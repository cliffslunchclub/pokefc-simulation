'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const url=process.env.PHASE10_URL||'http://127.0.0.1:8765/';
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1340,height:1000},deviceScaleFactor:1});
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 try{
  await page.goto(url+'host-inline.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.__PFC_INLINE_FIXTURE__||!!window.__PFC_INLINE_ERROR__,null,{timeout:18000});
  assert(!(await page.evaluate(()=>window.__PFC_INLINE_ERROR__)), 'Unable to load public fixture');
  await page.locator('#start').click();
  await page.waitForFunction(()=>window.__PFC_INLINE_TEST__?.boots===1||window.__PFC_INLINE_TEST__?.errors?.length>0,null,{timeout:150000});
  const iframe=page.locator('#field iframe');
  assert.equal(await iframe.count(),1,'2.5D viewer must be embedded inside the field panel');
  let shot=await iframe.evaluate(el=>el.contentWindow.__PFC_SNAPSHOT__);
  if(!shot)throw Error('No 2.5D browser snapshot: '+JSON.stringify(await page.evaluate(()=>window.__PFC_INLINE_TEST__)));
  assert.equal(shot.projection,'isometric','Expected angled 2.5D as default');
  assert.equal(shot.camera,'wide');
  assert.equal(shot.players,22);
  assert.equal(shot.actualSprites,true,'Original Soccer-JS native renderer did not initialize');
  assert(shot.pokemonSpritesLoaded>=20,'Pokémon sprites did not load: '+shot.pokemonSpritesLoaded);
  assert(shot.pokemonSpritesDrawn>=20,'Pokémon billboard sprites not painted: '+shot.pokemonSpritesDrawn);
  assert.deepEqual(shot.teamColors,['#E53935','#FFFFFF']);
  assert.deepEqual(shot.score,[0,0]);
  assert(shot.scale>0);
  await page.screenshot({path:'phase10-reports/inline-2p5d-kickoff.png',fullPage:true});
  await page.locator('#pause').click();
  await page.locator('#view').selectOption('topdown');
  await page.waitForFunction(()=>document.querySelector('#field iframe')?.contentWindow?.__PFC_SNAPSHOT__?.projection==='topdown');
  await page.locator('#view').selectOption('isometric');
  await page.waitForFunction(()=>document.querySelector('#field iframe')?.contentWindow?.__PFC_SNAPSHOT__?.projection==='isometric');
  await page.locator('#camera').selectOption('follow');
  await page.waitForFunction(()=>document.querySelector('#field iframe')?.contentWindow?.__PFC_SNAPSHOT__?.camera==='follow');
  await page.locator('#camera').selectOption('wide');
  await page.waitForFunction(()=>document.querySelector('#field iframe')?.contentWindow?.__PFC_SNAPSHOT__?.camera==='wide');
  await page.evaluate(()=>{
   const frame=document.querySelector('#field iframe');
   frame.contentWindow.postMessage({type:'pfc-phase10-control',action:'seek',minute:54},location.origin);
  });
  await page.waitForFunction(()=>JSON.stringify(document.querySelector('#field iframe')?.contentWindow?.__PFC_SNAPSHOT__?.score)==='[1,0]');
  const halfway=await iframe.evaluate(el=>el.contentWindow.__PFC_SNAPSHOT__);
  await page.locator('#handoff').click();
  await page.waitForFunction(()=>document.querySelector('#field iframe')?.contentWindow?.__PFC_SNAPSHOT__?.minute===90);
  await page.waitForFunction(()=>!document.querySelector('#record')?.disabled);
  shot=await iframe.evaluate(el=>el.contentWindow.__PFC_SNAPSHOT__);
  assert.deepEqual(shot.score,[2,1],'Watch→Sim score drift');
  assert.equal(shot.projection,'isometric');
  await page.screenshot({path:'phase10-reports/inline-2p5d-fulltime.png',fullPage:true});
  await page.locator('#record').click();
  assert.equal(await page.evaluate(()=>window.__PFC_INLINE_TEST__.records),1);
  assert.deepEqual(await page.evaluate(()=>window.__PFC_INLINE_TEST__.recordedScore),[2,1]);
  await page.locator('#start').click();
  await page.waitForFunction(()=>window.__PFC_INLINE_TEST__?.boots===2||window.__PFC_INLINE_TEST__?.errors?.length>0,null,{timeout:150000});
  await page.locator('#cancel').click();
  const state=await page.evaluate(()=>window.__PFC_INLINE_TEST__);
  assert.equal(state.records,1,'Cancel or double-write changed recorded results');
  assert.equal(state.cancels,1);
  assert.equal((await page.locator('#field iframe').count()),0,'Canceled iframe still mounted');
  assert.equal(state.errors.length,0,'Inline application errors: '+JSON.stringify(state.errors));
  assert.equal(errors.length,0,'JavaScript errors: '+JSON.stringify(errors));
  fs.mkdirSync('phase10-reports',{recursive:true});
  fs.writeFileSync('phase10-reports/inline-2p5d-browser.json',JSON.stringify({
   result:'PASS',nativeSoccerJS:true,embedded:true,defaultProjection:'isometric',
   originalSpriteEngine:true,pokemonSpritesLoaded:shot.pokemonSpritesLoaded,
   pokemonSpritesDrawn:shot.pokemonSpritesDrawn,teamColors:shot.teamColors,
   cameraControls:true,firstGoal:halfway.score,
   officialFulltimeScore:shot.score,watchToSim:true,
   recordedExactlyOnce:state.records===1,cancelWithoutSave:true,
   screenCaptures:['inline-2p5d-kickoff.png','inline-2p5d-fulltime.png'],
   errors
  },null,2));
  console.log('PASS native 2.5D inline browser: 22 Pokémon, real sprites, isometric camera, 1–0 → 2–1, record once, cancel');
 }finally{
  await browser.close();
 }
})().catch(err=>{console.error('FAIL inline 2.5D public browser: '+(err.stack||err));process.exitCode=1});
