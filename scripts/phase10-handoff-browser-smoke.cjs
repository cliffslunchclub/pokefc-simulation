'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const server=process.env.PHASE10_URL||'http://127.0.0.1:8765/';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1450,height:980}});
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 try{
  await page.goto(server+'host.html',{waitUntil:'domcontentloaded'});
  await page.locator('#launch').waitFor({state:'visible'});
  await page.waitForFunction(()=>!!window.PFC_TEST_DATA||!!window.__PFC_HOST_ERROR__,null,{timeout:15000});
  const loadError=await page.evaluate(()=>window.__PFC_HOST_ERROR__);
  assert(!loadError,'Public host could not load fixture: '+loadError);
  await page.locator('#launch').click();
  await page.locator('#phase10-soccer-watch iframe').waitFor();
  const iframe=page.frameLocator('#phase10-soccer-watch iframe');
  await page.waitForFunction(()=>{
   const element=document.querySelector('#phase10-soccer-watch iframe');
   return element?.contentWindow?.__PFC_VIEWER_READY__||element?.contentWindow?.__PFC_VIEWER_ERROR__;
  },null,{timeout:150000});
  const info=await iframe.locator('#score').textContent();
  assert(info.includes('0'),'Viewer did not start at 0–0');
  const initial=await iframe.locator('#pitch').evaluate(()=>{
   const s=window.__PFC_SNAPSHOT__;
   return {score:s.score,players:s.players,actualSprites:s.actualSprites};
  });
  assert.equal(initial.players,22);
  assert.equal(initial.actualSprites,true,'Real Soccer-JS sprites were not loaded');
  assert.deepEqual(initial.score,[0,0]);
  await iframe.locator('#nextGoal').click();
  const mid=await iframe.locator('#pitch').evaluate(()=>window.__PFC_SNAPSHOT__);
  assert.deepEqual(mid.score,[1,0],'Goal at 54 min was not replayed');
  await page.getByRole('button',{name:'⚡ Sim to End'}).click();
  await page.waitForFunction(()=>{
   const e=document.querySelector('#phase10-soccer-watch iframe');
   return e?.contentWindow?.__PFC_SNAPSHOT__?.minute===90;
  });
  const atEnd=await iframe.locator('#pitch').evaluate(()=>window.__PFC_SNAPSHOT__);
  assert.deepEqual(atEnd.score,[2,1],'Skipping generated a different result');
  await page.getByRole('button',{name:'✓ Record official result'}).click();
  await page.waitForFunction(()=>window.__PFC_HOST__?.records===1);
  const after=await page.evaluate(()=>window.__PFC_HOST__);
  assert.equal(after.records,1);
  assert.deepEqual(after.recordedScore,[2,1]);
  assert.equal(after.lastHandoff,'watch-to-quick-sim');
  assert.equal(after.lastClose,'recorded');
  await page.locator('#launch').click();
  await page.locator('#phase10-soccer-watch iframe').waitFor();
  await page.getByRole('button',{name:'✕ Close without recording'}).click();
  const canceled=await page.evaluate(()=>window.__PFC_HOST__);
  assert.equal(canceled.records,1,'Cancel accidentally saved');
  assert.equal(canceled.lastClose,'canceled');
  fs.mkdirSync('phase10-reports',{recursive:true});
  await page.screenshot({path:'phase10-reports/watch-handoff-browser.png',fullPage:true});
  const report={result:'PASS',genuineQuickSimFixture:true,
   nativeSoccerJSSprites:true,players:22,
   firstGoalAt54:mid.score,handoffMinute:mid.minute,
   afterSimToEnd:atEnd.score,recordCount:after.records,
   cancelPreservedRecordCount:canceled.records,
   iframeCommunicationsVerified:true,errors};
  fs.writeFileSync('phase10-reports/watch-handoff-browser.json',JSON.stringify(report,null,2));
  assert.equal(errors.length,0,'Browser errors occurred: '+JSON.stringify(errors.slice(0,5)));
  console.log('PASS browser handoff: real Quick Sim fixture and sprites, 1–0 to 2–1 Sim-to-End, one saved result, cancel does not save');
 }finally{await browser.close()}
})().catch(e=>{console.error('FAIL public Watch-to-Sim browser: '+(e.stack||e));process.exitCode=1});
