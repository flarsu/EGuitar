import type { PointerEvent } from 'react'
import { ROWS, KEY_LABELS } from '../input/keymap'
import { STANDARD_TUNING, midiToName } from '../music/theory'

interface Props {
  windowOffset: number
  octave: number
  activeKeys: Set<string>
  onPluck(code: string): void
  onRelease(code: string): void
}

export function Fretboard({ windowOffset, octave, activeKeys, onPluck, onRelease }: Props) {
  const press = (e: PointerEvent, code: string) => {
    e.preventDefault()
    onPluck(code)
  }
  return (
    <main className="fretboard">
      <div className="fret-numbers">
        <span />
        {Array.from({ length: 10 }, (_, fret) => (
          <span key={fret}>{fret === 0 ? 'open' : fret}</span>
        ))}
      </div>
      {ROWS.map((rowKeys, row) => {
        const stringIndex = windowOffset + row
        const string = STANDARD_TUNING[stringIndex]
        const ringing = rowKeys.some((code) => activeKeys.has(code))
        return (
          <div className={'string-row' + (ringing ? ' ringing' : '')} key={string.name}>
            <span className="string-label">{string.name}</span>
            <div
              className="string-line"
              style={{ height: `${1 + stringIndex * 0.4}px` }}
            />
            {rowKeys.map((code, fret) => {
              const midi = string.midi + fret + 12 * octave
              const active = activeKeys.has(code)
              return (
                <button
                  key={code}
                  className={'keycap' + (active ? ' active' : '')}
                  onPointerDown={(e) => press(e, code)}
                  onPointerUp={() => onRelease(code)}
                  onPointerLeave={() => onRelease(code)}
                  onPointerCancel={() => onRelease(code)}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <span className="key-label">{KEY_LABELS[code]}</span>
                  <span className="note-label">{midiToName(midi)}</span>
                </button>
              )
            })}
          </div>
        )
      })}
    </main>
  )
}
