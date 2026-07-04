import { useEffect, useRef, useState } from 'react'
import { STANDARD_TUNING } from '../music/theory'
import type { TabSheet, TabEvent } from '../tab/types'
import { TabPlayer } from '../tab/player'

interface Props {
  sheet: TabSheet
  onReplay: (event: TabEvent) => void
  onClose: () => void
  onDone: () => void
}

interface TabColumn {
  time: number
  frets: (number | null)[]
  muted: boolean[]
}

function buildColumns(events: TabEvent[]): TabColumn[] {
  const plucks = events.filter(e => e.type === 'pluck')
  if (plucks.length === 0) return []

  const columns: TabColumn[] = []
  let current: TabColumn | null = null
  const GROUP_WINDOW = 30

  for (const ev of plucks) {
    if (!current || ev.time - current.time > GROUP_WINDOW) {
      current = {
        time: ev.time,
        frets: Array(6).fill(null),
        muted: Array(6).fill(false),
      }
      columns.push(current)
    }
    if (ev.stringIndex >= 0 && ev.stringIndex < 6) {
      current.frets[ev.stringIndex] = ev.fret
      current.muted[ev.stringIndex] = ev.muted
    }
  }

  return columns
}

export function TabView({ sheet, onReplay, onClose, onDone }: Props) {
  const [playing, setPlaying] = useState(false)
  const [activeCol, setActiveCol] = useState(-1)
  const playerRef = useRef(new TabPlayer())
  const scrollRef = useRef<HTMLDivElement>(null)
  const columns = useRef(buildColumns(sheet.events)).current

  const play = () => {
    if (playing) {
      playerRef.current.stop()
      setPlaying(false)
      setActiveCol(-1)
      return
    }

    setPlaying(true)
    setActiveCol(-1)

    const pluckEvents = sheet.events.filter(e => e.type === 'pluck')

    playerRef.current.play(
      { ...sheet, events: pluckEvents },
      (eventIndex) => {
        const ev = pluckEvents[eventIndex]
        if (ev) {
          onReplay(ev)
          const colIdx = columns.findIndex(
            col => Math.abs(col.time - ev.time) < 35
          )
          if (colIdx >= 0) setActiveCol(colIdx)
        }
      },
      () => {
        setPlaying(false)
        setActiveCol(-1)
        onDone()
      },
    )
  }

  useEffect(() => {
    if (activeCol >= 0 && scrollRef.current) {
      const col = scrollRef.current.querySelector(`[data-col="${activeCol}"]`)
      col?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }
  }, [activeCol])

  useEffect(() => () => playerRef.current.stop(), [])

  const stringNames = STANDARD_TUNING.map(s => s.name)
  const totalNotes = sheet.events.filter(e => e.type === 'pluck').length
  const durationSec = (sheet.duration / 1000).toFixed(1)

  return (
    <div className="tab-panel">
      <div className="tab-header">
        <div className="tab-title">
          <h3>Tablature</h3>
          <span className="tab-meta">
            {totalNotes} notes &middot; {durationSec}s
            {sheet.chordFamily && <> &middot; Key of {sheet.chordFamily}</>}
            &middot; {sheet.source === 'mic' ? 'Mic' : 'Keyboard'}
          </span>
        </div>
        <div className="tab-actions">
          <button className="tab-play-btn" onClick={play}>
            {playing ? '■ Stop' : '▶ Play'}
          </button>
          <button className="tab-close-btn" onClick={onClose}>✕</button>
        </div>
      </div>

      <div className="tab-grid-scroll" ref={scrollRef}>
        <div className="tab-grid">
          {/* String labels column */}
          <div className="tab-string-labels">
            {stringNames.map((name, i) => (
              <div key={i} className="tab-string-label">{name}</div>
            ))}
          </div>

          {/* Tablature columns */}
          {columns.map((col, ci) => (
            <div
              key={ci}
              className={`tab-column${activeCol === ci ? ' active' : ''}`}
              data-col={ci}
            >
              {col.frets.map((fret, si) => (
                <div
                  key={si}
                  className={`tab-cell${fret !== null ? ' has-note' : ''}${col.muted[si] ? ' muted' : ''}`}
                >
                  {fret !== null ? (
                    <span className="tab-fret">{fret}</span>
                  ) : (
                    <span className="tab-dash">—</span>
                  )}
                </div>
              ))}
            </div>
          ))}

          {columns.length === 0 && (
            <div className="tab-empty">No notes recorded</div>
          )}
        </div>
      </div>
    </div>
  )
}
