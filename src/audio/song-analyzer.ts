import {
  computeChromagram,
  detectKeyKS,
  type KeyResult,
} from './chromagram'
import { NOTE_NAMES } from '../music/theory'

export interface BeatInfo {
  bpm: number
  intervalMs: number
  beats: number[]
  /** Beat energies (parallel to beats array) for accent analysis */
  beatEnergies: number[]
  confidence: number
}

export interface TimeSignature {
  beats: number
  noteValue: number
  label: string
  confidence: number
}

export interface BarInfo {
  totalBars: number
  barDurationMs: number
  /** Timestamps marking bar boundaries */
  barStarts: number[]
}

export interface ChordFamilyNote {
  degree: string
  name: string
  quality: 'major' | 'minor' | 'diminished'
}

export interface SongAnalysis {
  key: KeyResult
  chordFamily: ChordFamilyNote[]
  chromaSum: Float32Array
  duration: number
  beat: BeatInfo
  timeSignature: TimeSignature
  bars: BarInfo
}

export type AnalysisCallback = (update: {
  key: KeyResult | null
  elapsed: number
  currentBpm: number
  beatCount: number
}) => void

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11]
const DIATONIC_QUALITIES: ('major' | 'minor' | 'diminished')[] =
  ['major', 'minor', 'minor', 'major', 'major', 'minor', 'diminished']
const ROMAN_NUMERALS = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii\u00B0']

/**
 * Build the diatonic chord family for a given key root using the circle of fifths.
 * Returns the 7 diatonic chords with their Roman numeral degrees.
 */
function buildChordFamily(root: number, mode: 'major' | 'minor'): ChordFamilyNote[] {
  const scale = mode === 'major' ? MAJOR_SCALE : [0, 2, 3, 5, 7, 8, 10]
  const qualities: ('major' | 'minor' | 'diminished')[] = mode === 'major'
    ? DIATONIC_QUALITIES
    : ['minor', 'diminished', 'major', 'minor', 'minor', 'major', 'major']
  const numerals = mode === 'major'
    ? ROMAN_NUMERALS
    : ['i', 'ii\u00B0', 'III', 'iv', 'v', 'VI', 'VII']

  return scale.map((interval, i) => {
    const noteRoot = (root + interval) % 12
    const quality = qualities[i]
    const suffix = quality === 'minor' ? 'm' : quality === 'diminished' ? '\u00B0' : ''
    return {
      degree: numerals[i],
      name: NOTE_NAMES[noteRoot] + suffix,
      quality,
    }
  })
}

/**
 * Estimate time signature from beat accent patterns.
 * Analyzes energy groupings to distinguish 4/4, 3/4, 6/8, etc.
 */
function estimateTimeSignature(
  beatEnergies: number[],
  intervalMs: number,
): TimeSignature {
  if (beatEnergies.length < 8) {
    return { beats: 4, noteValue: 4, label: '4/4', confidence: 0.3 }
  }

  // Normalize energies
  const max = Math.max(...beatEnergies)
  if (max === 0) return { beats: 4, noteValue: 4, label: '4/4', confidence: 0.3 }
  const norm = beatEnergies.map(e => e / max)

  // Score groupings of 2, 3, and 4 by checking if every Nth beat is accented
  const scores: Record<number, number> = { 2: 0, 3: 0, 4: 0 }

  for (const groupSize of [2, 3, 4]) {
    let accentScore = 0
    let count = 0
    for (let i = 0; i < norm.length; i++) {
      if (i % groupSize === 0) {
        accentScore += norm[i]
      } else {
        accentScore -= norm[i] * 0.3
      }
      count++
    }
    scores[groupSize] = accentScore / count
  }

  // Also consider if beat interval suggests compound time (6/8 has shorter intervals)
  const is68Likely = intervalMs > 0 && intervalMs < 350

  let bestGroup = 4
  let bestScore = scores[4]

  if (scores[3] > bestScore * 1.1 || is68Likely) {
    bestGroup = 3
    bestScore = scores[3]
  }
  if (scores[2] > bestScore * 1.2) {
    bestGroup = 2
    bestScore = scores[2]
  }

  const confidence = Math.min(1, Math.max(0, bestScore))

  if (bestGroup === 3 && is68Likely) {
    return { beats: 6, noteValue: 8, label: '6/8', confidence }
  }
  if (bestGroup === 3) {
    return { beats: 3, noteValue: 4, label: '3/4', confidence }
  }
  if (bestGroup === 2) {
    return { beats: 2, noteValue: 4, label: '2/4', confidence }
  }
  return { beats: 4, noteValue: 4, label: '4/4', confidence }
}

