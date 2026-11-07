'use strict';
// CI-only real Chromium rendering: no deployment or network beyond browser assets.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const qs=require('../assets/js/quick-sim.js'),knockout=require('../assets/js/pse-knockout.js'),
 bridge=require('../watch/soccerjs/watch-bridge.js');
const roles=['GK','DEF','DEF','DEF','DEF','MID','MID','MID','FWD','FWD','FWD'];
function team(id,offset){return {id,name:id+' FC',tactic:'balanced',
 lineup:roles.map((pos,i)=>({id:id+'-'+i,name:id+' Pokémon '+i,pos,
 speciesId:offset+i+1,jerseyNumber:i+1,
 main:{finishing:70+i,shortPassing:72+i,vision:70+i,firstTouch:68+i,sprintSpeed:71+i,tackling:71+i},
 detail:{reflexes:70+i,handling:71+i,positioning:71+i,diving:70+i,composure:70+i}}))};}
const preview={seed:'BROWSER-KO',home:team('pewter',0),away:team('cerulean',11)};
let found=null;
for(let n=0;n<800;n++){
 const seed='CI-120-'+n,reg=qs.simulate(preview,{seed});
 const ko=knockout.resolve(preview,reg,{seed});
 if(ko.shootout?.attempts.length>=6){found=ko;break;}
}
assert(found,'No seeded official PSE shootout match available');
const fixture=bridge.snapshot(preview,{...found.match,shootout:found.shootout});
assert.equal(fixture.durationMinutes,120);
const fixturePath=path.join(root,'watch/soccerjs/dist/fixture.json');
fs.writeFileSync(fixturePath,JSON.stringify(fixture));
const screenshotDir=process.env.GITHUB_WORKSPACE?
 path.join(process.env.GITHUB_WORKSPACE,'pse-browser-artifacts'):
 path.join(root,'pse-browser-artifacts');
fs.mkdirSync(screenshotDir,{recursive:true});
const server=spawn('python3',['-m','http.server','8765','--bind','127.0.0.1','--directory',root],
 {stdio:'ignore'});
