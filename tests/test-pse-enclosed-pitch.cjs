'use strict';
const assert=require('node:assert/strict'),qs=require('../assets/js/quick-sim.js');
const roles=['GK','DEF','DEF','DEF','DEF','MID','MID','MID','FWD','FWD','FWD'];
function team(id){return {id,name:id+' Gym FC',tactic:'press',
 lineup:roles.map((pos,i)=>({id:id+'-'+i,name:id+' Pokémon '+i,pos,
 main:{finishing:69+i,shortPassing:71+i,vision:70+i,firstTouch:72+i,sprintSpeed:75+i,tackling:76+i},
 detail:{reflexes:74,handling:75,positioning:74,diving:72,kicking:75,strength:73,decisionMaking:73}
 }))};}
const preview={home:team('home'),away:team('away'),seed:'enclosed-pitch'};
const forbidden=['corner','throw-in','foul','free-kick','penalty-kick'];
let checked=0,goals=0,tackles=0;
for(let i=0;i<500;i++){
 const seed='ENCLOSED-'+i,result=qs.simulate(preview,{seed});
 assert.deepEqual(result,qs.simulate(preview,{seed}),'Seed must reproduce the same result');
 assert.deepEqual(result,qs.simulate(preview,{seed,setPieces:'v1'}),
  'Deprecated set-piece flag cannot enable a different match ruleset');
 assert.equal(result.setPieceRules,undefined);
 assert(result.events.every(e=>e.type==='goal'||e.type==='save'),
  'New matches only record goals and saves');
 for(const type of forbidden)assert(!result.events.some(e=>e.type===type),
  'Retired event created: '+type);
 for(let side=0;side<2;side++){
  const st=result.stats[side],other=result.stats[1-side];
  assert.equal(st.goals,result.score[side]);
  assert.equal(st.shotsOnTarget,st.goals+other.saves);
  assert(st.tackles<=st.tackleAttempts);
  for(const field of ['corners','foulsCommitted','freeKicks','penaltyKicks'])
   assert.equal(Object.hasOwn(st,field),false,'Obsolete stat '+field);
  goals+=st.goals;tackles+=st.tackles;
 }
 checked++;
}
assert(goals>0&&tackles>0,'Open play should still have scoring and standing tackles');
console.log('PASS no-whistle PSE: 500 deterministic matches, goals/saves/standing tackles retained; legacy seed preserved');