export class SongAnalyzerEngine {
  private ctx: AudioContext | null = null
  private stream: MediaStream | null = null
  private raf = 0
  private startTime = 0
  private _running = false

  private chromaSum = new Float32Array(12)
  private frameCount = 0

  private onsetTimes: number[] = []
  private onsetEnergiesLog: number[] = []
  private currentBpm = 0
  private energyWindow: number[] = []
  private lastOnsetTime = 0

  get running(): boolean { return this._running }

  async start(onUpdate: AnalysisCallback): Promise<void> {
    if (this._running) return

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: true,
      },
    })

    const ctx = new AudioContext()
    const source = ctx.createMediaStreamSource(stream)

    // ── Vocal-reduction filter chain for chromagram analysis ──
    // Notch out the core vocal range (300–3000 Hz) so instruments
    // dominate the pitch-class energy used for key detection.
    const notch1 = ctx.createBiquadFilter()
    notch1.type = 'peaking'
    notch1.frequency.value = 800
    notch1.Q.value = 0.5
    notch1.gain.value = -18

    const notch2 = ctx.createBiquadFilter()
    notch2.type = 'peaking'
    notch2.frequency.value = 1800
    notch2.Q.value = 0.5
    notch2.gain.value = -18

    // Boost the bass range where root notes live
    const bassBoost = ctx.createBiquadFilter()
    bassBoost.type = 'lowshelf'
    bassBoost.frequency.value = 250
    bassBoost.gain.value = 6

    source.connect(notch1)
    notch1.connect(notch2)
    notch2.connect(bassBoost)

    const analyser = ctx.createAnalyser()
    analyser.fftSize = 8192
    analyser.smoothingTimeConstant = 0.4
    bassBoost.connect(analyser)

    // ── Beat detection: sub-bass only (kick drum range) ──
    const lowpass = ctx.createBiquadFilter()
    lowpass.type = 'lowpass'
    lowpass.frequency.value = 120
    lowpass.Q.value = 0.7
    source.connect(lowpass)

    const analyserBeat = ctx.createAnalyser()
    analyserBeat.fftSize = 2048
    analyserBeat.smoothingTimeConstant = 0.1
    lowpass.connect(analyserBeat)

    this.ctx = ctx
    this.stream = stream
    this.startTime = performance.now()
    this._running = true
    this.chromaSum = new Float32Array(12)
    this.frameCount = 0
    this.onsetTimes = []
    this.onsetEnergiesLog = []
    this.currentBpm = 0
    this.energyWindow = []
    this.lastOnsetTime = 0

    const magBuffer = new Float32Array(analyser.frequencyBinCount)
    const beatBuffer = new Float32Array(analyserBeat.fftSize)
    let prevBeatEnergy = 0

    const loop = () => {
      if (!this._running) return

      const elapsed = performance.now() - this.startTime
      this.frameCount++

      // Chromagram for key detection
      if (this.frameCount % 3 === 0) {
        analyser.getFloatFrequencyData(magBuffer)
        const linearMag = new Float32Array(magBuffer.length)
        for (let i = 0; i < magBuffer.length; i++) {
          linearMag[i] = Math.pow(10, magBuffer[i] / 20)
        }
        const chroma = computeChromagram(linearMag, ctx.sampleRate, analyser.fftSize, true)
        for (let i = 0; i < 12; i++) {
          this.chromaSum[i] += chroma[i]
        }
      }

      // Beat / onset detection
      analyserBeat.getFloatTimeDomainData(beatBuffer)
      let energy = 0
      for (let i = 0; i < beatBuffer.length; i++) {
        energy += beatBuffer[i] * beatBuffer[i]
      }
      energy = Math.sqrt(energy / beatBuffer.length)

      this.energyWindow.push(energy)
      if (this.energyWindow.length > 90) this.energyWindow.shift()

      const avgEnergy = this.energyWindow.reduce((a, b) => a + b, 0) / this.energyWindow.length
      const threshold = Math.max(avgEnergy * 1.8, 0.01)

      const minBeatInterval = 200
      if (
        energy > threshold &&
        energy > prevBeatEnergy * 1.3 &&
        elapsed - this.lastOnsetTime > minBeatInterval
      ) {
        this.onsetTimes.push(elapsed)
        this.onsetEnergiesLog.push(energy)
        this.lastOnsetTime = elapsed

        if (this.onsetTimes.length >= 4) {
          this.currentBpm = this.estimateBpm()
        }
      }
      prevBeatEnergy = energy

      // Key detection
      let key: KeyResult | null = null
      if (this.frameCount % 30 === 0 && this.frameCount > 30) {
        key = detectKeyKS(this.chromaSum)
      }

      onUpdate({
        key,
        elapsed,
        currentBpm: this.currentBpm,
        beatCount: this.onsetTimes.length,
      })

      this.raf = requestAnimationFrame(loop)
    }

    this.raf = requestAnimationFrame(loop)
  }

  private estimateBpm(): number {
    const times = this.onsetTimes
    if (times.length < 4) return 0

    const recent = times.slice(-30)
    const intervals: number[] = []
    for (let i = 1; i < recent.length; i++) {
      const dt = recent[i] - recent[i - 1]
      if (dt > 200 && dt < 2000) intervals.push(dt)
    }

    if (intervals.length < 3) return 0

    const binSize = 20
    const histogram = new Map<number, number>()
    for (const dt of intervals) {
      const bin = Math.round(dt / binSize) * binSize
      histogram.set(bin, (histogram.get(bin) ?? 0) + 1)
    }

    let bestBin = 0
    let bestCount = 0
    for (const [bin, count] of histogram) {
      if (count > bestCount) {
        bestCount = count
        bestBin = bin
      }
    }

    if (bestBin === 0) return 0

    const tolerance = binSize * 1.5
    let sum = 0
    let count = 0
    for (const dt of intervals) {
      if (Math.abs(dt - bestBin) <= tolerance) {
        sum += dt
        count++
      }
    }

    return Math.round(60000 / (sum / count))
  }

  stop(): SongAnalysis {
    this._running = false
    cancelAnimationFrame(this.raf)
    this.stream?.getTracks().forEach(t => t.stop())
    this.ctx?.close()

    const duration = performance.now() - this.startTime
    const key = detectKeyKS(this.chromaSum)

    const bpm = this.onsetTimes.length >= 4 ? this.estimateBpm() : 0
    const intervalMs = bpm > 0 ? Math.round(60000 / bpm) : 0

    let confidence = 0
    if (bpm > 0 && this.onsetTimes.length >= 4) {
      const intervals: number[] = []
      for (let i = 1; i < this.onsetTimes.length; i++) {
        const dt = this.onsetTimes[i] - this.onsetTimes[i - 1]
        if (dt > 200 && dt < 2000) intervals.push(dt)
      }
      if (intervals.length > 2) {
        const nearTarget = intervals.filter(dt => Math.abs(dt - intervalMs) < 40)
        confidence = nearTarget.length / intervals.length
      }
    }

    const timeSignature = estimateTimeSignature(this.onsetEnergiesLog, intervalMs)
    const chordFamily = buildChordFamily(key.root, key.mode)

    // Calculate bars
    const beatsPerBar = timeSignature.beats
    const barDurationMs = intervalMs * beatsPerBar
    const totalBars = barDurationMs > 0 ? Math.floor(duration / barDurationMs) : 0
    const barStarts: number[] = []
    if (barDurationMs > 0) {
      for (let t = 0; t < duration; t += barDurationMs) {
        barStarts.push(t)
      }
    }

    return {
      key,
      chordFamily,
      chromaSum: new Float32Array(this.chromaSum),
      duration,
      beat: {
        bpm,
        intervalMs,
        beats: [...this.onsetTimes],
        beatEnergies: [...this.onsetEnergiesLog],
        confidence,
      },
      timeSignature,
      bars: {
        totalBars,
        barDurationMs,
        barStarts,
      },
    }
  }
}
