'use strict';
/* Representative Gen I XI role swaps: official seeded PSE outputs, not visual estimates. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const position=require('../assets/js/position-effectiveness.js');
const PSE=require('../assets/js/quick-sim.js'),KO=require('../assets/js/pse-knockout.js');
const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../assets/js/national-species.js'),'utf8'),sandbox);
const pokemon=new Map(sandbox.window.FXI_SPECIES.map(s=>[s.id,s]));
const slots=['GK','LB','CB','CB','RB','CM','CM','CM','LW','ST','RW'];
const roster=[9,142,143,76,59,3,149,65,135,68,6];
// Blastoise, Aerodactyl, Snorlax, Golem, Arcanine, Venusaur,
// Dragonite, Alakazam, Jolteon, Machamp, Charizard.
const family=slot=>slot==='GK'?'GK':['CB','LB','RB','LWB','RWB'].includes(slot)?'DEF':['ST','LW','RW'].includes(slot)?'FWD':'MID';
function build(ids,side){
 return {id:side,tactic:'balanced',lineup:ids.map((id,i)=>{
  const stats={...pokemon.get(id).baseStats},exactPosition=slots[i],p=position.competitiveProfile(stats,exactPosition);
  return {id:side+'-'+i+'-'+id,name:pokemon.get(id).name,pos:family(exactPosition),
   exactPosition,pokemonStats:stats,positionFit:p.fit,positionEfficiency:p.efficiency};
 })};
}
const swap=(a,b)=>{const r=roster.slice();[r[a],r[b]]=[r[b],r[a]];return r};
const opponent=build(roster,'away');
const setups=[
 {label:'natural XI',list:roster},
 {label:'ST ↔ CB (Machamp/Snorlax)',list:swap(9,2)},
 {label:'LW ↔ CB (Jolteon/Golem)',list:swap(8,3)},
 {label:'GK ↔ ST (Blastoise/Machamp)',list:swap(0,9)},
 {label:'CM ↔ CB (Dragonite/Golem)',list:swap(6,3)},
 {label:'LW ↔ RW (Jolteon/Charizard)',list:swap(8,10)}
];
const trials=1200;
const rows=setups.map((setup,i)=>{
 const home=build(setup.list,'home'),preview={home,away:opponent};
 let gf=0,ga=0,shots=0,onTarget=0,saves=0;
 const run=seed=>PSE.simulate(preview,{seed,positionEffectiveness:'v2'});
 for(let j=0;j<trials;j++){
  const seed='PFC-V2-REALISTIC-SWAP-'+j,result=run(seed);
  gf+=result.score[0];ga+=result.score[1];shots+=result.stats[0].shots;
  onTarget+=result.stats[0].shotsOnTarget;saves+=result.stats[0].saves;
  if(j===0){
   assert.deepEqual(run(seed),result,'Same seed must produce the same official events');
   assert.equal(result.events.filter(e=>e.type==='goal').length,result.score[0]+result.score[1]);
   if(result.score[0]===result.score[1])assert(KO.resolve(preview,result,{seed}).winner,'Tied game resolves without legacy soccer attributes');
  }
 }
 return {label:setup.label,avgGoals:+(gf/trials).toFixed(3),avgConceded:+(ga/trials).toFixed(3),
  goalDiff:+((gf-ga)/trials).toFixed(3),avgShots:+(shots/trials).toFixed(3),
  avgOnTarget:+(onTarget/trials).toFixed(3),avgSaves:+(saves/trials).toFixed(3),
  meanEfficiency:+(100*home.lineup.reduce((sum,p)=>sum+p.positionEfficiency,0)/11).toFixed(1)};
});
assert.equal(rows.length,6);
assert(rows[3].goalDiff<rows[0].goalDiff,'GK/ST role mismatch must reduce match effectiveness');
assert(rows.slice(1,5).some(x=>x.avgShots!==rows[0].avgShots||x.avgGoals!==rows[0].avgGoals),
 'Actual role changes must affect PSE results');
assert(rows.every(r=>r.avgGoals>=0&&r.avgConceded>=0&&r.avgShots>=r.avgOnTarget));
// Reversing left/right wide roles does not invent preferred-foot penalties.
assert.equal(position.preciseFit(pokemon.get(135).baseStats,'LW'),position.preciseFit(pokemon.get(135).baseStats,'RW'));
assert.equal(position.preciseFit(pokemon.get(142).baseStats,'LB'),position.preciseFit(pokemon.get(142).baseStats,'RB'));
console.log('PASS real Pokémon XI swap regression; '+trials+' matched seeds per scenario');
for(const row of rows)console.log('CALIBRATE '+JSON.stringify(row));
