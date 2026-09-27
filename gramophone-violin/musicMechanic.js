/* Standalone interaction state; deliberately independent of Exam Companion. */
(function () {
  'use strict';
  const CHORDS = {
    'c-minor': { label: 'C minor', notes: ['C4', 'Eb4', 'G4'] },
    'f-minor': { label: 'F minor', notes: ['F4', 'Ab4', 'C5'] },
    'g-minor': { label: 'G minor', notes: ['G4', 'Bb4', 'D5'] },
    'eb-major': { label: 'Eb major', notes: ['Eb4', 'G4', 'Bb4'] }
  };
  const TIMING = { short: 0.72, full: 2.4, payoff: 220 };
  const player = window.gramophone;
  const audio = new window.ViolinAudio.ViolinSynth();
  const ui = Object.fromEntries(['chord-selectors', 'selected-chord', 'note-progress', 'play-music', 'music-status', 'music-debug']
    .map(id => [id, document.getElementById(id)]));
  const panel = document.querySelector('.music-mechanic');
  let selectedChordId = 'c-minor', currentStep = 0, isPlaying = false, state = 'Ready';
  let currentNote = '—', animationType = 'none', generation = 0, reactionTimer = null, message = '';
  let disposed = false;

  function render() {
    const chord = CHORDS[selectedChordId];
    ui['selected-chord'].textContent = chord.label;
    ui['chord-selectors'].querySelectorAll('button').forEach(button => {
      const selected = button.dataset.chord === selectedChordId;
      button.setAttribute('aria-pressed', String(selected));
      button.textContent = (selected ? '✓ ' : '') + CHORDS[button.dataset.chord].label;
    });
    ui['note-progress'].replaceChildren(...chord.notes.map((note, index) => {
      const item = document.createElement('li');
      item.textContent = note + (index < currentStep ? ' ✓' : '');
      item.classList.toggle('introduced', index < currentStep);
      item.setAttribute('aria-label', note + (index < currentStep ? ', introduced' : ', not yet introduced'));
      return item;
    }));
    ui['play-music'].disabled = isPlaying || disposed;
    ui['play-music'].textContent = isPlaying ? (state === 'PlayingFullChord' ? 'Performing phrase…' : 'Playing ' + currentNote + '…')
      : currentStep === chord.notes.length ? 'Play complete phrase' : 'Play ' + chord.notes[currentStep];
    ui['music-status'].textContent = message || (currentStep === chord.notes.length ? 'Phrase ready — hear every note in sequence' : `${currentStep} / ${chord.notes.length} notes introduced`);
    panel.dataset.state = state;
    ui['music-debug'].textContent = `Chord: ${chord.label}\nStep: ${currentStep} / ${chord.notes.length}\nState: ${state}\nNote: ${currentNote}\nAudioContext: ${audio.state}\nAnimation: ${animationType}`;
    document.getElementById('speed').disabled = isPlaying;
    document.getElementById('loop').disabled = isPlaying;
  }
  function cancel({ reset = false } = {}) {
    generation++;
    clearTimeout(reactionTimer); reactionTimer = null;
    audio.stopMusic();
    player.cancelViolinPerformance();
    isPlaying = false; state = 'Ready'; animationType = 'none'; currentNote = '—'; message = '';
    if (reset) currentStep = 0;
    panel.classList.remove('performed');
    render();
  }
  function selectChord(id) {
    if (disposed || !CHORDS[id]) return;
    cancel({ reset: true });
    selectedChordId = id;
    render();
  }
  async function advance() {
    if (disposed || isPlaying) return;
    const token = ++generation;
    const chord = CHORDS[selectedChordId];
    const full = currentStep === chord.notes.length;
    isPlaying = true; state = full ? 'PlayingFullChord' : 'PlayingShortNote';
    currentNote = full ? 'Complete Phrase' : chord.notes[currentStep];
    animationType = full ? 'long' : 'short'; message = '';
    player.cancelViolinPerformance();
    render();
    try {
      await audio.initializeAudio();
      if (disposed || token !== generation) return;
      const schedule = full ? audio.playViolinSequence(chord.notes, TIMING.full, { full: true })
        : audio.playViolinNote(chord.notes[currentStep], TIMING.short);
      if (!full) currentStep++;
      if (full) player.playLongViolinAnimation(schedule);
      else player.playShortViolinAnimation(schedule);
      render();
      const completed = await schedule.finished;
      if (!completed || disposed || token !== generation) return;
      player.setViolinReadyPose();
      if (full) {
        panel.classList.add('performed');
        message = `${chord.label} performed ✓`;
        render();
        reactionTimer = setTimeout(() => {
          reactionTimer = null;
          if (token !== generation || disposed) return;
          currentStep = 0;
          finish();
        }, TIMING.payoff);
      } else finish();
    } catch (error) {
      if (token !== generation || disposed) return;
      cancel();
      message = error.message + ' You can still use the animation study controls.';
      render();
    }
  }
  function finish() {
    isPlaying = false; state = 'Ready'; message = ''; animationType = 'none';
    panel.classList.remove('performed');
    render();
  }
  Object.entries(CHORDS).forEach(([id, chord]) => {
    const button = document.createElement('button');
    button.type = 'button'; button.dataset.chord = id; button.textContent = chord.label;
    button.addEventListener('click', () => selectChord(id));
    ui['chord-selectors'].append(button);
  });
  ui['play-music'].addEventListener('click', advance);
  // Study controls keep their existing behavior and share exactly one rig player.
  document.querySelectorAll('[data-clip], #toggle, #restart, #ready').forEach(control => {
    control.addEventListener('click', () => {
      if (isPlaying || control.id === 'restart' || control.hasAttribute('data-clip')) cancel({ reset: true });
    }, { capture: true });
  });
  document.getElementById('scrub').addEventListener('input', () => { if (isPlaying) cancel({ reset: true }); }, { capture: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); });
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => cancel());
  window.addEventListener('pagehide', () => cancel());
  const observer = new MutationObserver(() => {
    if (!player.svg.isConnected) {
      disposed = true; cancel(); observer.disconnect(); audio.dispose(); player.destroy();
    }
  });
  observer.observe(player.svg.parentElement, { childList: true });
  // Read-only state plus explicit commands for diagnostics and focused browser checks.
  window.musicMechanic = { chords: CHORDS, advance, selectChord, reset: () => cancel({ reset: true }), audio,
    get state() { return { selectedChordId, currentStep, isPlaying, state, currentNote, animationType }; } };
  render();
})();
