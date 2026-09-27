# Exam Companion prototypes

This repository contains the two standalone gramophone motion studies used to explore the character mechanics before production integration.

## Prototypes

- [`GramophoneEntrancePrototype`](GramophoneEntrancePrototype/): articulated entrance study with walking, settling, pocket, record grip, deterministic IK, and a cancellable animation loop.
- [`gramophone-violin`](gramophone-violin/): violin edition with the same articulated character, short and long bow performances, selectable chords, synthesized violin audio, and progressive note playback.

Both folders are dependency-light browser prototypes. Open their `index.html` files directly, or serve this directory with a local static server. The violin prototype documents its audio and browser verification commands in its own README.

These prototypes are separate from the Blazor production game. They contain no application database, learning rules, persistence, or backend code.
