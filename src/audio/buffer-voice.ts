import type { VoiceHandle } from './types'

// Shared by both engines: a playing buffer whose stop() damps the note with a
// quick gain fade. Pitch expression (bend, vibrato) rides on playbackRate,
// which shifts pitch identically for synthesized and sampled buffers.
export class BufferVoice implements VoiceHandle {
  private stopped = false
  private lfo: OscillatorNode | null = null
  private lfoGain: GainNode | null = null

  constructor(
    private ctx: AudioContext,
    private gain: GainNode,
    private source: AudioBufferSourceNode,
    private baseRate = 1,
  ) {}

  bend(semitones: number, glide = 0.12): void {
    if (this.stopped) return
    const rate = this.source.playbackRate
    const now = this.ctx.currentTime
    rate.cancelScheduledValues(now)
    rate.setValueAtTime(rate.value, now)
    rate.linearRampToValueAtTime(this.baseRate * Math.pow(2, semitones / 12), now + glide)
  }

  setVibrato(on: boolean): void {
    if (this.stopped) return
    if (on && !this.lfo) {
      this.lfo = this.ctx.createOscillator()
      this.lfo.frequency.value = 5.5
      this.lfoGain = this.ctx.createGain()
      this.lfoGain.gain.value = this.baseRate * 0.015
      this.lfo.connect(this.lfoGain)
      this.lfoGain.connect(this.source.playbackRate)
      this.lfo.start()
    } else if (!on && this.lfo) {
      this.lfo.stop()
      this.lfo.disconnect()
      this.lfoGain?.disconnect()
      this.lfo = null
      this.lfoGain = null
    }
  }

  dampen(factor: number): void {
    if (this.stopped) return
    this.gain.gain.value *= factor
  }

  stop(): void {
    if (this.stopped) return
    this.setVibrato(false)
    this.stopped = true
    const now = this.ctx.currentTime
    this.gain.gain.cancelScheduledValues(now)
    this.gain.gain.setTargetAtTime(0, now, 0.04)
    this.source.stop(now + 0.3)
  }
}
