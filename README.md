# EGuitar

Play guitar with your QWERTY keyboard. Each key row is a guitar string (high e on top, like a tab), and moving right along a row moves up the frets. Two switchable sound engines: Karplus-Strong plucked-string synthesis (default, instant) and recorded acoustic guitar samples.

Acoustic samples are from [tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments) (CC-BY), bundled into the app at build time so the single-file export stays fully offline.

## Play (Mac keyboard)

| Keys | Action |
|---|---|
| `1–0`, `Q–P`, `A–;`, `Z–/` | Pluck strings e, B, G, D at frets 0–9 |
| `⇧` + `↑` / `↓` | Octave up / down (−2 to +2) |
| `[` / `]` | Slide the 4-string window toward the low A/E strings and back |
| Hold a key | Let the note ring; release to damp it |
| Hold `⌥ Option` | Palm mute |
| Hold `↑` | Bend sounding notes up a whole step (release to fall back) |
| Hold `↓` | Vibrato on sounding notes |
| Overlap keys on one row | Hammer-on (press) and pull-off (release back to the held key) — no re-pick |
| `⇧ Shift` + overlapping key | Slide to that fret instead of hammering |
| `⇥ Tab` | Toggle chord mode |

In chord mode: `1–7` pick (and strum) the diatonic chords of the selected key, `Q`–`P` pick the chord shape (key-default triad, sus2, sus4, 7, maj7, m7, add9, 6, forced maj/min — e.g. `2`+`E` = Dsus4, `2`+`U` = Dadd9 in C), `Space` strums down, `⏎ Enter` strums up, `⌥`+`Space` chucks (percussive muted strum), `Z`–`N` fingerpick individual strings of the current chord (low E → high e), `←`/`→` change key.

## Scale overlay

Turn on the scale bar above the fretboard (lead mode) to light up every note of a scale across the neck. Pick a root (e.g. A) and a scale type — major, natural minor, major/minor pentatonic, blues, dorian, mixolydian, or harmonic minor. Each scale degree is colored by its Indian sargam swara — Sa (red), Re (orange), Ga (yellow), Ma (green), Pa (teal), Dha (blue), Ni (violet) — so you can tell the notes apart at a glance, with the swara name on each fret and the western note in the corner. Sa (the root) carries a glow ring so you can see where the scale starts and ends, komal/tivra notes keep their swara's color with a ♭/♯ marker, and off-scale frets dim out. It's a learning overlay only — you still play normally underneath it.

The header has tone presets (Acoustic / Clean / Drive — EQ, reverb, and overdrive on a shared effects chain) and a `● Rec` button that records your playing and downloads it as a `.webm` audio file. Settings (octave, mode, key, engine, preset, volume) persist across visits via localStorage.

## Develop

```sh
npm install
npm run dev
```

## Play it now

Live at **https://flarsu.github.io/EGuitar/** — no install, works offline after first load.

To deploy an update: `npm run build && cp dist/index.html docs/index.html`, then commit and push (GitHub Pages serves `docs/`).

## Export to any system

```sh
npm run build
```

This produces `dist/index.html` — the entire app inlined into a single file. Copy that one file to any machine (macOS, Windows, Linux) and open it in a browser; it works offline, from `file://`, or hosted anywhere (GitHub Pages, S3, a USB stick).

## Design

See [DESIGN.md](DESIGN.md) for the architecture, sound-engine interface, and roadmap (sampler engine, chord/strum mode, effects).
