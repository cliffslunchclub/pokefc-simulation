/* PokeFC v0.7b statistical calibration from verified TacticMesh match reports.
 * DO NOT label synthetic/demonstration records as authentic calibration data.
 * Uses a held-out match set; does not fit to unknown metric definitions. */
(function(root){'use strict';
 const SIM=(typeof require==='function'&&typeof module!=='undefined'&&module.exports)?require('./quick-sim.js'):root.FXI_QUICK;
 const SOURCE_COMMIT='603312dcf037bed0b0c817f8ba8a194eaebce8da';
 const crypto=typeof require==='function'?require('node:crypto'):null;
 const digest=v=>{if(!crypto)throw Error('Collection verification requires Node.js');return crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex')};
 const REFERENCE_FORMAT='fxi-tacticmesh-full-match-v1';
 const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
 const mean=(xs)=>xs.reduce((a,b)=>a+b,0)/Math.max(1,xs.length);
 const n=(v)=>Number.isFinite(Number(v))?Number(v):NaN;
 const keys=['goals','shots','passes','completedPasses','tackles','assists'];
 const value=(team,key)=>key==='assists'?team.assists:team[key];
 function validateReference(r){
  if(!r||r.format!==REFERENCE_FORMAT||r.verified!==true||r.fullMatch!==true||r.engineCommit!==SOURCE_COMMIT||!r.engineBuild)throw Error('Not a verified full-length TacticMesh reference');
  if(!r.preview||!r.preview.home||!r.preview.away||r.preview.home.lineup?.length!==11||r.preview.away.lineup?.length!==11)throw Error('Reference must contain both authentic XIs');
  if(!r.preview.home.lineup.some(p=>p.pos==='GK')||!r.preview.away.lineup.some(p=>p.pos==='GK'))throw Error('Reference lineup is missing a goalkeeper');
  if(!Number.isFinite(n(r.elapsedSeconds))||n(r.elapsedSeconds)<5399||n(r.elapsedSeconds)>6500)throw Error('Reference is not a full regulation match');
  if(!Array.isArray(r.teamStats)||r.teamStats.length!==2||!r.teamStats.every(x=>keys.every(k=>Number.isFinite(n(value(x,k)))&&n(value(x,k))>=0)))throw Error('Reference stats incomplete');
  if(!Array.isArray(r.goalEvents)||r.goalEvents.length!==r.teamStats[0].goals+r.teamStats[1].goals)throw Error('Reference goal ledger mismatch');
  if(r.teamStats.some(t=>t.completedPasses>t.passes))throw Error('Completed passes exceed passes');
  if(r.teamStats.some(t=>t.tackleAttempts!=null&&(!Number.isInteger(Number(t.tackleAttempts))||Number(t.tackleAttempts)<Number(t.tackles))))throw Error('Tackle wins exceed attempts');
  for(let i=0;i<2;i++){
   if(String(r.teamStats[i].teamId)!==String(i===0?r.preview.home.id:r.preview.away.id))throw Error('Reference team stats are misaligned with fixture');
   const pp=r.teamStats[i].possessionPercent;
   if(pp!==null&&pp!==undefined&&(!Number.isFinite(n(pp))||n(pp)<0||n(pp)>100))throw Error('Invalid possession percentage');
  }
  for(const e of r.goalEvents){
   if(!Number.isFinite(n(e.time))||n(e.time)<0||n(e.time)>n(r.elapsedSeconds)+1)throw Error('Goal event outside match clock');
   if(![String(r.preview.home.id),String(r.preview.away.id)].includes(String(e.teamId)))throw Error('Goal event references unknown team');
  }
  for(let i=0;i<2;i++){
   if(r.goalEvents.filter(e=>String(e.teamId)===String(i===0?r.preview.home.id:r.preview.away.id)).length!==r.teamStats[i].goals)throw Error('Scored goals mismatch team affiliation');
  }
  if(!r.referenceId||!String(r.referenceId).trim()||!r.matchId)throw Error('Reference identity missing');
  return r;
 }
 function verifyCollection(r,official){
  validateReference(r);
  if(!r.verification||r.verification.source!=='pinned-local-tacticmesh-physics')throw Error('Reference lacks pinned local physics provenance');
  if(!/^[a-f0-9]{64}$/.test(r.verification.reportSha256||'')||
     !/^[a-f0-9]{64}$/.test(r.verification.payloadSha256||''))throw Error('Reference provenance checksums are missing');
  const payload=Object.assign({},r);delete payload.verification;
  if(digest(payload)!==r.verification.payloadSha256)throw Error('Reference payload checksum mismatch');
  if(!official||official.format!=='tacticmesh-result'||official.complete!==true||official.status!=='completed'||
     official.shortenedForTesting===true||Number(official.halfSeconds)!==2700)throw Error('Not a full official regulation TacticMesh report');
  if(digest(official)!==r.verification.reportSha256)throw Error('Original report checksum mismatch');
  if(official.engineBuild!==r.engineBuild||official.matchId!==r.matchId||String(official.seed)!==String(r.seed)||
     Math.abs(Number(official.durationSeconds)-Number(r.elapsedSeconds))>.01)throw Error('Original TacticMesh report identity mismatch');
  if(!Array.isArray(official.teams)||official.teams.length!==2||
     !Array.isArray(official.events)||!Array.isArray(official.teamSnapshots)||official.teamSnapshots.length!==2)throw Error('Original report is missing audit fields');
  for(let i=0;i<2;i++){
   const tm=official.teams[i],ref=r.teamStats[i];
   if(String(tm.id)!==String(ref.teamId)||String(official.teamSnapshots[i].id)!==String(ref.teamId))throw Error('Report teams differ from reference');
   for(const k of keys)if(n(tm.stats[k])!==n(ref[k]))throw Error('Original report statistic does not match collected reference: '+k);
   if(ref.tackleAttempts!=null&&n(tm.stats.tackleAttempts)!==n(ref.tackleAttempts))throw Error('Original report tackle attempts do not match');
   if(n(tm.stats.possessionPercent)!==n(ref.possessionPercent)&&!(tm.stats.possessionPercent==null&&ref.possessionPercent==null))
    throw Error('Original report possession does not match reference');
  }
  const goals=official.events.filter(e=>e.type==='goal');
  const expected=goals.map(e=>({teamId:e.teamId,scorerId:e.scorerId,assistId:e.assistId,time:e.time}));
  if(JSON.stringify(expected)!==JSON.stringify(r.goalEvents))throw Error('Original report goal event ledger differs');
  return r;
 }
 function byTeam(sim){return sim.stats.map((s,i)=>({...s,assists:(sim.events||[]).filter(e=>e.type==='goal'&&String(e.team)===String(i===0?sim.home:sim.away)&&e.assist).length}))}
 function aggregate(items,parameters,replicates=16){
  const sums={goals:0,shots:0,passes:0,completedPasses:0,tackles:0,assists:0},pos=[],samples=[];
  for(const r of items){
   const matchAgg={goals:0,shots:0,passes:0,completedPasses:0,tackles:0,assists:0};let poss=0;
   for(let rep=0;rep<replicates;rep++){
    const result=SIM.simulate(r.preview,{seed:r.preview.seed+'|calibration|'+rep,parameters});const sides=byTeam(result);
    for(const k of keys)matchAgg[k]+=sides.reduce((a,x)=>a+x[k],0)/replicates;
    poss+=Number(result.stats[0].possession)/replicates;
   }
   for(const k of keys)sums[k]+=matchAgg[k];
   pos.push(poss);samples.push(matchAgg);
  }
  return {sums,pos,samples};
 }
 function referenceTotals(items){const sums=Object.fromEntries(keys.map(k=>[k,0]));
  for(const r of items)for(const s of r.teamStats)for(const k of keys)sums[k]+=value(s,k);
  return sums;
 }
 function accuracy(items,p,replicates=16){const sim=aggregate(items,p,replicates),ref=referenceTotals(items);
  const breakdown=keys.map(k=>{const a=sim.sums[k],b=ref[k];return {metric:k,reference:+b.toFixed(2),simulated:+a.toFixed(2),errorPercent:b>0?+((a-b)/b*100).toFixed(1):null}});
  let error=0,w=0;for(const item of breakdown){if(item.reference>0){error+=Math.abs(item.simulated-item.reference)/item.reference;w++;}}
  const obsPos=items.map(r=>r.teamStats[0].possessionPercent).filter(v=>Number.isFinite(n(v)));
  const posError=obsPos.length===items.length?mean(sim.pos.map((p,i)=>Math.abs(p-n(items[i].teamStats[0].possessionPercent)))):null;
  return {referenceMatches:items.length,breakdown,meanAbsoluteRelativeError:w?error/w:null,homePossessionMeanAbsErrorPoints:posError,simulated:sim,reference:ref};
 }
 function midpoint(t){const list=t.lineup.filter(p=>p.pos==='MID');const unit=p=>.33*n(p.main.shortPassing)+.29*n(p.main.vision)+.23*n(p.main.firstTouch)+.15*n(p.detail.decisionMaking);
  return list.reduce((s,p)=>s+unit(p),0)/Math.max(1,list.length);
 }
 function fit(references,{minMatches=8,replicates=24}={}){
  if(!Array.isArray(references))throw Error('Reference collection must be an array');
  references.forEach(validateReference);
  if(references.length<minMatches)throw Error(`Need at least ${minMatches} real full-length TacticMesh matches; have ${references.length}. No calibration installed.`);
  const unique=new Set();for(const r of references){if(unique.has(r.matchId)||unique.has(r.referenceId))throw Error('Duplicate reference match');unique.add(r.matchId);unique.add(r.referenceId)}
  const sorted=references.slice().sort((a,b)=>String(a.referenceId).localeCompare(String(b.referenceId)));
  const train=sorted.filter((_,i)=>i%4!==0),holdout=sorted.filter((_,i)=>i%4===0);
  if(holdout.length<2||train.length<6)throw Error('Need at least 6 training and 2 held-out reference matches');
  const starting=SIM.validParams({...SIM.DEFAULTS});const P={...starting};
  const real=referenceTotals(train);
  // Fit aggregate expected event frequencies. Weak sample estimates are
  // regularized; unknown TM shots-on-target / saves are never optimized.
  for(let i=0;i<3;i++){
   const sim=aggregate(train,P,replicates).sums;
   const update=(field,target,key)=>{if(target<=0||sim[key]<=0)return;P[field]*=clamp(Math.sqrt(target/sim[key]),.65,1.6)};
   update('shotsBase',real.shots,'shots');
   update('passesBase',real.passes,'passes');
   update('tacklesPerPlayer',real.tackles,'tackles');
   update('goalConversionScale',real.goals,'goals');
   if(real.passes>0)P.passAccuracy=clamp((real.completedPasses/real.passes),.20,.99);
   if(real.goals>0)P.assistProbability=clamp((real.assists/real.goals),0,1);
   P.shotsBase=clamp(P.shotsBase,2,30);P.passesBase=clamp(P.passesBase,20,700);
   P.tacklesPerPlayer=clamp(P.tacklesPerPlayer,.1,8);P.goalConversionScale=clamp(P.goalConversionScale,.15,3);
  }
  // Conditional possession least squares (team strengths + existing tactic
  // preset), with shrinkage to prevent fitting noise from eight fixtures.
  const x=[],y=[];
  for(const r of train){const observed=n(r.teamStats[0].possessionPercent);if(!Number.isFinite(observed))continue;
   const diff=midpoint(r.preview.home)-midpoint(r.preview.away);
   const tactical=(r.preview.home.tactic==='possession'?P.possessionTacticBonus:0)-(r.preview.away.tactic==='possession'?P.possessionTacticBonus:0);
   x.push(diff);y.push(observed-50-tactical);
  }
  if(x.length>=6){const X=mean(x),Y=mean(y),variance=x.reduce((s,v)=>s+(v-X)**2,0);
   if(variance>30){const slope=clamp(x.reduce((s,v,i)=>s+(v-X)*(y[i]-Y),0)/variance,0,1);
    P.possessionMidfieldSlope=clamp(starting.possessionMidfieldSlope*.45+slope*.55,0,1);
    const intercept=clamp(Y-P.possessionMidfieldSlope*X,-10,10);
    P.possessionHomeOffset=intercept*.7;
   }
  }
  SIM.validParams(P);
  const baseline=accuracy(holdout,starting,replicates),tuned=accuracy(holdout,P,replicates);
  // An honest holdout check: do not enable a profile that clearly generalizes
  // worse than the provisional model under the same deterministic draws.
  const baseError=baseline.meanAbsoluteRelativeError||0,tunedError=tuned.meanAbsoluteRelativeError||0;
  const accepted=tunedError<=baseError*1.15 || (tunedError-baseError)<.025;
  const profile=accepted?{status:'calibrated',version:'v0.7b',referenceMatches:sorted.length,engineCommit:SOURCE_COMMIT,
   parameters:P,metrics:{trainingMatches:train.length,holdoutMatches:holdout.length,holdoutBaselineError:baseError,holdoutCalibratedError:tunedError,
    holdoutPossessionPoints:tuned.homePossessionMeanAbsErrorPoints,calibratedMetrics:keys,unavailableMetrics:['shotsOnTarget','conventionalSaves','individualInterceptions']}}:null;
  return {accepted,profile,trainingMatches:train.length,holdoutMatches:holdout.length,baseline:{breakdown:baseline.breakdown,meanAbsoluteRelativeError:baseline.meanAbsoluteRelativeError,homePossessionMeanAbsErrorPoints:baseline.homePossessionMeanAbsErrorPoints},
   tuned:{breakdown:tuned.breakdown,meanAbsoluteRelativeError:tuned.meanAbsoluteRelativeError,homePossessionMeanAbsErrorPoints:tuned.homePossessionMeanAbsErrorPoints},
   notes:accepted?'Calibrated parameters were fitted exclusively to verified TacticMesh full matches; holdout is reported.':'Rejected: candidate generalized worse on held-out genuine matches. Previous provisional model remains active.'};
 }
 const API={REFERENCE_FORMAT,SOURCE_COMMIT,validateReference,verifyCollection,digest,fit,accuracy};
 root.FXI_FITTER=API;
 if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
