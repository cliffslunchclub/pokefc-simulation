'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const url=process.env.PHASE10_URL||'http://127.0.0.1:8765/';
async function seek(page,minute){
 return page.locator('#scrub').evaluate((element,t)=>{
  element.value=String(t);element.dispatchEvent(new Event('input',{bubbles:true}));
  return window.__PFC_SNAPSHOT__;
 },minute);
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1440,height:1024},deviceScaleFactor:1});
 const errors=[],report={};
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 try{
  await page.goto(url+'index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__PFC_VIEWER_READY__||window.__PFC_VIEWER_ERROR__,null,{timeout:140000});
  const error=await page.evaluate(()=>window.__PFC_VIEWER_ERROR__||null);
  assert(!error,'Viewer startup failed: '+error);
  const initial=await page.evaluate(()=>window.__PFC_SNAPSHOT__);
  assert.equal(initial.projection,'isometric','2.5D must be the default');
  assert.equal(initial.camera,'wide','Camera must start in wide mode');
  assert.equal(initial.actualSprites,true,'Native Soccer-JS sprites not loaded');
  assert.equal(initial.players,22);
  assert.deepEqual(initial.score,[0,0]);
  report.default={projection:initial.projection,camera:initial.camera,scale:initial.scale,players:22,realSprites:true};
  fs.mkdirSync('phase10-reports',{recursive:true});
  await page.screenshot({path:'phase10-reports/isometric-wide.png',fullPage:true});

  const samplePass=await seek(page,.23);
  assert.equal(samplePass.animation,'illustrative-pass');
  const sampleChallenge=await seek(page,.57);
  assert.equal(sampleChallenge.animation,'illustrative-challenge');
  assert.deepEqual(sampleChallenge.score,[0,0]);
  report.firstFive={passAt:.23,challengeAt:.57,authoritativeScore:[0,0]};

  await page.locator('#camera').selectOption('follow');
  const follow=await page.evaluate(()=>window.__PFC_SNAPSHOT__);
  assert.equal(follow.projection,'isometric');
  assert.equal(follow.camera,'follow');
  assert(follow.scale>initial.scale*1.3,'Following camera must zoom into original isometric rendering');
  await page.screenshot({path:'phase10-reports/isometric-follow.png',fullPage:true});

  for(const mode of ['orthographic','topdown','isometric']){
   await page.locator('#projection').selectOption(mode);
   const s=await page.evaluate(()=>window.__PFC_SNAPSHOT__);
   assert.equal(s.projection,mode,'Projection mode not applied');
   assert.deepEqual(s.score,[0,0],'Changing view changed Quick Sim score');
  }
  await page.locator('#camera').selectOption('wide');
  const back=await page.evaluate(()=>window.__PFC_SNAPSHOT__);
  assert.equal(back.camera,'wide');
  assert.equal(back.projection,'isometric');

  // Full first five-minute segment, rendered with native sprite/ball/pitch
  // frames; no server calls, no Soccer-JS AI/physics or new match outcome.
  await page.locator('#restart').click();
  await page.locator('#speed').selectOption('4');
  await page.locator('#playFive').click();
  await page.waitForFunction(()=>window.__PFC_SNAPSHOT__?.minute>=4.999,null,{timeout:20000});
  const five=await page.evaluate(()=>window.__PFC_SNAPSHOT__);
  assert.equal(five.minute,5);
  assert.deepEqual(five.score,[0,0]);
  report.fiveMinuteClip={reachedMinute:five.minute,officialScore:five.score};

  // Original Quick Sim goals must remain the only scoring events.
  const firstGoal=await page.evaluate(async()=>{
   const f=await (await fetch('./fixture.json')).json();return f.events[0].minute;
  });
  await seek(page,firstGoal-.03);
  await page.screenshot({path:'phase10-reports/isometric-goal-buildup.png',fullPage:true});
  await page.locator('#nextGoal').click();
  const g1=await page.evaluate(()=>window.__PFC_SNAPSHOT__);
  assert.deepEqual(g1.score,[1,0]);
  await page.locator('#nextGoal').click();
  const g2=await page.evaluate(()=>window.__PFC_SNAPSHOT__);
  assert.deepEqual(g2.score,[2,0]);
  await page.locator('#nextGoal').click();
  const g3=await page.evaluate(()=>window.__PFC_SNAPSHOT__);
  assert.deepEqual(g3.score,[2,1]);
  await page.locator('#skip').click();
  const end=await page.evaluate(()=>window.__PFC_SNAPSHOT__);
  assert.deepEqual(end.score,[2,1]);
  report.goals=[g1.score,g2.score,g3.score];report.final=end.score;

  await page.locator('#restart').click();
  assert.deepEqual((await page.evaluate(()=>window.__PFC_SNAPSHOT__)).score,[0,0]);
  const bench=await page.evaluate(()=>{
   const slider=document.getElementById('scrub');
   const samples=[];
   for(let i=0;i<45;i++){
    const start=performance.now();slider.value=String(i/9);
    slider.dispatchEvent(new Event('input',{bubbles:true}));
    samples.push(performance.now()-start);
   }
   samples.sort((a,b)=>a-b);
   return {medianMs:samples[22],p95Ms:samples[42],maxMs:samples[44]};
  });
  assert(Number.isFinite(bench.p95Ms)&&bench.p95Ms>0,'No measured render performance');
  report.renderPerformance=bench;
  assert.equal(errors.length,0,'Browser errors: '+JSON.stringify(errors.slice(0,5)));
  fs.writeFileSync('phase10-reports/isometric-browser.json',JSON.stringify({
   outcome:'PASS',...report,consoleErrors:errors,
   note:'Illustrative movement is not the true Quick Sim pass/tackle sequence; native Soccer-JS sprite renderer is used.'
  },null,2));
  console.log('PASS isometric Soccer-JS: 22 original sprites, 5-min passes/contests, 3 official goals, 3 projection modes, follow camera, p95 '+bench.p95Ms.toFixed(1)+'ms');
 }finally{await browser.close()}
})().catch(e=>{console.error('FAIL isometric browser '+(e.stack||e));process.exitCode=1});
