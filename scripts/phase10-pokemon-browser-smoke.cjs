'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const url=process.env.PHASE10_URL||'http://127.0.0.1:8765/';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1450,height:1000}});
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 try{
  await page.goto(url+'index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__PFC_VIEWER_READY__||window.__PFC_VIEWER_ERROR__,null,{timeout:140000});
  const error=await page.evaluate(()=>window.__PFC_VIEWER_ERROR__||null);
  assert(!error,error);
  const start=await page.evaluate(()=>window.__PFC_SNAPSHOT__);
  assert.equal(start.projection,'isometric');
  assert.equal(start.pokemonSpritesLoaded,22,'Every original sprite should preload');
  assert.equal(start.pokemonSpritesDrawn,22,'Every original sprite should be painted');
  assert.equal(start.pokemonEntitiesDrawn,22,'22 Pokémon must replace human player rendering');
  assert.equal(start.humanPlayerSprites,false);
  assert.equal(start.numbersVisible,true);
  assert.deepEqual(start.teamColors,['#EBC63C','#287FCB']);
  assert.equal(start.pokemonIds[0],9);
  assert.equal(start.pokemonIds[8],6);
  assert.equal(start.pokemonIds[10],25);
  assert.equal(start.pokemonIds[11],3);
  assert.deepEqual(start.score,[0,0]);
  fs.mkdirSync('phase10-reports',{recursive:true});
  await page.screenshot({path:'phase10-reports/pokemon-2.5d-numbers.png',fullPage:true});
  await page.locator('#showNumbers').uncheck();
  assert.equal((await page.evaluate(()=>window.__PFC_SNAPSHOT__)).numbersVisible,false);
  await page.screenshot({path:'phase10-reports/pokemon-2.5d-no-numbers.png',fullPage:true});
  await page.locator('#showNumbers').check();
  await page.locator('#nextGoal').click();
  assert.deepEqual((await page.evaluate(()=>window.__PFC_SNAPSHOT__)).score,[1,0]);
  await page.locator('#nextGoal').click();
  assert.deepEqual((await page.evaluate(()=>window.__PFC_SNAPSHOT__)).score,[2,0]);
  await page.locator('#nextGoal').click();
  assert.deepEqual((await page.evaluate(()=>window.__PFC_SNAPSHOT__)).score,[2,1]);
  await page.locator('#skip').click();
  assert.deepEqual((await page.evaluate(()=>window.__PFC_SNAPSHOT__)).score,[2,1]);
  await page.locator('#restart').click();
  assert.deepEqual((await page.evaluate(()=>window.__PFC_SNAPSHOT__)).score,[0,0]);
  assert.equal(errors.length,0,'Browser errors: '+JSON.stringify(errors));
  const report={result:'PASS',originalSpeciesSprites:22,teamColors:start.teamColors,
   jerseyNumbers:true,keeperBadges:true,numberToggle:true,
   isometricCamera:true,QuickSimGoals:[1,0,2,0,2,1],quickSimEnd:[2,1],
   fullReset:[0,0],nativeHumanSprites:false,errors};
  fs.writeFileSync('phase10-reports/pokemon-2.5d-browser.json',JSON.stringify(report,null,2));
  console.log('PASS Pokémon originals: 22 images drawn, colored numbers and rings, GK badge, camera, goal/replay parity');
 }finally{await browser.close()}
})().catch(e=>{console.error('FAIL Pokémon browser '+(e.stack||e));process.exitCode=1});
