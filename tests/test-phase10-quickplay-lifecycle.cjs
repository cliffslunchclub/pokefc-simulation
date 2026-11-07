'use strict';
// Quick Play integration lifecycle regression for the default Soccer-JS path.
// Exercises the actual app controller with the real Quick Sim, but replaces the
// network viewer iframe with a deterministic bridge stub (visual browser tests
// run separately in the public simulation repository).
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const ids=[25,6,3,9,149,94,131,143,68,135,196];
const lineup={version:1,name:'Quick Play 2.5D test XI',formation:'4-3-3',
 lineup:ids.slice(),selected:0,spriteStyle:'pixel'};
const local=new Map([['pokefc-free-builder-v1',JSON.stringify(lineup)]]);
const els=new Map(),sessions=[],replayCalls=[],seekCalls=[];let replayDestroyed=0;
const drawing={clearRect(){},fillRect(){},strokeRect(){},beginPath(){},moveTo(){},
 lineTo(){},stroke(){},arc(){},fill(){},fillText(){},
 set fillStyle(v){},set strokeStyle(v){},set lineWidth(v){},
 set font(v){},set textAlign(v){}};
function el(id){
 if(!els.has(id)){
  const classes=new Set();
  const e={value:id==='region'?'all':id==='opponent'?'gym-1':
    id==='watchSpeed'?'1':id==='tactic'?'balanced':'',
   innerHTML:'',textContent:'',disabled:false,hidden:id==='soccerWatchActions',events:{},
   classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)},
   addEventListener(type,fn){this.events[type]=fn},scrollIntoView(options){this.scrolledTo=options},
   open:false,showModal(){this.open=true},close(){this.open=false;this.onclose?.()},
   getContext(){return drawing},appendChild(){},replaceChildren(){}
  };
  els.set(id,e);
 }return els.get(id);
}
let active=false;
const bridge={
 isActive:()=>active,
 mountInline(options){
  assert.equal(active,false,'No overlapping 2.5D session');
  assert.equal(typeof options.onRecord,'function');
  if(options.autoRecordOnSimToEnd===undefined){
   assert.equal(options.result.origin,'quick-sim','Replay must use a locked official match');
   assert(Array.isArray(options.result.events)&&options.result.events.some(e=>e.type==='goal'));
   active=true;
   const readonly={
    seek(minute){seekCalls.push(minute);return true},
    replayHighlight(id){replayCalls.push(id);return true},
    destroy(){replayDestroyed++;active=false}
   };
   options.onReady(readonly);
   return readonly;
  }
  assert.equal(options.autoRecordOnSimToEnd,true,'Sim to End must auto-finalize official result');
  const original=JSON.stringify(options.result);
  active=true;let recorded=false,closed=false;
  const session={
   fixture:options.preview,
   getState:()=>({recorded,closed,ready:true,finished:recorded}),
   play(speed){this.lastSpeed=speed;return true},pause(){return true},
   setSpeed(){return true},setProjection(view){this.lastProjection=view;return true},setCamera(camera){this.lastCamera=camera;return true},
   simToEnd(){
    options.onProgress({minute:90,score:options.result.score,finished:true,handedOff:true});
    this.record(); // Real bridge completes the verified handoff and calls onRecord.
    return true;
   },
   record(){
    if(recorded||closed)return false;
    recorded=true;
    options.onRecord({result:options.result,minute:90,handoff:'watch-to-quick-sim'});
    assert.equal(JSON.stringify(options.result),original,'Quick Sim result mutated');
    return true;
   },
   destroy(){closed=true;active=false},
   cancel(){
    if(recorded||closed)return false;
    this.destroy();options.onCancel();return true;
   }
  };
  sessions.push(session);options.onReady(session);
  return session;
 }
};
const document={
 getElementById:el,
 querySelector(selector){assert.equal(selector,'.field-shell');return el('field-shell')},
 createElement(tag){assert.equal(tag,'script');return {src:'',onload:null,onerror:null}},
 head:{append(script){assert.match(script.src,/watch-bridge\.js(?:\?v=\d+)?$/);script.onload()}}
};
const context=vm.createContext({
 window:{location:{search:''},addEventListener(){},FXI_PHASE10_WATCH:bridge},
 document,URLSearchParams,Date,Math,console,
 localStorage:{getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v)}
});
for(const filename of ['assets/js/national-species.js','assets/js/calibration-profile.js','assets/js/position-effectiveness.js','assets/js/quick-sim.js',
 'play/opponents.js','play/play.js']){
 vm.runInContext(fs.readFileSync(path.join(root,filename),'utf8'),context,{filename,timeout:20000});
}
assert(context.window.PFC_PLAY);
assert.equal(el('watch').disabled,false,'Default 2.5D Watch button should be ready after bridge script');
assert(!fs.readFileSync(path.join(root,'play/index.html'),'utf8').includes('watchEngineSwitch'),
 'Retired TacticMesh engine switch must not be exposed');
