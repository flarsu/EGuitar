import { useEffect, useRef } from 'react'
import { KEY_TO_POSITION, PLUCK_KEY_TO_STRING, VARIANT_KEY_TO_CHORD } from './keymap'
import type { ChordVariant } from '../music/theory'

export type PlayMode = 'lead' | 'chord'

export interface KeyboardHandlers {
  mode: PlayMode
  /**
   * muted = ⌥ Option held: palm mute in lead mode, chuck in chord mode.
   * slide = ⇧ Shift held: legato transitions glide instead of jumping.
   */
  pluck(code: string, muted: boolean, slide: boolean): void
  release(code: string): void
  shiftOctave(delta: number): void
  shiftWindow(delta: number): void
  toggleMode(): void
  selectChord(degree: number): void
  strum(direction: 'down' | 'up', muted: boolean): void
  changeKey(delta: number): void
  /** Fingerpick one string of the current chord (chord mode, Z–N keys). */
  pluckString(stringIndex: number, muted: boolean): void
  /** Change the chord shape/flavor (chord mode, Q row). */
  selectVariant(variant: ChordVariant): void
  /** ↑ held in lead mode: bend sounding notes up a whole step, release to fall back. */
  bend(on: boolean): void
  /** ↓ held in lead mode: vibrato on sounding notes. */
  vibrato(on: boolean): void
}

export function useGuitarKeyboard(handlers: KeyboardHandlers): void {
  const ref = useRef(handlers)
  ref.current = handlers

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const h = ref.current
      // Leave ⌘/Ctrl shortcuts (reload, devtools…) to the browser.
      if (e.metaKey || e.ctrlKey) return

      if (e.code === 'Tab') {
        e.preventDefault()
        if (!e.repeat) h.toggleMode()
        return
      }
      if (e.shiftKey && (e.code === 'ArrowUp' || e.code === 'ArrowDown')) {
        e.preventDefault()
        h.shiftOctave(e.code === 'ArrowUp' ? 1 : -1)
        return
      }
      if (e.code === 'BracketLeft' || e.code === 'BracketRight') {
        e.preventDefault()
        h.shiftWindow(e.code === 'BracketLeft' ? 1 : -1)
        return
      }

      if (h.mode === 'chord') {
        if (e.code === 'Space') {
          e.preventDefault()
          if (!e.repeat) h.strum('down', e.altKey)
          return
        }
        if (e.code === 'Enter') {
          e.preventDefault()
          if (!e.repeat) h.strum('up', e.altKey)
          return
        }
        if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
          e.preventDefault()
          h.changeKey(e.code === 'ArrowRight' ? 1 : -1)
          return
        }
        const variant = VARIANT_KEY_TO_CHORD[e.code]
        if (variant !== undefined) {
          e.preventDefault()
          if (!e.repeat) h.selectVariant(variant)
          return
        }
        const pluckString = PLUCK_KEY_TO_STRING[e.code]
        if (pluckString !== undefined) {
          e.preventDefault()
          if (!e.repeat) h.pluckString(pluckString, e.altKey)
          return
        }
        const pos = KEY_TO_POSITION[e.code]
        if (pos && pos.row === 0 && pos.fret < 7 && !e.repeat) {
          e.preventDefault()
          h.selectChord(pos.fret)
        }
        return
      }

      if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
        e.preventDefault()
        if (!e.repeat) {
          if (e.code === 'ArrowUp') h.bend(true)
          else h.vibrato(true)
        }
        return
      }

      if (e.repeat) return
      if (KEY_TO_POSITION[e.code]) {
        e.preventDefault()
        h.pluck(e.code, e.altKey, e.shiftKey)
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      const h = ref.current
      if (e.code === 'ArrowUp') {
        h.bend(false)
        return
      }
      if (e.code === 'ArrowDown') {
        h.vibrato(false)
        return
      }
      if (h.mode === 'lead' && KEY_TO_POSITION[e.code]) {
        h.release(e.code)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])
}
