'use strict';
// Match real TacticMesh fixtures to the locally installed private Quick Sim.
// Do not copy PokeFC/quick-sim.js into this public repository.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf('--' + name);
  return i < 0 ? fallback : args[i + 1];
};
const input = path.resolve(arg('input', 'results/tm'));
const modulePath = arg('quick-sim', null);
if (!modulePath) throw Error('Pass --quick-sim /private/PokeFC/quick-sim.js (not bundled in public repo)');
const quick = require(path.resolve(modulePath));
assert(typeof quick.simulate === 'function', 'Expected private Quick Sim simulate()');
const repetitions = Number(arg('replicates', '500'));
assert(Number.isInteger(repetitions) && repetitions >= 1 && repetitions <= 10000, 'Invalid repetitions');
const output = path.resolve(arg('out', 'results/head-to-head'));
const filenames = fs.readdirSync(input, { recursive: true }).filter(f => f.endsWith('.json') && f.includes('tm-reference'));
assert(filenames.length > 0, 'Missing TacticMesh fixture reports');
const rows = [], ids = new Set();
const sum = (rows, key) => rows.reduce((s,r) => s + (Number(r[key]) || 0), 0);
const rate = (a,b) => b > 0 ? a/b : null;
const mean = (rows,k) => sum(rows,k)/rows.length;
function summarize(items) {
  const tm = items.map(x=>x.tm), q = items.map(x=>x.quick);
  return { fixtures:items.length, quickMatches:items.length*repetitions,
    tm: {goals:mean(tm,'goals'),shots:mean(tm,'shots'),passes:mean(tm,'passes'),
      passing:rate(sum(tm,'completedPasses'),sum(tm,'passes')),tackles:mean(tm,'tackles')},
    quick: {goals:mean(q,'goals'),shots:mean(q,'shots'),passes:mean(q,'passes'),
      passing:rate(sum(q,'completedPasses'),sum(q,'passes')),tackles:mean(q,'tackles')} };
}
for (const filename of filenames) {
  const batch = JSON.parse(fs.readFileSync(path.join(input,filename),'utf8'));
  assert(batch.fullRegulation && batch.completedMatches === batch.matchesData.length && batch.includesQuickSimFixtures,
    'Incomplete fixture export: ' + filename);
  for (const m of batch.matchesData) {
    assert(m.finished && m.simulatedSeconds >= 5399,'Incomplete TacticMesh match '+m.seed);
    const preview=m.quickSimFixture;
    assert(preview && preview.home && preview.away,'Missing exact ratings: '+m.seed);
    assert(preview.home.lineup.length===11 && preview.away.lineup.length===11,'Invalid XI');
    for (const team of [preview.home,preview.away]) for (const p of team.lineup) {
      assert(['GK','DEF','MID','FWD'].includes(p.pos),'Unknown role');
      for (const k of ['shortPassing','firstTouch','vision','finishing','sprintSpeed','tackling'])
        assert(Number.isFinite(p.main[k])&&p.main[k]===p.detail[k],'Missing attribute '+k);
    }
    const profile='home'+(batch.homeRatingOffset>=0?'+':'')+batch.homeRatingOffset+
      '_away'+(batch.awayRatingOffset>=0?'+':'')+batch.awayRatingOffset;
    const key=profile+':'+m.seed;
    assert(!ids.has(key),'Duplicate fixture '+key);ids.add(key);
    const quickStats={goals:0,shots:0,passes:0,completedPasses:0,tackles:0};
    for (let i=0;i<repetitions;i++) {
      const result=quick.simulate(preview,{seed:String(m.seed)+':quick-ref:'+i});
      assert(result.stats.length===2&&result.score.length===2,'Invalid Quick Sim result');
      assert(result.score[0]+result.score[1]===result.stats[0].goals+result.stats[1].goals,'Goal ledger mismatch');
      for (const t of result.stats) {
        quickStats.goals+=t.goals;quickStats.shots+=t.shots;quickStats.passes+=t.passes;
        quickStats.completedPasses+=t.completedPasses;quickStats.tackles+=t.tackleAttempts;
      }
    }
    for (const k of Object.keys(quickStats))quickStats[k]/=repetitions;
    rows.push({profile,seed:m.seed,
      tm:{goals:m.goals,shots:m.shots,passes:m.passAttempts,completedPasses:m.completedPasses,
        tackles:Object.values(m.teams).reduce((s,t)=>s+(t.counters?.tackle||0),0)},
      quick:quickStats});
  }
}
const overall=summarize(rows),byProfile={};
for (const p of [...new Set(rows.map(x=>x.profile))].sort())byProfile[p]=summarize(rows.filter(x=>x.profile===p));
const model=typeof quick.profile==='function'?quick.profile():null;
const report={kind:'matched-roster-quick-vs-tm',sourceOfQuickSim:'user-private-module',quickModelStatus:model?.status||'unknown',
  quickModelVersion:model?.version||null,quickModelParameters:model?.parameters||null,
  repetitions,overall,byProfile,fixtures:rows};
const fmt=n=>n==null?'n/a':Number(n).toFixed(2);
const lines=['# PokéFC matched-roster Quick Sim vs TacticMesh','',
  '**'+rows.length+' full TacticMesh matches and '+(rows.length*repetitions)+' Quick Sim simulations.**',
  'Same starting XI, individual attributes, positions and fixture seeds. Different random streams and simulation methods.',
  'Quick Sim implementation loaded from a private path, never published to the public simulation repository.','',
  'Quick Sim model: **'+(model?.status||'unknown')+'** ('+(model?.version||'unreported')+').','',
  '| Profile | TM goals | Quick goals | TM shots | Quick shots | TM pass % | Quick pass % | TM challenges | Quick challenges |',
  '|---|---:|---:|---:|---:|---:|---:|---:|---:|',
  ...Object.entries({all:overall,...byProfile}).map(([p,r])=>'| '+p+' | '+fmt(r.tm.goals)+' | '+fmt(r.quick.goals)+
    ' | '+fmt(r.tm.shots)+' | '+fmt(r.quick.shots)+' | '+fmt(100*r.tm.passing)+' | '+fmt(100*r.quick.passing)+
    ' | '+fmt(r.tm.tackles)+' | '+fmt(r.quick.tackles)+' |'),'',
  '**Limitations:** Quick Sim uses a statistical model, while TacticMesh simulates physics, fatigue and potential substitutions. Seed identity ensures same lineup generation, not identical event RNG. Quick Sim passing accuracy is presently a fixed provisional parameter; do not force TacticMesh to match it. Quick Sim saves and watched-game goalkeeper stops have different definitions. This pilot is not a production calibration.',''];
fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'comparison.md'),lines.join('\n'));
fs.writeFileSync(path.join(output,'comparison.json'),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(output,'fixture-pairs.csv'),
  ['profile,seed,tmGoals,quickGoals,tmShots,quickShots,tmPassRate,quickPassRate',
   ...rows.map(r=>[r.profile,r.seed,r.tm.goals,fmt(r.quick.goals),r.tm.shots,fmt(r.quick.shots),
     fmt(rate(r.tm.completedPasses,r.tm.passes)),fmt(rate(r.quick.completedPasses,r.quick.passes))].join(','))].join('\n')+'\n');
console.log(lines.join('\n'));