'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = process.argv[2] || 'results/input';
const out = process.argv[3] || 'results/phase6-summary.md';
const files = fs.readdirSync(root, { recursive: true }).filter(n => n.endsWith('.json'));
const groups = {};
for (const name of files) {
  const b = JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
  if (!b.fullRegulation || b.completedMatches !== 1) throw Error('Incomplete test: ' + name);
  (groups[b.calibrationVariant] ||= []).push(b.matchesData[0]);
}
const keys = Object.keys(groups).sort();
if (keys.length !== 2 || keys.some(k => groups[k].length !== 5)) throw Error('Expected two variants with five completed matches each');
const total = (rows, key) => rows.reduce((s, m) => s + (Number(m[key]) || 0), 0);
const mean = (rows, key) => total(rows, key) / rows.length;
const defensive = (rows, key) => rows.reduce((s, m) => s + Object.values(m.teams).reduce((a, t) => a + (Number(t.counters[key]) || 0), 0), 0) / rows.length;
const fmt = x => x.toFixed(2);
const header = '| Variant | Goals | Shots | Saves | Pass accuracy | Interceptions | Tackles | Turnovers |';
const lines = ['# Phase 6 matched-seed calibration', '', 'Five full-length matches per variant. Rates and counts are per match, except pass accuracy.', '', header, '|---|---:|---:|---:|---:|---:|---:|---:|'];
for (const k of keys) {
  const r = groups[k];
  lines.push('| ' + k + ' | ' + [fmt(mean(r,'goals')), fmt(mean(r,'shots')), fmt(mean(r,'saves')), fmt(100*total(r,'completedPasses')/total(r,'passAttempts'))+'%', fmt(defensive(r,'interception')), fmt(defensive(r,'tackle')), fmt(mean(r,'turnovers'))].join(' | ') + ' |');
}
lines.push('', 'Exploratory comparison only; five matched seeds are not sufficient for final calibration.');
fs.mkdirSync(path.dirname(out), {recursive:true});
fs.writeFileSync(out, lines.join('\n')+'\n');
console.log(lines.join('\n'));
