'use strict';
const assert=require('node:assert/strict');
const quick=require('../assets/js/quick-sim.js');
const director=require('../match-director/timeline.js');
const roles=['GK','DEF','DEF','DEF','DEF','MID','MID','MID','FWD','FWD','FWD'];
function team(side,boost=0){
 const lineup=roles.map((pos,i)=>({
  id:side+'-'+i,name:side+' player '+i,pos,
  main:{
   shortPassing:68+boost,firstTouch:67+boost,vision:68+boost,
   sprintSpeed:71+boost,tackling:69+boost,finishing:67+boost,
   shooting:67+boost,interception:69+boost,composure:67+boost
  },
  detail:{
   positioning:69+boost,strength:70+boost,reflexes:68+boost,
   handling:68+boost,diving:68+boost,kicking:69+boost,
   decisionMaking:67+boost,awareness:69+boost
  }
 }));
 return {id:side,name:side+' FC',tactic:'balanced',lineup};
}
const preview={seed:'phase10-fixture',home:team('home'),away:team('away')};
let checked=0,goals=0,saves=0,shots=0,positiveGoals=0;
for(let seed=0;seed<220;seed++){
 const options={seed:'phase10-quick-seed-'+seed};
 const result=quick.simulate(preview,options);
 const unchanged=JSON.stringify(result),fixtureBefore=JSON.stringify(preview);
 const timeline=director.build(preview,result,{seed:'phase10-director-seed-'+seed});
 assert(director.validate(timeline));
 assert.equal(JSON.stringify(result),unchanged,'Match Director changed Quick Sim result');
 assert.equal(JSON.stringify(preview),fixtureBefore,'Match Director changed original roster');
 assert.deepEqual(timeline,director.build(preview,result,{seed:'phase10-director-seed-'+seed}),
  'Same result and seed must generate exactly the same timeline');
 assert.equal(timeline.coverage,'shots-and-goals-only','Do not imply passes have been scripted');
 assert.deepEqual(director.scoreAt(timeline,90),result.score,'Official score changed');
 assert.deepEqual(timeline.events,director.eventsBetween(timeline,0,90),'Window omitted events');
 assert.equal(director.eventsBetween(timeline,0,5).every(e=>e.minute<5),true,'Opening five-minute window invalid');
 assert.equal(director.eventsBetween(timeline,5,10).every(e=>e.minute>=5&&e.minute<10),true);
 assert.equal(timeline.events.length,result.stats[0].shots+result.stats[1].shots);
 const originalGoals=result.events.filter(e=>e.type==='goal');
 const scriptedGoals=timeline.events.filter(e=>e.outcome==='goal');
 assert.equal(scriptedGoals.length,originalGoals.length);
 for(let i=0;i<originalGoals.length;i++){
  const goal=originalGoals[i],replayed=scriptedGoals.find(e=>e.officialGoalIndex===i);
  assert(replayed,'Missing original scoring event');
  assert.equal(replayed.minute,goal.minute,'Official goal minute moved');
  assert.equal(replayed.teamId,String(goal.team));
  assert.equal(replayed.playerId,String(goal.player));
  assert.equal(replayed.assistId,goal.assist==null?null:String(goal.assist));
  assert.deepEqual(director.scoreAt(timeline,goal.minute),
   director.scoreAt(timeline,goal.minute+0.00001),'Score is unstable after goal');
 }
 for(let side=0;side<2;side++){
  const teamId=side===0?preview.home.id:preview.away.id;
  const teamEvents=timeline.events.filter(e=>e.teamId===teamId);
  const shotsByPlayer=Object.create(null);
  for(const e of teamEvents)shotsByPlayer[e.playerId]=(shotsByPlayer[e.playerId]||0)+1;
  for(const p of (side===0?preview.home.lineup:preview.away.lineup))
   assert.equal(shotsByPlayer[p.id]||0,result.box[p.id].shots,'Player shots must agree with Quick Sim');
  assert.equal(teamEvents.filter(e=>e.onTarget).length,result.stats[side].shotsOnTarget);
  assert.equal(teamEvents.filter(e=>e.outcome==='saved').length,result.stats[1-side].saves);
 }
 checked++;goals+=scriptedGoals.length;
 shots+=timeline.events.length;
 saves+=timeline.events.filter(e=>e.outcome==='saved').length;
 if(scriptedGoals.length>0)positiveGoals++;
}
assert(positiveGoals>=20,'Too few scored fixtures in test set');
const one=quick.simulate(preview,{seed:'tamper-check'}),before=director.build(preview,one);
assert.throws(()=>director.build({...preview,home:{...preview.home,id:'different'}},one),/different fixture/);
assert.throws(()=>director.eventsBetween(before,-1,5),/Invalid window/);
assert.throws(()=>director.scoreAt(before,91),/Invalid minute/);
const altered=structuredClone(one);
altered.stats[0].shots+=1;
assert.throws(()=>director.build(preview,altered),/Team shots differ/);
const alteredTwo=structuredClone(one);
alteredTwo.stats[0].shotsOnTarget+=1;
assert.throws(()=>director.build(preview,alteredTwo),/Saved shots differ|Impossible shot counts/);
const tamperedPlan=structuredClone(before);
tamperedPlan.events[0].outcome='goal';
if(before.events[0].outcome!=='goal')assert.throws(()=>director.validate(tamperedPlan),/Score drift|Event ledger mismatch/);
console.log('PASS Phase 10 Match Director v0.1: '+checked+' seeded matches, '+shots+
 ' shots, '+saves+' saves, '+goals+' goals reconciled, Quick Sim unchanged');
