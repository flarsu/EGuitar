import type { TabSheet } from './types'

export type PlaybackCallback = (eventIndex: number) => void
export type PlaybackDoneCallback = () => void

export class TabPlayer {
  private timers: ReturnType<typeof setTimeout>[] = []
  private _playing = false
  private onEvent: PlaybackCallback | null = null
  private onDone: PlaybackDoneCallback | null = null

  get playing(): boolean {
    return this._playing
  }

  play(
    sheet: TabSheet,
    onEvent: PlaybackCallback,
    onDone: PlaybackDoneCallback,
  ): void {
    this.stop()
    this._playing = true
    this.onEvent = onEvent
    this.onDone = onDone

    sheet.events.forEach((event, i) => {
      const timer = setTimeout(() => {
        if (!this._playing) return
        this.onEvent?.(i)
      }, event.time)
      this.timers.push(timer)
    })

    const endTimer = setTimeout(() => {
      if (!this._playing) return
      this._playing = false
      this.onDone?.()
    }, sheet.duration + 100)
    this.timers.push(endTimer)
  }

  stop(): void {
    this._playing = false
    for (const t of this.timers) clearTimeout(t)
    this.timers = []
    this.onEvent = null
    this.onDone = null
  }
}
