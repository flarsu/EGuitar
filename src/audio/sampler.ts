import { getAudio } from './context'
import { BufferVoice } from './buffer-voice'
import type { SoundEngine, VoiceHandle } from './types'
import e2 from '../assets/samples/guitar-acoustic/E2.mp3'
import g2 from '../assets/samples/guitar-acoustic/G2.mp3'
import as2 from '../assets/samples/guitar-acoustic/As2.mp3'
import cs3 from '../assets/samples/guitar-acoustic/Cs3.mp3'
import e3 from '../assets/samples/guitar-acoustic/E3.mp3'
import g3 from '../assets/samples/guitar-acoustic/G3.mp3'
import as3 from '../assets/samples/guitar-acoustic/As3.mp3'
import cs4 from '../assets/samples/guitar-acoustic/Cs4.mp3'
import e4 from '../assets/samples/guitar-acoustic/E4.mp3'
import g4 from '../assets/samples/guitar-acoustic/G4.mp3'
import as4 from '../assets/samples/guitar-acoustic/As4.mp3'
import c5 from '../assets/samples/guitar-acoustic/C5.mp3'

// Recorded acoustic guitar, one sample every 3 semitones (tonejs-instruments, CC-BY).
// Notes in between are pitch-shifted via playbackRate, so the shift never
// exceeds 1.5 semitones and stays inaudible as an artifact.
const SAMPLE_URLS: { midi: number; url: string }[] = [
  { midi: 40, url: e2 },
  { midi: 43, url: g2 },
  { midi: 46, url: as2 },
  { midi: 49, url: cs3 },
  { midi: 52, url: e3 },
  { midi: 55, url: g3 },
  { midi: 58, url: as3 },
  { midi: 61, url: cs4 },
  { midi: 64, url: e4 },
  { midi: 67, url: g4 },
  { midi: 70, url: as4 },
  { midi: 72, url: c5 },
]

const SILENT_VOICE: VoiceHandle = { stop() {}, bend() {}, setVibrato() {}, dampen() {} }

export class SamplerEngine implements SoundEngine {
  private samples: { midi: number; buffer: AudioBuffer }[] = []
  private loading: Promise<void> | null = null

  ready(): Promise<void> {
    this.loading ??= this.load()
    return this.loading
  }

  private async load(): Promise<void> {
    const { ctx } = getAudio()
    this.samples = await Promise.all(
      SAMPLE_URLS.map(async ({ midi, url }) => {
        const response = await fetch(url)
        const data = await response.arrayBuffer()
        return { midi, buffer: await ctx.decodeAudioData(data) }
      }),
    )
  }

  pluck(midi: number, velocity = 1, muted = false): VoiceHandle {
    if (this.samples.length === 0) return SILENT_VOICE
    const { ctx, master } = getAudio()

    let nearest = this.samples[0]
    for (const sample of this.samples) {
      if (Math.abs(sample.midi - midi) < Math.abs(nearest.midi - midi)) {
        nearest = sample
      }
    }

    const source = ctx.createBufferSource()
    source.buffer = nearest.buffer
    source.playbackRate.value = Math.pow(2, (midi - nearest.midi) / 12)
    const gain = ctx.createGain()
    gain.gain.value = 0.9 * velocity
    let head: AudioNode = source
    if (muted) {
      // Samples can't be re-recorded muted, so fake it: chop the tail with a
      // fast envelope and roll off the highs.
      const lowpass = ctx.createBiquadFilter()
      lowpass.type = 'lowpass'
      lowpass.frequency.value = 1400
      source.connect(lowpass)
      head = lowpass
      gain.gain.setTargetAtTime(0, ctx.currentTime + 0.03, 0.07)
      source.stop(ctx.currentTime + 0.6)
    }
    head.connect(gain)
    gain.connect(master)
    source.start()
    return new BufferVoice(ctx, gain, source, source.playbackRate.value)
  }
}
