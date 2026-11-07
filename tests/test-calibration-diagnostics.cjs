'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const files=['kanto','johto','hoenn','sinnoh'].map(r=>path.join(root,'calibration','v08b-audit-'+r+'.json'));
let count=0,ticks=0;
for(const f of files){const r=JSON.parse(fs.readFileSync(f,'utf8'));
 assert.equal(r.format,'fxi-quick-vs-tm-diagnostic-v1');
 assert.equal(r.engineMode,'verified-unmodified-original');
 assert.equal(r.provenance.fullMatch,false);
 assert.equal(r.provenance.calibrationEligible,false);
 assert.equal(r.provenance.goalEventConsistent,true);
 assert.equal(r.franchiseUnchanged,true);
 assert.equal(r.parametersStatus,'provisional');
 assert.equal(r.validQuickSimReports,r.replicates);
 assert.equal(r.observations.length,2);
 for(const item of r.observations){
  const s=item.originalTacticMeshObserved;
  assert(Number.isInteger(s.passes)&&Number.isInteger(s.goals)&&Number.isInteger(s.tackles));
  assert(s.completedPasses<=s.passes);
  for(const k of ['goals','shots','passes','completedPasses','tackles','assists'])assert(item.quickSimMonteCarlo[k].per90>=0);
 }
 count+=r.replicates;ticks+=r.provenance.realTacticMeshTicks;
}
assert.equal(count,5000);assert.equal(ticks,18000);
console.log(`PASS four-region genuine TacticMesh partial diagnostic provenance, ${ticks} real ticks, ${count} deterministic Quick Sim evaluations, provisional guardrails`);
