export interface VoiceHandle {
  /** Damp the note like lifting a finger off the string. */
  stop(): void
  /** Glide the pitch by the given semitone offset (0 releases the bend). */
  bend(semitones: number, glide?: number): void
  /** Toggle a pitch LFO (~5.5 Hz, ±25 cents) on the sounding note. */
  setVibrato(on: boolean): void
  /** Scale the voice's gain — legato transitions lose a little energy. */
  dampen(factor: number): void
}

export interface SoundEngine {
  /** muted = palm mute / chuck: short percussive decay with rolled-off highs. */
  pluck(midi: number, velocity?: number, muted?: boolean): VoiceHandle
  /** Resolves when the engine can produce sound (samplers need to load assets). */
  ready(): Promise<void>
}
