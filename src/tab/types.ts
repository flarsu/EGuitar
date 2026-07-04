export interface TabEvent {
  /** Milliseconds since recording started */
  time: number
  type: 'pluck' | 'release'
  /** Guitar string index (0 = high e, 5 = low E) */
  stringIndex: number
  /** Fret number (0 = open) */
  fret: number
  /** MIDI note number */
  midi: number
  /** Note name like "E4" */
  noteName: string
  /** Was this a palm-muted note? */
  muted: boolean
}

export interface TabSheet {
  /** When the recording was created */
  createdAt: number
  /** Total duration in ms */
  duration: number
  /** Detected key root (0-11, C=0), if available */
  keyRoot?: number
  /** Detected chord family name, if available */
  chordFamily?: string
  /** Source: 'keyboard' from user playing, 'mic' from microphone detection */
  source: 'keyboard' | 'mic'
  events: TabEvent[]
}

export interface ChordHit {
  time: number
  name: string
  notes: number[]
}
