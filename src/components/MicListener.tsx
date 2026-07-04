import { useEffect, useRef, useState, useCallback } from 'react'
import {
  detectPitch,
  freqToMidi,
  midiToNoteName,
  midiToStringFret,
  hasSignal,
} from '../audio/pitch-detect'
import { computeChromagram, matchChord, detectKeyKS } from '../audio/chromagram'
import { midiToName } from '../music/theory'
import type { TabEvent, TabSheet, ChordHit } from '../tab/types'

interface Props {
  onTabGenerated: (sheet: TabSheet) => void
}

export function MicListener({ onTabGenerated }: Props) {
  const [listening, setListening] = useState(false)
  const [currentNote, setCurrentNote] = useState<string | null>(null)
  const [currentChord, setCurrentChord] = useState<string | null>(null)
  const [detectedKey, setDetectedKey] = useState<string | null>(null)
  const [noteCount, setNoteCount] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  const streamRef = useRef<MediaStream | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const analyserFreqRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number>(0)
  const eventsRef = useRef<TabEvent[]>([])
  const chordsRef = useRef<ChordHit[]>([])
  const startTimeRef = useRef(0)
  const lastMidiRef = useRef(-1)
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined)
  const chromaSumRef = useRef(new Float32Array(12))
  const frameCountRef = useRef(0)

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    ctxRef.current?.close()
    streamRef.current = null
    ctxRef.current = null
    analyserRef.current = null
    analyserFreqRef.current = null

    const events = eventsRef.current
    if (events.length > 0) {
      const duration = performance.now() - startTimeRef.current
      const keyResult = detectKeyKS(chromaSumRef.current)

      const sheet: TabSheet = {
        createdAt: Date.now(),
        duration,
        source: 'mic',
        events,
        keyRoot: keyResult.root,
        chordFamily: keyResult.name,
      }
      onTabGenerated(sheet)
    }

    eventsRef.current = []
    chordsRef.current = []
    lastMidiRef.current = -1
    chromaSumRef.current = new Float32Array(12)
    frameCountRef.current = 0
    setListening(false)
    setCurrentNote(null)
    setCurrentChord(null)
    setDetectedKey(null)
    setNoteCount(0)
    setElapsed(0)
  }, [onTabGenerated])

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const ctx = new AudioContext()
      const source = ctx.createMediaStreamSource(stream)

      // Time-domain analyser for pitch detection
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 4096
      source.connect(analyser)

      // Frequency-domain analyser for chromagram
      const analyserFreq = ctx.createAnalyser()
      analyserFreq.fftSize = 8192
      analyserFreq.smoothingTimeConstant = 0.3
      source.connect(analyserFreq)

      streamRef.current = stream
      ctxRef.current = ctx
      analyserRef.current = analyser
      analyserFreqRef.current = analyserFreq
      eventsRef.current = []
      chordsRef.current = []
      lastMidiRef.current = -1
      chromaSumRef.current = new Float32Array(12)
      frameCountRef.current = 0
      startTimeRef.current = performance.now()
      setListening(true)
      setNoteCount(0)

      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((performance.now() - startTimeRef.current) / 1000))
      }, 1000)

      const buffer = new Float32Array(analyser.fftSize)
      const freqBuffer = new Float32Array(analyserFreq.frequencyBinCount)
      let debounceCount = 0

      const loop = () => {
        if (!analyserRef.current || !analyserFreqRef.current) return
        frameCountRef.current++

        // ── Pitch detection for individual notes ──
        analyserRef.current.getFloatTimeDomainData(buffer)

        if (hasSignal(buffer, 0.008)) {
          const freq = detectPitch(buffer, ctx.sampleRate)
          if (freq > 60 && freq < 1200) {
            const midi = freqToMidi(freq)
            const noteName = midiToNoteName(midi)
            setCurrentNote(noteName)

            if (midi !== lastMidiRef.current) {
              debounceCount = 0
            }
            debounceCount++

            if (debounceCount >= 3 && midi !== lastMidiRef.current) {
              lastMidiRef.current = midi
              const pos = midiToStringFret(midi)
              if (pos) {
                const time = performance.now() - startTimeRef.current
                eventsRef.current.push({
                  time,
                  type: 'pluck',
                  stringIndex: pos.stringIndex,
                  fret: pos.fret,
                  midi,
                  noteName: midiToName(midi),
                  muted: false,
                })
                setNoteCount(n => n + 1)
              }
            }
          }
        } else {
          setCurrentNote(null)
          debounceCount = 0
        }

        // ── Chromagram-based chord + key detection (every 3rd frame) ──
        if (frameCountRef.current % 3 === 0) {
          analyserFreqRef.current.getFloatFrequencyData(freqBuffer)

          const linearMag = new Float32Array(freqBuffer.length)
          for (let i = 0; i < freqBuffer.length; i++) {
            linearMag[i] = Math.pow(10, freqBuffer[i] / 20)
          }

          const chroma = computeChromagram(linearMag, ctx.sampleRate, analyserFreq.fftSize)

          for (let i = 0; i < 12; i++) {
            chromaSumRef.current[i] += chroma[i]
          }

          const chord = matchChord(chroma, 0.6)
          if (chord) {
            setCurrentChord(chord.name)
            const time = performance.now() - startTimeRef.current
            chordsRef.current.push({
              time,
              name: chord.name,
              notes: [],
            })
          }
        }

        // ── Key detection (every 30th frame) ──
        if (frameCountRef.current % 30 === 0 && frameCountRef.current > 30) {
          const key = detectKeyKS(chromaSumRef.current)
          if (key.confidence > 0.3) {
            setDetectedKey(key.name)
          }
        }

        rafRef.current = requestAnimationFrame(loop)
      }

      rafRef.current = requestAnimationFrame(loop)
    } catch (err) {
      console.error('Microphone access denied:', err)
      alert('Microphone access is required for this feature. Please allow microphone access and try again.')
    }
  }, [])

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current)
    clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    ctxRef.current?.close()
  }, [])

  const toggle = () => {
    if (listening) stop()
    else start()
  }

  return (
    <div className="mic-panel">
      <button
        className={`mic-btn${listening ? ' listening' : ''}`}
        onClick={toggle}
        title={listening ? 'Stop listening' : 'Listen to single instrument'}
      >
        {listening ? '■ Stop Mic' : '🎤 Instrument'}
      </button>

      {listening && (
        <div className="mic-status">
          <div className="mic-indicator" />
          <div className="mic-info">
            <span className="mic-elapsed">{elapsed}s</span>
            <span className="mic-note-count">{noteCount} notes</span>
            {currentNote && (
              <span className="mic-current-note">{currentNote}</span>
            )}
            {currentChord && (
              <span className="mic-current-chord">{currentChord}</span>
            )}
            {detectedKey && (
              <span className="mic-detected-key">Key: {detectedKey}</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
