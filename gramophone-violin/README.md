# The Little Virtuoso

A poseable paper-craft gramophone with a violin. The wooden cabinet and brass horn retain the supplied character’s visual identity; the articulated limbs, instrument, bow and hands are designed for this edition.

## Open the preview

Open **index.html** in a modern browser. Keep its sibling JavaScript and CSS files together; it needs no package installation or internet connection and works directly from a file URL. Choose a chord, then use the single musical Play button below the character: each press introduces one note, and the following press performs the complete set as a longer note-by-note violin phrase. The same chord then resets for another cycle. C minor, F minor, G minor, and Eb major are included.

The separate Animation study controls preserve Arrival, A Little Note, The Recital, the whole story, pause/resume, restart, speed, scrubbing, and looping. These controls preview motion silently. The primary musical Play button creates synthesized violin-like audio after the user's gesture and always drives the character: individual notes use the existing short bow gesture, while the full chord uses the existing long performance. With reduced motion, the same musical actions use gentler bow strokes with strongly reduced body and horn sway.

To serve the directory locally, run `python -m http.server 5194 --bind 127.0.0.1` here and open `http://127.0.0.1:5194/`.

## Files

| File | Purpose |
|---|---|
| `assets/` | 17 individual editable SVG parts |
| `gramophone-ready.svg` | Self-contained character in the ready pose |
| `gramophone-carrying.svg` | Self-contained character carrying the violin |
| `index.html` | Original inline SVG, chord builder, and animation-study controls |
| `animation.js` | Single loaded source for the original rig and player API |
| `style.css` | Single loaded UI stylesheet |
| `audio.js` | Native Web Audio string synthesis, note conversion, scheduling and cleanup |
| `musicMechanic.js` | Chord configuration, one-button progression, feedback and lifecycle |
| `tests/music.cjs` | Edge/Playwright interaction, motion, audio and lifecycle regression checks |
| `rig-manifest.json` | Asset bounds, pivots, segment lengths, contact rules and durations |
| `codex-prompt.json` | Detailed implementation prompt for integrating the character into your existing game |
| `character-sheet.png` | Carry, ready and playing poses |
| `animation-preview.gif` | Silent rendered preview of the full sequence |
| `validation.json` | Numerical checks of reach, bow contact and playback lifecycle |

## Motions

- **Arrival — 4.8 seconds:** walk in, plant feet, lift violin and position the bow.
- **Short — 1.7 seconds:** compact note gesture and return to ready.
- **Long — 8 seconds:** alternating bow strokes, finger lifts and musical sway. Can loop.
- **Full — 15.3 seconds:** arrival, short gesture, 0.8-second pause, long phrase.

The motions are a stylized performance, not fingering or bowing for a particular composition. The musical mechanic reuses the exact short and long pose samplers, retiming their full paths to 0.72 seconds and 2.4 seconds. Study controls keep the original durations above.

## Music ownership and cancellation

`CHORDS` in `musicMechanic.js` is the single chord configuration. Any nonempty notes array is supported; progression uses its length rather than assuming a triad. `currentStep` is the next note index, and index N means the next press performs all N notes sequentially across the long animation. Already introduced notes remain visible until completion, including a 220 ms completion acknowledgement. The Play button locks for the current sound, preventing queued or overlapping steps. Changing chord or restarting resets progress and cancels sound and movement. Study controls can interrupt playback.

`ViolinAudio.ViolinSynth` exposes `initializeAudio()`, `playViolinNote()`, `playViolinSequence()`, `playViolinChord()`, `stopMusic()`, and `dispose()`. `ViolinAudio.noteToFrequency()` accepts letter notes, optional flat/sharp, and octave. There are no sound files. `playViolinSequence()` gives every note a separate non-overlapping audio-clock window; the three-note phrase starts at 0.0, 0.8, and 1.6 seconds within the 2.4-second long performance. The controller samples that same audio clock for the existing animation poses. A short gain fade stops replaced sound, and completion/disposal disconnects nodes and releases promises.

### Violin voice parameters

The voice starts with a normalized harmonic `PeriodicWave`, then applies a changing per-note low-pass response, a six-peak body filter bank, 5.9 Hz vibrato, slow pitch drift, one shared filtered bow-friction layer, and dynamics control. These values are exposed as `ViolinAudio.parameters` for listening adjustments.

