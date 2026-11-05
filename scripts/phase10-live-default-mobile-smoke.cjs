'use strict';
// Verify normal /play/ uses 2.5D Soccer-JS by default on a mobile viewport.
// Browser-local testing only: no user saves, server mutations or private code.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const SITE=process.env.PFC_SITE_URL||'https://pfc.cliffslunchclub.com';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,
   isMobile:true,hasTouch:true,ignoreHTTPSErrors:false});
 await context.addInitScript(()=>{
  const stored={version:1,name:'Mobile Watch Test XI',formation:'4-3-3',
   lineup:[25,6,3,9,149,94,131,143,68,135,196],selected:0,spriteStyle:'pixel'};
  localStorage.setItem('pokefc-free-builder-v1',JSON.stringify(stored));
 });
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 try{
  const response=await page.goto(SITE+'/play/',{waitUntil:'domcontentloaded',timeout:50000});
  assert.equal(response.status(),200);
  await page.waitForFunction(()=>!!window.FXI_PHASE10_WATCH?.mountInline&&!document.getElementById('watch')?.disabled,null,{timeout:50000});
  assert.match(await page.locator('#watch').textContent(),/2\.5D/,'Default Watch is Soccer-JS');
  assert.match(await page.locator('#watchEngineSwitch').textContent(),/legacy/i,'Legacy rollback must remain discoverable');
  assert((await page.locator('#watchEngineSwitch').getAttribute('href')).includes('watch=tacticmesh'));
  await page.locator('#watch').click();
  const frame=page.locator('.field-shell iframe.soccerjs-inline-frame');
  await frame.waitFor({state:'visible',timeout:30000});
  await page.waitForFunction(()=>{
   const w=document.querySelector('.field-shell iframe')?.contentWindow;
   return !!w?.__PFC_VIEWER_READY__||!!w?.__PFC_VIEWER_ERROR__;
  },null,{timeout:70000});
  const data=await frame.evaluate(el=>({snapshot:el.contentWindow.__PFC_SNAPSHOT__,error:el.contentWindow.__PFC_VIEWER_ERROR__||null}));
  assert.equal(data.error,null);
  assert.equal(data.snapshot.projection,'isometric');
  assert.equal(data.snapshot.players,22);
  assert(data.snapshot.pokemonSpritesDrawn>=18,'Mobile Pokémon field sprites absent');
  assert.equal(await page.locator('#matchPitch').isVisible(),false);
  const frameBox=await frame.boundingBox();
  assert(frameBox?.width>=250&&frameBox.width<=392,'Iframe does not fit mobile field: '+JSON.stringify(frameBox));
  fs.mkdirSync('phase10-reports',{recursive:true});
  await page.screenshot({path:'phase10-reports/siteground-mobile-default-2p5d.png',fullPage:true});
  await page.locator('#simRemaining').click();
  await page.waitForFunction(()=>!document.getElementById('soccerRecord')?.disabled,null,{timeout:20000});
  await page.locator('#soccerRecord').click();
  assert.equal(await page.locator('#matchClock').textContent(),'FULL TIME');
  await page.goto(SITE+'/play/?watch=tacticmesh',{waitUntil:'domcontentloaded',timeout:50000});
  assert.match(await page.locator('#watchEngineSwitch').textContent(),/Soccer-JS 2\.5D/);
  assert(!(await page.locator('#watch').textContent()).includes('2.5D'),'Legacy route must not use Soccer-JS');
  assert.deepEqual(errors,[]);
  fs.writeFileSync('phase10-reports/siteground-mobile-default-2p5d.json',JSON.stringify({
   result:'PASS',site:SITE,defaultWatch:'Soccer-JS 2.5D',mobileViewport:'390x844',
   nativeSpritesDrawn:data.snapshot.pokemonSpritesDrawn,fieldWidth:frameBox.width,
   simToEnd:true,recorded:true,legacyFallback:true,errors
  },null,2));
  console.log('PASS mobile default Quick Play: Soccer-JS 2.5D, 22 players, responsive field, full-time record and legacy fallback');
 }finally{await browser.close()}
})().catch(e=>{console.error('FAIL mobile default Quick Play: '+(e.stack||e));process.exitCode=1});
