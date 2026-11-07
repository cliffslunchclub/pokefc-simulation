'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {motionFrame}=require('./phase10-motion.cjs');
const {planFor}=require('./phase10-play-director.cjs');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixture.json'),'utf8'));
const original=JSON.stringify(fixture),field={width:106,height:68};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const timeline=planFor(fixture,field);
const ignored=sec=>fixture.events.some(e=>e.type==='goal'&&
 sec>=e.minute*60-42-.2&&sec<=e.minute*60+17);
let maxBoundary=0,maxContact=0,maxReversal=0,transfers=0,challenges=0;
let forward=0,backwards=0,lobs=0,oneTwos=0,crosses=0;
for(let i=1;i<timeline.actions.length;i++){
 const at=timeline.actions[i].start;
 if(ignored(at))continue;
 const a=motionFrame(fixture,(at-.00006)/60,field);
 const b=motionFrame(fixture,(at+.00006)/60,field);
 if([a,b].some(f=>['official-goal','illustrative-goal-buildup',
  'illustrative-shot','illustrative-kickoff'].includes(f.action)))continue;
 maxBoundary=Math.max(maxBoundary,dist(a.ball,b.ball),
  ...a.actors.map((p,j)=>dist(p,b.actors[j])));
 assert(maxBoundary<.05,'Ball or player teleported between variable-length actions; stage '+i+
  ' at '+at+'s max '+maxBoundary+' actions '+a.action+' / '+b.action+
  ' pressing '+JSON.stringify(a.pressingPlayers)+' / '+JSON.stringify(b.pressingPlayers)+
  ' biggestIndex '+[dist(a.ball,b.ball),...a.actors.map((p,j)=>dist(p,b.actors[j]))].indexOf(maxBoundary)+
  ' pressPhase '+a.pressPhase+' / '+b.pressPhase+
  ' player '+JSON.stringify(a.actors[5])+' / '+JSON.stringify(b.actors[5])+
  ' stageOwner '+timeline.actions[i-1].owner+' -> '+timeline.actions[i].owner);
}
for(const stage of timeline.actions){
 const at=(stage.start+stage.end)/2;
 if(ignored(at)||stage.duration<.5)continue;
 const frame=motionFrame(fixture,at/60,field);
 if(['official-goal','illustrative-goal-buildup','illustrative-shot',
  'illustrative-kickoff'].includes(frame.action))continue;
 if(stage.mode==='carry'){
  assert.equal(frame.ownerIndex,stage.owner,'Dribbler ownership changed mid-carry');
  maxContact=Math.max(maxContact,dist(frame.ball,frame.actors[stage.owner]));
 }else if(stage.mode==='pass'){
  assert.equal(frame.ownerIndex,-1,'Midflight ball assigned a premature owner');
  assert.deepEqual(frame.passOrigin,stage.from);
  assert.deepEqual(frame.passTarget,stage.to);
  const ts=[.2,.5,.8].map(u=>motionFrame(fixture,
   (stage.start+stage.duration*u)/60,field));
  const v={x:stage.to.x-stage.from.x,y:stage.to.y-stage.from.y};
  const length=Math.hypot(v.x,v.y);
  // Intentional bank passes reverse the component perpendicular to a wall.
  if(length>.1&&!stage.wall){
   const pr=x=>((x.ball.x-stage.from.x)*v.x+(x.ball.y-stage.from.y)*v.y)/length;
   const ds=ts.map(pr);
   maxReversal=Math.max(maxReversal,ds[0]-ds[1],ds[1]-ds[2]);
   assert(ds[0]<=ds[1]+.00001&&ds[1]<=ds[2]+.00001,'Pass reverses before touch');
  }
  const advance=(stage.to.x-stage.from.x)*(stage.owner<11?1:-1);
  if(advance>2)forward++;else if(advance<-2)backwards++;
  if(stage.arc>2)lobs++;
  if(stage.pattern==='one-two')oneTwos++;
  if(stage.pattern==='cross')crosses++;
  transfers++;
 }else if(stage.mode==='rebound'){
  assert.equal(frame.ownerIndex,-1,'Loose ball cannot have an early carrier');
  assert(frame.wall,'A loose-wall rebound must include contact geometry');
 }else if(stage.mode==='challenge'){
  assert.equal(frame.ownerIndex,-1,'Contested ball must not be an owned carry');
  challenges++;
 }
}
assert(transfers>100,'Too few real give-and-go/cross/through visuals');
assert(challenges>20,'No standing possession challenges');
assert(oneTwos>30&&crosses>25&&lobs>25,'New attacking patterns absent');
assert(forward>backwards,'Backpasses dominate the attacking sequence');
assert(maxContact<1.8,'The ball drifts away from its actual dribbler');
assert(maxReversal<.0001,'Flight reverses direction');
for(const goal of fixture.events.filter(e=>e.type==='goal')){
 const toward=goal.team===fixture.home.id?1:-1;
 let prev=null;
 for(let t=goal.minute-.7;t<=goal.minute;t+=.01){
  const next=motionFrame(fixture,t,field);
  if(prev)assert((next.ball.x-prev.ball.x)*toward>-.08,
   'Goal buildup whips backwards before the official shot');
  prev=next;
 }
}
assert.equal(JSON.stringify(fixture),original,'Watch modified official PSE fixture');
const clone=JSON.parse(original);
assert.deepEqual(motionFrame(fixture,1.5,field),motionFrame(clone,1.5,field),
 'Cloned fixture and same seed must animate identically');
for(const minute of [90,100,119.99,120]){
 const frame=motionFrame({...fixture,durationMinutes:120},minute,field);
 assert.equal(frame.actors.length,22);assert(Number.isFinite(frame.ball.x));
}
console.log('PASS variable Watch continuity: '+timeline.sequences.length+
 ' distinct plays, '+transfers+' illustrative passes, '+challenges+
 ' contests, '+oneTwos+' one-twos, '+crosses+' crosses, '+lobs+
 ' lofts, '+maxBoundary.toFixed(5)+'m max discontinuity, stable PSE ledger');
