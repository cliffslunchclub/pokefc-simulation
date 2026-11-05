'use strict';
// Read-only browser smoke against the public PokeFC SiteGround alpha.
// No private source, credentials, user saves, or mutations of the server.
const {chromium}=require('playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const SITE=process.env.PFC_SITE_URL||'https://pfc.cliffslunchclub.com';
const OUTPUT='phase10-reports';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:1420,height:1050},deviceScaleFactor:1,ignoreHTTPSErrors:false});
 await context.addInitScript(()=>{
  const record={version:1,name:'Automated 2.5D test XI',formation:'4-3-3',
    lineup:[25,6,3,9,149,94,131,143,68,135,196],selected:0,spriteStyle:'pixel'};
  try{localStorage.setItem('pokefc-free-builder-v1',JSON.stringify(record))}catch{}
 });
 const page=await context.newPage(),jsErrors=[],httpErrors=[];
 page.on('pageerror',e=>jsErrors.push(String(e)));
 page.on('response',response=>{
  if(response.status()>=400&&response.url().startsWith(SITE))httpErrors.push(response.status()+' '+response.url());
 });
 try{
  const r=await page.goto(SITE+'/play/?watch=soccerjs',{waitUntil:'domcontentloaded',timeout:50000});
  assert(r&&r.status()===200,'Quick Play test route not HTTP 200');
  await page.waitForFunction(()=>{
    return !!window.FXI_PHASE10_WATCH?.mountInline&&!document.getElementById('watch')?.disabled;
  },null,{timeout:60000});
  assert.match(await page.locator('#watch').textContent(),/2\.5D/,'Expected opt-in Watch button');
  await page.locator('#watch').click();
  await page.locator('.field-shell iframe.soccerjs-inline-frame').waitFor({state:'visible',timeout:40000});
  await page.waitForFunction(()=>{
   const win=document.querySelector('.field-shell iframe')?.contentWindow;
   return !!win?.__PFC_VIEWER_READY__||!!win?.__PFC_VIEWER_ERROR__;
  },null,{timeout:140000});
  const info=await page.evaluate(()=>{
   const w=document.querySelector('.field-shell iframe')?.contentWindow;
   return {error:w?.__PFC_VIEWER_ERROR__||null,snapshot:w?.__PFC_SNAPSHOT__||null,
     originalCanvasHidden:getComputedStyle(document.querySelector('#matchPitch')).display==='none'};
  });
  assert(!info.error,'Native viewer error: '+info.error);
  assert(info.originalCanvasHidden,'Flat top-down canvas must be replaced during 2.5D Watch');
  assert(info.snapshot,'No 2.5D native renderer frame');
  assert.equal(info.snapshot.projection,'isometric');
  assert.equal(info.snapshot.players,22);
  assert.equal(info.snapshot.actualSprites,true);
  assert(info.snapshot.pokemonSpritesLoaded>=18,'Not enough Pokémon species sprites on live SiteGround: '+info.snapshot.pokemonSpritesLoaded);
  assert(info.snapshot.pokemonSpritesDrawn>=18,'Pokémon art not painted on live pitch: '+info.snapshot.pokemonSpritesDrawn);
  assert.deepEqual(info.snapshot.teamColors,['#E53935','#FFFFFF']);
  fs.mkdirSync(OUTPUT,{recursive:true});
  await page.screenshot({path:OUTPUT+'/siteground-optin-kickoff.png',fullPage:true});
  await page.locator('#simRemaining').click();
  await page.waitForFunction(()=>!document.getElementById('soccerRecord')?.disabled,null,{timeout:20000});
  const final=await page.evaluate(()=>{
   const w=document.querySelector('.field-shell iframe')?.contentWindow;
   return {score:w?.__PFC_SNAPSHOT__?.score,minute:w?.__PFC_SNAPSHOT__?.minute,
    displayed:document.getElementById('score')?.textContent};
  });
  assert.equal(final.minute,90);
  assert.deepEqual(final.score.map(Number),final.displayed.trim().split(/\s*:\s*/).map(Number));
  await page.locator('#soccerRecord').click();
  assert.equal(await page.locator('#matchClock').textContent(),'FULL TIME');
  assert.equal(await page.locator('#watch').isEnabled(),true,'Must allow next Watch after recording');
  await page.locator('#watch').click();
  await page.waitForFunction(()=>!!document.querySelector('.field-shell iframe')?.contentWindow?.__PFC_VIEWER_READY__,null,{timeout:140000});
  await page.locator('#soccerCancel').click();
  assert.equal(await page.locator('.field-shell iframe').count(),0,'Canceled replay still mounted');
  assert.equal(await page.locator('#watch').isEnabled(),true);
  assert.equal(jsErrors.length,0,'Site JavaScript errors: '+JSON.stringify(jsErrors.slice(0,5)));
  assert.equal(httpErrors.length,0,'Site asset 404/500 errors: '+JSON.stringify(httpErrors.slice(0,5)));
  fs.writeFileSync(OUTPUT+'/siteground-optin-smoke.json',JSON.stringify({
   result:'PASS',site:SITE,route:'/play/?watch=soccerjs',
   initialProjection:info.snapshot.projection,pokemonSpritesLoaded:info.snapshot.pokemonSpritesLoaded,
   pokemonSpritesDrawn:info.snapshot.pokemonSpritesDrawn,flatCanvasHidden:true,
   officialFinalScore:final.score,watchToSim:true,recordedThenNextWatch:true,
   canceledWithoutSecondSave:true,jsErrors,httpErrors
  },null,2));
  console.log('PASS PokeFC SiteGround 2.5D Quick Play: isometric Pokémon field, score, Watch→Sim, record, restart and cancel');
 }finally{await browser.close()}
})().catch(e=>{console.error('FAIL PokeFC hosted 2.5D smoke: '+(e.stack||e));process.exitCode=1});
