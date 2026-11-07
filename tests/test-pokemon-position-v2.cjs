'use strict';
// Pokémon-stat positional specialization, Competitive efficiency and BST finishing.
const assert=require('node:assert/strict');
const model=require('../assets/js/position-effectiveness.js');
const pse=require('../assets/js/quick-sim.js');
const ko=require('../assets/js/pse-knockout.js');

const snorlax={hp:160,attack:110,defense:65,spAttack:65,spDefense:110,speed:30};
const sample={hp:65,attack:125,defense:20,spAttack:95,spDefense:30,speed:110};
const approximate=(a,b)=>assert(Math.abs(a-b)<1e-8,a+' differs from '+b);
approximate(model.preciseFit(snorlax,'CB'),76.2375);
assert.equal(model.archetype('LB'),'FB');
assert.equal(model.archetype('RB'),'FB');
assert.equal(model.archetype('LWB'),'WB');
assert.equal(model.archetype('LM'),'WB');
assert.equal(model.archetype('CDM'),'CDM');
assert.equal(model.archetype('CAM'),'CAM');
assert.equal(model.archetype('CM'),'CM');
assert.equal(model.archetype('LW'),'WING');
assert.equal(model.archetype('RW'),'WING');
assert.equal(model.archetype('ST'),'ST');
assert.equal(model.archetype('GK'),'GK');
assert.equal(model.preciseFit(snorlax,'LW'),model.preciseFit(snorlax,'RW'));
assert.equal(model.preciseFit(snorlax,'LB'),model.preciseFit(snorlax,'RB'));
assert(model.preciseFit(snorlax,'CB')>model.preciseFit(snorlax,'LB'));
assert(model.preciseFit(sample,'ST')!==model.preciseFit(sample,'LW'));
for(const k of Object.keys(model.PRECISE_WEIGHTS))
 approximate(Object.values(model.PRECISE_WEIGHTS[k]).reduce((a,b)=>a+b,0),1);
for(const [gap,eff] of [[0,1],[5,.97],[10,.92],[15,.85],[20,.78],[25,.74],[30,.70],[100,.70]])
 approximate(model.competitiveEfficiency(gap),eff);
assert(model.competitiveEfficiency(13)<.92&&model.competitiveEfficiency(13)>.85);
assert.equal(model.competitiveProfile(snorlax,'CB').efficiency,1);
assert(model.competitiveProfile(sample,'CB').efficiency<1);
assert(model.competitiveProfile(sample,'CB').efficiency>=.70);
assert.equal(model.finishingIndex(snorlax),.45*110+.25*65+.30*(540/6));
const cm=model.PRECISE_WEIGHTS.CM;
assert.deepEqual(cm,{hp:.20,attack:.15,defense:.15,spAttack:.15,spDefense:.15,speed:.20});
assert.equal(model.preciseFit({hp:120,attack:80,defense:80,spAttack:80,spDefense:80,speed:120},'CM'),Math.min(100,20+.55*(.20*120+.20*120+.15*80*4)));

