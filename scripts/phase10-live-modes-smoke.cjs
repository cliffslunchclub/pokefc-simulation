'use strict';
// Hosted-site integration checks with disposable browser localStorage.
// Tests real PokeFC Quick Sim/Challenge/Franchise UIs without publishing
// private engine code or touching any user's actual save.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const SITE=process.env.PFC_SITE_URL||'https://pfc.cliffslunchclub.com';
const here='phase10-reports';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const results={},errors=[];
 const fresh=async()=>{const ctx=await browser.newContext({viewport:{width:1360,height:980}});
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(String(e)));return {ctx,page}};
 try{
  // Franchise: real state and live Tactical Viewer, official 16-fixture week only on Record.
  {
   const {ctx,page}=await fresh();
   const pageResponse=await page.goto(SITE+'/franchise/',{waitUntil:'domcontentloaded',timeout:50000});
   assert.equal(pageResponse.status(),200);
   await page.waitForFunction(()=>!!window.FXI_TEST&&!!window.FXI_SOCCERJS_FRANCHISE?.mount,null,{timeout:30000});
   await page.evaluate(()=>window.FXI_TEST.create('classic',16,'PFC-BROWSER-SOCCERJS-VERIFY','off'));
   assert.equal(await page.evaluate(()=>window.FXI_TEST.state().week),0);
   await page.locator('.nav button[data-view="tactical"]').click();
   await page.waitForFunction(()=>document.getElementById('viewerMode')?.value==='soccerjs',null,{timeout:12000});
   const viewer=page.locator('.pitch-frame iframe.soccerjs-inline-frame');
   await viewer.waitFor({state:'visible',timeout:25000});
   await page.waitForFunction(()=>{
    const w=document.querySelector('.pitch-frame iframe')?.contentWindow;
    return !!w?.__PFC_VIEWER_READY__||!!w?.__PFC_VIEWER_ERROR__;
   },null,{timeout:65000});
   const started=await viewer.evaluate(el=>({snapshot:el.contentWindow.__PFC_SNAPSHOT__,error:el.contentWindow.__PFC_VIEWER_ERROR__||null}));
   assert.equal(started.error,null,'Franchise native viewer startup error');
   assert.equal(started.snapshot?.projection,'isometric');
   assert.equal(started.snapshot?.players,22);
   assert(started.snapshot?.pokemonSpritesDrawn>=20,'Franchise Pokémon sprites missing');
   assert.equal(await page.locator('#tacticalPitch').isVisible(),false);
   const before=await page.evaluate(()=>JSON.stringify(window.FXI_TEST.state()));
   fs.mkdirSync(here,{recursive:true});
   await page.screenshot({path:here+'/siteground-franchise-2p5d.png',fullPage:true});
   await page.locator('#viewerComplete').click();
   await page.waitForFunction(()=>!document.getElementById('viewerSoccerRecord')?.disabled,null,{timeout:25000});
   assert.equal(await page.evaluate(()=>JSON.stringify(window.FXI_TEST.state())),before,'Sim to End advanced Franchise before Record');
   await page.locator('#viewerSoccerRecord').click();
   await page.waitForFunction(()=>window.FXI_TEST.state()?.week===1,null,{timeout:15000});
   const saved=await page.evaluate(()=>({week:window.FXI_TEST.state().week,
     fixtures:window.FXI_TEST.state().results[0].length,score:window.FXI_TEST.state().results[0].find(r=>r.home===16||r.away===16)?.score}));
   assert.equal(saved.fixtures,16);assert.equal(saved.week,1);
   await page.locator('.nav button[data-view="tactical"]').click();
   const again=page.locator('.pitch-frame iframe.soccerjs-inline-frame');
   await again.waitFor({state:'visible',timeout:25000});
   await page.waitForFunction(()=>{
    const w=document.querySelector('.pitch-frame iframe')?.contentWindow;
    return !!w?.__PFC_VIEWER_READY__||!!w?.__PFC_VIEWER_ERROR__;
   },null,{timeout:65000});
   await page.locator('#viewerSoccerCancel').click();
   assert.equal(await again.count(),0);
   assert.equal(await page.evaluate(()=>window.FXI_TEST.state().week),1,'Cancel advanced Franchise');
   results.franchise={result:'PASS',spriteCount:started.snapshot.pokemonSpritesDrawn,
     defaultProjection:started.snapshot.projection,recordedWeek:1,leagueFixtureCount:16,
     recordedClubScore:saved.score,secondWatchCancelSavedNothing:true};
   await ctx.close();
  }
  // Challenge: live locked Red fixture; cancel without write then save once.
  {
   const {ctx,page}=await fresh();
   await page.goto(SITE+'/challenge/',{waitUntil:'domcontentloaded',timeout:50000});
   const saved=await page.evaluate(()=>{
    const roster=[25,6,3,9,149,94,131,143,68,135,196];
    const history=['Lorelei','Bruno','Agatha','Lance','Blue'].map((boss,i)=>({
      boss,round:i+1,score:[2,1],shots:[12,7],passes:[360,275],outcome:'Victory'
    }));
    const state={version:1,phase:'locked',pool:9,legends:true,formation:'4-3-3',tactic:'press',
      roster,items:Array(11).fill(null),selected:0,rng:191121,
      locked:{roster:roster.slice(),items:Array(11).fill(null),formation:'4-3-3',tactic:'press',score:85.7},
      round:5,history,result:null};
    localStorage.setItem('pokefc-challenge-alpha-1',JSON.stringify(state));
    return JSON.stringify(state);
   });
   await page.goto(SITE+'/play/?challenge=1&watch=soccerjs',{waitUntil:'domcontentloaded',timeout:50000});
   await page.waitForFunction(()=>!!window.FXI_PHASE10_WATCH?.mountInline&&!document.getElementById('watch')?.disabled,null,{timeout:40000});
   await page.locator('#watch').click();
   const frame=page.locator('.field-shell iframe.soccerjs-inline-frame');
   await frame.waitFor({state:'visible',timeout:30000});
   await page.waitForFunction(()=>{
    const w=document.querySelector('.field-shell iframe')?.contentWindow;
    return !!w?.__PFC_VIEWER_READY__||!!w?.__PFC_VIEWER_ERROR__;
   },null,{timeout:65000});
   const snap=await frame.evaluate(el=>({s:el.contentWindow.__PFC_SNAPSHOT__,e:el.contentWindow.__PFC_VIEWER_ERROR__||null}));
   assert.equal(snap.e,null);
   assert.equal(snap.s.projection,'isometric');
   assert(snap.s.pokemonSpritesDrawn>=20);
   assert.equal(await page.evaluate(()=>localStorage.getItem('pokefc-challenge-alpha-1')),saved);
   await page.screenshot({path:here+'/siteground-challenge-2p5d.png',fullPage:true});
   await page.locator('#simRemaining').click();
   await page.waitForFunction(()=>!document.getElementById('soccerRecord')?.disabled,null,{timeout:25000});
   assert.equal(await page.evaluate(()=>localStorage.getItem('pokefc-challenge-alpha-1')),saved,'Sim to End prematurely recorded Challenge');
   await page.locator('#soccerRecord').click();
   const final=await page.evaluate(()=>JSON.parse(localStorage.getItem('pokefc-challenge-alpha-1')));
   assert.equal(final.phase,'finished');assert.equal(final.result.boss,'Red');
   assert.equal(final.history.length,6);
   assert.equal(final.result.origin,'quick-sim');
   assert.equal(await page.locator('#soccerRecord').isEnabled(),false);
   results.challenge={result:'PASS',spriteCount:snap.s.pokemonSpritesDrawn,
    officialResult:final.result.score,history:final.history.length,boss:final.result.boss,
    recordedOnce:true,lockedTactic:final.locked.tactic};
   await ctx.close();
  }
  assert.deepEqual(errors,[],'Browser script errors');
  fs.writeFileSync(here+'/siteground-2p5d-modes.json',JSON.stringify({status:'PASS',site:SITE,...results,errors},null,2));
  console.log('PASS live PokeFC 2.5D Challenges + Franchise: native Pokémon fields, single saves, cancel and official results');
 }finally{await browser.close()}
})().catch(err=>{console.error('FAIL hosted Challenges/Franchise 2.5D smoke: '+(err.stack||err));process.exitCode=1});
