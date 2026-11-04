'use strict';
// Time-boxed, single-runner calibration worker. Each 90-minute simulated match
// runs in a fresh deterministic process and is checkpointed to a JSONL record.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const args = process.argv.slice(2);
function arg(name) {
  const i = args.indexOf('--' + name);
  if (i < 0 || i + 1 >= args.length) throw Error('Missing --' + name);
  return args[i + 1];
}
const stage = arg('stage'), variant = arg('variant');
const minutes = Number(arg('minutes')), seedBase = Number(arg('seed'));
const outputRoot = path.resolve(arg('out'));
if (!/^stage[1-4]$/.test(stage) || !/^[a-z0-9-]+$/.test(variant)) throw Error('Invalid stage or variant');
if (!Number.isInteger(minutes) || minutes < 1 || minutes > 330 || !Number.isSafeInteger(seedBase) || seedBase < 1) throw Error('Invalid minutes or seed');
const runner = path.resolve(__dirname, '../engines/tacticmesh/tools/batch.cjs');
const directory = path.join(outputRoot, stage);
fs.mkdirSync(directory, { recursive: true });
const log = path.join(directory, stage + '-' + variant + '.jsonl');
if (fs.existsSync(log)) throw Error('Existing output would mix calibration runs: ' + log);
const started = Date.now(), deadline = started + minutes * 60000;
let completed = 0, lastElapsed = 0, failures = 0;
while (true) {
  // Do not start another match when less than 45 seconds remain; allow the
  // last match to finish. The enclosing job has a separate timeout buffer.
  if (Date.now() + 45000 >= deadline) break;
  const seed = seedBase + completed;
  const sample = path.join(directory, stage + '-' + variant + '-sample-' + seed + '.json');
  const tmp = path.join(directory, '.current-' + variant + '.json');
  const command = [runner, '--matches', '1', '--seed', String(seed), '--half-seconds', '2700',
    '--strength-profile', 'independent', '--home-style', 'balanced', '--away-style', 'balanced',
    '--calibration-variant', variant, '--out', tmp];
  const result = spawnSync(process.execPath, command, { cwd: path.resolve(__dirname, '..'),
    stdio: ['ignore', 'ignore', 'inherit'], timeout: 20 * 60 * 1000 });
  if (result.status !== 0) {
    failures++;
    fs.writeFileSync(path.join(directory, stage + '-' + variant + '-failure.txt'),
      'seed=' + seed + ', exit=' + result.status + ', signal=' + (result.signal || 'none') + ', error=' + (result.error || 'none') + '\n');
    throw Error('Match failed: variant=' + variant + ' seed=' + seed + ', exit=' + result.status);
  }
  const batch = JSON.parse(fs.readFileSync(tmp, 'utf8'));
  if (batch.calibrationVariant !== variant || batch.completedMatches !== 1 || !batch.fullRegulation ||
      !Array.isArray(batch.matchesData) || batch.matchesData.length !== 1) throw Error('Invalid full-length batch for seed ' + seed);
  const m = batch.matchesData[0];
  if (m.seed !== seed || !m.finished || m.simulatedSeconds < 5399) throw Error('Incomplete match for seed ' + seed);
  const teams = Object.values(m.teams || {});
  const count = name => teams.reduce((sum, team) => sum + (Number((team.counters || {})[name]) || 0), 0);
  const row = { stage, variant, seed, engineVersion: batch.engineVersion,
    goals: m.goals, shots: m.shots, saves: m.saves, xG: m.xG,
    attempts: m.passAttempts, completedPasses: m.completedPasses,
    progressivePasses: m.progressivePasses, interceptions: count('interception'),
    tackles: count('tackle'), turnovers: m.turnovers, fouls: m.fouls,
    yellowCards: m.cards && m.cards.yellow || 0, redCards: m.cards && m.cards.red || 0,
    runtimeMs: m.runtimeMs, eventCount: m.eventCount,
    scoreline: m.scoreline };
  fs.appendFileSync(log, JSON.stringify(row) + '\n');
  if (completed < 3) fs.copyFileSync(tmp, sample);
  fs.unlinkSync(tmp);
  completed++;
  lastElapsed = Number(((Date.now() - started) / 60000).toFixed(1));
  console.log('[overnight] stage=' + stage + ' variant=' + variant + ' matches=' + completed +
    ' elapsedMinutes=' + lastElapsed + '/' + minutes + ' latestSeed=' + seed +
    ' goals=' + m.goals + ' shots=' + m.shots + ' passRate=' + Number(100 * m.passCompletionRate).toFixed(1) + '%');
}
if (completed === 0) throw Error('No complete calibration matches');
console.log('[overnight] COMPLETE stage=' + stage + ' variant=' + variant +
  ' matches=' + completed + ' elapsedMinutes=' + Number(((Date.now() - started) / 60000).toFixed(1)) +
  ' failed=' + failures + ' report=' + log);
