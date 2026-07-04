import { useEffect, useRef, useState } from 'react'
import { Controls } from './components/Controls'
import { Fretboard } from './components/Fretboard'
import { ChordPanel } from './components/ChordPanel'
import { KeyboardHints } from './components/KeyboardHints'
import { useGuitarKeyboard, type PlayMode } from './input/keyboard'
import { KEY_TO_POSITION } from './input/keymap'
import { STANDARD_TUNING, diatonicChord, type ChordVariant } from './music/theory'
import { KarplusStrongEngine } from './audio/karplus'
import { SamplerEngine } from './audio/sampler'
import { VoiceManager } from './audio/voices'
import { setMasterVolume, setTonePreset, type TonePreset } from './audio/context'
import './App.css'

const SETTINGS_KEY = 'eguitar-settings'

interface SavedSettings {
  octave: number
  windowOffset: number
  volume: number
  engineId: EngineId
  mode: PlayMode
  keyRoot: number
  preset: TonePreset
}

function loadSettings(): Partial<SavedSettings> {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<SavedSettings>
  } catch {
    return {}
  }
}

const saved = loadSettings()

const MIN_OCTAVE = -2
const MAX_OCTAVE = 2
// Window can slide from strings e-B-G-D (offset 0) down to G-D-A-E (offset 2).
const MAX_WINDOW = STANDARD_TUNING.length - 4

export type EngineId = 'synth' | 'acoustic'
export type SamplerState = 'idle' | 'loading' | 'ready' | 'failed'

const engines: Record<EngineId, KarplusStrongEngine | SamplerEngine> = {
  synth: new KarplusStrongEngine(),
  acoustic: new SamplerEngine(),
}
const voices = new VoiceManager()

