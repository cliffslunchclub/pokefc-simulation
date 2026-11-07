'use strict';
/* Current-PSE seeded reproducibility and goal-ledger compatibility.
 * The retired v0.8b golden hashes included an obsolete, goal-only event
 * format and pre-Pokémon-stat model; they are NOT current golden outputs.
 * This guard protects deterministic seeds and current official invariants,
 * while the full goal/save and legacy-save tests cover their own schemas. */
const assert=require('node:assert/strict');
const qs=require('../assets/js/quick-sim.js');
const roles=['GK','DEF','DEF','DEF','DEF','MID','MID','MID','FWD','FWD','FWD'];
const create=side=>({id:side,tactic:side==='h'?'press':'possession',lineup:roles.map((pos,i)=>({
 id:side+i,pos,
 main:{sprintSpeed:70+i,shortPassing:66+i,firstTouch:65+i,vision:68+i,tackling:73+i,finishing:64+i},
 detail:{strength:72+i,reflexes:69+i,positioning:70+i,handling:71+i,diving:67+i,kicking:76+i,decisionMaking:68+i,composure:75+i}
}))});
const preview={home:create('h'),away:create('a'),seed:'SEED-BASE'};
const outputs=new Set();
for(const seed of ['A','B','C','D']){
 const a=qs.simulate(preview,{seed});
 const b=qs.simulate(preview,{seed});
 assert.deepEqual(a,b,'PSE result changed across identical runs for '+seed);
 assert.equal(a.origin,'quick-sim','PSE result provenance changed for '+seed);
 assert(Array.isArray(a.events),'PSE event ledger unavailable');
 const goals=a.events.filter(e=>e.type==='goal');
 assert.equal(goals.length,a.score[0]+a.score[1],'goals must match score for '+seed);
 for(let side=0;side<2;side++){
   const teamId=side===0?'h':'a';
   assert.equal(a.stats[side].goals,a.score[side],'team goals not reconciled for '+seed);
   assert.equal(goals.filter(e=>String(e.team)===teamId).length,a.score[side],
     'team goal events not reconciled for '+seed);
 }
 outputs.add(JSON.stringify({score:a.score,events:a.events,stats:a.stats,box:a.box}));
}
assert(outputs.size>1,'Different seeds unexpectedly produced identical PSE reports');
console.log('PASS 4 current-PSE seeds: repeatable score, event ledger, team stats and box scores; unique seeded outputs');
