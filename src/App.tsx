import { useCallback, useEffect, useRef, useState } from 'react'
import { Controls } from './components/Controls'
import { Fretboard } from './components/Fretboard'
import { ScaleBar } from './components/ScaleBar'
import { ChordPanel } from './components/ChordPanel'
import { KeyboardHints } from './components/KeyboardHints'
import { TabView } from './components/TabView'
import { MicListener } from './components/MicListener'
import { SongAnalyzer } from './components/SongAnalyzer'
import { useGuitarKeyboard, type PlayMode } from './input/keyboard'
import { KEY_TO_POSITION } from './input/keymap'
import {
  STANDARD_TUNING,
  diatonicChord,
  scaleDegreeByPitchClass,
  type ChordVariant,
  type ScaleType,
} from './music/theory'
import { KarplusStrongEngine } from './audio/karplus'
import { SamplerEngine } from './audio/sampler'
import { VoiceManager } from './audio/voices'
import { setMasterVolume, setTonePreset, type TonePreset } from './audio/context'
import { TabRecorder } from './tab/recorder'
import type { TabSheet, TabEvent } from './tab/types'
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
  theme: Theme
  scaleOn: boolean
  scaleRoot: number
  scaleType: ScaleType
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

export type Theme = 'dark' | 'light'
export type EngineId = 'synth' | 'acoustic'
export type SamplerState = 'idle' | 'loading' | 'ready' | 'failed'