- Spectral-envelope peaks are centered around 280, 500, 1000, 2000, 2500, and 3000 Hz. The middle bands follow measured violin envelope regions, while the broad 2.5 kHz boost represents the violin bridge hill described by Woodhouse: [On the Bridge Hill of the Violin](https://euphonics.org/wp-content/uploads/2022/03/BridgeHill.pdf).
- Sustained-note vibrato uses 5.9 Hz and ±15.2 cents from measured violin vibrato: [The time-frequency characteristics of violin vibrato](https://pubmed.ncbi.nlm.nih.gov/10641668/). Short notes use a restrained 5.5-cent depth because their 0.72-second duration does not leave a long steady state.
- The attack opens its spectrum over roughly 180 ms, within the 0–220 ms transient interval examined in [Microstructure of sound: formants in the dynamical spectra of violin sounds](https://acoustics.ippt.pan.pl/index.php/aa/article/view/1128).
- The custom harmonic wave, sample-accurate envelopes, detune modulation, and absolute start times use the corresponding primitives from the [W3C Web Audio API](https://www.w3.org/TR/webaudio/).

One existing `GramophoneViolinPlayer` owns all movement. Its short/long wrapper methods accept the audio schedule; pause, seek and standalone previews retain their original transport behavior. The mechanic cancels on chord changes, study-control interruption, hidden tabs, pagehide, reduced-motion changes, and SVG removal. Generation checks prevent late audio initialization from playing a stale selection. No autoplay or storage is used.

## Rig and integration

Embed the assembled SVG inline to control its internal groups. Standalone SVG parts and assembled pose files are static; the supplied JavaScript animates their transforms. CSS animation on an `<img>` cannot articulate the internal limbs.

`GramophoneViolinPlayer` exposes `play('entrance' | 'short' | 'long' | 'full')`, `pause()`, `resume()`, `seek(seconds)`, `ready()` and `destroy()`. Set `rate` and `loop` as needed. The supplied preview exposes its instance as `window.gramophone`.

The preview loads `animation.js` exactly once, followed by `audio.js` and `musicMechanic.js`; duplicate embedded code was removed. SVG artwork and its wrappers are unchanged. This folder is a standalone mechanics experiment and has no production imports, backend changes, persistence, or Blazor dependencies. Any future production integration needs a separate deliberate port.

The constructor also accepts `{ onUpdate, onComplete }`. The SVG emits `gramophone:clipstart` and `gramophone:clipcomplete`, each with `event.detail.clip`. In a real game, coordinate entrance and performance through its existing state layer, queuing short/long requests until entrance finishes. The preview buttons intentionally start isolated clips immediately for inspection.

### Coordinate contract

Anatomical left is the viewer’s right. Limbs are drawn along local +X, with their pivot at [0,0]. Arms have lengths 135 + 140; legs 114 + 112. The violin bridge is [0,0] and its neck grip is [208,0]. The bow hair lies at y=10 and the bow grip is [143,10].

Hands are derived from instrument transforms and elbows are solved with two-bone inverse kinematics. Keep these relationships when changing the motion. Pivots and viewBoxes are listed in rig-manifest.json. Body and horn use the supplied global art coordinates and have nonzero viewBox origins.

Prefix SVG IDs and all local href/url references if more than one instance is mounted. For game use, separate preview-only controls from the reusable player class as appropriate to the existing frontend architecture.

## Verification

- All four clips sampled at 60 frames per second for finite transforms, joint reach and bow contact.
- No arm or leg target exceeds the supplied segment lengths in those samples.
- Bow contact error is below 0.000000001 SVG units during playing.
- Long loop endpoints match within floating-point tolerance.
- Runtime checks cover clock advancement, pause/resume, loop and reduced motion.
- Poses and the rendered full sequence were visually inspected using SVG rasterization.
- Interactive verification now runs in real headless Edge against the local file URL, including normal Play/pause/resume, all four chord choices, the full C-minor cycle, keyboard activation, rapid clicks, changing chords during sound, restarting, and all original study clips.
- A four-note configuration verifies variable chord sizes. Reduced motion retains sound, gentler animation, and progress. Offline Web Audio rendering verifies audible energy, a 0.58 peak, sequential 0.8-second note starts, a silent tail, strong harmonic energy, and a harmonic centroid around 1.56 kHz. Lifecycle checks cover hidden tabs, delayed audio unlock cancellation, and SVG removal.
- Responsive screenshots at 1440, 1024, and 390 pixels are written to `artifacts/` by the test. Subjective timbre and physical speaker/headphone listening still need human review.

Run `node --check animation.js`, `node --check audio.js`, `node --check musicMechanic.js`, and `node tests/music.cjs`. The browser test uses the existing sibling prototype's Playwright installation, or `PLAYWRIGHT_PATH` can point to another installed Playwright package; Microsoft Edge must be installed. No runtime package dependency is introduced.
