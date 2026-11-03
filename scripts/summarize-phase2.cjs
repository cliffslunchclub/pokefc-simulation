'use strict';
const fs = require('node:fs'), path = require('node:path');
const assert = require('node:assert/strict');
const dir = process.argv[2] || 'results/input', output = process.argv[3] || 'results/phase2';
const files = fs.readdirSync(dir, {recursive:true}).filter(f => /batch-[^/]+\.json$/.test(f)).map(f => path.join(dir, f)).sort();
const requiredProfiles = ['equal','home-strong','away-strong','independent','generated'];
const metrics = ['goals','shots','xG','passes','completedPasses','passAccuracy','tackles','tackleSuccess','tackleFailure','tackleUnknown','interceptions','fouls','offsides','corners','wallSeconds'];
const rows=[], errors=[], notices=[];
assert.equal(files.length,20,'Expected 20 separate five-match batches');
for(const file of files) {
  const r=JSON.parse(fs.readFileSync(file,'utf8'));
  assert.equal(r.kind,'batch-simulation');
  assert.equal(r.fullRegulation,true,'Only 90-minute matches allowed');
  assert.equal(r.matches,5,'Expected five matches per batch');
  assert.equal(r.completedMatches,5,'All five matches must finish');
  assert.ok(requiredProfiles.includes(r.strengthProfile),'Unexpected strength profile');
  assert.equal(r.matchesData.length,5);
  for(const m of r.matchesData) {
    const t=Object.values(m.teams);
    const counter=k=>t.reduce((sum,v)=>sum+(Number(v.counters[k])||0),0);
    const tackles=counter('tackle'), success=counter('tackleSuccess'), failure=counter('tackleFailure'), unknown=counter('tackleUnknown');
    assert.ok(m.finished && !m.shortenedForTesting && m.simulatedSeconds>=5399,'Incomplete match seed '+m.seed);
    const row={seed:m.seed,profile:r.strengthProfile,homeStyle:r.matchup.home.style,awayStyle:r.matchup.away.style,score:m.scoreline,goals:m.goals,shots:m.shots,xG:m.xG,passes:m.passAttempts,completedPasses:m.completedPasses,passAccuracy:m.passCompletionRate,tackles,tackleSuccess:success,tackleFailure:failure,tackleUnknown:unknown,interceptions:counter('interception'),fouls:m.fouls,offsides:m.offsides,corners:m.corners,wallSeconds:Number((m.runtimeMs/1000).toFixed(3))};
    if(tackles!==success+failure+unknown) errors.push('Tackle count mismatch for seed '+m.seed);
    if(m.completedPasses>m.passAttempts) errors.push('More completions than attempts for seed '+m.seed);
    if(m.xG<0 || m.goals<0 || m.shots<0) errors.push('Negative metric seed '+m.seed);
    if(m.goals>8) notices.push('High goal total for seed '+m.seed+': '+m.goals);
    rows.push(row);
  }
}
rows.sort((a,b)=>a.seed-b.seed);
assert.equal(rows.length,100,'Expected 100 matches');
assert.equal(new Set(rows.map(r=>r.seed)).size,100,'Seeds must be unique');
for(const p of requiredProfiles) assert.equal(rows.filter(r=>r.profile===p).length,20,'Missing profile '+p);
if(errors.length) throw Error(errors.join('\n'));
const mean=(rs,k)=>rs.reduce((s,r)=>s+Number(r[k]||0),0)/rs.length;
const rounded=n=>Number(n.toFixed(4));
const aggregate=(rs)=>Object.fromEntries(metrics.map(k=>[k,rounded(mean(rs,k))]));
const result={
 schemaVersion:'pokefc-phase2-v1',
 status:'tacticmesh-100-match-reference-completed',
 calibrationStatus:'quick-sim-not-integrated',
 referenceMatches:100, fullRegulation:true, uniqueSeeds:100, complete:true,
 profileCounts:Object.fromEntries(requiredProfiles.map(p=>[p,rows.filter(r=>r.profile===p).length])),
 all:aggregate(rows), byProfile:Object.fromEntries(requiredProfiles.map(p=>[p,aggregate(rows.filter(r=>r.profile===p))])),
 weightedPassAccuracy:rows.reduce((s,r)=>s+r.completedPasses,0)/rows.reduce((s,r)=>s+r.passes,0),
 recordedTackleSuccessRate:rows.reduce((s,r)=>s+r.tackleSuccess,0)/rows.reduce((s,r)=>s+r.tackles,0),
 warnings:notices, rows
};
fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'phase2-summary.json'),JSON.stringify(result,null,2)+'\n');
const fields=Object.keys(rows[0]);
fs.writeFileSync(path.join(output,'phase2-matches.csv'),[fields.join(','),...rows.map(r=>fields.map(k=>JSON.stringify(r[k]??'')).join(','))].join('\n')+'\n');
const lines=['# PokéFC Phase 2 — TacticMesh 100-match reference','',
'100 completed full-regulation matches, 100 distinct seeds, 20 per strength profile. **This is not Quick Sim calibration.**','',
'| Statistic | Overall average |','|---|---:|'];
for(const [name,key] of [['Goals','goals'],['Shots','shots'],['Internal xG','xG'],['Pass attempts','passes'],['Completed passes','completedPasses'],['Pass completion rate','passAccuracy'],['Recorded tackles','tackles'],['Successful tackles','tackleSuccess'],['Failed tackles','tackleFailure'],['Interceptions (native counter)','interceptions'],['Fouls (native counter)','fouls'],['Runtime (seconds)','wallSeconds']]) lines.push('| '+name+' | '+rounded(mean(rows,key))+' |');
lines.push('','','| Profile | Matches | Goals | Shots | xG | Pass accuracy | Tackles |','|---|---:|---:|---:|---:|---:|---:|');
for(const p of requiredProfiles){const rs=rows.filter(r=>r.profile===p);lines.push('| '+p+' | '+rs.length+' | '+rounded(mean(rs,'goals'))+' | '+rounded(mean(rs,'shots'))+' | '+rounded(mean(rs,'xG'))+' | '+rounded(mean(rs,'passAccuracy')*100)+'% | '+rounded(mean(rs,'tackles'))+' |');}
lines.push('','','**Audit:** A tackle attempt is a recorded native tackle event; outcome comes from its success flag. Interceptions include certain ownership changes. Fouls include advantage events. Internal xG has not been calibrated against external football data.','',
'**Limitations:** Simulations use native TacticMesh-generated footballers, not Pokémon attribute mappings. Strength profiles change generated player attributes for benchmarking only; they do not alter the underlying physics. 100 matches is diagnostic, not a complete stability proof.','');
if(notices.length)lines.push('High-scoring seeds to inspect: '+notices.join('; '),'');
fs.writeFileSync(path.join(output,'phase2-report.md'),lines.join('\n'));
console.log(lines.join('\n'));
