# EGuitar — Design Document

A virtual guitar played entirely with the laptop (QWERTY) keyboard. Runs in the browser.

## 1. Goals

- Feel like an instrument, not a toy: low latency, polyphony, expressive control.
- Zero install: open a page, press keys, hear guitar.
- Keyboard-first: every feature reachable without a mouse.

## 2. Recommended platform and stack

| Decision | Recommendation | Why |
|---|---|---|
| Platform | Web app (browser) | Keyboard events + Web Audio API are native; no install; easy to share |
| Build tool | Vite | Instant dev server, trivial setup |
| UI | React + TypeScript | Declarative fretboard rendering; you already work with this stack |
| Audio | Web Audio API directly (no library) | Full control over latency and voice management; engine stays framework-free |
| Sound generation | **Dual engine, switchable at runtime**: Karplus-Strong synthesis and recorded samples | Synth needs no assets and ships first; sampler gives maximum realism. Both implement one `SoundEngine` interface so the rest of the app doesn't care which is active |

The audio engine lives in plain TypeScript modules with no React imports, so the UI layer is swappable and the engine is unit-testable.

### SoundEngine interface

```ts
interface SoundEngine {
  pluck(note: Note, velocity: number): VoiceHandle;  // returns handle to damp/mute later
  damp(handle: VoiceHandle): void;                   // natural release on key-up
  setPalmMute(on: boolean): void;
  ready(): Promise<void>;                            // sampler: wait for sample load
}
```

- **`KarplusStrongEngine`** — default; instant, zero assets.
- **`SamplerEngine`** — loads a free CC-licensed acoustic/electric guitar sample set (e.g. the tonejs-instruments or FreePats collections), one sample every ~3 semitones, pitch-shifted between sampled notes via `playbackRate`. Loads lazily in the background; the UI switch enables it once `ready()` resolves.
- The engine selector lives in the header next to the tone preset; switching mid-song is allowed (active voices finish on the old engine).

## 3. Keyboard mapping

### Lead mode (default) — rows are strings, columns are frets

The four usable key rows map to the top four guitar strings (standard tuning), highest string on top like a guitar tab:

```
1 2 3 4 5 6 7 8 9 0   →  string 1: high e (E4), frets 0–9
Q W E R T Y U I O P   →  string 2: B (B3),     frets 0–9
A S D F G H J K L ;   →  string 3: G (G3),     frets 0–9
Z X C V B N M , . /   →  string 4: D (D3),     frets 0–9
```

- **Shift + ↑ / Shift + ↓** — shift everything up/down one octave (range −2 to +2, shown in the UI).
- **[ / ]** — slide the 4-string window down/up so the low A2 and E2 strings become reachable.
- Physical key position is used (`event.code`), so the layout works on non-US keyboards too.

### Chord mode — one hand picks the chord, the other strums

- **Tab** — toggle between Lead and Chord mode.
- **1–7** — diatonic chords of the selected key (I, ii, iii, IV, V, vi, vii°).
- **Space** — downstrum; **Enter** — upstrum. Strums stagger string onsets by ~15 ms for realism.
- **← / →** — change key (C, G, D, …).

### Expression

- Holding a key lets the note ring; releasing damps it naturally.
- **Hold ⌥ Option (Alt)** — palm mute (fast decay + lowpass, like resting your palm on the bridge).

The user plays on a Mac keyboard: shortcuts avoid Ctrl+arrow combos (reserved by Mission Control) and use ⇧/⌥ conventions; UI hints show Mac key symbols.
- Auto-repeat from the OS is ignored (`event.repeat` guard) — one keypress, one pluck.

## 4. Audio engine

```
pluck voice (Karplus-Strong) ─┐
pluck voice ──────────────────┼──▶ drive (waveshaper) ─▶ EQ ─▶ reverb ─▶ master gain ─▶ output
pluck voice ──────────────────┘
```

- **Karplus-Strong voice**: a burst of noise fed into a delay line (length = sampleRate / frequency) with a lowpass filter in the feedback loop. Damping factor controls sustain; palm mute just shortens it.
- **Voice pool**: 12 voices, oldest-note stealing. Re-plucking a sounding string damps the old note first (like a real string).
- **Tone presets**: Acoustic (no drive, warm EQ), Clean electric (slight compression), Overdrive (waveshaper pushed hard).
- AudioContext starts suspended; resumed on the first keypress (browser autoplay policy).

## 5. UI

- **Fretboard view**: horizontal strings with the mapped keyboard keys drawn on the fret positions. A pressed key lights up and its string "vibrates" (CSS/rAF animation).
- **Header**: mode indicator (Lead/Chord), octave offset badge, tone preset selector, volume.
- **Footer**: compact shortcut cheatsheet.
- Note names shown on each key cap (togglable) — doubles as a learning aid.

## 6. Project structure

```
EGuitar/
  index.html
  src/
    main.tsx
    audio/
      types.ts       # SoundEngine + VoiceHandle interfaces
      context.ts     # AudioContext, master chain (drive → EQ → reverb → gain), presets
      karplus.ts     # KarplusStrongEngine (default)
      sampler.ts     # SamplerEngine (lazy-loaded samples)
      voices.ts      # voice pool, oldest-note stealing
    music/
      theory.ts      # note↔frequency math, tunings, chord shapes
    input/
      keymap.ts      # physical key → (string, fret) tables
      keyboard.ts    # event listeners, octave/mode state, repeat guard
    components/
      Fretboard.tsx
      Controls.tsx
      KeyboardHints.tsx
    state/
      store.ts       # octave, mode, preset, tuning
```

## 7. Distribution / portability

`npm run build` uses `vite-plugin-singlefile` to inline all JS and CSS into a single `dist/index.html`. That one file is the whole app — copy it to any machine (macOS, Windows, Linux), double-click, and it runs offline in any modern browser. No server, no install. `base: './'` keeps asset paths relative so it also works hosted under any subpath (GitHub Pages, S3, etc.).

## 8. Milestones

1. **M1 — First sound**: Vite + React + TS scaffold; pressing any mapped key plays the correct pitch through the Karplus-Strong engine.
2. **M2 — Playable lead guitar** *(v1 target)*: full 4-row mapping, octave shift (Shift+↑/↓), string-window slide, visual fretboard with pressed-key feedback.
3. **M3 — Sampler engine**: recorded guitar sample set behind the same `SoundEngine` interface, runtime switch in the header.
4. **M4 — Chord mode**: Tab toggle, diatonic chords, Space/Enter strumming, key selection.
5. **M5 — Polish**: tone presets and effects chain, palm mute, settings persistence (localStorage), optional recording/export via MediaRecorder.

## 9. Ideas for later

- Tablature playback: load a tab, highlight which keys to press (guitar-hero style practice).
- MIDI output mode so EGuitar can drive a DAW.
- Bend/vibrato on ↑/↓ arrow while a note is held.
