'use strict';
const assert=require('node:assert/strict');
const fixture=require('./fixture.json');
const {planFor,sample,actorAt,stageAt,nextBoundary}=require('./phase10-play-director.cjs');
const {motionFrame}=require('./phase10-motion.cjs');
const Wall=require('./phase10-wall-physics.cjs');
const field={width:106,height:68},pristine=JSON.stringify(fixture);
const p=planFor(fixture,field),other=planFor(JSON.parse(pristine),field);
assert.deepEqual(p,other,'Visual plan must replay identically from same fixture');
assert.equal(p.duration,5400);
assert(p.actions.length>1100&&p.sequences.length>350,'Variable plays not constructed');
// With shorter on-ball carries, an extended buildup is defined by several
// real passing actions, not by one player standing on the ball for 20s.
const longSequences=p.sequences.filter(s=>s.end-s.start>10);
const passingWeaves=p.sequences.filter(s=>s.kind==='weave'&&
 p.actions.filter(a=>a.sequence===s.index&&a.mode==='pass').length>=3);
assert(longSequences.length>10&&passingWeaves.length>20,
 'Missing meaningful extended multi-pass buildups; '+longSequences.length+
 ' over 10s and '+passingWeaves.length+' passing weaves');
assert(new Set(p.sequences.map(s=>Math.round((s.end-s.start)*10))).size>45,
 'Play durations remain fixed');
const kinds=new Map;
for(const seq of p.sequences)kinds.set(seq.kind,(kinds.get(seq.kind)||0)+1);
for(const kind of ['dribble','one-two','cross','through','switch'])
 assert(kinds.get(kind)>30,'Pattern absent during normal play: '+kind);
const none={...fixture,events:[]},without=planFor(none,field);
assert.deepEqual(without.actions,p.actions,
 'Pattern frequency or setup must not reveal PSE goal minutes');
assert.equal(JSON.stringify(fixture),pristine);
let maxBall=0,maxActor=0,flight=0,carry=0;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
for(let i=1;i<p.actions.length;i++){
 const now=p.actions[i].start;
 assert(distance(p.actions[i].from,p.actions[i-1].to)<.000001,
  'Timeline breaks ball position at next action');
 const left=sample(fixture,field,now-.00006),right=sample(fixture,field,now+.00006);
 maxBall=Math.max(maxBall,distance(left.ball,right.ball));
 if(p.actions[i].mode==='pass'){
  flight++;
  assert.equal(right.ownerIndex,-1,'Flying ball belongs to nobody');
 }
 if(p.actions[i].mode==='carry')carry++;
 // Verify actual 22-player Watch actor positions too, excluding goal/kickoff cuts.
 const inGoal=fixture.events.some(g=>g.type==='goal'&&
  now>=g.minute*60-42-.05&&now<=g.minute*60+17);
 if(!inGoal){
  const before=motionFrame(fixture,(now-.00006)/60,field),
   after=motionFrame(fixture,(now+.00006)/60,field);
  if([before,after].some(f=>['official-goal','illustrative-goal-buildup',
   'illustrative-shot','illustrative-kickoff'].includes(f.action)))continue;
  maxActor=Math.max(maxActor,...before.actors.map((x,j)=>distance(x,after.actors[j])));
 }
}
assert(maxBall<.01&&maxActor<.05,'Variable action creates a snap');
assert(flight>100&&carry>100,'Need enough flight and carry sequences');
for(const t of [0,1,10,32,300,3000,5399,5400]){
 const a=sample(fixture,field,t),b=sample(JSON.parse(pristine),field,t);
 assert.deepEqual(a.ball,b.ball);
 assert(Wall.boundary(a.ball,field),'Continuous ball must remain inside boards');
 assert(['pass','carry','challenge','rebound'].includes(a.stage.mode));
}
const overtime={...fixture,durationMinutes:120};
assert.equal(planFor(overtime,field).duration,7200);
assert(planFor(overtime,field).actions.at(-1).end>=7199.9);
const originalGoalEvents=fixture.events.filter(e=>e.type==='goal');
for(const goal of originalGoalEvents){
 const scored=motionFrame(fixture,goal.minute,field);
 assert.equal(scored.action,'official-goal');
 assert.equal(scored.officialEvent.player,goal.player);
}
assert(nextBoundary(fixture,field,100)>99);
assert.equal(JSON.stringify(fixture),pristine,'Animation rewrote PSE fixture');
console.log('PASS variable Play Director: '+p.sequences.length+' variable sequences, '+
 p.actions.length+' stages, '+JSON.stringify(Object.fromEntries(kinds))+
 ', '+maxBall.toFixed(6)+'m ball continuity, '+maxActor.toFixed(6)+
 'm actor continuity, PSE results unchanged');
