/* Procedural plucked strings; native Web Audio, no samples or downloads. */
(function () {
  'use strict';
  const pitches = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function noteToFrequency(note) {
    const m = /^([A-G])([#b]?)(-?\d+)$/.exec(note);
    if (!m) throw new Error('Invalid note: ' + note);
    return 440 * 2 ** (((Number(m[3]) + 1) * 12 + pitches[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) - 69) / 12);
  }
  class GuitarSynth {
    constructor(context = null) { this.context = context; this.active = new Set(); this.lastSchedule = null; }
    async initializeAudio() {
      if (!this.context) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) throw new Error('Web Audio is unavailable.');
        this.context = new Audio();
      }
      if (this.context.state === 'suspended') await this.context.resume();
      if (this.context.state !== 'running') throw new Error('Audio is unavailable. Press Play to retry.');
      return this.context;
    }
    playGuitarNote(note, duration, options = {}) { return this.playGuitarPhrase([note], duration, options); }
    playGuitarSequence(notes, duration, options = {}) { return this.playGuitarPhrase(notes, duration, { ...options, sequence: true }); }
    playGuitarChord(notes, duration, options = {}) { return this.playGuitarPhrase(notes, duration, options); }
    playGuitarPhrase(notes, duration, options = {}) {
      if (!this.context || !notes.length || !Number.isFinite(duration) || duration <= 0) throw new Error('Invalid musical phrase.');
      const frequencies = notes.map(noteToFrequency), context = this.context;
      this.stopMusic();
      const start = context.currentTime + .015, end = start + duration;
      const starts = notes.map((_, i) => start + (options.sequence ? i * duration / notes.length : i * Math.min(.012, duration / notes.length)));
      const master = context.createGain(); master.gain.value = .72;
      master.connect(context.destination);
      const sources = []; let cleaned = false, remaining = notes.length, resolve;
      const finished = new Promise(r => resolve = r);
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true; sources.forEach(s => s.disconnect()); master.disconnect();
        this.active.delete(phrase); resolve(!phrase.cancelled);
      };
      const phrase = { start, end, duration, starts, notes: [...notes], sequence: !!options.sequence, finished, cancelled: false,
        elapsed: () => Math.max(0, context.currentTime - start),
        cancel: () => {
          if (cleaned) return;
          phrase.cancelled = true;
          const now = context.currentTime;
          master.gain.cancelScheduledValues(now); master.gain.setValueAtTime(master.gain.value, now);
          master.gain.linearRampToValueAtTime(0, now + .018);
          sources.forEach(s => { try { s.stop(now + .02); } catch {} });
          if (context.state !== 'running') cleanup();
        },
        dispose: () => { phrase.cancel(); cleanup(); }
      };
      frequencies.forEach((frequency, index) => {
        const seconds = (options.sequence ? (index + 1 < notes.length ? starts[index + 1] : end) : end) - starts[index];
        const buffer = context.createBuffer(1, Math.ceil(seconds * context.sampleRate), context.sampleRate);
        const data = buffer.getChannelData(0);
        // A pluck excites many string modes. Higher modes lose energy faster,
        // leaving the warm fundamental; a tiny pick transient marks the onset.
        let seed = 173 + index;
        const partials = Array.from({ length: 18 }, (_, h) => {
          const n = h + 1;
          return { frequency: frequency * n * Math.sqrt(1 + .000035 * n * n),
            amplitude: Math.sin(n * Math.PI * .23) / n ** 1.35,
            decay: 2.4 + n * .95 };
        }).filter(p => p.frequency < context.sampleRate * .45);
        for (let i = 0; i < data.length; i++) {
          const t = i / context.sampleRate;
          let sample = 0;
          for (const p of partials) sample += p.amplitude * Math.sin(2 * Math.PI * p.frequency * t) * Math.exp(-p.decay * t);
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          sample += (seed / 2147483648 - 1) * .035 * Math.exp(-t * 230);
          const attack = Math.min(1, t / .004), release = Math.min(1, (seconds - t) / Math.min(.075, seconds / 3));
          data[i] = sample * attack * release * .5 / (options.sequence ? 1 : notes.length);
        }
        const source = context.createBufferSource(); source.buffer = buffer;
        source.connect(master); sources.push(source);
        source.onended = () => { if (--remaining === 0) cleanup(); };
        source.start(starts[index]); source.stop(options.sequence && index + 1 < notes.length ? starts[index + 1] : end);
      });
      this.active.add(phrase); this.lastSchedule = phrase; return phrase;
    }
    stopMusic() { [...this.active].forEach(p => p.cancel()); }
    get state() { return this.context?.state || 'not initialized'; }
    dispose() { [...this.active].forEach(p => p.dispose()); return this.context?.close?.(); }
  }
  window.GuitarAudio = { GuitarSynth, noteToFrequency };
})();
