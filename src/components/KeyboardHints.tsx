import type { PlayMode } from '../input/keyboard'

export function KeyboardHints({ mode }: { mode: PlayMode }) {
  return (
    <footer className="hints">
      <span>
        <kbd>⇥</kbd> {mode === 'lead' ? 'chord mode' : 'lead mode'}
      </span>
      <span>
        <kbd>⇧</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> octave
      </span>
      {mode === 'lead' ? (
        <>
          <span>
            <kbd>[</kbd> lower strings · <kbd>]</kbd> back up
          </span>
          <span>
            hold <kbd>⌥</kbd> palm mute
          </span>
          <span>
            hold <kbd>↑</kbd> bend · <kbd>↓</kbd> vibrato
          </span>
          <span>
            overlap keys on a row: hammer-on / pull-off · with <kbd>⇧</kbd> slide
          </span>
          <span>hold a key to let it ring, release to damp</span>
        </>
      ) : (
        <span>
          hold <kbd>⌥</kbd> while strumming to chuck
        </span>
      )}
    </footer>
  )
}
