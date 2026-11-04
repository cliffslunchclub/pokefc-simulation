'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const input = path.resolve(process.argv[2] || 'results/input');
const output = path.resolve(process.argv[3] || 'results/phase8');
const variants = ['phase4-control','phase8-reach15','phase8-reach25','phase8-reach40'];
const files = fs.readdirSync(input, { recursive: true })
  .filter(f => /^phase8-.*\.json$/.test(path.basename(f)));
assert.equal(files.length, 12, 'Expected three five-match batches per variant');
const groups = Object.fromEntries(variants.map(v => [v, []]));
let sourceHash = null;
for (const file of files) {
  const batch = JSON.parse(fs.readFileSync(path.join(input, file), 'utf8'));
  assert(variants.includes(batch.calibrationVariant), 'Unknown variant in ' + file);
  assert(batch.fullRegulation && batch.completedMatches === 5 && batch.matchesData.length === 5, 'Incomplete batch: ' + file);
  if (sourceHash === null) sourceHash = batch.sourceHash;
  assert.equal(batch.sourceHash, sourceHash, 'Source version differs across batches');
  for (const match of batch.matchesData) {
    assert(match.finished && match.simulatedSeconds >= 5399, 'Incomplete match ' + match.seed);
    assert(!groups[batch.calibrationVariant].some(m => m.seed === match.seed), 'Duplicate seed');
    groups[batch.calibrationVariant].push(match);
  }
}
for (const variant of variants) assert.equal(groups[variant].length, 15, 'Expected 15 full matches per variant: ' + variant);
const commonSeeds = groups[variants[0]].map(m => m.seed).sort((a,b) => a-b);
for (const variant of variants) assert.deepEqual(groups[variant].map(m => m.seed).sort((a,b) => a-b), commonSeeds, 'Mismatched seeds for ' + variant);
const sum = (rows, key) => rows.reduce((s, row) => s + (Number(row[key]) || 0), 0);
const mean = (rows, key) => sum(rows, key) / rows.length;
const teamCounter = (m, key) => Object.values(m.teams || {}).reduce((s,t) => s + (Number((t.counters || {})[key]) || 0), 0);
const counterMean = (rows, key) => rows.reduce((s,m) => s + teamCounter(m,key), 0) / rows.length;
const summary = {};
for (const variant of variants) {
  const rows = groups[variant];
  summary[variant] = {
    matches: rows.length, passing: sum(rows,'completedPasses') / sum(rows,'passAttempts'),
    goals: mean(rows,'goals'), shots: mean(rows,'shots'),
    conversion: sum(rows,'goals') / Math.max(1,sum(rows,'shots')),
    saves: mean(rows,'saves'), turnovers: mean(rows,'turnovers'),
    broadInterceptions: counterMean(rows,'interception'),
    directPassInterceptionControls: counterMean(rows,'directPassInterceptionControl'),
    directPassInterceptionDeflections: counterMean(rows,'directPassInterceptionDeflection'),
    tackles: counterMean(rows,'tackle'),
    progressivePasses: mean(rows,'progressivePasses'), xG: mean(rows,'xG')
  };
}
const fmt = (x, places=2) => x.toFixed(places);
const baseline = summary[variants[0]];
const report = [
  '# PokéFC Phase 8 — Opponent pass-interception reach A/B',
  '',
  '60 full 90-minute matches: 15 matched seeds per variant. All configurations inherit the Phase 4 baseline.',
  'Only opposing outfield contacts on live deliberate passes have a smaller physical reach; teammates, tackles, loose balls, and keepers retain their original reach.',
  '',
  '| Variant | Pass % | Goals | Shots | Conversion | Direct controlled INT | Direct deflections | Broad INT | Tackles | Turnovers |',
  '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
  ...variants.map(v => {
    const r = summary[v];
    return '| '+v+' | '+fmt(r.passing*100,1)+'% | '+fmt(r.goals)+' | '+fmt(r.shots)+
      ' | '+fmt(r.conversion*100,1)+'% | '+fmt(r.directPassInterceptionControls)+
      ' | '+fmt(r.directPassInterceptionDeflections)+' | '+fmt(r.broadInterceptions)+
      ' | '+fmt(r.tackles)+' | '+fmt(r.turnovers)+' |';
  }),
  '',
  '## Comparison to baseline',
  ...variants.slice(1).map(v => {
    const r=summary[v];
    return '- **'+v+'**: pass completion '+fmt((r.passing-baseline.passing)*100,1)+' percentage points, goals '+fmt(r.goals-baseline.goals)+
      '/match, shots '+fmt(r.shots-baseline.shots)+'/match, direct controlled pass interceptions '+fmt(r.directPassInterceptionControls-baseline.directPassInterceptionControls)+'/match.';
  }),
  '',
  '## Interpretation',
  '- Broad interception events also include some possession changes; direct controlled-pass interception is the more specific new diagnostic.',
  '- A touch can deflect a pass without gaining possession, so both direct contact outcomes are reported separately.',
  '- Passing target: 78–82%; goals: 2–3.5; shots: 20–28; conversion: 9–15%. These are objectives, not automatic acceptance criteria.',
  '- Sample size is exploratory. Do not promote a candidate until larger validation, including weak/elite roster tests.',
  '- No modifications are made to the production game repository.',
  ''
];
fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'phase8-reach-report.md'),report.join('\n'));
fs.writeFileSync(path.join(output,'phase8-reach-summary.json'),JSON.stringify({ sourceHash,seedCount:commonSeeds.length,seeds:commonSeeds,summary },null,2)+'\n');
fs.writeFileSync(path.join(output,'phase8-reach-matches.csv'),[
  'variant,seed,goals,shots,passAttempts,completedPasses,interceptionControls,interceptionDeflections,broadInterceptions,tackles,turnovers',
  ...variants.flatMap(v=>groups[v].sort((a,b)=>a.seed-b.seed).map(m=>[v,m.seed,m.goals,m.shots,m.passAttempts,m.completedPasses,
    teamCounter(m,'directPassInterceptionControl'),teamCounter(m,'directPassInterceptionDeflection'),
    teamCounter(m,'interception'),teamCounter(m,'tackle'),m.turnovers].join(',')))
].join('\n')+'\n');
console.log(report.join('\n'));
