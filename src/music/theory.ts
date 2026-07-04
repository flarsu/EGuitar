export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export interface StringDef {
  name: string
  midi: number
}

// Standard tuning, highest string first (index 0 = high e), matching tab orientation.
export const STANDARD_TUNING: StringDef[] = [
  { name: 'e', midi: 64 },
  { name: 'B', midi: 59 },
  { name: 'G', midi: 55 },
  { name: 'D', midi: 50 },
  { name: 'A', midi: 45 },
  { name: 'E', midi: 40 },
]

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

export function midiToName(midi: number): string {
  return NOTE_NAMES[midi % 12] + String(Math.floor(midi / 12) - 1)
}

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11]

type ChordQuality =
  | 'maj'
  | 'min'
  | 'dim'
  | 'sus2'
  | 'sus4'
  | '7'
  | 'maj7'
  | 'm7'
  | 'add9'
  | '6'

/** 'auto' = the triad the key dictates; anything else overrides the quality. */
export type ChordVariant = 'auto' | Exclude<ChordQuality, 'dim'>

const DIATONIC_QUALITIES: ChordQuality[] = ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim']

export const DIATONIC_ROMAN = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']

// Guitar-style 6-note voicings as semitone intervals from the root
// (root, fifth, octave, color tones spread above — like strummed open shapes).
const VOICINGS: Record<ChordQuality, number[]> = {
  maj: [0, 7, 12, 16, 19, 24],
  min: [0, 7, 12, 15, 19, 24],
  dim: [0, 6, 12, 15, 18, 24],
  sus2: [0, 7, 12, 14, 19, 24],
  sus4: [0, 7, 12, 17, 19, 24],
  '7': [0, 7, 10, 16, 19, 24],
  maj7: [0, 7, 11, 16, 19, 24],
  m7: [0, 7, 10, 15, 19, 24],
  add9: [0, 7, 12, 16, 19, 26],
  '6': [0, 7, 12, 16, 21, 24],
}

const SUFFIXES: Record<ChordQuality, string> = {
  maj: '',
  min: 'm',
  dim: '°',
  sus2: 'sus2',
  sus4: 'sus4',
  '7': '7',
  maj7: 'maj7',
  m7: 'm7',
  add9: 'add9',
  '6': '6',
}

export interface Chord {
  name: string
  /** Voicing notes, ascending — lowest note belongs on the lowest string. */
  midis: number[]
}

export function diatonicChord(
  keyRoot: number,
  degree: number,
  variant: ChordVariant = 'auto',
): Chord {
  const rootPc = (keyRoot + MAJOR_SCALE[degree]) % 12
  // Place the chord root in the guitar's low register, E2 (40) to D#3 (51).
  const root = 40 + ((rootPc - 4 + 12) % 12)
  const quality: ChordQuality = variant === 'auto' ? DIATONIC_QUALITIES[degree] : variant
  return {
    name: NOTE_NAMES[rootPc] + SUFFIXES[quality],
    midis: VOICINGS[quality].map((interval) => root + interval),
  }
}
