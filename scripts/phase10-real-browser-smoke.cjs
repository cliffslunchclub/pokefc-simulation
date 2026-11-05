'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const pageUrl=process.env.PHASE10_URL||'http://127.0.0.1:8765/';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
 const browserErrors=[];
 page.on('pageerror',error=>browserErrors.push(String(error)));
 page.on('console',event=>{if(event.type()==='error')browserErrors.push(event.text())});
 await page.goto(pageUrl,{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>window.__PFC_VIEWER_READY__||window.__PFC_VIEWER_ERROR__,null,{timeout:150000});
 const failure=await page.evaluate(()=>window.__PFC_VIEWER_ERROR__||null);
 if(failure)throw Error('Viewer startup failed: '+failure);
 const check=await page.evaluate(()=>window.__PFC_SNAPSHOT__);
 assert.equal(check.players,22);
 assert.equal(check.actualSprites,true,'Actual Soccer-JS player assets did not load');
 assert.deepEqual(check.score,[0,0],'At kickoff scoreboard should be 0-0');
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
 await page.locator('#restart').click();
 assert.deepEqual(await page.evaluate(()=>window.__PFC_SNAPSHOT__.score),[0,0]);
 await page.locator('#skip').click();
 assert.deepEqual(await page.evaluate(()=>window.__PFC_SNAPSHOT__.score),[2,1]);
 fs.mkdirSync('phase10-reports',{recursive:true});
 await page.screenshot({path:'phase10-reports/real-quicksim-soccerjs.png',fullPage:true});
 fs.writeFileSync('phase10-reports/real-browser-proof.json',JSON.stringify({
  status:'PASS',realSoccerJSSprites:true,actualQuickSimFixture:true,
  goals:[g1,g2,g3].map(x=>({minute:x.minute,score:x.score})),
  fulltime:end.score,restartAndSkipPreserveScore:true,browserErrors
 },null,2));
 console.log('PASS browser: native sprites, real Quick Sim goals 1-0/2-0/2-1, skip/restart parity; screenshot saved');
 if(browserErrors.length)console.log('Browser console warnings/errors: '+JSON.stringify(browserErrors.slice(0,7)));
 await browser.close();
})().catch(e=>{console.error('FAIL real browser smoke '+(e.stack||e));process.exitCode=1;});
