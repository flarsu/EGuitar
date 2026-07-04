import { useCallback, useEffect, useRef, useState } from 'react'
import { SongAnalyzerEngine, type SongAnalysis } from '../audio/song-analyzer'
import type { KeyResult } from '../audio/chromagram'

export function SongAnalyzer() {
  const [analyzing, setAnalyzing] = useState(false)
  const [key, setKey] = useState<KeyResult | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [liveBpm, setLiveBpm] = useState(0)
  const [beatCount, setBeatCount] = useState(0)
  const [result, setResult] = useState<SongAnalysis | null>(null)

  const engineRef = useRef(new SongAnalyzerEngine())
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval>>(undefined)
  const startTimeRef = useRef(0)

  const start = useCallback(async () => {
    setResult(null)
    setKey(null)
    setLiveBpm(0)
    setBeatCount(0)
    startTimeRef.current = performance.now()

    elapsedTimerRef.current = setInterval(() => {
      setElapsed(Math.floor((performance.now() - startTimeRef.current) / 1000))
    }, 1000)

    try {
      setAnalyzing(true)
      await engineRef.current.start((update) => {
        if (update.key) setKey(update.key)
        if (update.currentBpm > 0) setLiveBpm(update.currentBpm)
        setBeatCount(update.beatCount)
      })
    } catch (err) {
      console.error('Song analyzer error:', err)
      setAnalyzing(false)
      clearInterval(elapsedTimerRef.current)
      alert('Microphone access is required. Please allow microphone access and try again.')
    }
  }, [])

  const stop = useCallback(() => {
    clearInterval(elapsedTimerRef.current)
    const analysis = engineRef.current.stop()
    setAnalyzing(false)
    setResult(analysis)
  }, [])

  const toggle = () => {
    if (analyzing) stop()
    else start()
  }

  useEffect(() => () => {
    clearInterval(elapsedTimerRef.current)
    if (engineRef.current.running) engineRef.current.stop()
  }, [])

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="song-analyzer">
      <button
        className={`song-btn${analyzing ? ' analyzing' : ''}`}
        onClick={toggle}
        title={analyzing ? 'Stop analysis' : 'Analyze a song through microphone'}
      >
        {analyzing ? '■ Stop Analysis' : '🎵 Analyze Song'}
      </button>

      {analyzing && (
        <div className="song-live">
          <div className="song-live-indicator" />
          <div className="song-live-info">
            <span className="song-live-time">{elapsed}s</span>
            {liveBpm > 0 && (
              <span className="song-live-bpm">
                {liveBpm} <small>BPM</small>
              </span>
            )}
            {key && (
              <span className="song-live-key">Key: {key.name}</span>
            )}
            <span className="song-live-counts">
              {beatCount} beats
            </span>
          </div>
        </div>
      )}

      {result && !analyzing && (
        <div className="song-results">
          <div className="song-results-header">
            <h3>Song Analysis</h3>
            <button className="song-results-close" onClick={() => setResult(null)}>✕</button>
          </div>

          <div className="song-results-body">
            {/* Stats row */}
            <div className="song-stat-row">
              <div className="song-stat">
                <span className="song-stat-label">Key / Tonic</span>
                <span className="song-stat-value song-stat-key">
                  {result.key.name}
                  <small>{result.key.mode}</small>
                </span>
              </div>
              <div className="song-stat">
                <span className="song-stat-label">Tempo</span>
                <span className="song-stat-value song-stat-bpm">
                  {result.beat.bpm > 0 ? result.beat.bpm : '—'}
                  {result.beat.bpm > 0 && <small>BPM</small>}
                </span>
              </div>
              <div className="song-stat">
                <span className="song-stat-label">Time Signature</span>
                <span className="song-stat-value song-stat-time-sig">
                  {result.timeSignature.label}
                </span>
              </div>
              <div className="song-stat">
                <span className="song-stat-label">Bars</span>
                <span className="song-stat-value">
                  {result.bars.totalBars > 0 ? result.bars.totalBars : '—'}
                </span>
              </div>
              <div className="song-stat">
                <span className="song-stat-label">Duration</span>
                <span className="song-stat-value">{formatTime(result.duration)}</span>
              </div>
            </div>

            {/* Chord Family (Circle of Fifths) */}
            <div className="song-section">
              <h4>
                Chord Family
                <span className="song-section-badge">
                  Circle of Fifths · {result.key.name} {result.key.mode}
                </span>
              </h4>
              <div className="song-chord-family">
                {result.chordFamily.map((ch, i) => (
                  <div
                    key={i}
                    className={`song-family-card ${ch.quality}`}
                  >
                    <span className="song-family-degree">{ch.degree}</span>
                    <span className="song-family-name">{ch.name}</span>
                    <span className="song-family-quality">{ch.quality}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bar / Measure Info */}
            {result.beat.bpm > 0 && (
              <div className="song-section">
                <h4>
                  Measures
                  <span className="song-section-badge">
                    {result.timeSignature.label} time · {result.bars.barDurationMs > 0 ? `${(result.bars.barDurationMs / 1000).toFixed(1)}s per bar` : ''}
                  </span>
                </h4>
                <div className="song-measure-info">
                  <div className="song-measure-detail">
                    <span className="song-measure-label">Beat Interval</span>
                    <span className="song-measure-val">{result.beat.intervalMs}ms</span>
                  </div>
                  <div className="song-measure-detail">
                    <span className="song-measure-label">Beats per Bar</span>
                    <span className="song-measure-val">{result.timeSignature.beats}</span>
                  </div>
                  <div className="song-measure-detail">
                    <span className="song-measure-label">Bar Duration</span>
                    <span className="song-measure-val">
                      {result.bars.barDurationMs > 0 ? `${(result.bars.barDurationMs / 1000).toFixed(2)}s` : '—'}
                    </span>
                  </div>
                  <div className="song-measure-detail">
                    <span className="song-measure-label">Total Bars</span>
                    <span className="song-measure-val">{result.bars.totalBars}</span>
                  </div>
                  <div className="song-measure-detail">
                    <span className="song-measure-label">Total Beats</span>
                    <span className="song-measure-val">{result.beat.beats.length}</span>
                  </div>
                  <div className="song-measure-detail">
                    <span className="song-measure-label">Tempo Consistency</span>
                    <span className="song-measure-val">{Math.round(result.beat.confidence * 100)}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Beat timeline */}
            {result.beat.beats.length > 0 && (
              <div className="song-section">
                <h4>
                  Beat Map
                  <span className="song-section-badge">
                    {result.beat.beats.length} beats
                  </span>
                </h4>
                <div className="song-beat-timeline">
                  <div className="song-beat-track">
                    {/* Bar lines */}
                    {result.bars.barStarts.map((t, i) => {
                      const pct = (t / result!.duration) * 100
                      return (
                        <div
                          key={`bar-${i}`}
                          className="song-bar-line"
                          style={{ left: `${pct}%` }}
                          title={`Bar ${i + 1}`}
                        />
                      )
                    })}
                    {/* Beat ticks */}
                    {result.beat.beats.map((t, i) => {
                      const pct = (t / result!.duration) * 100
                      return (
                        <div
                          key={i}
                          className="song-beat-tick"
                          style={{ left: `${pct}%` }}
                          title={`Beat ${i + 1} at ${formatTime(t)}`}
                        />
                      )
                    })}
                  </div>
                  <div className="song-beat-labels">
                    <span>0:00</span>
                    <span>{formatTime(result.duration)}</span>
                  </div>
                </div>
                {result.beat.beats.length > 3 && (
                  <div className="song-beat-intervals">
                    <BeatIntervals beats={result.beat.beats} />
                  </div>
                )}
              </div>
            )}

            {/* Chromagram */}
            <div className="song-section">
              <h4>Pitch Class Distribution</h4>
              <div className="song-chroma">
                {Array.from(result.chromaSum).map((val, i) => {
                  const max = Math.max(...Array.from(result!.chromaSum))
                  const pct = max > 0 ? (val / max) * 100 : 0
                  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
                  const isRoot = i === result!.key.root
                  return (
                    <div key={i} className={`song-chroma-bar${isRoot ? ' root' : ''}`}>
                      <div className="song-chroma-fill" style={{ height: `${pct}%` }} />
                      <span className="song-chroma-label">{notes[i]}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function BeatIntervals({ beats }: { beats: number[] }) {
  const intervals: number[] = []
  for (let i = 1; i < beats.length; i++) {
    intervals.push(Math.round(beats[i] - beats[i - 1]))
  }

  if (intervals.length === 0) return null

  const min = Math.min(...intervals)
  const max = Math.max(...intervals)
  const avg = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length)

  const display = intervals.slice(-20)
  const displayMax = Math.max(...display)

  return (
    <div className="beat-intervals-chart">
      <div className="beat-intervals-header">
        <span>Beat Intervals</span>
        <span className="beat-intervals-stats">
          avg {avg}ms · min {min}ms · max {max}ms
        </span>
      </div>
      <div className="beat-intervals-bars">
        {display.map((dt, i) => {
          const pct = displayMax > 0 ? (dt / displayMax) * 100 : 0
          return (
            <div key={i} className="beat-interval-bar" title={`${dt}ms`}>
              <div className="beat-interval-fill" style={{ height: `${pct}%` }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
