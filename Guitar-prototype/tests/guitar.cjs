const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    assert.equal(await page.locator('#guitar-root').count(), 1);
    assert.equal(await page.locator('#left-hand use[href="#art-fret-hand"]').count(), 1);
    assert.ok(await page.evaluate(() => {
      const guitar = document.querySelector('#guitar-root');
      const hand = document.querySelector('#left-hand');
      return !!(guitar.compareDocumentPosition(hand) & Node.DOCUMENT_POSITION_FOLLOWING);
    }), 'Fretting hand must render in front of the guitar');
    assert.equal(await page.locator('#art-violin, #art-bow').count(), 0);
    const geometry = await page.evaluate(() => {
      let maxError = 0;
      for (const clip of ['entrance','short','long','full']) {
        gramophone.clip = clip;
        for (let t = 0; t <= ({entrance:4.8,short:1.7,long:8,full:15.3})[clip]; t += .05) {
          gramophone.time = t; gramophone.render(); maxError = Math.max(maxError, gramophone.maxReachError);
        }
      }
      gramophone.ready(); return maxError;
    });
    assert.ok(geometry < 1, 'Wrists and feet must remain within rigid limb reach: '+geometry);
    for (let i=0;i<4;i++) {
      await page.locator('#play-music').click();
      if (i === 0) {
        const before = await page.locator('#right-hand').getAttribute('transform');
        await page.waitForTimeout(90);
        assert.notEqual(await page.locator('#right-hand').getAttribute('transform'), before);
      }
      await page.waitForFunction(() => !musicMechanic.state.isPlaying);
    }
    assert.equal(await page.evaluate(() => musicMechanic.state.currentStep), 0);
    const performedChord = await page.evaluate(() => ({
      sequence: musicMechanic.audio.lastSchedule.sequence,
      starts: musicMechanic.audio.lastSchedule.starts
    }));
    assert.equal(performedChord.sequence, false);
    assert.ok(performedChord.starts.at(-1)-performedChord.starts[0] <= .025,
      'Chord notes should begin within one quick strum');
    const audio = await page.evaluate(async () => {
      const ctx = new OfflineAudioContext(1, 48000*3, 48000);
      const synth = new GuitarAudio.GuitarSynth(ctx);
      const schedule = synth.playGuitarChord(['C4','Eb4','G4'],2.4);
      const out = (await ctx.startRendering()).getChannelData(0);
      return { peak: out.reduce((a,b)=>Math.max(a,Math.abs(b)),0), starts: schedule.starts, tail: out.slice(125000).some(v=>v!==0) };
    });
    assert.ok(audio.peak > .02 && audio.peak < 1); assert.equal(audio.tail, false);
    assert.ok(audio.starts.at(-1)-audio.starts[0] <= .025);
    await page.locator('#play-music').click();
    await page.locator('[data-chord="f-minor"]').click();
    assert.equal(await page.evaluate(() => musicMechanic.state.isPlaying), false);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('#play-music').click();
    await page.waitForFunction(() => !musicMechanic.state.isPlaying);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    for (const width of [390,1024,1440]) {
      await page.setViewportSize({width,height:1100});
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    await page.evaluate(() => gramophone.ready());
    await page.screenshot({path:path.resolve(__dirname,'../preview.png'),fullPage:true});
    assert.deepEqual(errors, []);
    console.log('PASS: foreground fretting grip, guitar geometry, audible playback, synchronized chord, reset, cancellation, reduced motion, responsive layout.');
    console.log(JSON.stringify({geometry,audio}));
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
