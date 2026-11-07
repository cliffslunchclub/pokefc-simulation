'use strict';
/* Near-goal defender convergence and goalkeeper 5m/s continuous motion. */
const assert=require('node:assert/strict');
const fixture=require('./fixture.json');
const Director=require('./phase10-play-director.cjs');
const TeamShape=require('./phase10-team-shape.cjs');
const Keeper=require('./phase10-goalkeeper-rush.cjs');
const Pace=require('./phase10-player-pace.cjs');
const Wall=require('./phase10-wall-physics.cjs');
const {motionFrame}=require('./phase10-motion.cjs');
const field={width:106,height:68},snapshot=JSON.stringify(fixture);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function pressAt(ball,stage,second=2){
 const actors=Array.from({length:22},(_,id)=>({
  x:id<11?40:75,y:34+(id%11-5)*3
 }));
 const profile=TeamShape.styleFor('balanced');
 const shape={active:0,age:Infinity,phase:'settled',turnover:null,
  nextTurnover:null,profiles:[profile,profile]};
 const visual={stage:{start:0,end:5,duration:5,from:ball,...stage},
  plan:{turnovers:[]}};
 const before=actors.map(x=>({...x}));
 const press=TeamShape.press(fixture,field,second,visual,shape,actors,ball);
 return {press,before,actors};
}
const near=pressAt({x:97,y:34});
const distant=pressAt({x:52,y:34});
assert(near.press.nearGoal>.5,'Goal area must trigger full pressure');
assert(near.press.intensity>distant.press.intensity,'Near-goal pressure must be urgent');
const rank=Array.from({length:10},(_,i)=>i+12)
 .sort((a,b)=>distance(near.before[a],{x:97,y:34})-
  distance(near.before[b],{x:97,y:34})||a-b).slice(0,3);
assert.deepEqual(near.press.ids,rank,'Actual nearest three outfield defenders must press');
assert(near.press.ids.length<=3&&new Set(near.press.ids).size===3);
assert(near.press.ids.every(id=>id>=12&&id<=21),'Goalkeeper not counted among pressers');
assert(near.press.ids.some(id=>distance(near.actors[id],{x:97,y:34})<
 distance(near.before[id],{x:97,y:34})-1),'Nearby defenders must close down');
const betweenPasses=pressAt({x:97,y:34},{start:2,end:7,duration:5},2.001);
assert(betweenPasses.press.intensity>.8,
 'Final-16m pressure must persist across passing stage boundaries');
const noAttack=Keeper.target(1,field,{mode:'carry',owner:14},
 {x:98,y:34,z:.23});
assert(!noAttack.urgent,'Keeper must not rush own attacker');
const rush=Keeper.target(1,field,{mode:'carry',owner:6},
 {x:98,y:34,z:.23});
assert(rush.urgent,'Keeper must charge when opposition is within 10m');
assert(rush.x<field.width*.955,'Keeper must leave the goal line toward attacker');
const outside=Keeper.target(1,field,{mode:'carry',owner:6},
 {x:90,y:34,z:.23});
assert(!outside.urgent,'Keeper must not rush beyond 10m');
const ownCollection=Keeper.target(1,field,
 {mode:'rebound',owner:6,receiver:11,duration:3,to:{x:100,y:34}},
 {x:102,y:34,z:.23});
assert(ownCollection.collecting,'A reachable assigned GK loose ball is collectible');
assert.equal(Pace.speedFor({ownerIndex:11},11),5);
const plan=Director.planFor(fixture,field);
let rushSeconds=0,maxSpeed=0;
for(let t=0;t<=plan.duration;t+=.25){
 const pos=Keeper.at(fixture,field,t);
 const future=Keeper.at(fixture,field,Math.min(t+.25,plan.duration));
 for(let side=0;side<2;side++){
  const speed=distance(pos[side],future[side])/.25;
  maxSpeed=Math.max(maxSpeed,speed);
  assert(speed<=Keeper.SPEED_LIMIT+1e-5,
   'Keeper teleported or outran 5m/s at '+t+': '+speed);
 }
 const stage=Director.stageAt(plan,t),ball=Director.ballAt(stage,t);
 if(Keeper.target(1-Math.floor(stage.owner/11),field,stage,ball).urgent)
  rushSeconds++;
}
assert(rushSeconds>0,'Expected near-goal rush opportunities in visual match');
const pick=plan.actions.filter(a=>a.mode==='rebound'&&a.receiver%11===0);
for(const action of pick){
 assert(action.receiver===0||action.receiver===11,'Only actual keeper may collect');
 assert(distance(Director.base(action.receiver,field),action.to)<=8.0001);
 const before=motionFrame(fixture,(action.end-.06)/60,field);
 const after=motionFrame(fixture,(action.end+.00001)/60,field);
 assert(distance(before.ball,after.ball)<.2,'GK pickup must preserve ball continuity');
}
for(const event of fixture.events.filter(e=>e.type==='goal')){
 const frame=motionFrame(fixture,event.minute,field);
 assert.equal(frame.action,'official-goal');
 assert.equal(frame.officialEvent.player,event.player,'Keeper must not deny PSE goal');
}
const noGoal={...fixture,events:[]};
assert.deepEqual(Director.planFor(noGoal,field).actions,plan.actions,
 'Goalkeeper and defender choreography cannot change the PSE goal schedule');
assert.equal(JSON.stringify(fixture),snapshot,'PSE fixture mutated');
const render=require('node:fs').readFileSync(require('node:path').join(__dirname,'viewer-entry.cjs'),'utf8');
assert(render.includes('Wall.boardSegments(field)'),'Renderer must honor actual goalpost cutouts');
assert.equal(Wall.boardSegments(field).length,6);
console.log('PASS near-goal pressure and keeper: three nearest, '+rushSeconds+
 ' rush samples, '+pick.length+' loose pickups, max '+maxSpeed.toFixed(3)+
 'm/s, open goals and PSE ledger unchanged');