const engines: Record<EngineId, KarplusStrongEngine | SamplerEngine> = {
  synth: new KarplusStrongEngine(),
  acoustic: new SamplerEngine(),
}
const voices = new VoiceManager()
const tabRecorder = new TabRecorder()

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
  const [theme, setTheme] = useState<Theme>(saved.theme ?? 'dark')
  const [scaleOn, setScaleOn] = useState(saved.scaleOn ?? false)
  const [scaleRoot, setScaleRoot] = useState(saved.scaleRoot ?? 9) // A
  const [scaleType, setScaleType] = useState<ScaleType>(saved.scaleType ?? 'major')
  const [pluckedStrings, setPluckedStrings] = useState<Set<number>>(new Set())
  const [tabRecording, setTabRecording] = useState(false)
  const [tabSheet, setTabSheet] = useState<TabSheet | null>(null)
  const [savedTabs, setSavedTabs] = useState<TabSheet[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('eguitar-tabs') ?? '[]') as TabSheet[]
    } catch {
      return []
    }
  })

  // Per-string stacks of physically held keys (press order), like fingers on a
  // fretboard: pressing onto a fingered string = hammer-on/slide, releasing the
  // top key while a lower finger remains = pull-off back to it.
  const heldStrings = useRef(new Map<number, { code: string; midi: number }[]>())
  const keyString = useRef(new Map<string, number>())

  const booted = useRef(false)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

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
      JSON.stringify({
        octave, windowOffset, volume, engineId, mode, keyRoot, preset, theme,
        scaleOn, scaleRoot, scaleType,
      }),
    )
  }, [octave, windowOffset, volume, engineId, mode, keyRoot, preset, theme, scaleOn, scaleRoot, scaleType])

  const scaleDegrees = scaleDegreeByPitchClass(scaleRoot, scaleType)

  const toggleTabRecording = useCallback(() => {
    if (tabRecording) {
      const sheet = tabRecorder.stop()
      setTabRecording(false)
      if (sheet.events.length > 0) {
        setTabSheet(sheet)
        const updated = [...savedTabs, sheet]
        setSavedTabs(updated)
        localStorage.setItem('eguitar-tabs', JSON.stringify(updated))
      }
    } else {
      tabRecorder.start()
      setTabRecording(true)
      setTabSheet(null)
    }
  }, [tabRecording, savedTabs])

  const handleMicTab = useCallback((sheet: TabSheet) => {
    setTabSheet(sheet)
    const updated = [...savedTabs, sheet]
    setSavedTabs(updated)
    localStorage.setItem('eguitar-tabs', JSON.stringify(updated))
  }, [savedTabs])

  const handleTabReplay = useCallback((event: TabEvent) => {
    if (event.type === 'pluck') {
      voices.pluck(engines[engineId], `replay-${event.stringIndex}`, event.stringIndex, event.midi, 0.9, event.muted)
    }
  }, [engineId])

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
      const delay = direction === 'down' ? i * step : (count - 1 - i) * step
      const stringIndex = count - 1 - i
      const finalMidi = midi + 12 * octave
      window.setTimeout(() => {
        voices.pluck(
          engines[engineId],
          `chord-${stringIndex}`,
          stringIndex,
          finalMidi,
          0.75 + Math.random() * 0.25,
          muted,
        )
        const fret = Math.max(0, finalMidi - STANDARD_TUNING[stringIndex].midi)
        tabRecorder.recordPluck(stringIndex, fret, finalMidi, muted)
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

  // Shared by the physical keyboard and on-screen touch controls.
  const toggleMode = () => {
    voices.releaseAll()
    heldStrings.current.clear()
    keyString.current.clear()
    setActiveKeys(new Set())
    setMode((m) => (m === 'lead' ? 'chord' : 'lead'))
  }

  const selectChord = (degree: number) => {
    setChordDegree(degree)
    strumChord(degree, 'down')
  }

  const strum = (direction: 'down' | 'up', muted = false) => {
    strumChord(chordDegree, direction, muted)
  }

  const changeKey = (delta: number) => {
    setKeyRoot((k) => (k + delta + 12) % 12)
  }

  const selectVariant = (variant: ChordVariant) => {
    setChordVariant(variant)
  }

  const pluckString = (stringIndex: number, muted = false) => {
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
  }

  const pluck = (code: string, muted = false, slide = false) => {
    const pos = KEY_TO_POSITION[code]
    if (!pos) return
    const stringIndex = windowOffset + pos.row
    const midi = STANDARD_TUNING[stringIndex].midi + pos.fret + 12 * octave
    const stack = heldStrings.current.get(stringIndex) ?? []
    if (stack.length > 0) {
      voices.legato(stringIndex, code, midi, slide ? 0.12 : 0.012)
    } else {
      voices.pluck(engines[engineId], code, stringIndex, midi, 1, muted)
    }
    tabRecorder.recordPluck(stringIndex, pos.fret, midi, muted)
    stack.push({ code, midi })
    heldStrings.current.set(stringIndex, stack)
    keyString.current.set(code, stringIndex)
    setActiveKeys((prev) => new Set(prev).add(code))
  }

  const release = (code: string) => {
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
  }

  const shiftOctave = (delta: number) => {
    setOctave((o) => Math.max(MIN_OCTAVE, Math.min(MAX_OCTAVE, o + delta)))
  }

  const shiftWindow = (delta: number) => {
    setWindowOffset((w) => Math.max(0, Math.min(MAX_WINDOW, w + delta)))
  }

  useGuitarKeyboard({
    mode,
    toggleMode,
    selectChord,
    strum,
    changeKey,
    selectVariant,
    pluckString,
    pluck,
    release,
    shiftOctave,
    shiftWindow,
    bend(on) {
      voices.setBend(on ? 2 : 0)
    },
    vibrato(on) {
      voices.setVibrato(on)
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
        theme={theme}
        onPreset={(p) => {
          setPreset(p)
          setTonePreset(p)
        }}
        onEngine={selectEngine}
        onVolume={(v) => {
          setVolume(v)
          setMasterVolume(v)
        }}
        onToggleMode={toggleMode}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        onOctave={shiftOctave}
        onWindow={shiftWindow}
        onKeyChange={changeKey}
      />
      {mode === 'lead' ? (
        <>
          <ScaleBar
            scaleOn={scaleOn}
            scaleRoot={scaleRoot}
            scaleType={scaleType}
            onToggle={() => setScaleOn((s) => !s)}
            onRoot={(delta) => setScaleRoot((r) => (r + delta + 12) % 12)}
            onType={setScaleType}
          />
          <Fretboard
            windowOffset={windowOffset}
            octave={octave}
            activeKeys={activeKeys}
            onPluck={pluck}
            onRelease={release}
            scaleOn={scaleOn}
            scaleRoot={scaleRoot}
            scaleDegrees={scaleDegrees}
          />
        </>
      ) : (
        <ChordPanel
          keyRoot={keyRoot}
          chordDegree={chordDegree}
          chordVariant={chordVariant}
          pluckedStrings={pluckedStrings}
          octave={octave}
          onSelectChord={selectChord}
          onSelectVariant={selectVariant}
          onPluckString={pluckString}
          onStrum={strum}
        />
      )}
      <div className="tab-mic-bar">
        <button
          className={`tab-rec-btn${tabRecording ? ' recording' : ''}`}
          onClick={toggleTabRecording}
          title={tabRecording ? 'Stop tab recording' : 'Record tablature'}
        >
          {tabRecording ? '■ Stop Tab' : '♫ Record Tab'}
        </button>
        <div className="tab-mic-divider" />
        <MicListener onTabGenerated={handleMicTab} />
        <SongAnalyzer />
        <div className="tab-mic-divider" />
        {savedTabs.length > 0 && !tabSheet && (
          <button
            className="tab-history-btn"
            onClick={() => setTabSheet(savedTabs[savedTabs.length - 1])}
            title="Show last recorded tab"
          >
            ↻ Last Tab ({savedTabs.length})
          </button>
        )}
      </div>
      {tabSheet && (
        <TabView
          sheet={tabSheet}
          onReplay={handleTabReplay}
          onClose={() => setTabSheet(null)}
          onDone={() => {}}
        />
      )}
      <KeyboardHints mode={mode} />
    </div>
  )
}
