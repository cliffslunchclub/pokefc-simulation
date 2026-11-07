/* Report honest statistical comparisons. Never synthesize a TacticMesh reference. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {verifyCollection,accuracy}=require('../assets/js/calibration-fit.js');
const {DEFAULTS}=require('../assets/js/quick-sim.js');
const root=path.resolve(__dirname,'..'),base=path.join(root,'calibration');
const refsPath=path.join(base,'references'),reportsPath=path.join(base,'reports');
fs.mkdirSync(refsPath,{recursive:true});fs.mkdirSync(reportsPath,{recursive:true});
const files=fs.readdirSync(refsPath).filter(f=>/^tm-\d+\.json$/.test(f)).sort();
const references=files.map(f=>{
 const raw=path.join(reportsPath,f);
 if(!fs.existsSync(raw))throw Error('Missing corresponding original official TacticMesh match report: '+f);
 return verifyCollection(JSON.parse(fs.readFileSync(path.join(refsPath,f),'utf8')),JSON.parse(fs.readFileSync(raw,'utf8')));
});
const ids=new Set();
for(const r of references){if(ids.has(r.matchId))throw Error('Duplicate match ID across references');ids.add(r.matchId)}
const metrics=['goals','shots','passes','completedPasses','tackles','assists'];
const result={
 format:'fxi-calibration-comparison-v1',source:'pinned-original-tacticmesh-physics',
 status:references.length===0?'NO_VERIFIED_FULL_MATCHES':references.length<8?'INSUFFICIENT_REFERENCES':'REFERENCES_AVAILABLE_FOR_FITTING',
 referenceCount:references.length,minimumForExperimentalFit:8,recommendedForStrongerCalibration:32,
 engineCommits:[...new Set(references.map(x=>x.engineCommit))],referenceFiles:files,
 notes:['Reference matches are only counted when paired with their original full-length TacticMesh reports.',
 'No estimate, shortened match or fabricated result is counted as a TacticMesh full-time reference.',
 'Quick Sim saves and shots on target are not comparable with TacticMesh shotStops and null shotsOnTarget.']
};
if(references.length){
 const raw=Object.fromEntries(metrics.map(k=>[k,references.reduce((sum,r)=>sum+r.teamStats.reduce((a,t)=>a+t[k],0),0)]));
 const comparison=accuracy(references,DEFAULTS,16);
 result.referencePerMatch=Object.fromEntries(metrics.map(k=>[k,+(raw[k]/references.length).toFixed(3)]));
 result.quickSimBaseline={replicatesPerReference:16,metrics:comparison.breakdown,
  meanAbsoluteRelativeError:comparison.meanAbsoluteRelativeError,
  homePossessionMeanAbsErrorPoints:comparison.homePossessionMeanAbsErrorPoints};
}
fs.writeFileSync(path.join(base,'reference-comparison.json'),JSON.stringify(result,null,2)+'\n');
console.log('FUTBOL XI reference audit: '+references.length+' authentic completed full 90-minute match(es).');
console.log('Status: '+result.status);
if(result.quickSimBaseline){
 console.table(result.quickSimBaseline.metrics.map(x=>({metric:x.metric,tacticmesh:x.reference,quickSim:x.simulated,errorPercent:x.errorPercent})));
 console.log('Current uncalibrated Quick Sim mean absolute relative error: '+result.quickSimBaseline.meanAbsoluteRelativeError);
}else console.log('No real-engine distribution is available. No measured comparison has been fabricated.');
console.log('Saved calibration/reference-comparison.json');
