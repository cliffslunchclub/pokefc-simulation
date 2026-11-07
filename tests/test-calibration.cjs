'use strict';
const assert=require('node:assert/strict'),sim=require('../assets/js/quick-sim.js'),fit=require('../assets/js/calibration-fit.js');
const [GK,DEF,MID,FWD]=['GK','DEF','MID','FWD'];
function pokemon(side,id,pos,offset=0){const v=57+(id*7%22)+offset;return {
 id:side+'-p'+id,pos,main:{sprintSpeed:v,shortPassing:v+3,firstTouch:v+1,vision:v+2,tackling:v+2,finishing:v+1},
 detail:{strength:v-1,reflexes:v+5,positioning:v+4,handling:v+1,diving:v+2,kicking:v+1,decisionMaking:v,composure:v+3}
}}
function fixture(index){const positions=[GK,DEF,DEF,DEF,DEF,MID,MID,MID,FWD,FWD,FWD];
 return {seed:'TEST-CALIBRATION-'+index,home:{id:1,tactic:index%2?'possession':'press',lineup:positions.map((pos,i)=>pokemon('h'+index,i,pos,index%5))},
 away:{id:2,tactic:index%3?'balanced':'counter',lineup:positions.map((pos,i)=>pokemon('a'+index,i,pos,Math.floor(index/2)%9))}}}
const pr=fixture(3),a=sim.simulate(pr),b=sim.simulate(pr);
assert.equal(JSON.stringify(a),JSON.stringify(b),'full Quick Sim must be deterministic');
assert.equal(a.box[pr.home.lineup[0].id].minutes,90);
assert.equal(a.box[pr.away.lineup[0].id].minutes,90);
for(let side=0;side<2;side++){
 assert.equal(a.score[side],a.stats[side].goals);
 assert.ok(a.stats[side].shots>=a.stats[side].shotsOnTarget);
 assert.ok(a.stats[side].passes>=a.stats[side].completedPasses);
 assert.equal(a.events.filter(e=>e.type==='goal'&&String(e.team)===String(side===0?pr.home.id:pr.away.id)).length,a.score[side]);
}
assert.ok(Math.abs(a.stats[0].possession+a.stats[1].possession-100)<.01);
assert.equal(sim.profile().status,'provisional','missing real profile must be treated as provisional');
assert.throws(()=>sim.validParams({shotsBase:8}),/Invalid calibration parameter/);
assert.throws(()=>fit.validateReference({format:fit.REFERENCE_FORMAT,verified:false}),/Not a verified full-length/);
assert.throws(()=>fit.fit([]),/at least 8 real/);
// Artificial records are constructed ONLY INSIDE this isolated unit test to
// exercise the fitting math; none are exported as real TacticMesh evidence.
const fictional=[];
for(let i=0;i<12;i++){
 const p=fixture(i+20),r=sim.simulate(p,{seed:p.seed+'|test-target'}),byId=[p.home.id,p.away.id];
 const stats=r.stats.map((s,side)=>({...s,teamId:byId[side],assists:r.events.filter(e=>e.type==='goal'&&String(e.team)===String(byId[side])&&e.assist).length}));
 fictional.push({format:fit.REFERENCE_FORMAT,fullMatch:true,verified:true,
  engineCommit:fit.SOURCE_COMMIT,engineBuild:'unit-test-synthetic-not-real',referenceId:'UNIT-TEST-'+i,matchId:'UNIT-TEST-MATCH-'+i,
  preview:p,elapsedSeconds:5400,teamStats:stats,
  goalEvents:r.events.filter(e=>e.type==='goal').map(e=>({teamId:e.team,scorerId:e.player,assistId:e.assist,time:e.minute*60}))});
}
for(const r of fictional)fit.validateReference(r);
const result=fit.fit(fictional,{minMatches:8,replicates:6});
assert.equal(result.trainingMatches,9);assert.equal(result.holdoutMatches,3);
assert.ok(Number.isFinite(result.baseline.meanAbsoluteRelativeError));
assert.ok(Number.isFinite(result.tuned.meanAbsoluteRelativeError));
if(result.accepted)sim.validParams(result.profile.parameters);
assert.throws(()=>fit.validateReference({...fictional[0],elapsedSeconds:3000}),/not a full regulation/);
assert.throws(()=>fit.validateReference({...fictional[0],goalEvents:[]}),/goal ledger mismatch/);
assert.throws(()=>fit.fit([...fictional,fictional[0]],{replicates:2}),/Duplicate reference match/);
console.log('PASS v0.7b deterministic 90-minute Quick Sim, consistent goals/passes, provisional-only without verified references, strict metric and reference checks, fitting mathematics, holdout evaluation, duplicate rejection');
