import { NOTE_NAMES, STANDARD_TUNING } from '../music/theory'
import { Recorder } from './Recorder'
import type { TonePreset } from '../audio/context'
import type { EngineId, SamplerState } from '../App'
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
  onPreset(preset: TonePreset): void
  onEngine(id: EngineId): void
  onVolume(value: number): void
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
  onPreset,
  onEngine,
  onVolume,
}: Props) {
  const acousticLabel =
    samplerState === 'loading' ? 'Acoustic…' : samplerState === 'failed' ? 'Acoustic ✕' : 'Acoustic'
  const strings = STANDARD_TUNING.slice(windowOffset, windowOffset + 4)
    .map((s) => s.name)
    .join(' ')

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
        <span className="badge mode-badge">{mode === 'lead' ? 'Lead' : 'Chord'}</span>
        <span className="badge">
          Octave {octave >= 0 ? '+' : ''}
          {octave}
        </span>
        {mode === 'lead' ? (
          <span className="badge">Strings {strings}</span>
        ) : (
          <span className="badge">Key of {NOTE_NAMES[keyRoot]}</span>
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
      </div>
    </header>
  )
}
