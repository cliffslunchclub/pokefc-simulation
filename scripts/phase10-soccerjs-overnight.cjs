'use strict';
// Read-only, pinned Soccer-JS baseline. No game files are modified.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const upstream=path.resolve(process.argv[2]||'upstream');
require(path.join(upstream,'tests/mock_env.js'));
const {Settings}=require(path.join(upstream,'kernel/settings.js'));
const {mergeConfig,runBatch}=require(path.join(upstream,'kernel/providers/simulator/headless_runner.js'));
Settings.app={camX:0,camY:0,canvas:{width:720,height:528}};
const configs=[
 {name:'balanced-442',seed:100031,formationA:'4-4-2',formationB:'4-4-2',dynamicStrategyShifting:false},
 {name:'attacking-433',seed:200031,formationA:'4-3-3',formationB:'4-4-2',dynamicStrategyShifting:true},
 {name:'compact-532',seed:300031,formationA:'5-3-2',formationB:'4-2-3-1',dynamicStrategyShifting:true}
];
const base={headless:true,matchDurationSeconds:300,maxFramesPerMatch:25000};
const f=n=>Math.round(n*100)/100;
function signature(m){return JSON.stringify({seed:m.seed,frames:m.frames,matchState:m.matchState,scoreA:m.scoreA,scoreB:m.scoreB,totalGoals:m.totalGoals,tactical:m.tactical,possessionShare:m.possessionShare});}
(async()=>{
 const start=Date.now(),scenarios=[];
 for(const c of configs){
  const {matches,summary}=await runBatch(mergeConfig({...base,...c,iterations:16,concurrency:4}));
  assert.equal(matches.length,16);
  scenarios.push({
   name:c.name,seed:c.seed,total:matches.length,
   completed:matches.filter(m=>m.matchState==='fulltime').length,
   drawn:matches.filter(m=>m.scoreA===m.scoreB).length,
   goals:f(summary.avgGoalsPerMatch),shots:f(summary.tactical.shootAttemptsPerMatch),
   passes:f(summary.tactical.passAttemptsPerMatch),penalties:f(summary.tactical.penaltiesPerMatch),
   avgFrameCount:f(summary.avgFramesPerMatch),elapsedMs:summary.elapsedMs,
   scores:matches.map(m=>({seed:m.seed,score:[m.scoreA,m.scoreB],state:m.matchState,frames:m.frames}))
  });
  const last=scenarios.at(-1);console.log('BASELINE '+c.name+' '+last.completed+'/16 finished; '+last.goals+' goals; '+last.shots+' shots');
 }
 const seedConfig=mergeConfig({...base,iterations:6,seed:900027,concurrency:1,formationA:'4-3-3',formationB:'4-4-2'});
 const first=await runBatch(seedConfig),second=await runBatch(seedConfig);
 const seedsStable=first.matches.map(signature).join('\n')===second.matches.map(signature).join('\n');
 const allComplete=scenarios.every(x=>x.completed===x.total);
 const report={kind:'phase10-soccerjs-readonly-audit',upstreamCommit:'38970e0dade0865078c9e84bc1ecfd72aaa02fde',
  matches:60,scenarios,seedsStable,allComplete,elapsedMs:Date.now()-start,
  limitations:'No 120-minute extra time, penalty shootout or Quick Sim-directed playback was implemented or tested. These are native Soccer-JS matches.'};
 const dir=path.join(__dirname,'../phase10-reports');fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'soccerjs-nightly.json'),JSON.stringify(report,null,2));
 const lines=['# Phase 10 Soccer-JS overnight feasibility audit','',
  'Read-only baseline of pinned upstream version '+report.upstreamCommit+'. Not an overtime or Quick Sim adapter test.','',
  '| Profile | Full-time | Draws | Goals / match | Shots / match | Passes / match | Penalty fouls / match | Runtime (sec) |',
  '|---|---:|---:|---:|---:|---:|---:|---:|'];
 for(const x of scenarios)lines.push('| '+x.name+' | '+x.completed+'/'+x.total+' | '+x.drawn+' | '+x.goals+' | '+x.shots+' | '+x.passes+' | '+x.penalties+' | '+f(x.elapsedMs/1000)+' |');
 lines.push('','Same seed replayed twice across six games: **'+(seedsStable?'PASS':'FAIL')+'**.',
   'All native 90-minute simulations reached full-time: **'+(allComplete?'PASS':'FAIL')+'**.',
   '','Remaining development: extra-time phases 90–105–120, shootout round/state machine, separate penalty scores, and externally directed animation that obeys Quick Sim.',
   'No modifications to production mode, arcade test, upstream engine, or live site.');
 const md=lines.join('\n')+'\n';
 fs.writeFileSync(path.join(dir,'soccerjs-nightly.md'),md);
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,md);
 console.log(JSON.stringify({seedsStable,allComplete,matches:report.matches,report:'phase10-reports/soccerjs-nightly.md'}));
 if(!seedsStable||!allComplete)process.exitCode=1;
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
