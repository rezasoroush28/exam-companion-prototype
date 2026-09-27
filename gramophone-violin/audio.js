/* Local, synthesized bowed strings. No samples, downloads, or autoplay. */
(function () {
  'use strict';
  const pitchClasses = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const VIOLIN_VOICE = Object.freeze({
    harmonicAmplitudes: [0, 1, .82, .66, .52, .43, .35, .30, .25, .21, .18, .15, .13, .11, .095, .08, .07, .06, .05, .04, .035, .03, .026, .022],
    bodyPeaks: Object.freeze([
      Object.freeze({ frequency: 280, gain: 2.5, q: .75 }),
      Object.freeze({ frequency: 500, gain: 4.2, q: .85 }),
      Object.freeze({ frequency: 1000, gain: 3.1, q: .9 }),
      Object.freeze({ frequency: 2000, gain: 2.2, q: .8 }),
      Object.freeze({ frequency: 2500, gain: 4.8, q: .72 }),
      Object.freeze({ frequency: 3000, gain: 1.8, q: .8 })
    ]),
    vibratoRate: 5.9,
    vibratoCents: 15.2,
    shortVibratoCents: 5.5,
    bowNoiseCenter: 2900,
    bowNoiseQ: .75
  });
  function noteToFrequency(name) {
    const match = /^([A-G])([#b]?)(-?\d+)$/.exec(name);
    if (!match) throw new Error('Invalid note: ' + name);
    const midi = (Number(match[3]) + 1) * 12 + pitchClasses[match[1]] + (match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0);
    return 440 * 2 ** ((midi - 69) / 12);
  }

  class ViolinSynth {
    constructor(context = null) {
      this.context = context;
      this.active = new Set();
      this.lastSchedule = null;
    }
    async initializeAudio() {
      if (!this.context) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) throw new Error('This browser does not support Web Audio.');
        this.context = new Audio();
      }
      if (this.context.state === 'suspended') await this.context.resume();
      if (this.context.state !== 'running') throw new Error('Audio is unavailable. Press Play to retry.');
      return this.context;
    }
    playViolinNote(noteName, duration, options) {
      return this.playViolinPhrase([noteName], duration, options);
    }
    playViolinChord(noteNames, duration, options = {}) {
      return this.playViolinPhrase(noteNames, duration, { ...options, sequence: false });
    }
    playViolinSequence(noteNames, duration, options = {}) {
      return this.playViolinPhrase(noteNames, duration, { ...options, sequence: true });
    }
    playViolinPhrase(noteNames, duration, options = {}) {
      const context = this.context;
      if (!context) throw new Error('Initialize audio with a user gesture first.');
      if (!noteNames.length || !Number.isFinite(duration) || duration <= 0) throw new Error('Invalid musical phrase.');
      const frequencies = noteNames.map(noteToFrequency);
      this.stopMusic();
      const start = context.currentTime + 0.015;
      const end = start + duration;
      const toneDuration = options.sequence ? duration / frequencies.length : duration;
      const toneWindows = frequencies.map((_, index) => options.sequence
        ? { start: start + index * toneDuration, end: start + (index + 1) * toneDuration }
        : { start, end });
      // Measured violin spectra stabilize over the first ~220 ms. Give the
      // sustained chord more time to establish than the detached note.
      const attack = Math.min(options.sequence ? .07 : options.full ? 0.13 : 0.065, toneDuration / 4);
      const release = Math.min(options.sequence ? .14 : options.full ? 0.32 : 0.16, toneDuration / 3);
      const real = new Float32Array(VIOLIN_VOICE.harmonicAmplitudes.length);
      const imaginary = Float32Array.from(VIOLIN_VOICE.harmonicAmplitudes);
      const wave = context.createPeriodicWave(real, imaginary);
      const voiceBus = context.createGain();
      voiceBus.gain.value = 1;
      const highpass = context.createBiquadFilter();
      highpass.type = 'highpass'; highpass.frequency.value = 115; highpass.Q.value = .55;
      voiceBus.connect(highpass);
      let bodyOutput = highpass;
      const bodyFilters = VIOLIN_VOICE.bodyPeaks.map(peak => {
        const filter = context.createBiquadFilter();
        filter.type = 'peaking'; filter.frequency.value = peak.frequency; filter.Q.value = peak.q; filter.gain.value = peak.gain;
        bodyOutput.connect(filter); bodyOutput = filter; return filter;
      });
      const bodyLowpass = context.createBiquadFilter();
      bodyLowpass.type = 'lowpass'; bodyLowpass.frequency.value = 6800; bodyLowpass.Q.value = .65;
      bodyOutput.connect(bodyLowpass);
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -14; compressor.knee.value = 12; compressor.ratio.value = 3.5; compressor.attack.value = .006; compressor.release.value = .16;
      bodyLowpass.connect(compressor);
      const master = context.createGain();
      master.gain.value = options.full ? .64 : .8;
      compressor.connect(master);
      master.connect(context.destination);
      const nodes = [voiceBus, highpass, ...bodyFilters, bodyLowpass, compressor, master], sources = [];
      let resolveFinished, remaining = frequencies.length, cleaned = false;
      const finished = new Promise(resolve => { resolveFinished = resolve; });
      const phrase = { start, end, notes: [...noteNames], starts: toneWindows.map(tone => tone.start), sequence: Boolean(options.sequence), cancelled: false,
        finished, elapsed: () => Math.max(0, context.currentTime - start), duration,
        dispose: () => { phrase.cancel(); cleanup(); },
        cancel: () => {
          if (cleaned) return;
          phrase.cancelled = true;
          const now = context.currentTime;
          master.gain.cancelScheduledValues(now);
          master.gain.setValueAtTime(master.gain.value, now);
          master.gain.linearRampToValueAtTime(0, now + 0.018);
          sources.forEach(source => { try { source.stop(now + 0.02); } catch {} });
          // A suspended clock cannot finish a fade or dispatch source endings.
          if (context.state !== 'running') cleanup();
        }
      };
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        nodes.forEach(node => node.disconnect());
        this.active.delete(phrase);
        resolveFinished(!phrase.cancelled);
      };
      frequencies.forEach((frequency, index) => {
        const toneStart = toneWindows[index].start, toneEnd = toneWindows[index].end;
        const oscillator = context.createOscillator();
        oscillator.setPeriodicWave(wave);
        oscillator.frequency.value = frequency;
        const vibrato = context.createOscillator();
        vibrato.frequency.value = VIOLIN_VOICE.vibratoRate + index * 0.07;
        const depth = context.createGain();
        depth.gain.setValueAtTime(0, toneStart);
        const vibratoDepth = options.full ? VIOLIN_VOICE.vibratoCents : VIOLIN_VOICE.shortVibratoCents;
        depth.gain.setValueAtTime(0, toneStart + Math.min(.08, toneDuration * .12));
        depth.gain.linearRampToValueAtTime(vibratoDepth, toneStart + Math.min(.24, toneDuration * .4));
        vibrato.connect(depth).connect(oscillator.detune);
        const drift = context.createOscillator();
        drift.frequency.value = .63 + index * .05;
        const driftDepth = context.createGain();
        driftDepth.gain.value = 1.6;
        drift.connect(driftDepth).connect(oscillator.detune);
        const stringColor = context.createBiquadFilter();
        stringColor.type = 'lowpass'; stringColor.Q.value = .62;
        const colorStart = Math.max(1900, Math.min(3200, frequency * 7));
        const colorOpen = Math.max(4800, Math.min(6500, frequency * 15));
        stringColor.frequency.setValueAtTime(colorStart, toneStart);
        stringColor.frequency.exponentialRampToValueAtTime(colorOpen, toneStart + Math.min(.18, toneDuration * .3));
        stringColor.frequency.exponentialRampToValueAtTime(colorOpen * .82, toneEnd - release);
        const envelope = context.createGain();
        const amplitude = options.sequence ? .27 : (options.full ? .29 : .245) / Math.sqrt(frequencies.length);
        envelope.gain.setValueAtTime(0, toneStart);
        envelope.gain.linearRampToValueAtTime(amplitude, toneStart + attack);
        envelope.gain.linearRampToValueAtTime(amplitude * .92, Math.max(toneStart + attack, toneEnd - release));
        envelope.gain.linearRampToValueAtTime(0, toneEnd);
        oscillator.connect(stringColor).connect(envelope).connect(voiceBus);
        nodes.push(oscillator, vibrato, depth, drift, driftDepth, stringColor, envelope);
        sources.push(oscillator, vibrato, drift);
        oscillator.onended = () => { if (--remaining === 0) cleanup(); };
        oscillator.start(toneStart); vibrato.start(toneStart); drift.start(toneStart);
        oscillator.stop(toneEnd); vibrato.stop(toneEnd); drift.stop(toneEnd);
      });
      // One filtered friction layer represents bow hair, shared by all tones
      // so a chord still sounds like one instrument gesture.
      const noiseLength = Math.ceil((duration + .04) * context.sampleRate);
      const noiseBuffer = context.createBuffer(1, noiseLength, context.sampleRate);
      const noiseData = noiseBuffer.getChannelData(0);
      let noiseSeed = 0x51f15e;
      for (let i = 0; i < noiseData.length; i++) {
        noiseSeed = (1664525 * noiseSeed + 1013904223) >>> 0;
        noiseData[i] = noiseSeed / 0x80000000 - 1;
      }
      const bowNoise = context.createBufferSource(); bowNoise.buffer = noiseBuffer;
      const bowBand = context.createBiquadFilter();
      bowBand.type = 'bandpass'; bowBand.frequency.value = VIOLIN_VOICE.bowNoiseCenter; bowBand.Q.value = VIOLIN_VOICE.bowNoiseQ;
      const noiseEnvelope = context.createGain();
      const noiseSustain = options.full ? .008 : .01;
      toneWindows.forEach(tone => {
        noiseEnvelope.gain.setValueAtTime(0, tone.start);
        noiseEnvelope.gain.linearRampToValueAtTime(noiseSustain * 2.4, tone.start + .012);
        noiseEnvelope.gain.linearRampToValueAtTime(noiseSustain, tone.start + Math.min(.11, toneDuration * .25));
        noiseEnvelope.gain.setValueAtTime(noiseSustain, tone.end - release);
        noiseEnvelope.gain.linearRampToValueAtTime(0, tone.end);
      });
      bowNoise.connect(bowBand).connect(noiseEnvelope).connect(voiceBus);
      nodes.push(bowNoise, bowBand, noiseEnvelope); sources.push(bowNoise);
      bowNoise.start(start); bowNoise.stop(end);
      this.active.add(phrase);
      this.lastSchedule = phrase;
      return phrase;
    }
    stopMusic() { [...this.active].forEach(phrase => phrase.cancel()); }
    get state() { return this.context?.state || 'not initialized'; }
    dispose() { [...this.active].forEach(phrase => phrase.dispose()); return this.context?.close?.(); }
  }
  window.ViolinAudio = { ViolinSynth, noteToFrequency, parameters: VIOLIN_VOICE };
})();
