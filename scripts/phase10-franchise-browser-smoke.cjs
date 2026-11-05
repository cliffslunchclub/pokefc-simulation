'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.PHASE10_URL||'http://127.0.0.1:8765/';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1400,height:950}});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 try{
  await page.goto(base+'host-franchise.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.__PFC_FRA_FIXTURE__||!!window.__PFC_FRA_ERROR__,null,{timeout:15000});
  assert.equal(await page.evaluate(()=>window.__PFC_FRA_ERROR__||null),null);
  await page.locator('#start').click();
  const iframe=page.locator('.pitch-frame iframe.soccerjs-inline-frame');
  await iframe.waitFor({state:'visible'});
  await page.waitForFunction(()=>{
   const w=document.querySelector('.pitch-frame iframe')?.contentWindow;
   return !!w?.__PFC_VIEWER_READY__||!!w?.__PFC_VIEWER_ERROR__;
  },null,{timeout:45000});
  assert.equal(await iframe.evaluate(el=>el.contentWindow.__PFC_VIEWER_ERROR__||null),null,'Franchise iframe boot error 1');
  const info=await iframe.evaluate(el=>el.contentWindow.__PFC_SNAPSHOT__);
  assert.equal(info.projection,'orthographic');assert.equal(info.camera,'follow');assert.equal(info.players,22);
  assert(info.ballDrawRadius>=14,'Native franchise ball must be enlarged');
  assert.equal(info.actualSprites,true);
  assert(info.pokemonSpritesLoaded>=20&&info.pokemonSpritesDrawn>=20);
  assert.deepEqual(info.teamColors,['#E53935','#FFFFFF']);
  assert.equal(await page.locator('#tacticalPitch').isVisible(),false);
  assert.equal(await page.locator('#viewerSoccerRecord').isEnabled(),false);
  assert.equal(await page.evaluate(()=>window.__PFC_FRA_PUBLIC_TEST__.records),0);
  await page.screenshot({path:'phase10-reports/franchise-2p5d-kickoff.png',fullPage:true});
  await page.locator('#viewerProjection').selectOption('isometric');
  await page.waitForFunction(()=>document.querySelector('.pitch-frame iframe')?.contentWindow?.__PFC_SNAPSHOT__?.projection==='isometric');
  await page.locator('#viewerProjection').selectOption('orthographic');
  await page.waitForFunction(()=>document.querySelector('.pitch-frame iframe')?.contentWindow?.__PFC_SNAPSHOT__?.projection==='orthographic');
  await page.locator('#viewerCamera').selectOption('wide');
  await page.waitForFunction(()=>document.querySelector('.pitch-frame iframe')?.contentWindow?.__PFC_SNAPSHOT__?.camera==='wide');
  await page.locator('#viewerCamera').selectOption('follow');
  await page.waitForFunction(()=>document.querySelector('.pitch-frame iframe')?.contentWindow?.__PFC_SNAPSHOT__?.camera==='follow');
  await page.locator('#viewerComplete').click();
  await page.waitForFunction(()=>!document.getElementById('viewerSoccerRecord')?.disabled);
  const final=await iframe.evaluate(el=>el.contentWindow.__PFC_SNAPSHOT__);
  assert.deepEqual(final.score,[2,1]);assert.equal(final.minute,90);
  assert.equal(await page.evaluate(()=>window.__PFC_FRA_PUBLIC_TEST__.records),0);
  await page.screenshot({path:'phase10-reports/franchise-2p5d-fulltime.png',fullPage:true});
  await page.locator('#viewerSoccerRecord').click();
  assert.equal(await page.evaluate(()=>window.__PFC_FRA_PUBLIC_TEST__.records),1);
  assert.equal(await page.evaluate(()=>window.__PFC_FRA_PUBLIC_TEST__.lastWeek),1);
  assert.equal(await iframe.count(),0);
  await page.locator('#start').click();
  await iframe.waitFor({state:'visible'});
  await page.waitForFunction(()=>{
   const w=document.querySelector('.pitch-frame iframe')?.contentWindow;
   return !!w?.__PFC_VIEWER_READY__||!!w?.__PFC_VIEWER_ERROR__;
  },null,{timeout:45000});
  assert.equal(await iframe.evaluate(el=>el.contentWindow.__PFC_VIEWER_ERROR__||null),null,'Franchise iframe boot error 2');
  await page.locator('#viewerSoccerCancel').click();
  assert.equal(await iframe.count(),0);
  assert.equal(await page.evaluate(()=>window.__PFC_FRA_PUBLIC_TEST__.records),1);
  assert.deepEqual(await page.evaluate(()=>window.__PFC_FRA_PUBLIC_TEST__.score),[2,1]);
  assert.deepEqual(await page.evaluate(()=>window.__PFC_FRA_PUBLIC_TEST__.errors),[]);
  assert.deepEqual(errors,[]);
  fs.mkdirSync('phase10-reports',{recursive:true});
  fs.writeFileSync('phase10-reports/franchise-2p5d-browser.json',JSON.stringify({
    result:'PASS',nativeSoccerJS:true,pokemonSpritesLoaded:info.pokemonSpritesLoaded,
    projection:'orthographic',framing:'follow',ballDrawRadius:info.ballDrawRadius,teamColors:info.teamColors,
    cameraControl:true,officialFinalScore:final.score,
    preRecordSaves:0,afterRecordSaves:1,afterCancelSaves:1,
    firstFixtureIndex:5,errors
  },null,2));
  console.log('PASS Franchise 2.5D browser: Broadcast follow-ball Pokémon pitch, camera, locked result, one save and cancel');
 }finally{await browser.close()}
})().catch(e=>{console.error('FAIL Franchise 2.5D browser: '+(e.stack||e));process.exitCode=1});
