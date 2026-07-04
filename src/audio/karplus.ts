import { getAudio } from './context'
import { BufferVoice } from './buffer-voice'
import { midiToFreq } from '../music/theory'
import type { SoundEngine, VoiceHandle } from './types'

const RING_SECONDS = 3.5

// Karplus-Strong: a burst of noise circulating through a delay line the length of
// one period, averaged each pass. The averaging acts as a lowpass, so high
// harmonics die first and the tone mellows exactly like a real plucked string.
// A palm-muted string is the same physics with much heavier damping.
function renderPluck(ctx: AudioContext, freq: number, decay: number): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const length = Math.floor(sampleRate * RING_SECONDS)
  const buffer = ctx.createBuffer(1, length, sampleRate)
  const out = buffer.getChannelData(0)

  const period = Math.max(2, Math.round(sampleRate / freq))
  const delay = new Float32Array(period)
  for (let i = 0; i < period; i++) {
    delay[i] = Math.random() * 2 - 1
  }

  let idx = 0
  for (let i = 0; i < length; i++) {
    const current = delay[idx]
    const next = delay[(idx + 1) % period]
    out[i] = current
    delay[idx] = decay * 0.5 * (current + next)
    idx = (idx + 1) % period
  }
  return buffer
}

export class KarplusStrongEngine implements SoundEngine {
  pluck(midi: number, velocity = 1, muted = false): VoiceHandle {
    const { ctx, master } = getAudio()
    const source = ctx.createBufferSource()
    source.buffer = renderPluck(ctx, midiToFreq(midi), muted ? 0.97 : 0.996)
    const gain = ctx.createGain()
    gain.gain.value = 0.35 * velocity
    let head: AudioNode = source
    if (muted) {
      const lowpass = ctx.createBiquadFilter()
      lowpass.type = 'lowpass'
      lowpass.frequency.value = 1400
      source.connect(lowpass)
      head = lowpass
    }
    head.connect(gain)
    gain.connect(master)
    source.start()
    return new BufferVoice(ctx, gain, source)
  }

  async ready(): Promise<void> {}
}