const url='http://127.0.0.1:8765/watch/soccerjs/dist/index.html';
async function serve(){
 for(let tries=0;tries<50;tries++){
  try{const res=await fetch(url);if(res.ok)return}catch{}
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 throw Error('Local CI viewer web server did not initialize');
}
(async()=>{
 let browser;
 try{
  await serve();
  browser=await chromium.launch({headless:true,args:['--no-sandbox'],
   ...(process.env.PFC_CHROME_BIN?{executablePath:process.env.PFC_CHROME_BIN}:{})});
  for(const [device,viewport] of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}]]){
   const page=await browser.newPage({viewport,deviceScaleFactor:1});
   const errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
   await page.waitForFunction(()=>window.__PFC_VIEWER_READY__||window.__PFC_VIEWER_ERROR__,null,{timeout:120000});
   const state=await page.evaluate(()=>({
    ready:window.__PFC_VIEWER_READY__,error:window.__PFC_VIEWER_ERROR__,
    initial:window.__PFC_SNAPSHOT__,width:document.documentElement.scrollWidth,
    innerWidth:window.innerWidth
   }));
   assert(state.ready,'Native Soccer-JS failed to boot on '+device+': '+state.error+' '+errors.join('; '));
   assert.equal(state.initial.durationMinutes,120);
   assert.equal(state.initial.players,22);
   assert.equal(state.initial.phase,'regulation');
   assert(state.initial.pokemonEntitiesDrawn>0,'No Pokémon sprites drawn on '+device);
   // Real 2.5D UI: avoid spoilers, offer live goal replay, and return to
   // the exact Watch minute without changing the official match.
   const firstGoal=fixture.events.find(e=>e.type==='goal');
   assert(firstGoal,'Browser fixture should have a real goal for replay');
   await page.locator('#highlightToggle').click();
   assert.equal(await page.locator('#highlightList .highlight-entry').count(),0,
    'Highlight drawer cannot reveal future PSE events');
   await page.locator('#highlightClose').click();
   const from=Math.max(0,firstGoal.minute-.12);
   await page.locator('#scrub').evaluate((el,v)=>{
    el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));
   },from);
   await page.locator('#speed').selectOption('16');
   await page.locator('#play').click();
   // At the exact PSE goal time, show the ball past the keeper and beyond
   // the goal line before the Replay/Continue modal obscures the pitch.
   await page.waitForFunction(goal=>{
    const s=window.__PFC_SNAPSHOT__;
    return s?.animation==='official-goal'&&!s.goalPaused&&!s.watchPlaying&&
      Math.abs(s.minute-goal)<.00001;
   },firstGoal.minute,{timeout:15000});
   const netFrame=await page.evaluate(()=>window.__PFC_SNAPSHOT__);
   const homeScored=firstGoal.team===fixture.home.id;
   const farLine=homeScored?106:0;
   assert((netFrame.ball.x-farLine)*(homeScored?1:-1)>.5,
    'Goal ball must be inside net, not in front of end line on '+device);
   assert((netFrame.ball.x-netFrame.actorWorldPositions[homeScored?11:0][0])*
    (homeScored?1:-1)>2,'Goalkeeper must be between shot and net on '+device);
   assert.equal(netFrame.goalPaused,false,'Goal popup appeared before net hold');
   await page.screenshot({path:path.join(screenshotDir,'pse-goal-in-net-'+device+'.png')});
   await page.locator('#highlightNotice').waitFor({state:'visible',timeout:15000});
   const goalPause=await page.evaluate(()=>window.__PFC_SNAPSHOT__);
   assert.equal(goalPause.goalPaused,true,'Goal should automatically pause '+device);
   assert.equal(goalPause.watchPlaying,false,'Match clock continues during goal pause');
   assert(Math.abs(goalPause.minute-firstGoal.minute)<.00001,
    'Match must stop at exact official PSE goal minute at 16×');
   const goalCard=await page.locator('.goal-prompt-card').boundingBox();
   const pitchBounds=await page.locator('#pitch').boundingBox();
   assert(goalCard&&pitchBounds&&goalCard.x>=pitchBounds.x-4&&
    goalCard.x+goalCard.width<=pitchBounds.x+pitchBounds.width+4,
    'Goal modal extends outside match rendering on '+device);
   await page.screenshot({path:path.join(screenshotDir,'pse-goal-prompt-'+device+'.png')});
   await page.locator('#highlightNoticePlay').click();
   const replay=await page.evaluate(()=>window.__PFC_SNAPSHOT__);
   assert.equal(replay.replay?.kind,'goal','Official goal replay did not activate');
   assert(await page.locator('#highlightReplay').isVisible());
   await page.locator('#highlightReplaySpeed').click();
   assert.match(await page.locator('#highlightReplaySpeed').innerText(),/1×/);
   await page.locator('#highlightReplayReturn').click();
   const restored=await page.evaluate(()=>window.__PFC_SNAPSHOT__);
   assert.equal(restored.replay,null,'Replay return must restore live viewer');
   assert(restored.minute>=firstGoal.minute,'Watch position must resume after goal');
   assert(await page.locator('#highlightNotice').isVisible(),
    'Returning from replay should offer Continue');
   await page.locator('#highlightNoticeDismiss').click();
   const continued=await page.evaluate(()=>window.__PFC_SNAPSHOT__);
   assert.equal(continued.goalPaused,false,'Continue must dismiss goal prompt');
   assert.equal(continued.watchPlaying,true,'Continue must resume selected speed');
   await page.locator('#pause').click();
   // A scored ball stays in the goal before a deliberate broadcast CUT to
   // center-circle kickoff, never gliding backwards across the field.
   // The range control quantizes input by its step; seek the two adjacent
   // selectable moments around the goal-to-kickoff boundary.
   const scrubStep=Number(await page.locator('#scrub').getAttribute('step'))||.05;
   const cutMinute=firstGoal.minute+.22;
   const holdMinute=Math.floor((cutMinute-1e-7)/scrubStep)*scrubStep;
   const restartMinute=Math.ceil((cutMinute+1e-7)/scrubStep)*scrubStep;
   await page.locator('#scrub').evaluate((el,v)=>{
    el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));
   },holdMinute);
   const held=await page.evaluate(()=>window.__PFC_SNAPSHOT__);
   assert.equal(held.animation,'official-goal','Goal ball should stay in the net on '+device);
   await page.locator('#scrub').evaluate((el,v)=>{
    el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));
   },restartMinute);
   const restarted=await page.evaluate(()=>window.__PFC_SNAPSHOT__);
   assert.equal(restarted.animation,'illustrative-kickoff','Missing kickoff broadcast cut on '+device);
   assert(['kickoff-setup','kickoff-pass'].includes(restarted.ballContact),
    'Kickoff must have a valid setup/pass phase on '+device);
   if(restarted.ballContact==='kickoff-setup')
    assert(restarted.carrier>=0,'Kickoff setup needs a controlling Pokémon on '+device);
   else assert.equal(restarted.carrier,-1,'Kickoff pass cannot claim midflight possession');
   assert(Math.hypot(restarted.ball.x-held.ball.x,restarted.ball.y-held.ball.y)>15,
    'A reset cut should not pretend the scored ball travels backwards to midfield');
   assert.deepEqual(restarted.score,bridge.scoreAt(fixture,restartMinute),
    'Kickoff visual must never change the official PSE score');
   await page.screenshot({path:path.join(screenshotDir,'pse-kickoff-'+device+'.png')});
   await page.locator('#highlightToggle').click();
   assert((await page.locator('#highlightList .highlight-entry').count())>0,
    'A recorded goal must be replayable from the highlight drawer');
   await page.locator('#highlightList .highlight-entry button').first().click();
   assert.equal((await page.evaluate(()=>window.__PFC_SNAPSHOT__)).replay?.kind,'goal');
   await page.locator('#highlightReplayReturn').click();
   await page.locator('#pause').click();
   for(const minute of [90,105,119,120]){
    await page.locator('#scrub').evaluate((el,v)=>{
     el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));
    },minute);
    const snap=await page.evaluate(()=>window.__PFC_SNAPSHOT__);
    assert.equal(snap.minute,minute);
    assert.deepEqual(snap.score,bridge.scoreAt(fixture,minute));
    assert.equal(snap.phase,minute===120?'shootout':'extra-time');
   }
   assert(await page.locator('#shootoutOverlay').isVisible(),'Shootout overlay absent');
   assert.match(await page.locator('#shootoutScore').innerText(),/PENALTIES 0 – 0/);
   const initialKicks=fixture.shootout.attempts.length;
   await page.locator('#shootoutAdvance').click();
   const shot=await page.evaluate(()=>window.__PFC_SNAPSHOT__);
   assert.equal(shot.kickIndex,1);
   assert.match(shot.animation,/^official-shootout-/);
   await page.locator('#highlightToggle').click();
   await page.locator('[data-highlight-filter="set"]').click();
   assert.equal(await page.locator('#highlightList .highlight-entry').count(),1,
    'Only the first completed official shootout kick may be replayed');
   await page.locator('#highlightList .highlight-entry button').first().click();
   const kickReplay=await page.evaluate(()=>window.__PFC_SNAPSHOT__);
   assert.equal(kickReplay.replay?.kind,'shootout');
   assert.deepEqual(kickReplay.score,fixture.score,'Penalty clip cannot modify full-time goals');
   await page.locator('#highlightReplayReturn').click();
   assert.equal((await page.evaluate(()=>window.__PFC_SNAPSHOT__)).kickIndex,1);
   for(let i=1;i<initialKicks;i++)await page.locator('#shootoutAdvance').click();
   const final=await page.evaluate(()=>window.__PFC_SNAPSHOT__);
   assert.equal(final.kickIndex,initialKicks);
   assert.deepEqual(final.score,fixture.score,'Full-time score is not overwritten by shootout');
   const label=await page.locator('#shootoutScore').innerText();
   assert(label.includes(fixture.shootout.home+' – '+fixture.shootout.away),'Final penalty tally wrong');
   await page.screenshot({path:path.join(screenshotDir,'pse-120-'+device+'.png'),fullPage:true});
   if(device==='mobile'){
    const dims=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth}));
    assert(dims.width<=dims.viewport+4,'Mobile layout overflows horizontally: '+JSON.stringify(dims));
    const rect=await page.locator('#shootoutAdvance').boundingBox();
    // Hidden after final kick; the 44px touch target is checked in CSS contract tests.
    assert.equal(rect,null);
   }
   assert.deepEqual(errors,[],'JavaScript console errors on '+device);
   console.log('PASS real Soccer-JS Chromium',device,fixture.score,
    '90–120 minute replay and',initialKicks,'official shootout kicks');
   await page.close();
  }
 }finally{
  if(browser)await browser.close();
  server.kill('SIGTERM');
 }
})().catch(error=>{console.error(error);process.exitCode=1});
