'use strict';
const assert=require('node:assert/strict');
const Onside=require('./phase10-onside-movement.cjs');
const {motionFrame}=require('./phase10-motion.cjs');
const Director=require('./phase10-play-director.cjs');
const fixture=require('./fixture.json'),field={width:106,height:68};
const original=JSON.stringify(fixture);
const depth=(side,x)=>side===0?x:field.width-x;
function setup(side){
 return Array.from({length:22},(_,id)=>{
  const team=Math.floor(id/11),i=id%11;
  const forward=team===side?85:i===0?100:i===1?80:70;
  return {side:team,index:i,x:side===0?forward:field.width-forward,y:30};
 });
}
for(const side of [0,1]){
 const ball={x:side===0?60:46};
 let actors=setup(side);
 assert.equal(Onside.line(actors,field,side,ball),79.5);
 Onside.apply(actors,field,ball,side,{carrier:side*11+6});
 assert.equal(depth(side,actors[side*11+8].x),79.5);
 assert.equal(depth(side,actors[side*11+6].x),85,'Dribbler can beat defensive line');
 // The keeper has rushed beyond both deepest outfield players.
 actors=setup(side);actors[(1-side)*11].x=side===0?65:41;
 assert.equal(Onside.line(actors,field,side,ball),69.5,'Use second-last opponent, not last outfielder');
 actors=setup(side);
 const ahead={x:side===0?94:12};
 assert.equal(Onside.line(actors,field,side,ahead),93.5,'Ball can define the line');
 actors=setup(side);
 for(const p of actors)if(p.side!==side)p.x=side===0?40:66;
 assert.equal(Onside.line(actors,field,side,{x:53}),53,'Never restrict own half');
 actors=setup(side);
 Onside.apply(actors,field,ball,side,{runner:side*11+8,run:0});
 assert.equal(depth(side,actors[side*11+8].x),79.5,'Receiver onside at release');
 actors=setup(side);
 Onside.apply(actors,field,ball,side,{runner:side*11+8,run:1});
 assert.equal(depth(side,actors[side*11+8].x),85,'Released receiver can run beyond defense');
 // Moving defenders produce continuous returning positions.
 let previous=null;
 for(let tick=0;tick<=100;tick++){
  actors=setup(side);
  actors[(1-side)*11+1].x=side===0?80-tick*.05:26+tick*.05;
  Onside.apply(actors,field,ball,side);
  const x=actors[side*11+8].x;
  if(previous!==null)assert(Math.abs(x-previous)<=.050001);
  previous=x;
 }
}
let checked=0,runs=0;
const plan=Director.planFor(fixture,field);
for(const stage of plan.actions){
 for(const seconds of [stage.start,stage.start+stage.duration*.5]){
  const frame=motionFrame(fixture,seconds/60,field,true);
  const actual=Director.stageAt(plan,seconds/60*60);
  const side=Math.floor(actual.owner/11),ball=frame.ball;
  if(!Number.isFinite(frame.offsideBoundary))continue;
  const boundary=Onside.line(frame.actors,field,side,ball);
  // Newly regained possession eases stranded players back over one second.
  if(frame.pressPhase!=='settled')continue;
  for(let id=side*11+1;id<side*11+11;id++){
   if(id===frame.ownerIndex||actual.mode!=='carry'&&id===actual.receiver&&
    seconds-actual.start>1e-7)continue;
   assert(depth(side,frame.actors[id].x)<=boundary+1e-7,'Supporting attacker beyond live line');
   checked++;
  }
  if(stage.mode==='pass'&&seconds>stage.start&&
   depth(side,frame.actors[stage.receiver].x)>boundary)runs++;
 }
}
assert(checked>1000);assert(runs>0,'Through-ball runs must survive the limit');
for(const goal of fixture.events.filter(e=>e.type==='goal')){
 const side=goal.team===fixture.home.id?0:1;
 const roster=side===0?fixture.home:fixture.away;
 const scorer=side*11+roster.lineup.findIndex(p=>String(p.id)===String(goal.player));
 for(const u of [.05,.2,.339]){
  const frame=motionFrame(fixture,goal.minute-.7+.7*u,field);
  assert(depth(side,frame.actors[scorer].x)<=Onside.line(frame.actors,field,side,frame.ball)+1e-7,
   'Official scorer must wait onside until the goal-scene pass is released');
 }
 const at=motionFrame(fixture,goal.minute,field);
 assert.equal(at.officialEvent,goal,'Preserve the exact official goal');
}
assert.equal(JSON.stringify(fixture),original,'Official PSE fixture must not change');
assert.deepEqual(motionFrame(fixture,12.345,field),motionFrame(JSON.parse(original),12.345,field),
 'Seeking remains deterministic');
console.log('PASS dynamic onside movement: '+checked+' supporting positions, '+runs+' released runs, mirrored rules and unchanged PSE');
