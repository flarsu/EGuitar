import { STANDARD_TUNING, NOTE_NAMES } from '../music/theory'

/**
 * YIN-style autocorrelation pitch detector.
 * Returns the detected frequency in Hz, or 0 if no clear pitch is found.
 */
export function detectPitch(buffer: Float32Array, sampleRate: number): number {
  const threshold = 0.15
  const halfLen = Math.floor(buffer.length / 2)

  // Cumulative mean normalized difference function
  const d = new Float32Array(halfLen)
  d[0] = 1

  let runningSum = 0
  for (let tau = 1; tau < halfLen; tau++) {
    let sum = 0
    for (let i = 0; i < halfLen; i++) {
      const diff = buffer[i] - buffer[i + tau]
      sum += diff * diff
    }
    runningSum += sum
    d[tau] = sum * tau / runningSum
  }

  // Find the first dip below threshold
  let tau = 2
  while (tau < halfLen) {
    if (d[tau] < threshold) {
      // Walk to the local minimum
      while (tau + 1 < halfLen && d[tau + 1] < d[tau]) tau++
      break
    }
    tau++
  }

  if (tau === halfLen) return 0

  // Parabolic interpolation for sub-sample accuracy
  const s0 = d[tau - 1]
  const s1 = d[tau]
  const s2 = d[tau + 1] ?? d[tau]
  const betterTau = tau + (s0 - s2) / (2 * (s0 - 2 * s1 + s2))

  return sampleRate / betterTau
}

export function freqToMidi(freq: number): number {
  return Math.round(69 + 12 * Math.log2(freq / 440))
}

export function midiToNoteName(midi: number): string {
  return NOTE_NAMES[midi % 12] + String(Math.floor(midi / 12) - 1)
}

/**
 * Given a MIDI note, find the best string + fret combination on standard tuning.
 * Prefers lower fret positions.
 */
export function midiToStringFret(midi: number): { stringIndex: number; fret: number } | null {
  let best: { stringIndex: number; fret: number } | null = null
  let bestFret = 999

  for (let i = 0; i < STANDARD_TUNING.length; i++) {
    const fret = midi - STANDARD_TUNING[i].midi
    if (fret >= 0 && fret <= 24 && fret < bestFret) {
      bestFret = fret
      best = { stringIndex: i, fret }
    }
  }

  return best
}

/**
 * Given a set of MIDI notes sounding together, try to identify the chord.
 */
export function identifyChord(midis: number[]): string | null {
  if (midis.length < 2) return null

  const pitchClasses = [...new Set(midis.map(m => m % 12))].sort((a, b) => a - b)
  if (pitchClasses.length < 2) return null

  const CHORD_PATTERNS: [string, number[]][] = [
    ['maj', [0, 4, 7]],
    ['min', [0, 3, 7]],
    ['7', [0, 4, 7, 10]],
    ['maj7', [0, 4, 7, 11]],
    ['m7', [0, 3, 7, 10]],
    ['dim', [0, 3, 6]],
    ['aug', [0, 4, 8]],
    ['sus2', [0, 2, 7]],
    ['sus4', [0, 5, 7]],
    ['5', [0, 7]],
  ]

  for (const root of pitchClasses) {
    const intervals = pitchClasses.map(pc => (pc - root + 12) % 12).sort((a, b) => a - b)

    for (const [suffix, pattern] of CHORD_PATTERNS) {
      if (pattern.length > intervals.length) continue
      const match = pattern.every(p => intervals.includes(p))
      if (match) {
        const name = NOTE_NAMES[root] + (suffix === 'maj' ? '' : suffix)
        return name
      }
    }
  }

  return null
}

/**
 * Detect the likely key from a collection of pitch classes.
 */
export function detectKey(pitchClasses: number[]): { root: number; name: string } | null {
  if (pitchClasses.length < 3) return null

  const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11]
  const unique = [...new Set(pitchClasses)]
  let bestRoot = 0
  let bestScore = 0

  for (let root = 0; root < 12; root++) {
    const scaleNotes = MAJOR_SCALE.map(interval => (root + interval) % 12)
    const score = unique.filter(pc => scaleNotes.includes(pc)).length
    if (score > bestScore) {
      bestScore = score
      bestRoot = root
    }
  }

  if (bestScore < 3) return null
  return { root: bestRoot, name: NOTE_NAMES[bestRoot] }
}

/** Check if the signal has enough energy to be worth analyzing. */
export function hasSignal(buffer: Float32Array, threshold = 0.01): boolean {
  let rms = 0
  for (let i = 0; i < buffer.length; i++) {
    rms += buffer[i] * buffer[i]
  }
  rms = Math.sqrt(rms / buffer.length)
  return rms > threshold
}
