import type { SoundEngine, VoiceHandle } from './types'

interface StringEntry {
  key: string
  voice: VoiceHandle
  /** midi the voice was plucked at — legato offsets are relative to this. */
  midi: number
  /** current legato offset (hammer-on/pull-off/slide) in semitones. */
  offset: number
}

// Tracks sounding notes so that (a) releasing a key damps its own note and
// (b) plucking a string that is already ringing silences the old note first,
// the way a real string can only sound one pitch at a time.
export class VoiceManager {
  private byKey = new Map<string, VoiceHandle>()
  private byString = new Map<number, StringEntry>()
  private bendSemitones = 0
  private vibrato = false

  /** Bend every sounding note; new plucks inherit the bend while it's held. */
  setBend(semitones: number): void {
    this.bendSemitones = semitones
    for (const entry of this.byString.values()) {
      entry.voice.bend(entry.offset + semitones)
    }
  }

  setVibrato(on: boolean): void {
    this.vibrato = on
    for (const voice of this.byKey.values()) {
      voice.setVibrato(on)
    }
  }

  pluck(
    engine: SoundEngine,
    key: string,
    stringIndex: number,
    midi: number,
    velocity = 1,
    muted = false,
  ): void {
    const previous = this.byString.get(stringIndex)
    if (previous) {
      previous.voice.stop()
      this.byKey.delete(previous.key)
    }
    const voice = engine.pluck(midi, velocity, muted)
    if (this.bendSemitones !== 0) voice.bend(this.bendSemitones, 0.01)
    if (this.vibrato) voice.setVibrato(true)
    this.byKey.set(key, voice)
    this.byString.set(stringIndex, { key, voice, midi, offset: 0 })
  }

  /**
   * Hammer-on, pull-off, or slide: retune the ringing voice on a string to a
   * new pitch without a fresh pluck attack. Ownership moves to newKey so its
   * key-up controls the note from here on.
   */
  legato(stringIndex: number, newKey: string, targetMidi: number, glide: number): void {
    const entry = this.byString.get(stringIndex)
    if (!entry) return
    this.byKey.delete(entry.key)
    entry.key = newKey
    entry.offset = targetMidi - entry.midi
    entry.voice.bend(entry.offset + this.bendSemitones, glide)
    entry.voice.dampen(0.92)
    this.byKey.set(newKey, entry.voice)
  }

  releaseAll(): void {
    for (const voice of this.byKey.values()) {
      voice.stop()
    }
    this.byKey.clear()
    this.byString.clear()
  }

  release(key: string): void {
    const voice = this.byKey.get(key)
    if (!voice) return
    voice.stop()
    this.byKey.delete(key)
    for (const [stringIndex, entry] of this.byString) {
      if (entry.key === key) {
        this.byString.delete(stringIndex)
      }
    }
  }
}
