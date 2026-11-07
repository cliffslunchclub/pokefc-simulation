'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Pace=require('./phase10-player-pace.cjs');
const Director=require('./phase10-play-director.cjs');
const field={width:106,height:68};
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixture.json'),'utf8'));
const before=JSON.stringify(fixture);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
assert.equal(Pace.NORMAL_RUN,4);
assert.equal(Pace.BALL_CARRY,3.8);
assert.equal(Pace.SHORT_SPRINT,5);
assert.equal(Pace.speedFor({ownerIndex:6},6),3.8,'Ball carrier speed');
assert.equal(Pace.speedFor({ownerIndex:7},6),4,'Recent passer does not sprint');
assert.equal(Pace.speedFor({ownerIndex:6,pressPhase:'counterpress',pressingPlayers:[6,16]},6),3.8,
 'Ball carrier never runs at counterpress sprint speed');
assert.equal(Pace.speedFor({ownerIndex:6,pressPhase:'counterpress',pressingPlayers:[16]},16),5,
 'Active counterpresser can sprint briefly');
assert.equal(Pace.speedFor({ownerIndex:6,pressPhase:'settled',pressingPlayers:[16]},16),4,
 'Counterpress sprint ends with the counterpress');
for(const v of [0,.01,.2,1,3]){
 for(const limit of [3.8,4,5]){
  const from={x:2,y:4},to={x:20,y:21,z:.2};
  const next=Pace.approach(from,to,v,limit);
  assert(distance(from,next)<=v*limit+1e-8,'Player exceeded motion limit');
  assert.equal(next.z,.2,'Motion limit must preserve other pose fields');
 }
}
const plan=Director.planFor(fixture,field);
const carries=plan.actions.filter(a=>a.mode==='carry');
const weaves=plan.sequences.filter(s=>s.kind==='weave');
assert(carries.length>100,'Expected ordinary ball carries');
assert(weaves.length>30,'Expected regular triangle passing weaves');
let maxCarry=0,maxPeakSpeed=0,maxWeavePasses=0,alternations=0,threePassWeaves=0;
for(const carry of carries){
 maxCarry=Math.max(maxCarry,carry.duration);
 const peak=distance(carry.from,carry.to)*1.5/carry.duration;
 maxPeakSpeed=Math.max(maxPeakSpeed,peak);
 assert(peak<=Pace.BALL_CARRY+1e-7,'A dribble moved faster than its carrier');
 assert(carry.duration<=5,'Uninterrupted carry action lasts too long');
}
for(const seq of weaves){
 const passing=plan.actions.filter(a=>a.sequence===seq.index&&a.mode==='pass');
 maxWeavePasses=Math.max(maxWeavePasses,passing.length);
 if(passing.length>=3)threePassWeaves++;
 const direction=passing.map(a=>Math.sign(a.to.y-a.from.y))
  .filter(n=>n!==0);
 if(direction.some((d,i)=>i>0&&d!==direction[i-1]))alternations++;
}
assert(threePassWeaves>=weaves.length*.65,'Weaves should contain three deliberate passes');
assert(alternations>=weaves.length*.4,'Weaves must change passing lanes');
const dribbles=plan.sequences.filter(s=>s.kind==='dribble');
assert(dribbles.length>30);
const dribbleReleases=dribbles.filter(s=>plan.actions.some(a=>a.sequence===s.index&&a.mode==='pass'));
assert(dribbleReleases.length>=dribbles.length*.7,
 'Ordinary dribbles must release the ball to a teammate promptly');
for(let i=1;i<plan.actions.length;i++){
 assert(distance(plan.actions[i-1].to,plan.actions[i].from)<1e-6,
  'New pacing created a ball position jump');
}
assert.equal(JSON.stringify(fixture),before,'PSE fixture changed');
console.log('PASS player pace: '+carries.length+' carries, max '+maxCarry.toFixed(2)+
 ' seconds, peak '+maxPeakSpeed.toFixed(2)+' m/s; '+weaves.length+
 ' weave sequences, '+threePassWeaves+' triple-pass, '+alternations+
 ' lateral alternations; PSE immutable');
