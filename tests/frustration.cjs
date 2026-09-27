const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.PLAYWRIGHT_PATH || 'playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  for(const folder of ['gramophone-violin','Guitar-prototype']) {
   const page=await browser.newPage({viewport:{width:1440,height:1100}});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(pathToFileURL(path.resolve(__dirname,'..',folder,'index.html')).href);
   await page.click('#play-music');
   await page.click('[data-clip="frustration"]');
   assert.equal(await page.evaluate(()=>musicMechanic.state.isPlaying),false);
   await page.waitForFunction(()=>gramophone.time>.15 && gramophone.playing);
   const poses=await page.evaluate(()=>{
    gramophone.pause();let maxError=0;
    for(let t=0;t<=6.6;t+=.025){gramophone.seek(t);maxError=Math.max(maxError,gramophone.maxReachError);}
    gramophone.seek(1.8);const slump={...gramophone.pose};
    gramophone.seek(6.6);const end={...gramophone.pose};
    gramophone.seek(1.8);return {maxError,slump,end};
   });
   assert.ok(poses.maxError<1,'Rigid limbs remain attached: '+poses.maxError);
   assert.equal(poses.slump.raise,0);assert.ok(poses.slump.hornAngle>20);
   assert.ok(Math.abs(poses.slump.rootX)<.001);assert.equal(poses.end.rootX,-1200);
   await page.locator('.stage').screenshot({path:path.resolve(__dirname,'..',folder,'frustration-preview.png')});
   await page.selectOption('#speed','1.5');
   await page.click('[data-clip="frustration"]');
   await page.waitForFunction(()=>!gramophone.playing);
   assert.equal(await page.evaluate(()=>gramophone.frame),null);
   await page.click('#ready');assert.equal(await page.evaluate(()=>gramophone.pose.rootX),0);
   await page.emulateMedia({reducedMotion:'reduce'});
   await page.click('[data-clip="frustration"]');
   await page.waitForFunction(()=>gramophone.playing && gramophone.time>.1);
   await page.click('#ready');assert.deepEqual(errors,[]);
   console.log('PASS '+folder+' frustration, audio cancellation, rigid joints, exit, reset, reduced-motion preview');
   await page.close();
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