export default function App() {
  const [octave, setOctave] = useState(saved.octave ?? 0)
  const [windowOffset, setWindowOffset] = useState(saved.windowOffset ?? 0)
  const [volume, setVolume] = useState(saved.volume ?? 0.8)
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set())
  const [engineId, setEngineId] = useState<EngineId>('synth')
  const [samplerState, setSamplerState] = useState<SamplerState>('idle')
  const [mode, setMode] = useState<PlayMode>(saved.mode ?? 'lead')
  const [keyRoot, setKeyRoot] = useState(saved.keyRoot ?? 0)
  const [chordDegree, setChordDegree] = useState(0)
  const [chordVariant, setChordVariant] = useState<ChordVariant>('auto')
  const [preset, setPreset] = useState<TonePreset>(saved.preset ?? 'acoustic')
  const [pluckedStrings, setPluckedStrings] = useState<Set<number>>(new Set())

  // Per-string stacks of physically held keys (press order), like fingers on a
  // fretboard: pressing onto a fingered string = hammer-on/slide, releasing the
  // top key while a lower finger remains = pull-off back to it.
  const heldStrings = useRef(new Map<number, { code: string; midi: number }[]>())
  const keyString = useRef(new Map<string, number>())

  const booted = useRef(false)
  useEffect(() => {
    setMasterVolume(volume)
    setTonePreset(preset)
    if (!booted.current && saved.engineId === 'acoustic') {
      booted.current = true
      selectEngine('acoustic')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ octave, windowOffset, volume, engineId, mode, keyRoot, preset }),
    )
  }, [octave, windowOffset, volume, engineId, mode, keyRoot, preset])

  const strumChord = (
    degree: number,
    direction: 'down' | 'up',
    muted = false,
    variant: ChordVariant = chordVariant,
  ) => {
    const chord = diatonicChord(keyRoot, degree, variant)
    const count = chord.midis.length
    // A chuck is a tighter, faster sweep than an open strum.
    const step = muted ? 10 : 18
    chord.midis.forEach((midi, i) => {
      // Down-strums hit the low strings first, like a real pick sweep.
      const delay = direction === 'down' ? i * step : (count - 1 - i) * step
      const stringIndex = count - 1 - i
      window.setTimeout(() => {
        voices.pluck(
          engines[engineId],
          `chord-${stringIndex}`,
          stringIndex,
          midi + 12 * octave,
          0.75 + Math.random() * 0.25,
          muted,
        )
      }, delay)
    })
  }

  const selectEngine = (id: EngineId) => {
    if (id === 'acoustic' && samplerState !== 'ready') {
      if (samplerState === 'loading') return
      setSamplerState('loading')
      engines.acoustic
        .ready()
        .then(() => {
          setSamplerState('ready')
          setEngineId('acoustic')
        })
        .catch((err) => {
          console.error('Failed to load guitar samples', err)
          setSamplerState('failed')
        })
      return
    }
    setEngineId(id)
  }

  useGuitarKeyboard({
    mode,
    toggleMode() {
      voices.releaseAll()
      heldStrings.current.clear()
      keyString.current.clear()
      setActiveKeys(new Set())
      setMode((m) => (m === 'lead' ? 'chord' : 'lead'))
    },
    selectChord(degree) {
      setChordDegree(degree)
      strumChord(degree, 'down')
    },
    strum(direction, muted) {
      strumChord(chordDegree, direction, muted)
    },
    changeKey(delta) {
      setKeyRoot((k) => (k + delta + 12) % 12)
    },
    selectVariant(variant) {
      setChordVariant(variant)
    },
    pluckString(stringIndex, muted) {
      const chord = diatonicChord(keyRoot, chordDegree, chordVariant)
      // chord.midis is ascending, so the lowest note sits on string index 5.
      const midi = chord.midis[5 - stringIndex] + 12 * octave
      voices.pluck(engines[engineId], `chord-${stringIndex}`, stringIndex, midi, 0.9, muted)
      setPluckedStrings((prev) => new Set(prev).add(stringIndex))
      window.setTimeout(() => {
        setPluckedStrings((prev) => {
          const next = new Set(prev)
          next.delete(stringIndex)
          return next
        })
      }, 160)
    },
    bend(on) {
      voices.setBend(on ? 2 : 0)
    },
    vibrato(on) {
      voices.setVibrato(on)
    },
    pluck(code, muted, slide) {
      const pos = KEY_TO_POSITION[code]
      if (!pos) return
      const stringIndex = windowOffset + pos.row
      const midi = STANDARD_TUNING[stringIndex].midi + pos.fret + 12 * octave
      const stack = heldStrings.current.get(stringIndex) ?? []
      if (stack.length > 0) {
        // String is already fingered: hammer-on (or slide with ⇧), no new attack.
        voices.legato(stringIndex, code, midi, slide ? 0.12 : 0.012)
      } else {
        voices.pluck(engines[engineId], code, stringIndex, midi, 1, muted)
      }
      stack.push({ code, midi })
      heldStrings.current.set(stringIndex, stack)
      keyString.current.set(code, stringIndex)
      setActiveKeys((prev) => new Set(prev).add(code))
    },
    release(code) {
      const stringIndex = keyString.current.get(code)
      keyString.current.delete(code)
      if (stringIndex !== undefined) {
        const stack = heldStrings.current.get(stringIndex) ?? []
        const idx = stack.findIndex((entry) => entry.code === code)
        const wasSounding = idx === stack.length - 1
        if (idx >= 0) stack.splice(idx, 1)
        if (stack.length === 0) {
          heldStrings.current.delete(stringIndex)
          voices.release(code)
        } else if (wasSounding) {
          // Pull-off: fall back to the finger still holding the string.
          const target = stack[stack.length - 1]
          voices.legato(stringIndex, target.code, target.midi, 0.012)
        }
      } else {
        voices.release(code)
      }
      setActiveKeys((prev) => {
        const next = new Set(prev)
        next.delete(code)
        return next
      })
    },
    shiftOctave(delta) {
      setOctave((o) => Math.max(MIN_OCTAVE, Math.min(MAX_OCTAVE, o + delta)))
    },
    shiftWindow(delta) {
      setWindowOffset((w) => Math.max(0, Math.min(MAX_WINDOW, w + delta)))
    },
  })

  return (
    <div className="app">
      <Controls
        octave={octave}
        windowOffset={windowOffset}
        volume={volume}
        engineId={engineId}
        samplerState={samplerState}
        mode={mode}
        keyRoot={keyRoot}
        preset={preset}
        onPreset={(p) => {
          setPreset(p)
          setTonePreset(p)
        }}
        onEngine={selectEngine}
        onVolume={(v) => {
          setVolume(v)
          setMasterVolume(v)
        }}
      />
      {mode === 'lead' ? (
        <Fretboard windowOffset={windowOffset} octave={octave} activeKeys={activeKeys} />
      ) : (
        <ChordPanel
          keyRoot={keyRoot}
          chordDegree={chordDegree}
          chordVariant={chordVariant}
          pluckedStrings={pluckedStrings}
          octave={octave}
        />
      )}
      <KeyboardHints mode={mode} />
    </div>
  )
}
