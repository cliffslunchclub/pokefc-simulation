'use strict';
// Same-player comparison using numerical Quick Sim references generated
// from the PRIVATE PokeFC Quick Sim module. No private implementation is copied.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(process.argv[2]||'results/tm');
const quickFile=path.resolve(process.argv[3]||'config/quick-sim-v07b-matched-fixture-reference.json');
const output=path.resolve(process.argv[4]||'results/comparison');
const ref=JSON.parse(fs.readFileSync(quickFile,'utf8'));
assert(ref.fixtures.length===16&&ref.reportedModelVersion==='v0.7b','Unexpected Quick Sim reference');
const files=fs.readdirSync(root,{recursive:true}).filter(f=>f.includes('tm-reference-')&&f.endsWith('.json'));
assert(files.length===16,'Expected 16 completed TacticMesh fixture files; got '+files.length);
const reference=new Map(ref.fixtures.map(r=>[r.profile+':'+r.seed,r]));
function fingerprint(value) {
  let h=2166136261;
  for(const ch of JSON.stringify(value))h=Math.imul(h^ch.charCodeAt(0),16777619)>>>0;
  return h.toString(16).padStart(8,'0');
}
const rows=[];
for(const filename of files) {
  const b=JSON.parse(fs.readFileSync(path.join(root,filename),'utf8'));
  assert(b.fullRegulation&&b.completedMatches===1&&b.includesQuickSimFixtures,'Invalid TM batch: '+filename);
  const m=b.matchesData[0],profile=ref.generation.offsets.find(o=>o.home===b.homeRatingOffset&&o.away===b.awayRatingOffset);
  assert(m.finished&&m.simulatedSeconds>=5399&&profile,'Bad TM batch or profile: '+filename);
  const key=profile.id+':'+m.seed;
  const q=reference.get(key);assert(q,'Quick Sim reference missing '+key);
  assert.equal(fingerprint(m.quickSimFixture),q.rosterFingerprint,'Starting XI attributes differ for '+key);
  const tackles=Object.values(m.teams).reduce((s,t)=>s+(Number((t.counters||{}).tackle)||0),0);
  rows.push({profile:profile.id,seed:m.seed,
    tm:{goals:m.goals,shots:m.shots,passes:m.passAttempts,completedPasses:m.completedPasses,challenges:tackles},
    quick:{goals:q.stats.goals,shots:q.stats.shots,passes:q.stats.passes,
      completedPasses:q.stats.completedPasses,challenges:q.stats.tackleAttempts,simulations:q.simulations}});
}
assert(rows.length===16&&new Set(rows.map(r=>r.profile+':'+r.seed)).size===16,'Duplicate pairs');
function aggregate(list) {
  const tm={goals:0,shots:0,passes:0,completedPasses:0,challenges:0};
  const q={goals:0,shots:0,passes:0,completedPasses:0,challenges:0};
  let n=0;
  for(const r of list) {
    for(const k of Object.keys(tm)) {
      tm[k]+=r.tm[k];
      q[k]+=r.quick[k];
    }
    n+=r.quick.simulations;
  }
  return {tmMatches:list.length,quickMatches:n,
    tm:{goals:tm.goals/list.length,shots:tm.shots/list.length,passing:tm.completedPasses/tm.passes,
      challenges:tm.challenges/list.length},
    quick:{goals:q.goals/n,shots:q.shots/n,passing:q.completedPasses/q.passes,challenges:q.challenges/n}};
}
const byProfile={};
for(const p of ref.generation.offsets) {
  const list=rows.filter(r=>r.profile===p.id);
  assert.equal(list.length,4,'Expected four paired fixtures for '+p.id);
  byProfile[p.id]=aggregate(list);
}
const overall=aggregate(rows);
const report={kind:'matched-quick-sim-vs-tacticmesh',quickModelVersion:ref.reportedModelVersion,
  quickReferenceProvisional:ref.calibrationStatus!=='calibrated',
  sameRosterVerified:true,tmVersion:'phase4-control',overall,byProfile,
  fixturePairs:rows};
const fmt=v=>Number(v).toFixed(2);
const lines=['# PokéFC — matched-player Quick Sim vs TacticMesh','',
  '**16 verified full TacticMesh matches** versus **8,000 Quick Sim simulations** using identical starting XI ratings for each of the 16 fixtures.',
  'Quick Sim source code stayed private. This comparison uses only previously generated numerical reference results and deterministic roster fingerprints.',
  '',
  '**Important:** Quick Sim '+ref.reportedModelVersion+' remains '+ref.calibrationStatus+' and uses a fixed default 68% passing model.',
  '',
  '| Team strength | TM goals | Quick goals | TM shots | Quick shots | TM pass % | Quick pass % | TM challenges | Quick challenges |',
  '|---|---:|---:|---:|---:|---:|---:|---:|---:|',
  ...Object.entries({all:overall,...byProfile}).map(([key,r])=>'| '+key+' | '+fmt(r.tm.goals)+' | '+fmt(r.quick.goals)+
    ' | '+fmt(r.tm.shots)+' | '+fmt(r.quick.shots)+' | '+fmt(100*r.tm.passing)+' | '+fmt(100*r.quick.passing)+
    ' | '+fmt(r.tm.challenges)+' | '+fmt(r.quick.challenges)+' |'),
  '',
  '**What to fit first:** goals/match and shots/match across strength profiles. Keep passing as an independent, realistic-soccer target until Quick Sim passing becomes attribute-dependent.',
  '',
  '**Limitations:** Only four full physics matches per profile, so differences may be noisy. Matching rosters does not imply matching stochastic play-by-play. Watched-match substitutions and stamina can differ from static statistical Quick Sim. Tackle attempt definitions may also differ.',
  '',
  '**No production gameplay settings have been automatically changed.**',
  ''];
fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'matched-engine-comparison.md'),lines.join('\n'));
fs.writeFileSync(path.join(output,'matched-engine-comparison.json'),JSON.stringify(report,null,2)+'\n');
console.log(lines.join('\n'));