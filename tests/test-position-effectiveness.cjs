'use strict';
const assert=require('node:assert/strict');
const fit=require('../assets/js/position-effectiveness.js');
const sim=require('../assets/js/quick-sim.js');
const knockout=require('../assets/js/pse-knockout.js');

const stats={hp:65,attack:125,defense:20,spAttack:95,spDefense:30,speed:110};
const forward=fit.profile(stats,'ST'),defender=fit.profile(stats,'CB');
assert.equal(fit.role('LW'),'FWD');assert.equal(fit.role('CDM'),'MID');
assert.equal(fit.role('RB'),'DEF');assert.equal(fit.role('GK'),'GK');
assert.equal(fit.fit(stats,'ST'),forward.fit);
assert.equal(fit.fit(stats,'LW'),forward.fit);
assert(defender.fit<forward.fit,'Off-role natural fit lower');
assert(defender.efficiency<1&&defender.efficiency>=.88);
assert.equal(forward.efficiency,1,'No flat tier bonus for natural-position players');
assert.equal(fit.profile({hp:0,attack:500,defense:0,spAttack:0,spDefense:0,speed:0},'GK').efficiency,.88);

const roles=['GK','DEF','DEF','DEF','DEF','MID','MID','MID','FWD','FWD','FWD'];
const team=(id,weak)=>({id,tactic:'balanced',lineup:roles.map((pos,i)=>({
 id:id+'-'+i,name:id+' #'+i,pos,positionEfficiency:weak?.88:1,
 main:{sprintSpeed:76,shortPassing:78,firstTouch:77,vision:77,tackling:76,finishing:78},
 detail:{reflexes:77,positioning:76,handling:77,diving:76,kicking:77,strength:77,composure:78,decisionMaking:76}
}))});
const neutral={home:team('home',false),away:team('away',false)};
const weakened={home:team('home',true),away:team('away',false)};
let changed=0,oldMargin=0,newMargin=0,checkedKnockouts=0;
for(let i=0;i<350;i++){
 const seed='POSITION-V1-'+i;
 const legacy=sim.simulate(neutral,{seed});
 const neutralOpt=sim.simulate(neutral,{seed,positionEffectiveness:'v1'});
 assert.deepEqual(neutralOpt.score,legacy.score,'100% efficiency retains legacy score');
 assert.deepEqual(neutralOpt.stats,legacy.stats,'100% efficiency retains legacy stats');
 assert.deepEqual(neutralOpt.events,legacy.events,'100% efficiency retains legacy events');
 const adjusted=sim.simulate(weakened,{seed,positionEffectiveness:'v1'});
 assert.equal(adjusted.positionEffectiveness,'v1');
 assert.deepEqual(sim.simulate(weakened,{seed,positionEffectiveness:'v1'}),adjusted,'Seeded determinism');
 oldMargin+=legacy.score[0]-legacy.score[1];
 newMargin+=adjusted.score[0]-adjusted.score[1];
 if(JSON.stringify(adjusted.stats)!==JSON.stringify(legacy.stats))changed++;
 if(legacy.score[0]===legacy.score[1]&&checkedKnockouts<4){
  const baseline=knockout.resolve(neutral,legacy,{seed});
  const withFit=knockout.resolve(weakened,adjusted,{seed});
  assert.equal(withFit.match.positionEffectiveness,'v1');
  assert.deepEqual(knockout.resolve(weakened,adjusted,{seed}),withFit,'KO reads opt-in from regulation');
  assert(baseline.match.score.length===2&&withFit.match.score.length===2);
  checkedKnockouts++;
 }
}
assert(changed>100,'PSE position effect must change real gameplay');
assert(newMargin<oldMargin,'The weakened team must have worse aggregate goal differential');
assert.equal(checkedKnockouts,4,'Knockout fixture coverage');
console.log('PASS position efficiency: shared natural fit, PSE mechanics, neutral seed compatibility, 120-minute KO continuity');
