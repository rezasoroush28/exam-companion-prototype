# Gramophone guitar prototype

Open `index.html` directly, or serve this folder with `python -m http.server 5196 --bind 127.0.0.1`.

The same papercraft gramophone character now holds a six-string acoustic guitar. Choose a chord and press the music button to introduce each note. The next press strums all chord notes with tiny guitar-like onset offsets so they sustain together, then resets the cycle. Short notes produce short plucks; the full chord produces one synchronized strumming gesture. Preview controls also offer entrance, a single pluck, a longer recital, scrubbing, speed, and pause.

`assets/guitar.svg` is the standalone guitar artwork. `gramophone-ready.svg` is the complete character in its ready pose. `index.html` embeds the artwork for articulated animation without fetch or external dependencies. The remaining assets contain the reusable body, horn, and limb pieces inherited from the violin study.

`animation.js` owns the rigid instrument transform and hand attachment using two-link IK. Music motion samples the Web Audio schedule. `audio.js` generates plucked string partials with fast-decaying overtones and a quiet pick transient. `musicMechanic.js` owns local note progression only. Hidden tabs, root removal, replay, and changed chord cancel active playback. Reduced motion retains gentle picking with less sway.

No samples, libraries, Blazor, backend, database, or production game changes. Synthesized sound is an approximation of an acoustic guitar.
