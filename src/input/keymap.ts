import type { ChordVariant } from '../music/theory'

// Physical key codes (layout-independent) — row = string, column = fret.
export const ROWS: string[][] = [
  ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'],
  ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP'],
  ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon'],
  ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash'],
]

export const KEY_LABELS: Record<string, string> = {
  Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4', Digit5: '5',
  Digit6: '6', Digit7: '7', Digit8: '8', Digit9: '9', Digit0: '0',
  KeyQ: 'Q', KeyW: 'W', KeyE: 'E', KeyR: 'R', KeyT: 'T',
  KeyY: 'Y', KeyU: 'U', KeyI: 'I', KeyO: 'O', KeyP: 'P',
  KeyA: 'A', KeyS: 'S', KeyD: 'D', KeyF: 'F', KeyG: 'G',
  KeyH: 'H', KeyJ: 'J', KeyK: 'K', KeyL: 'L', Semicolon: ';',
  KeyZ: 'Z', KeyX: 'X', KeyC: 'C', KeyV: 'V', KeyB: 'B',
  KeyN: 'N', KeyM: 'M', Comma: ',', Period: '.', Slash: '/',
}

export interface KeyPosition {
  row: number
  fret: number
}

export const KEY_TO_POSITION: Record<string, KeyPosition> = {}
ROWS.forEach((rowKeys, row) =>
  rowKeys.forEach((code, fret) => {
    KEY_TO_POSITION[code] = { row, fret }
  }),
)

// Chord-mode shapes: the Q row picks the chord flavor applied to the selected
// degree's root. 'auto' = whatever triad the key dictates.
export const VARIANT_KEY_TO_CHORD: Record<string, ChordVariant> = {
  KeyQ: 'auto',
  KeyW: 'sus2',
  KeyE: 'sus4',
  KeyR: '7',
  KeyT: 'maj7',
  KeyY: 'm7',
  KeyU: 'add9',
  KeyI: '6',
  KeyO: 'maj',
  KeyP: 'min',
}

// Chord-mode fingerpicking: bottom row = picking hand, low E string on the
// left. Values are string indexes (5 = low E … 0 = high e).
export const PLUCK_KEY_TO_STRING: Record<string, number> = {
  KeyZ: 5,
  KeyX: 4,
  KeyC: 3,
  KeyV: 2,
  KeyB: 1,
  KeyN: 0,
}
