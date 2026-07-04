import { useState } from 'react'
import { NOTE_NAMES, STANDARD_TUNING } from '../music/theory'
import { Recorder } from './Recorder'
import { Playbook } from './Playbook'
import type { TonePreset } from '../audio/context'
import type { EngineId, SamplerState, Theme } from '../App'
import type { PlayMode } from '../input/keyboard'

const PRESETS: { id: TonePreset; label: string }[] = [
  { id: 'acoustic', label: 'Acoustic' },
  { id: 'clean', label: 'Clean' },
  { id: 'drive', label: 'Drive' },
]

interface Props {
  octave: number
  windowOffset: number
  volume: number
  engineId: EngineId
  samplerState: SamplerState
  mode: PlayMode
  keyRoot: number
  preset: TonePreset
  theme: Theme
  onPreset(preset: TonePreset): void
  onEngine(id: EngineId): void
  onVolume(value: number): void
  onToggleMode(): void
  onToggleTheme(): void
  onOctave(delta: number): void
  onWindow(delta: number): void
  onKeyChange(delta: number): void
}

export function Controls({
  octave,
  windowOffset,
  volume,
  engineId,
  samplerState,
  mode,
  keyRoot,
  preset,
  theme,
  onPreset,
  onEngine,
  onVolume,
  onToggleMode,
  onToggleTheme,
  onOctave,
  onWindow,
  onKeyChange,
}: Props) {
  const [playbookOpen, setPlaybookOpen] = useState(false)
  const strings = STANDARD_TUNING.slice(windowOffset, windowOffset + 4)
    .map((s) => s.name)
    .join(' ')
  const acousticLabel =
    samplerState === 'loading' ? 'Acoustic…' : samplerState === 'failed' ? 'Acoustic ✕' : 'Acoustic'

  return (
    <header className="controls">
      <h1>
        EGuitar <span className="tagline">play with your keyboard</span>
      </h1>
      <div className="badges">
        <div className="engine-switch" role="group" aria-label="Sound engine">
          <button
            className={engineId === 'synth' ? 'on' : ''}
            onClick={() => onEngine('synth')}
          >
            Synth
          </button>
          <button
            className={engineId === 'acoustic' ? 'on' : ''}
            onClick={() => onEngine('acoustic')}
            title={samplerState === 'failed' ? 'Samples failed to load' : 'Recorded acoustic guitar'}
          >
            {acousticLabel}
          </button>
        </div>
        <div className="engine-switch" role="group" aria-label="Tone preset">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              className={preset === p.id ? 'on' : ''}
              onClick={() => onPreset(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <Recorder />
        <button className="playbook-btn" onClick={() => setPlaybookOpen(true)} title="How to play">
          Playbook
        </button>
        <button className="badge mode-badge" onClick={onToggleMode} title="Toggle lead / chord mode (⇥)">
          {mode === 'lead' ? 'Lead' : 'Chord'}
        </button>
        <span className="badge stepper">
          <button onClick={() => onOctave(-1)} aria-label="Octave down">
            −
          </button>
          Octave {octave >= 0 ? '+' : ''}
          {octave}
          <button onClick={() => onOctave(1)} aria-label="Octave up">
            +
          </button>
        </span>
        {mode === 'lead' ? (
          <span className="badge stepper">
            <button onClick={() => onWindow(1)} aria-label="Lower strings" title="Toward low E ([)">
              ‹
            </button>
            Strings {strings}
            <button onClick={() => onWindow(-1)} aria-label="Higher strings" title="Toward high e (])">
              ›
            </button>
          </span>
        ) : (
          <span className="badge stepper">
            <button onClick={() => onKeyChange(-1)} aria-label="Key down">
              ‹
            </button>
            Key of {NOTE_NAMES[keyRoot]}
            <button onClick={() => onKeyChange(1)} aria-label="Key up">
              ›
            </button>
          </span>
        )}
        <label className="volume">
          Vol
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => onVolume(Number(e.target.value))}
          />
        </label>
        <button
          className="theme-toggle"
          onClick={onToggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          {theme === 'dark' ? '☀' : '☽'}
        </button>
      </div>
      <Playbook open={playbookOpen} onClose={() => setPlaybookOpen(false)} />
    </header>
  )
}
