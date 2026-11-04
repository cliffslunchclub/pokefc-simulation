'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const input = path.resolve(process.argv[2] || 'results/input');
const out = path.resolve(process.argv[3] || 'results/overnight-report.md');
const selectedStage = process.argv[4] || 'all';
const expected = {
  stage1: ['phase4-control','phase7-pass-light','phase7-pass-medium','phase7-pass-support'],
  stage2: ['phase4-control','phase7-support','phase7-defense-01','phase7-defense-025'],
  stage3: ['phase4-control','phase6-keeper-reach40','phase7-shot-precision','phase7-keeper-precision'],
  stage4: ['phase4-control','phase7-combo-balanced','phase7-combo-possession','phase7-combo-scorer']
};
assert(selectedStage === 'all' || expected[selectedStage], 'Unknown stage: ' + selectedStage);
const filenames = fs.readdirSync(input, { recursive: true }).filter(f => f.endsWith('.jsonl'));
assert(filenames.length > 0, 'No JSONL calibration output found');
const groups = {};
for (const filename of filenames) {
  const lines = fs.readFileSync(path.join(input, filename), 'utf8').split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    const row = JSON.parse(line);
    if (selectedStage !== 'all' && row.stage !== selectedStage) continue;
    assert(expected[row.stage] && expected[row.stage].includes(row.variant), 'Unrecognized calibration row');
    assert(Number.isSafeInteger(row.seed) && Number.isFinite(row.goals) && Number.isFinite(row.attempts), 'Invalid row');
    const key = row.stage + ':' + row.variant;
    (groups[key] ||= new Map()).set(row.seed, row);
  }
}
const stages = selectedStage === 'all' ? Object.keys(expected) : [selectedStage];
const sum = (rows, key) => rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
const mean = (rows, key) => sum(rows, key) / rows.length;
const fixed = (n, decimals) => Number.isFinite(n) ? n.toFixed(decimals == null ? 1 : decimals) : 'n/a';
const outside = (v, lo, hi) => Math.max(0, lo - v, v - hi);
function metrics(rows) {
  const goals = mean(rows,'goals'), shots = mean(rows,'shots'), saves = mean(rows,'saves');
  const passAccuracy = sum(rows,'completedPasses') / Math.max(1, sum(rows,'attempts'));
  const conversion = sum(rows,'goals') / Math.max(1, sum(rows,'shots'));
  const tackles = mean(rows,'tackles'), interceptions = mean(rows,'interceptions');
  const turnovers = mean(rows,'turnovers');
  // A diagnostic distance, not a statistically validated winner selection.
  const distance = outside(passAccuracy, .78, .82) / .1 * 3 +
    outside(goals, 2, 3.5) / 1.5 * 2.5 +
    outside(shots, 20, 28) / 8 * 2 +
    outside(conversion, .09, .15) / .08 * 2 +
    (tackles < 40 ? (40 - tackles) / 40 * 3 : 0);
  return { matches: rows.length, goals, shots, saves, passingAccuracy: passAccuracy,
    shotConversion: conversion, tackles, interceptions, turnovers,
    progressivePasses: mean(rows,'progressivePasses'), xG: mean(rows,'xG'), distance };
}
const report = { generatedAt: new Date().toISOString(), selectedStage, targetBands: {
  passingAccuracy: [.78,.82], goals: [2,3.5], shots: [20,28], shotConversion: [.09,.15] },
  stages: {} };
const md = ['# PokéFC Phase 7 — 13-hour calibration campaign', '',
  'Four time-boxed stages. All matches use full 90-minute regulation, balanced tactics, independent team strengths, and deterministic seeds.',
  'All variants within a stage share their seed sequence. Only complete seeds present in every variant are used for the comparative metrics.',
  'Lower **distance** means closer to the target bands, but is exploratory and does not constitute automatic promotion or statistical significance.',
  '', '| Stage | Variant | Completed | Matched | Pass % | Goals | Shots | Conversion % | Saves | Tackles | Interceptions | Turnovers | Distance |',
  '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|'];
let completedTotal = 0;
for (const stage of stages) {
  const variants = expected[stage], maps = variants.map(v => groups[stage + ':' + v]);
  assert(maps.every(m => m && m.size > 0), 'Missing batch output for ' + stage);
  const common = [...maps[0].keys()].filter(seed => maps.every(m => m.has(seed))).sort((a,b) => a-b);
  assert(common.length > 0, 'No matched seeds for ' + stage);
  const stageResult = { commonSeeds: common, variants: {} };
  variants.forEach((variant, index) => {
    const all = [...maps[index].values()], paired = common.map(seed => maps[index].get(seed));
    const stats = metrics(paired);
    const item = { completed: all.length, matched: paired.length, metrics: stats };
    stageResult.variants[variant] = item;
    completedTotal += all.length;
    md.push('| ' + stage + ' | ' + variant + ' | ' + all.length + ' | ' + paired.length +
      ' | ' + fixed(stats.passingAccuracy*100) + ' | ' + fixed(stats.goals,2) + ' | ' +
      fixed(stats.shots,2) + ' | ' + fixed(stats.shotConversion*100) + ' | ' +
      fixed(stats.saves,2) + ' | ' + fixed(stats.tackles,2) + ' | ' +
      fixed(stats.interceptions,2) + ' | ' + fixed(stats.turnovers,2) + ' | ' + fixed(stats.distance,2) + ' |');
  });
  report.stages[stage] = stageResult;
}
report.completedMatches = completedTotal;
md.push('', '**Completed full matches across available stages:** ' + completedTotal, '',
  '**Interpretation safeguards:**', '',
  '- Check shots, tackles, interception definitions, and chance quality before selecting a candidate.',
  '- The target bands are design goals, not hard-coded gameplay guarantees.',
  '- These stage results are exploratory; stage 4 uses fresh independent seeds for confirmation of its predefined combinations.',
  '- Engine calibration changes stay experimental; the workflow does not update the production engine or game repository.',
  '');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, md.join('\n'));
fs.writeFileSync(out.replace(/\.md$/, '.json'), JSON.stringify(report, null, 2) + '\n');
console.log(md.join('\n'));
