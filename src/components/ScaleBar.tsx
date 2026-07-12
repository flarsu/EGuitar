import { NOTE_NAMES, SCALES, SCALE_ORDER, type ScaleType } from '../music/theory'

interface Props {
  scaleOn: boolean
  scaleRoot: number
  scaleType: ScaleType
  onToggle(): void
  onRoot(delta: number): void
  onType(type: ScaleType): void
}

export function ScaleBar({ scaleOn, scaleRoot, scaleType, onToggle, onRoot, onType }: Props) {
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

          <span className="scale-current">
            {NOTE_NAMES[scaleRoot]} {SCALES[scaleType].name}
          </span>

          <span className="scale-legend">
            <span className="legend-item">
              <span className="legend-swatch root" /> root
            </span>
            <span className="legend-item">
              <span className="legend-swatch note" /> scale note
            </span>
          </span>
        </>
      )}
    </div>
  )
}
