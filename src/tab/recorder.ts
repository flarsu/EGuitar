import { midiToName, STANDARD_TUNING } from '../music/theory'
import type { TabEvent, TabSheet } from './types'

export class TabRecorder {
  private events: TabEvent[] = []
  private startTime = 0
  private _recording = false

  get recording(): boolean {
    return this._recording
  }

  start(): void {
    this.events = []
    this.startTime = performance.now()
    this._recording = true
  }

  stop(): TabSheet {
    this._recording = false
    const duration = performance.now() - this.startTime
    return {
      createdAt: Date.now(),
      duration,
      source: 'keyboard',
      events: [...this.events],
    }
  }

  recordPluck(stringIndex: number, fret: number, midi: number, muted: boolean): void {
    if (!this._recording) return
    this.events.push({
      time: performance.now() - this.startTime,
      type: 'pluck',
      stringIndex,
      fret,
      midi,
      noteName: midiToName(midi),
      muted,
    })
  }

  recordRelease(stringIndex: number, midi: number): void {
    if (!this._recording) return
    const fret = midi - STANDARD_TUNING[stringIndex].midi
    this.events.push({
      time: performance.now() - this.startTime,
      type: 'release',
      stringIndex,
      fret: Math.max(0, fret),
      midi,
      noteName: midiToName(midi),
      muted: false,
    })
  }
}
