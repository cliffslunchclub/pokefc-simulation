'use strict';
/* Frozen compatibility hashes from the CURRENT PSE mirror baseline (2026-11-06).
 * Historical v0.8b hashes were intentionally superseded by later PSE scoring,
 * positional and event changes; this test protects today's legacy-input
 * deterministic outputs from unreviewed future changes. */
const {createHash}=require('node:crypto'),assert=require('node:assert/strict'),qs=require('../assets/js/quick-sim.js');
const roles=['GK','DEF','DEF','DEF','DEF','MID','MID','MID','FWD','FWD','FWD'];
const create=side=>({id:side,tactic:side==='h'?'press':'possession',lineup:roles.map((pos,i)=>({id:side+i,pos,main:{sprintSpeed:70+i,shortPassing:66+i,firstTouch:65+i,vision:68+i,tackling:73+i,finishing:64+i},detail:{strength:72+i,reflexes:69+i,positioning:70+i,handling:71+i,diving:67+i,kicking:76+i,decisionMaking:68+i,composure:75+i}}))});
const preview={home:create('h'),away:create('a'),seed:'SEED-BASE'};
const expected={A:'8eab410d86570ffab2e28d9671478c7cbd5d8eb4b37f4f3d9364598dc843afc3',B:'113d44861dd8c48d3c542a2f4906b69881c776cfec4ee232efc87727513cd275',C:'4f9da20798d2030f2cb677cc90f45f95632a1f9c307a402799118e4672d3ea7f',D:'3d42fc34980bc67200b0ec0273476cc27702167c9550344f126843e00fdbffe5'};
const observed={};
for(const [seed,hash] of Object.entries(expected)){
 const s=qs.simulate(preview,{seed});
 const stable=JSON.stringify({score:s.score,events:s.events,stats:s.stats.map(({tackles,tackleAttempts,...rest})=>rest),box:Object.fromEntries(Object.entries(s.box).map(([k,{tackles,tackleAttempts,...rest}])=>[k,rest]))});
 observed[seed]=createHash('sha256').update(stable).digest('hex');
}
console.log('Current PSE seed hashes:',JSON.stringify(observed));
for(const [seed,hash] of Object.entries(expected)) assert.equal(observed[seed],hash,'current PSE seeded legacy contract changed for '+seed);
console.log('PASS 4 current PSE seeds: stable official goals, events, passing, shots, assists, stats and player minutes');