const roles=['GK','LB','CB','CB','RB','CDM','CM','CAM','LW','ST','RW'];
const broad=r=>r==='GK'?'GK':['LB','CB','RB'].includes(r)?'DEF':['LW','ST','RW'].includes(r)?'FWD':'MID';
const pokes=[
 {hp:85,attack:83,defense:100,spAttack:85,spDefense:105,speed:78}, // GK
 {hp:80,attack:105,defense:65,spAttack:60,spDefense:75,speed:130}, // LB
 {hp:160,attack:110,defense:65,spAttack:65,spDefense:110,speed:30}, // CB
 {hp:80,attack:120,defense:130,spAttack:55,spDefense:65,speed:45}, // CB
 {hp:90,attack:110,defense:80,spAttack:100,spDefense:80,speed:95}, // RB
 {hp:80,attack:82,defense:83,spAttack:100,spDefense:100,speed:80}, // CDM
 {hp:91,attack:134,defense:95,spAttack:100,spDefense:100,speed:80}, // CM
 {hp:55,attack:50,defense:45,spAttack:135,spDefense:95,speed:120}, // CAM
 {hp:65,attack:65,defense:60,spAttack:110,spDefense:95,speed:130}, // LW
 {hp:90,attack:130,defense:80,spAttack:65,spDefense:85,speed:55}, // ST
 {hp:78,attack:84,defense:78,spAttack:109,spDefense:85,speed:100} // RW
];
function team(id,forcePenalty){
 return {id,tactic:'balanced',lineup:roles.map((r,i)=>{
  const stats=pokes[i],profile=model.competitiveProfile(stats,r),speed=65+i;
  return {id:id+'-'+i,name:'Pokémon '+i,pos:broad(r),exactPosition:r,pokemonStats:stats,
   positionFit:profile.fit,positionEfficiency:forcePenalty?.70:profile.efficiency,
   main:{sprintSpeed:speed,shortPassing:speed,firstTouch:speed,vision:speed,tackling:speed,finishing:speed},
   detail:{reflexes:speed,handling:speed,positioning:speed,diving:speed,kicking:speed,composure:speed,decisionMaking:speed,strength:speed}};
 })};
}
const ordinary={home:team('h',false),away:team('a',false)};
const degraded={home:team('h',true),away:team('a',false)};
let different=0,marginOrdinary=0,marginDegraded=0,knockouts=0;
let normalGoals=0,weakenedGoals=0,normalShots=0,weakenedShots=0;
for(let i=0;i<2000;i++){
 const seed='POKEMON-V2-'+i;
 const a=pse.simulate(ordinary,{seed,positionEffectiveness:'v2'});
 const b=pse.simulate(degraded,{seed,positionEffectiveness:'v2'});
 assert.equal(a.positionEffectiveness,'v2');
 assert.deepEqual(pse.simulate(ordinary,{seed,positionEffectiveness:'v2'}),a);
 assert.equal(a.events.filter(x=>x.type==='goal').length,a.score[0]+a.score[1]);
 assert.equal(b.events.filter(x=>x.type==='goal').length,b.score[0]+b.score[1]);
 if(a.stats.some((s,k)=>JSON.stringify(s)!==JSON.stringify(b.stats[k])))different++;
 marginOrdinary+=a.score[0]-a.score[1];
 marginDegraded+=b.score[0]-b.score[1];
 normalGoals+=a.score[0];weakenedGoals+=b.score[0];normalShots+=a.stats[0].shots;weakenedShots+=b.stats[0].shots;
 if(knockouts<4&&a.score[0]===a.score[1]){
  const r=ko.resolve(ordinary,a,{seed});
  assert.equal(r.match.positionEffectiveness,'v2');
  assert.deepEqual(ko.resolve(ordinary,a,{seed}),r);
  if(r.extraTime)assert.equal(r.match.durationMinutes,120);
  knockouts++;
 }
}
assert(different>100,'Competitive efficiency must affect real PSE match outcomes');
assert(marginDegraded<marginOrdinary,'Weakening one XI should reduce its aggregate goal differential');
assert.equal(knockouts,4,'Extra time and shootout pathway covered');
const altered=JSON.parse(JSON.stringify(ordinary));
for(const t of [altered.home,altered.away])for(const p of t.lineup){
 for(const k of Object.keys(p.main))p.main[k]=0;
 for(const k of Object.keys(p.detail))p.detail[k]=0;
}
assert.deepEqual(pse.simulate(altered,{seed:'DIRECT-STATS',positionEffectiveness:'v2'}),
 pse.simulate(ordinary,{seed:'DIRECT-STATS',positionEffectiveness:'v2'}),
 'PSE v2 must rely on Pokémon stats, not legacy soccer-attribute adapter');
// PSE legacy path remains unchanged with no v2 request.
assert.deepEqual(pse.simulate(ordinary,{seed:'LEGACY-V2-CHECK'}),
 pse.simulate(ordinary,{seed:'LEGACY-V2-CHECK'}));
console.log('PASS Pokémon-stat precise positions, Competitive curve, BST finishing, 2000 seeded PSE matches, knockout continuity');
console.log('Competitive calibration (per match): normal XI', (normalGoals/2000).toFixed(3),'goals and',(normalShots/2000).toFixed(3),'shots; penalized XI',(weakenedGoals/2000).toFixed(3),'goals and',(weakenedShots/2000).toFixed(3),'shots; margin changes',marginOrdinary,'->',marginDegraded);