assert.equal(el('soccerWatchActions').hidden,true,'Pre-match controls hidden');
el('watch').events.click();
assert.equal(sessions.length,1,'First Watch should start');
assert.equal(sessions[0].lastSpeed,1,'Watch defaults to 1×');
assert.equal(sessions[0].lastProjection,'orthographic','Broadcast is primary');
assert.equal(sessions[0].lastCamera,'follow','Follow Ball is primary');
assert.equal(active,true);
assert.equal(el('field-shell').classList.contains('soccerjs-active'),true);
assert.equal(el('watch').disabled,true,'Cannot overlap a running watch');
sessions[0].simToEnd();
assert.equal(el('soccerRecord').disabled,true,'Record button is unnecessary after Sim to End');
assert.equal(el('soccerRecord').hidden,true,'Sim to End hides redundant Record control');
assert.match(el('matchResult').innerHTML,/SHOTS ON TARGET/,'Official final statistics shown immediately');
assert.equal(el('matchResult').scrolledTo?.block,'start','Quick Play transitions to its result panel');
assert.equal(el('watch').disabled,false,'New match available after automatic recording');
assert.equal(sessions[0].record(),false,'Second record cannot duplicate official result');
assert.equal(active,true,'Final frame remains mounted until starting another match');
el('watch').events.click();
assert.equal(sessions.length,2,'A second watched match must be allowed after recording');
assert.equal(sessions[0].getState().closed,true,'Recorded previous session cleaned up');
assert.equal(active,true);
assert.equal(el('watch').disabled,true);
el('soccerCancel').events.click();
assert.equal(active,false,'Cancel closes second session');
assert.equal(el('field-shell').classList.contains('soccerjs-active'),false);
assert.equal(el('watch').disabled,false,'Watch can restart after cancel');
assert.equal(el('soccerWatchActions').hidden,true);
assert.match(el('engineStatus').textContent,/without recording/);
// Instant Quick Sim uses the same Goal Replay control as the screenshot.
const officialSim=context.window.FXI_QUICK.simulate;
context.window.FXI_QUICK.simulate=(preview,_options)=>{
 for(let s=0;s<120;s++){
  const result=officialSim(preview,{seed:'replay-regression-'+s});
  if(result.score[0]+result.score[1]>0)return result;
 }
 throw new Error('Deterministic replay fixture could not produce any goals');
};
el('quick').events.click();
assert.equal(el('goalReplayActions').hidden,false,'Quick Sim match timeline displays Goal Replays');
assert.match(el('goalReplayActions').innerHTML,/GOAL REPLAYS/,'Replay controls are placed above event feed');
assert.match(el('goalReplayActions').innerHTML,/data-goal-replay="goal-0"/);
assert.match(fs.readFileSync(path.join(root,'play/index.html'),'utf8'),/id="goalReplayModal"/,'Replay dialog is mounted in Quick Play');
const resultBefore=el('matchResult').innerHTML;
el('goalReplayActions').onclick({target:{closest:()=>({dataset:{goalReplay:'goal-0'}})}});
assert.equal(el('goalReplayModal').open,true,'Clicking goal opens replay dialog');
assert.deepEqual(replayCalls,['goal-0'],'Official first goal highlight starts');
assert.deepEqual(seekCalls,[90],'Replay viewer seeks to official full-time before goal clip');
assert.equal(el('matchResult').innerHTML,resultBefore,'Opening replay does not modify match results');
assert.equal(active,true,'Read-only replay uses a live presentation session');
el('closeGoalReplay').events.click();
assert.equal(el('goalReplayModal').open,false,'Close exits replay modal');
assert.equal(active,false,'Replay viewer is released without recording');
assert.equal(replayDestroyed,1,'Replay session destroyed once');
assert.equal(el('matchResult').innerHTML,resultBefore,'Final stats still present after replay');
console.log('PASS 2.5D Quick Play: Sim to End, canceled Watch, and read-only Goal Replay from Quick Sim match timeline');
