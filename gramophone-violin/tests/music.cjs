const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '../../ExamCompanionPrototypeMotion/tests/browser/node_modules/playwright');

(async () => {
 const browser = await chromium.launch({ channel: 'msedge', headless: true });
 const errors = [];
 try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
  const state = () => page.evaluate(() => window.musicMechanic.state);
  const idle = () => page.waitForFunction(() => !window.musicMechanic.state.isPlaying);
  assert.equal(await page.evaluate(() => window.musicMechanic.audio.state), 'not initialized');
  assert.equal(await page.locator('#chord-selectors button[aria-pressed=true]').count(), 1);
  assert.equal(await page.locator('#play-music').count(), 1);
  // Original transport: real clock advancement, pause, resume, arrival end.
  await page.click('#toggle');
  await page.waitForFunction(() => window.gramophone.time > 0.3 && window.gramophone.playing);
  await page.click('#toggle');
  const paused = await page.evaluate(() => window.gramophone.time);
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => window.gramophone.time), paused);
  await page.click('#toggle');
  await page.waitForFunction(t => window.gramophone.time > t, paused);
  await page.click('#ready');
  assert.equal(await page.evaluate(() => window.gramophone.pose.raise), 1);

  const notes = ['C4', 'Eb4', 'G4'];
  for (let i = 0; i < notes.length; i++) {
   await page.click('#play-music');
   await page.waitForFunction(() => window.musicMechanic.audio.lastSchedule !== null);
   assert.deepEqual(await page.evaluate(() => window.musicMechanic.audio.lastSchedule.notes), [notes[i]]);
   assert.equal((await state()).currentStep, i + 1);
   assert.equal(await page.evaluate(() => window.gramophone.clip), 'short');
   const before = await page.locator('#bow-root').getAttribute('transform');
   await page.waitForTimeout(180);
   assert.notEqual(await page.locator('#bow-root').getAttribute('transform'), before, 'bow visibly moves');
   await idle();
  }
  assert.equal(await page.locator('.note-progress .introduced').count(), 3);
  assert.equal(await page.locator('#play-music').textContent(), 'Play complete phrase');
  await page.click('#play-music');
  assert.equal((await state()).state, 'PlayingFullChord');
  assert.deepEqual(await page.evaluate(() => window.musicMechanic.audio.lastSchedule.notes), notes);
  assert.equal(await page.evaluate(() => window.musicMechanic.audio.lastSchedule.sequence), true);
  assert.equal(await page.evaluate(() => new Set(window.musicMechanic.audio.lastSchedule.starts).size), 3);
  assert.equal(await page.evaluate(() => window.gramophone.clip), 'long');
  assert.equal(await page.locator('.note-progress .introduced').count(), 3);
  await page.waitForFunction(() => document.querySelector('.music-mechanic').classList.contains('performed'));
  await idle();
  assert.equal((await state()).currentStep, 0);
  await page.click('#play-music');
  assert.deepEqual(await page.evaluate(() => window.musicMechanic.audio.lastSchedule.notes), ['C4']);
  await page.click('[data-chord=f-minor]');
  assert.equal((await state()).currentStep, 0);
  await page.waitForFunction(() => window.musicMechanic.audio.active.size === 0);
  await page.locator('#play-music').focus();
  await page.keyboard.press('Enter');
  assert.deepEqual(await page.evaluate(() => window.musicMechanic.audio.lastSchedule.notes), ['F4']);
  await idle();
  await page.evaluate(() => { for(let i=0;i<20;i++) document.getElementById('play-music').click(); });
  assert.equal((await state()).currentStep, 2, 'rapid clicks add only one note');
  await idle();
  await page.click('#restart');
  assert.equal((await state()).currentStep, 0);
  await page.click('#ready');
  for (const [id, note] of [['g-minor', 'G4'], ['eb-major', 'Eb4']]) {
   await page.click(`[data-chord=${id}]`);
   await page.click('#play-music');
   assert.deepEqual(await page.evaluate(() => window.musicMechanic.audio.lastSchedule.notes), [note]);
   await idle();
  }
  console.log('PASS: Play preview, C-minor sequential payoff, all selectors, keyboard, rapid-click and restart.');

  // Vary the data to exercise four-note groups through the same interaction.
  await page.evaluate(() => {
   window.musicMechanic.chords['c-minor'].notes = ['C4','Eb4','G4','Bb4'];
   window.musicMechanic.selectChord('c-minor');
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (let i=0;i<4;i++) { await page.click('#play-music'); await idle(); }
  assert.equal((await state()).currentStep, 4);
  await page.click('#play-music');
  assert.equal(await page.evaluate(() => window.musicMechanic.audio.lastSchedule.notes.length), 4);
  assert.equal(await page.evaluate(() => window.gramophone.clip), 'long');
  assert.equal(await page.locator('#character-scene').getAttribute('data-performance'), 'long');
  const reducedBowBefore = await page.locator('#bow-root').getAttribute('transform');
  await page.waitForTimeout(220);
  assert.notEqual(await page.locator('#bow-root').getAttribute('transform'), reducedBowBefore, 'reduced-motion chord keeps gentle visible bowing');
  assert.equal((await state()).isPlaying, true, 'reduced motion does not instantly reset music');
  await page.click('[data-chord=f-minor]');
  await page.waitForTimeout(50);
  assert.equal(await page.evaluate(() => window.musicMechanic.audio.active.size), 0);
  assert.equal((await state()).currentStep, 0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  for (const clip of ['short','long','entrance','full']) {
   await page.click(`[data-clip=${clip}]`);
   await page.waitForFunction(clip => window.gramophone.clip === clip && window.gramophone.time > 0.1, clip);
   await page.click('#ready');
  }
  // Rig sampling across every preserved motion, without changing its artwork or IK.
  assert.equal(await page.evaluate(() => {
   const p=window.gramophone;
   for(const [clip,duration] of [['entrance',4.8],['short',1.7],['long',8],['full',15.3]]) {
    p.play(clip);p.pause();
    for(let t=0;t<=duration;t+=.05){p.seek(t);if(p.maxReachError>.01)return false;}
   }
   p.ready(); return true;
  }), true);
  await page.click('#play-music');
  await page.evaluate(() => { Object.defineProperty(document,'hidden',{configurable:true,value:true}); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(80);
  assert.equal(await page.evaluate(() => window.musicMechanic.audio.active.size), 0);
  assert.equal(await page.evaluate(() => window.gramophone.frame), null);
  await page.evaluate(() => { delete document.hidden; window.musicMechanic.reset(); });

  // Unlock cancellation: a late resume must never play a stale selected chord.
  await page.evaluate(() => {
   const audio=window.musicMechanic.audio;
   const original=audio.initializeAudio.bind(audio);
   audio.initializeAudio=()=>new Promise(resolve=>{window.releaseAudio=async()=>resolve(await original());});
   window.restoreAudio=()=>{audio.initializeAudio=original;};
   window.musicMechanic.advance();window.musicMechanic.selectChord('g-minor');
  });
  await page.evaluate(async () => { await window.releaseAudio(); window.restoreAudio(); });
  assert.equal(await page.evaluate(() => window.musicMechanic.audio.active.size), 0);
  assert.equal((await state()).currentStep, 0);

  // Offline render verifies audible energy, bounded output, and final silence.
  const audioCheck = await page.evaluate(async () => {
   const ctx=new OfflineAudioContext(1,48000*3,48000);
   const synth=new window.ViolinAudio.ViolinSynth(ctx);
   const phrase=synth.playViolinSequence(['C4','Eb4','G4'],2.4,{full:true});
   const result=await ctx.startRendering();const data=result.getChannelData(0);
   const rms=(a,b)=>Math.sqrt(data.slice(a*48000,b*48000).reduce((s,v)=>s+v*v,0)/((b-a)*48000));
   const harmonicContext=new OfflineAudioContext(1,48000*2,48000);
   const harmonicSynth=new window.ViolinAudio.ViolinSynth(harmonicContext);
   harmonicSynth.playViolinNote('A4',1.5);
   const harmonicData=(await harmonicContext.startRendering()).getChannelData(0);
   const first=Math.round(.42*48000), count=8192;
   const magnitude=frequency=>{
    let real=0,imag=0;
    for(let i=0;i<count;i++){
     const window=.5-.5*Math.cos(2*Math.PI*i/(count-1)),angle=2*Math.PI*frequency*i/48000,value=harmonicData[first+i]*window;
     real+=value*Math.cos(angle);imag-=value*Math.sin(angle);
    }
    return Math.hypot(real,imag);
   };
   const harmonics=Array.from({length:8},(_,i)=>magnitude(440*(i+1)));
   const harmonicRatio=harmonics.slice(1).reduce((sum,value)=>sum+value,0)/harmonics[0];
   const harmonicCentroid=harmonics.reduce((sum,value,index)=>sum+value*440*(index+1),0)/harmonics.reduce((sum,value)=>sum+value,0);
   return {middle:rms(.5,1),tail:rms(2.6,2.9),peak:data.reduce((m,v)=>Math.max(m,Math.abs(v)),0),starts:phrase.starts,frequency:window.ViolinAudio.noteToFrequency('A4'),harmonicRatio,harmonicCentroid};
  });
  console.log('AUDIO CHECK', audioCheck);
  assert.ok(audioCheck.middle>.01 && audioCheck.peak<1);
  assert.equal(audioCheck.tail,0);assert.equal(audioCheck.frequency,440);
  assert.ok(audioCheck.harmonicRatio>.45,'bowed voice retains strong overtones');
  assert.ok(audioCheck.harmonicCentroid>750,'body-filtered voice remains harmonically rich');
  assert.equal(new Set(audioCheck.starts).size,3);
  assert.ok(Math.abs(audioCheck.starts[1]-audioCheck.starts[0]-.8)<.0001);
  assert.ok(Math.abs(audioCheck.starts[2]-audioCheck.starts[1]-.8)<.0001);
  const artifacts=path.resolve(__dirname,'../artifacts');fs.mkdirSync(artifacts,{recursive:true});
  for(const width of [1440,1024,390]) {
   await page.setViewportSize({width,height:1100});
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth),true);
   await page.screenshot({path:path.join(artifacts,`violin-${width}.png`),fullPage:true});
  }
  await page.click('#play-music');
  await page.evaluate(() => document.querySelector('#character-scene').remove());
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => window.gramophone.frame),null);
  assert.equal(await page.evaluate(() => window.musicMechanic.audio.active.size),0);
  assert.deepEqual(errors,[]);
  console.log('PASS: four-note chord, reduced motion with sound, original clips/rig reach, hidden-page/root-removal cleanup, stale unlock, offline synthesis and desktop/mobile layout.');
  console.log(JSON.stringify(audioCheck));
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
