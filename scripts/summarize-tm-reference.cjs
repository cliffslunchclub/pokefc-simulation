'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(process.argv[2]||'results/input');
const out=path.resolve(process.argv[3]||'results/tm-reference-summary.md');
const filenames=fs.readdirSync(root,{recursive:true}).filter(n=>n.endsWith('.json')&&n.includes('tm-reference-'));
const profiles={
  'avg-avg':[0,0],
  'weak-weak':[-15,-15],
  'elite-elite':[15,15],
  'elite-weak':[15,-15]
};
assert.equal(filenames.length,16,'Expected 16 completed full-match fixtures');
const grouped={},rows=[],keys=new Set();
for(const file of filenames){
  const data=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
  assert(data.fullRegulation&&data.completedMatches===1&&data.matchesData.length===1&&data.includesQuickSimFixtures,'Invalid fixture '+file);
  const m=data.matchesData[0];assert(m.finished&&m.simulatedSeconds>=5399,'Incomplete full match');
  const profile=Object.keys(profiles).find(k=>profiles[k][0]===data.homeRatingOffset&&profiles[k][1]===data.awayRatingOffset);
  assert(profile,'Unknown rating profile');
  assert(m.quickSimFixture?.home?.lineup?.length===11&&m.quickSimFixture?.away?.lineup?.length===11,'No shared starting XI');
  assert(!keys.has(profile+':'+m.seed),'Duplicate seed');keys.add(profile+':'+m.seed);
  const value={profile,seed:m.seed,goals:m.goals,shots:m.shots,passes:m.passAttempts,completedPasses:m.completedPasses,
    tackles:Object.values(m.teams).reduce((acc,t)=>acc+(t.counters?.tackle||0),0)};
  (grouped[profile]||=[]).push(value);rows.push(value);
}
const seeds=Object.values(grouped).map(g=>g.map(x=>x.seed).sort().join(','));
assert(seeds.length===4&&seeds.every(x=>x===seeds[0]),'Profiles must share the same four seeds');
const sum=(a,k)=>a.reduce((s,r)=>s+(Number(r[k])||0),0);
const mean=(a,k)=>sum(a,k)/a.length;
const fmt=n=>Number(n).toFixed(2);
const lines=['# PokéFC shared-roster pilot: TacticMesh side','',
  'All **16 full 90-minute matches** completed. These results are the watched-match half of a cross-engine comparison.',
  'The public artifacts contain generated starting-XI rating snapshots but **no private Quick Sim implementation**.',
  '',
  '| Strength profile | Matches | Goals | Shots | Pass % | Challenges |',
  '|---|---:|---:|---:|---:|---:|'];
for(const profile of Object.keys(profiles)){
  const g=grouped[profile];assert(g?.length===4,'Missing profile '+profile);
  lines.push('| '+profile+' | '+g.length+' | '+fmt(mean(g,'goals'))+' | '+fmt(mean(g,'shots'))+
    ' | '+fmt(100*sum(g,'completedPasses')/sum(g,'passes'))+'% | '+fmt(mean(g,'tackles'))+' |');
}
lines.push('','The private Quick Sim engine must consume these exported fixture JSON files using scripts/compare-quicksim-tm.cjs to produce a genuine same-player comparison.',
  'Do not treat the TacticMesh-only table as a head-to-head result or as evidence that the engine is balanced.','');
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,lines.join('\n'));
console.log(lines.join('\n'));