import { NOTE_NAMES, SCALES, SCALE_ORDER, type ScaleType, type Swara } from '../music/theory'

interface Props {
  scaleOn: boolean
  scaleRoot: number
  scaleType: ScaleType
  swaras: Swara[]
  onToggle(): void
  onRoot(delta: number): void
  onType(type: ScaleType): void
}

export function ScaleBar({ scaleOn, scaleRoot, scaleType, swaras, onToggle, onRoot, onType }: Props) {
  return (
    <div className={'scale-bar' + (scaleOn ? ' on' : '')}>
      <button
        className={'scale-toggle' + (scaleOn ? ' on' : '')}
        onClick={onToggle}
        title="Highlight a scale across the fretboard"
      >
        <span className="scale-dot-legend" /> Scale {scaleOn ? 'on' : 'off'}
      </button>

      {scaleOn && (
        <>
          <span className="scale-stepper">
            <button onClick={() => onRoot(-1)} aria-label="Scale root down">
              ‹
            </button>
            <span className="scale-root-name">{NOTE_NAMES[scaleRoot]}</span>
            <button onClick={() => onRoot(1)} aria-label="Scale root up">
              ›
            </button>
          </span>

          <select
            className="scale-select"
            value={scaleType}
            onChange={(e) => onType(e.target.value as ScaleType)}
            aria-label="Scale type"
          >
            {SCALE_ORDER.map((type) => (
              <option key={type} value={type}>
                {SCALES[type].name}
              </option>
            ))}
          </select>

          <span className="swara-legend">
            {swaras.map((swara, i) => (
              <span key={i} className={`swara-chip swara-${swara.index}`}>
                {swara.name}
                {swara.alt && <sup className="swara-alt">{swara.alt}</sup>}
              </span>
            ))}
          </span>
        </>
      )}
    </div>
  )
}
