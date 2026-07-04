import { useEffect } from 'react'

interface Props {
  open: boolean
  onClose(): void
}

export function Playbook({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="playbook-overlay" onClick={onClose}>
      <div className="playbook-modal" onClick={(e) => e.stopPropagation()}>
        <div className="playbook-header">
          <h2>Playbook</h2>
          <button className="playbook-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="playbook-body">
          <section className="playbook-section">
            <h3>Lead Mode — Fretboard</h3>
            <p>
              Each keyboard row maps to a guitar string. Moving right along a row moves up the
              frets, just like real tab notation.
            </p>
            <div className="playbook-grid">
              <div className="playbook-item">
                <kbd>1</kbd> – <kbd>0</kbd>
                <span>String e (highest) — frets 0–9</span>
              </div>
              <div className="playbook-item">
                <kbd>Q</kbd> – <kbd>P</kbd>
                <span>String B — frets 0–9</span>
              </div>
              <div className="playbook-item">
                <kbd>A</kbd> – <kbd>;</kbd>
                <span>String G — frets 0–9</span>
              </div>
              <div className="playbook-item">
                <kbd>Z</kbd> – <kbd>/</kbd>
                <span>String D (lowest visible) — frets 0–9</span>
              </div>
            </div>
            <p>
              <strong>Hold</strong> a key to let the note ring. <strong>Release</strong> to damp it.
            </p>
          </section>

          <section className="playbook-section">
            <h3>Techniques</h3>
            <div className="playbook-grid">
              <div className="playbook-item">
                <kbd>⌥ Option</kbd>
                <span>Hold for palm mute (muted, percussive tone)</span>
              </div>
              <div className="playbook-item">
                <kbd>↑</kbd>
                <span>Hold for bend (whole step up)</span>
              </div>
              <div className="playbook-item">
                <kbd>↓</kbd>
                <span>Hold for vibrato</span>
              </div>
              <div className="playbook-item">
                <span className="playbook-technique">Hammer-on</span>
                <span>Press a second key on the same row while holding the first</span>
              </div>
              <div className="playbook-item">
                <span className="playbook-technique">Pull-off</span>
                <span>Release the top key — falls back to the held key below</span>
              </div>
              <div className="playbook-item">
                <kbd>⇧ Shift</kbd> + overlap
                <span>Slide between notes (smooth glide instead of hammer)</span>
              </div>
            </div>
          </section>

          <section className="playbook-section">
            <h3>Chord Mode</h3>
            <p>
              Press <kbd>Tab</kbd> to switch between Lead and Chord modes.
            </p>
            <div className="playbook-grid">
              <div className="playbook-item">
                <kbd>1</kbd> – <kbd>7</kbd>
                <span>Select diatonic chord (I through vii°) and auto-strum</span>
              </div>
              <div className="playbook-item">
                <kbd>Q</kbd> – <kbd>P</kbd>
                <span>
                  Chord shape variants: auto, sus2, sus4, 7, maj7, m7, add9, 6, maj, min
                </span>
              </div>
              <div className="playbook-item">
                <kbd>Space</kbd>
                <span>Strum down</span>
              </div>
              <div className="playbook-item">
                <kbd>Enter</kbd>
                <span>Strum up</span>
              </div>
              <div className="playbook-item">
                <kbd>⌥</kbd> + <kbd>Space</kbd>
                <span>Chuck (muted strum)</span>
              </div>
              <div className="playbook-item">
                <kbd>Z</kbd> – <kbd>N</kbd>
                <span>Fingerpick individual strings (low E → high e)</span>
              </div>
              <div className="playbook-item">
                <kbd>←</kbd> / <kbd>→</kbd>
                <span>Change musical key</span>
              </div>
            </div>
          </section>

          <section className="playbook-section">
            <h3>Navigation & Controls</h3>
            <div className="playbook-grid">
              <div className="playbook-item">
                <kbd>Tab</kbd>
                <span>Toggle between Lead and Chord mode</span>
              </div>
              <div className="playbook-item">
                <kbd>⇧</kbd> + <kbd>↑</kbd> / <kbd>↓</kbd>
                <span>Shift octave up / down (−2 to +2)</span>
              </div>
              <div className="playbook-item">
                <kbd>[</kbd> / <kbd>]</kbd>
                <span>Slide string window (reach lower A and E strings)</span>
              </div>
            </div>
          </section>

          <section className="playbook-section">
            <h3>Sound Options</h3>
            <div className="playbook-grid">
              <div className="playbook-item">
                <span className="playbook-technique">Synth</span>
                <span>Karplus-Strong synthesis — instant, no loading</span>
              </div>
              <div className="playbook-item">
                <span className="playbook-technique">Acoustic</span>
                <span>Real guitar samples — richer tone, requires download</span>
              </div>
              <div className="playbook-item">
                <span className="playbook-technique">Presets</span>
                <span>Acoustic (warm), Clean (neutral), Drive (overdriven)</span>
              </div>
              <div className="playbook-item">
                <span className="playbook-technique">Rec</span>
                <span>Record your performance as a .webm audio file</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
