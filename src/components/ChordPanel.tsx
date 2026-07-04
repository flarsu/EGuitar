import type { PointerEvent } from 'react'
import { DIATONIC_ROMAN, diatonicChord, midiToName, type ChordVariant } from '../music/theory'
import { PLUCK_KEY_TO_STRING, VARIANT_KEY_TO_CHORD, KEY_LABELS } from '../input/keymap'

interface Props {
  keyRoot: number
  chordDegree: number
  chordVariant: ChordVariant
  pluckedStrings: Set<number>
  octave: number
  onSelectChord(degree: number): void
  onSelectVariant(variant: ChordVariant): void
  onPluckString(stringIndex: number): void
  onStrum(direction: 'down' | 'up', muted?: boolean): void
}

// Pluck keys ordered left→right as low E → high e, matching the keyboard row.
const PLUCK_KEYS = Object.entries(PLUCK_KEY_TO_STRING).sort((a, b) => b[1] - a[1])
const VARIANT_KEYS = Object.entries(VARIANT_KEY_TO_CHORD)

export function ChordPanel({
  keyRoot,
  chordDegree,
  chordVariant,
  pluckedStrings,
  octave,
  onSelectChord,
  onSelectVariant,
  onPluckString,
  onStrum,
}: Props) {
  const chord = diatonicChord(keyRoot, chordDegree, chordVariant)
  const press = (e: PointerEvent, action: () => void) => {
    e.preventDefault()
    action()
  }
  return (
    <main className="chord-panel">
      <div className="chord-grid">
        {DIATONIC_ROMAN.map((roman, degree) => {
          const card = diatonicChord(keyRoot, degree, chordVariant)
          return (
            <button
              key={roman}
              className={'chord-card' + (degree === chordDegree ? ' selected' : '')}
              onPointerDown={(e) => press(e, () => onSelectChord(degree))}
            >
              <span className="chord-hotkey">{degree + 1}</span>
              <span className="chord-name">{card.name}</span>
              <span className="chord-roman">{roman}</span>
            </button>
          )
        })}
      </div>
      <div className="pluck-row">
        <span className="pluck-label">shape</span>
        {VARIANT_KEYS.map(([code, variant]) => (
          <button
            key={code}
            className={'variant-key' + (variant === chordVariant ? ' active' : '')}
            onPointerDown={(e) => press(e, () => onSelectVariant(variant))}
          >
            <span className="key-label">{KEY_LABELS[code]}</span>
            <span className="note-label">{variant === 'auto' ? 'key' : variant}</span>
          </button>
        ))}
      </div>
      <div className="pluck-row">
        <span className="pluck-label">pluck</span>
        {PLUCK_KEYS.map(([code, stringIndex]) => {
          const midi = chord.midis[5 - stringIndex] + 12 * octave
          const active = pluckedStrings.has(stringIndex)
          return (
            <button
              key={code}
              className={'pluck-key' + (active ? ' active' : '')}
              onPointerDown={(e) => press(e, () => onPluckString(stringIndex))}
              onContextMenu={(e) => e.preventDefault()}
            >
              <span className="key-label">{KEY_LABELS[code]}</span>
              <span className="note-label">{midiToName(midi)}</span>
            </button>
          )
        })}
      </div>
      <div className="pluck-row">
        <span className="pluck-label">strum</span>
        <button className="strum-btn" onPointerDown={(e) => press(e, () => onStrum('down'))}>
          ↓ down
        </button>
        <button className="strum-btn" onPointerDown={(e) => press(e, () => onStrum('up'))}>
          ↑ up
        </button>
        <button
          className="strum-btn"
          onPointerDown={(e) => press(e, () => onStrum('down', true))}
        >
          ✕ chuck
        </button>
      </div>
      <p className="chord-help">
        <kbd>1</kbd>–<kbd>7</kbd> pick a chord (strums it) · <kbd>Q</kbd>–<kbd>P</kbd> chord shape ·{' '}
        <kbd>space</kbd> strum down · <kbd>⏎</kbd> strum up · <kbd>⌥</kbd>+<kbd>space</kbd> chuck ·{' '}
        <kbd>Z</kbd>–<kbd>N</kbd> pluck strings · <kbd>←</kbd>/<kbd>→</kbd> change key
      </p>
    </main>
  )
}
