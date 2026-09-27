/* Local, synthesized bowed strings. No samples, downloads, or autoplay. */
(function () {
  'use strict';
  const pitchClasses = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const VIOLIN_VOICE = Object.freeze({
    // A bowed-string spectrum: strong fundamental, controlled early
    // harmonics, and a gentle high-frequency taper instead of a sawtooth.
    harmonicAmplitudes: [0, 1, .55, .34, .22, .15, .09, .055, .035, .02, .014, .01, .007, .005, .0035, .0025],
    bodyPeaks: Object.freeze([
      Object.freeze({ frequency: 280, gain: 1.8, q: .65 }),
      Object.freeze({ frequency: 720, gain: 2.1, q: .65 }),
      Object.freeze({ frequency: 2500, gain: 3.6, q: .6 })
    ]),
    vibratoRate: 5.9,
    vibratoCents: 15.2,
    shortVibratoCents: 5.5,
    bowNoiseCenter: 2900,
    bowNoiseQ: .75,
    roomSeconds: .26,
    roomMixShort: .035,
    roomMixLong: .075
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
      const attack = Math.min(options.sequence ? .07 : options.full ? 0.10 : 0.065, toneDuration / 4);
      const release = Math.min(options.sequence ? .14 : options.full ? 0.28 : 0.16, toneDuration / 3);
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
      master.gain.value = options.full ? .52 : .68;
      compressor.connect(master);
      const room = context.createConvolver();
      const roomLength = Math.max(1, Math.ceil(VIOLIN_VOICE.roomSeconds * context.sampleRate));
      const roomBuffer = context.createBuffer(2, roomLength, context.sampleRate);
      for (let channel = 0; channel < roomBuffer.numberOfChannels; channel++) {
        const impulse = roomBuffer.getChannelData(channel);
        for (let i = 0; i < impulse.length; i++) {
          const progress = i / impulse.length;
          const seed = Math.sin((i + 1) * (channel + 3) * 12.9898) * 43758.5453;
          impulse[i] = (seed - Math.floor(seed) - .5) * (1 - progress) ** 2.6;
        }
      }
      room.buffer = roomBuffer;
      const roomGain = context.createGain();
      roomGain.gain.value = options.full ? VIOLIN_VOICE.roomMixLong : VIOLIN_VOICE.roomMixShort;
      bodyLowpass.connect(room).connect(roomGain).connect(master);
      master.connect(context.destination);
      const nodes = [voiceBus, highpass, ...bodyFilters, bodyLowpass, compressor, master, room, roomGain], sources = [];
      let resolveFinished, remaining = frequencies.length, cleaned = false, settled = false, cleanupTimer = null;
      const finished = new Promise(resolve => { resolveFinished = resolve; });
      const phrase = { start, end, notes: [...noteNames], starts: toneWindows.map(tone => tone.start), sequence: Boolean(options.sequence), cancelled: false,
        finished, elapsed: () => Math.max(0, context.currentTime - start), duration,
        dispose: () => { phrase.cancel(); cleanup(true); },
        cancel: () => {
          if (cleaned) return;
          phrase.cancelled = true;
          const now = context.currentTime;
          master.gain.cancelScheduledValues(now);
          master.gain.setValueAtTime(master.gain.value, now);
          master.gain.linearRampToValueAtTime(0, now + 0.018);
          sources.forEach(source => { try { source.stop(now + 0.02); } catch {} });
          // A suspended clock cannot finish a fade or dispatch source endings.
          if (context.state !== 'running') cleanup(true);
        }
      };
      const settle = value => {
        if (settled) return;
        settled = true;
        resolveFinished(value);
      };
      const cleanup = (immediate = false) => {
        if (cleaned) return;
        if (!immediate && !cleanupTimer) {
          cleanupTimer = setTimeout(() => { cleanupTimer = null; cleanup(true); }, VIOLIN_VOICE.roomSeconds * 1000 + 80);
          this.active.delete(phrase);
          return;
        }
        cleaned = true;
        if (cleanupTimer) { clearTimeout(cleanupTimer); cleanupTimer = null; }
        nodes.forEach(node => node.disconnect());
        this.active.delete(phrase);
        settle(!phrase.cancelled);
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
        const humanGain = 1 + (index - (frequencies.length - 1) / 2) * .018;
        const amplitude = humanGain * (options.sequence ? .27 : (options.full ? .29 : .245) / Math.sqrt(frequencies.length));
        envelope.gain.setValueAtTime(0, toneStart);
        envelope.gain.linearRampToValueAtTime(amplitude, toneStart + attack);
        envelope.gain.linearRampToValueAtTime(amplitude * .92, Math.max(toneStart + attack, toneEnd - release));
        envelope.gain.linearRampToValueAtTime(0, toneEnd);
        oscillator.connect(stringColor).connect(envelope).connect(voiceBus);
        const companion = context.createOscillator();
        companion.setPeriodicWave(wave);
        companion.frequency.value = frequency * (1 + (index % 2 ? -.0009 : .0007));
        const companionGain = context.createGain();
        companionGain.gain.setValueAtTime(0, toneStart);
        companionGain.gain.linearRampToValueAtTime(amplitude * .045, toneStart + attack);
        companionGain.gain.linearRampToValueAtTime(amplitude * .041, Math.max(toneStart + attack, toneEnd - release));
        companionGain.gain.linearRampToValueAtTime(0, toneEnd);
        companion.connect(stringColor).connect(companionGain).connect(voiceBus);
        nodes.push(oscillator, vibrato, depth, drift, driftDepth, stringColor, envelope, companion, companionGain);
        sources.push(oscillator, vibrato, drift, companion);
        oscillator.onended = () => { if (--remaining === 0) cleanup(); };
        oscillator.start(toneStart); vibrato.start(toneStart); drift.start(toneStart); companion.start(toneStart);
        oscillator.stop(toneEnd); vibrato.stop(toneEnd); drift.stop(toneEnd); companion.stop(toneEnd);
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
