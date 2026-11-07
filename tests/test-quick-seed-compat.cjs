'use strict';
/* Hashes recorded from UNMODIFIED v0.8b Quick Sim before the tackle-stat upgrade.
 * The new stat ledger must not reshuffle scoring, passes, shots, or assists
 * for an otherwise identical match seed. */
const {createHash}=require('node:crypto'),assert=require('node:assert/strict'),qs=require('../assets/js/quick-sim.js');
const roles=['GK','DEF','DEF','DEF','DEF','MID','MID','MID','FWD','FWD','FWD'];
const create=side=>({id:side,tactic:side==='h'?'press':'possession',lineup:roles.map((pos,i)=>({id:side+i,pos,main:{sprintSpeed:70+i,shortPassing:66+i,firstTouch:65+i,vision:68+i,tackling:73+i,finishing:64+i},detail:{strength:72+i,reflexes:69+i,positioning:70+i,handling:71+i,diving:67+i,kicking:76+i,decisionMaking:68+i,composure:75+i}}))});
const preview={home:create('h'),away:create('a'),seed:'SEED-BASE'};
const expected={A:'6b0b5a12b7ceb00b9670aa965e519cd8da854fb9c01f49ab51700a5bf0485400',B:'88fc0b7a3e1213d4b7c2186e3ffab6c48b3bbd396e61b77f10c5cf68405698d2',C:'2eac0c84d22842ce0b2eb43ed756e0340d4b745a88f7c7e73dd612ff4533c2aa',D:'c52de0476d43880bb4d1e282d0871a4c8e7bdc0ebd945d89829f324aed48fb7e'};
for(const [seed,hash] of Object.entries(expected)){
 const s=qs.simulate(preview,{seed});
 const stable=JSON.stringify({score:s.score,events:s.events,stats:s.stats.map(({tackles,tackleAttempts,...rest})=>rest),box:Object.fromEntries(Object.entries(s.box).map(([k,{tackles,tackleAttempts,...rest}])=>[k,rest]))});
 assert.equal(createHash('sha256').update(stable).digest('hex'),hash,'original non-tackle stats changed for '+seed);
}
console.log('PASS 4 historical seeds: unchanged goals, event history, shots, passing, assists and player minutes after tackle alignment');
