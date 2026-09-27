# Exam Companion prototypes

This repository contains standalone gramophone motion studies used to explore the character mechanics before production integration.

## Prototypes

Both instrument studies include a separate **Frustration** preview button: a 6.6-second instrument-lowering and horn-drooping gesture, a defeated pause, then a walk off the left edge. It cancels active music and supports pause, scrubbing, replay, and Ready pose reset. Like the other study controls, explicitly requested previews run with reduced motion enabled, with secondary frustration sway suppressed. Run `node tests/frustration.cjs` with `PLAYWRIGHT_PATH` pointing to an installed Playwright package to verify both editions.

- [`GramophoneEntrancePrototype`](GramophoneEntrancePrototype/): articulated entrance study with walking, settling, pocket, record grip, deterministic IK, and a cancellable animation loop.
- [`gramophone-violin`](gramophone-violin/): violin edition with the same articulated character, short and long bow performances, selectable chords, synthesized violin audio, and progressive note playback.
- [`Guitar-prototype`](Guitar-prototype/): acoustic guitar SVG edition with fretting and picking hands, synthesized plucked strings, and sequential chord-note playback.

These folders are dependency-light browser prototypes. Open their `index.html` files directly, or serve this directory with a local static server. Each instrument prototype documents its behavior in its own README.

These prototypes are separate from the Blazor production game. They contain no application database, learning rules, persistence, or backend code.
