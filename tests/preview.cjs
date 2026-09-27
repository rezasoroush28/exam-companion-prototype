const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const folder of ['gramophone-violin', 'Guitar-prototype']) {
      for (const reducedMotion of ['no-preference', 'reduce']) {
        const page = await browser.newPage({ reducedMotion });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.goto(pathToFileURL(path.resolve(__dirname, '..', folder, 'index.html')).href);
        assert.equal(await page.evaluate(() => gramophone.playing), false);
        await page.click('#toggle');
        await page.waitForFunction(() => gramophone.playing && gramophone.time > .2 && gramophone.time < 2);
        const startX = await page.evaluate(() => gramophone.pose.rootX);
        await page.waitForFunction(x => gramophone.pose.rootX > x + 30, startX);
        await page.click('#toggle');
        const paused = await page.evaluate(() => gramophone.time);
        await page.waitForTimeout(100);
        assert.equal(await page.evaluate(() => gramophone.time), paused);
        await page.click('#toggle');
        await page.waitForFunction(t => gramophone.time > t + .1, paused);
        await page.click('#ready');
        await page.click('[data-clip="entrance"]');
        await page.waitForFunction(() => gramophone.playing && gramophone.time > .1 && gramophone.time < 2);
        await page.selectOption('#speed', '1.5');
        await page.waitForFunction(() => !gramophone.playing);
        assert.equal(await page.evaluate(() => gramophone.pose.rootX), 0);
        assert.equal(await page.evaluate(() => gramophone.pose.raise), 1);
        await page.click('#toggle');
        await page.waitForFunction(() => gramophone.playing && gramophone.time < 2);
        await page.click('#ready');
        assert.equal(await page.evaluate(() => gramophone.frame), null);
        assert.deepEqual(errors, []);
        console.log('PASS: ' + folder + ' / ' + reducedMotion + ' — walking, pause/resume, arrival card, replay, ready cleanup');
        await page.close();
      }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
