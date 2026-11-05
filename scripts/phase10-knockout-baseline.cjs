'use strict';
// Baseline only: measures the PINNED, UNMODIFIED Soccer-JS before adding extra time.
// Does not imply that extra-time/shootout support exists in the upstream engine.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const upstream=path.resolve(process.argv[2]||'upstream');
require(path.join(upstream,'tests/mock_env.js'));
const {Settings}=require(path.join(upstream,'kernel/settings.js'));
const {Time}=require(path.join(upstream,'kernel/core/lib/time.js'));
const {Simulator,MatchStates}=require(path.join(upstream,'kernel/providers/simulator/simulator.js'));
const {mergeConfig,runBatch}=require(path.join(upstream,'kernel/providers/simulator/headless_runner.js'));
Settings.app={camX:0,camY:0,canvas:{width:800,height:600}};
Settings.HEADLESS=true;
const entries=[];
async function probeFulltime(seed,home,away){
 const sim=new Simulator({seed});
 await sim.start();
 sim.active=true;
 sim.fsm.setCurrentState(MatchStates.Play);
 sim.setPieceType='';
 sim.halfTimeTriggered=true;
 sim.matchTimer=5399.99;
 sim.scoreA=home;
 sim.scoreB=away;
 Time.deltaTime=0.05;
 sim.updateAll();
 assert.equal(sim.matchState,'fulltime','Current Soccer-JS should end at 90 minutes');
 assert.deepEqual([sim.scoreA,sim.scoreB],[home,away],'Transition cannot change score');
 const info={test:'90-minute boundary',seed,score:[home,away],state:sim.matchState,matchTimer:sim.matchTimer,draw:home===away};
 entries.push(info);
 console.log('PASS '+info.test+' '+home+'-'+away+' => '+info.state);
 return info;
}
async function probeHalftime(){
 const sim=new Simulator({seed:32123});
 await sim.start();
 sim.active=true;
 sim.fsm.setCurrentState(MatchStates.Play);
 sim.setPieceType='';
 sim.halfTimeTriggered=false;
 sim.matchTimer=2699.99;
 sim.scoreA=1;sim.scoreB=2;
 Time.deltaTime=0.05;
 sim.updateAll();
 assert.equal(sim.matchState,'halftime');
 assert.deepEqual([sim.scoreA,sim.scoreB],[1,2]);
 entries.push({test:'45-minute boundary',seed:32123,state:sim.matchState,score:[sim.scoreA,sim.scoreB]});
 console.log('PASS halftime transition preserves score');
}
const stableSample=m=>JSON.stringify({
 seed:m.seed,scoreA:m.scoreA,scoreB:m.scoreB,
 matchState:m.matchState,frames:m.frames,goals:m.totalGoals,
 tactical:m.tactical,possessionShare:m.possessionShare
});
const round=n=>Math.round(Number(n)*100)/100;
(async()=>{
 const begin=Date.now();
 await probeHalftime();
 await probeFulltime(11211,0,0);
 await probeFulltime(11212,2,2);
 await probeFulltime(11213,3,1);
 // This is a baseline of what is NOT implemented; no custom knockout code yet.
 const nativeFeatures={
  regularPenaltyFoul:!!MatchStates.Penalty,
  extraTimeState:!!(MatchStates.ExtraTime||MatchStates.ExtraTimeFirstHalf),
  penaltyShootoutState:!!(MatchStates.Shootout||MatchStates.PenaltyShootout)
 };
 assert.equal(nativeFeatures.regularPenaltyFoul,true,'Standard spot penalty should exist');
 assert.equal(nativeFeatures.extraTimeState,false,'Unexpected native extra-time state: revisit baseline');
 assert.equal(nativeFeatures.penaltyShootoutState,false,'Unexpected native shootout state: revisit baseline');
 const base={headless:true,matchDurationSeconds:300,maxFramesPerMatch:25000,
  formationA:'4-4-2',formationB:'4-3-3',dynamicStrategyShifting:true};
 const first=await runBatch(mergeConfig({...base,iterations:12,seed:54000,concurrency:3}));
 assert.equal(first.matches.length,12);
 const finished=first.matches.filter(x=>x.matchState==='fulltime').length;
 assert.equal(finished,12,'Unfinished regulation matches');
 const draws=first.matches.filter(x=>x.scoreA===x.scoreB).length;
 const config=mergeConfig({...base,iterations:4,seed:76000,concurrency:1});
 const firstRepeat=await runBatch(config);
 const secondRepeat=await runBatch(config);
 const sameSeeds=firstRepeat.matches.every((m,i)=>stableSample(m)===stableSample(secondRepeat.matches[i]));
 assert.equal(sameSeeds,true,'Seed replay drift');
 const metrics={
  matches:12,fulltime:finished,draws,avgGoals:round(first.summary.avgGoalsPerMatch),
  avgShots:round(first.summary.tactical.shootAttemptsPerMatch),
  avgPasses:round(first.summary.tactical.passAttemptsPerMatch),
  avgPenaltyFouls:round(first.summary.tactical.penaltiesPerMatch),
  nativeMatchElapsedMs:first.summary.elapsedMs,
  identicalReplays:4,
  boundaryProbes:entries,
  nativeFeatures
 };
 const report={
  name:'PokeFC Phase 10B knockout readiness baseline',
  upstream:'haeretici/soccer-js',
  commit:'38970e0dade0865078c9e84bc1ecfd72aaa02fde',
  authoritativeEngine:'Native Soccer-JS ONLY for baseline; NOT Quick Sim',
  status:'Pre-extension baseline. No extra time, shootouts or scripted animations implemented.',
  metrics,totalElapsedMs:Date.now()-begin,testsPassed:true
 };
 const outDir=path.resolve('phase10-reports');fs.mkdirSync(outDir,{recursive:true});
 fs.writeFileSync(path.join(outDir,'knockout-baseline.json'),JSON.stringify(report,null,2));
 const lines=[
  '# Phase 10B — Soccer-JS knockout readiness baseline','',
  'Pinned upstream: haeretici/soccer-js @ '+report.commit,'',
  'This is a **pre-extension baseline**. It tests current ordinary penalty mechanics and 45/90-minute transitions; it does not test a working extra-time or shootout system.','',
  '| Test | Result |',
  '|---|---|',
  '| Halftime at 45 minutes | PASS |',
  '| Tied 0-0 at 90 minutes | Native fulltime, no overtime |',
  '| Tied 2-2 at 90 minutes | Native fulltime, no overtime |',
  '| 3-1 at 90 minutes | Native fulltime |',
  '| Regular penalty-kick state | Present |',
  '| Extra-time state | Not implemented |',
  '| Shootout state | Not implemented |',
  '| Native seeded match completion | '+finished+'/12 |',
  '| Draws in seeded sample | '+draws+'/12 |',
  '| Exact seeded rerun | '+(sameSeeds?'PASS':'FAIL')+' (4 samples) |',
  '| Mean goals in 12 native games | '+metrics.avgGoals+' |',
  '| Mean shots in 12 native games | '+metrics.avgShots+' |',
  '| Mean passes in 12 native games | '+metrics.avgPasses+' |',
  '| Mean penalty fouls | '+metrics.avgPenaltyFouls+' |','',
  '## Next feature gates',
  '1. Knockout mode routes tied 90-minute scores into 105-minute first-half extra time.',
  '2. Second half begins from the preserved 105-minute snapshot and ends at 120 minutes.',
  '3. Scores remain unchanged by watching, replaying, or skipping; penalties remain separate from match goals.',
  '4. Five kicks per side, early clinch, and sudden death follow one deterministic result contract.',
  '5. Quick Sim, NOT Soccer-JS, becomes match authority when the eventual adapter is enabled.','',
  '**Scope:** Public simulation repo only; no production changes, no SiteGround upload.'
 ];
 const md=lines.join('\n')+'\n';
 fs.writeFileSync(path.join(outDir,'knockout-baseline.md'),md);
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,md);
 console.log('PASS Phase 10B baseline: '+finished+'/12 native matches, '+draws+' draws, four identical seeded reruns; report saved.');
})().catch(err=>{console.error('FAIL Phase 10B baseline:',err.stack||err);process.exitCode=1;});
