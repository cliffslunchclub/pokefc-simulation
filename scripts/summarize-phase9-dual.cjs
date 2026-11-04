'use strict';
// Phase 9 cross-engine evaluation. The Quick Sim numbers are precomputed from
// the PRIVATE PokeFC branch; this public script never imports private code.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const input=path.resolve(process.argv[2]||'results/phase9-input');
const refFile=path.resolve(process.argv[3]||'config/phase9-quick-sim-numeric-reference.json');
const output=path.resolve(process.argv[4]||'results/phase9-report');
const quick=JSON.parse(fs.readFileSync(refFile,'utf8'));
const variants=quick.tmVariants,profiles=quick.profiles.map(p=>p.id);
assert.equal(quick.referencedFixtures,300);
assert.equal(quick.quickSimulationCount,108000);
const lookup=new Map(quick.fixtures.map(row=>[row.variant+':'+row.profile+':'+row.seed,row]));
assert.equal(lookup.size,300);
function fingerprint(value){
  let h=2166136261;
  for(const c of JSON.stringify(value))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;
  return h.toString(16).padStart(8,'0');
}
const files=fs.readdirSync(input,{recursive:true}).filter(f=>/tm-phase9-.*\.json$/.test(path.basename(f)));
assert.equal(files.length,60,'Expected 60 five-match batches, got '+files.length);
const rows=[],keys=new Set();
let sourceHash=null;
for(const filename of files){
  const data=JSON.parse(fs.readFileSync(path.join(input,filename),'utf8'));
  assert(variants.includes(data.calibrationVariant),'Unknown variant '+filename);
  assert(data.fullRegulation&&data.completedMatches===5&&data.matchesData.length===5&&data.includesQuickSimFixtures,'Incomplete batch '+filename);
  if(sourceHash===null)sourceHash=data.sourceHash;
  assert.equal(data.sourceHash,sourceHash,'Mixed TacticMesh source versions');
  const profileInfo=quick.profiles.find(p=>p.home===data.homeRatingOffset&&p.away===data.awayRatingOffset);
  assert(profileInfo,'Unknown strength offsets '+filename);
  for(const match of data.matchesData){
    assert(match.finished&&match.simulatedSeconds>=5399,'Incomplete physical match '+filename);
    assert.equal(match.score.home+match.score.away,match.goals,'Score ledger mismatch '+filename);
    const key=data.calibrationVariant+':'+profileInfo.id+':'+match.seed;
    assert(!keys.has(key),'Duplicate match '+key);keys.add(key);
    const paired=lookup.get(key);assert(paired,'Missing private Quick Sim fixture reference '+key);
    assert.equal(fingerprint(match.quickSimFixture),paired.rosterFingerprint,'Exact roster/ratings mismatch '+key);
    const ctr=metric=>Object.values(match.teams).reduce((s,t)=>s+(Number((t.counters||{})[metric])||0),0);
    rows.push({
      variant:data.calibrationVariant,profile:profileInfo.id,seed:match.seed,
      tm:{goals:match.goals,homeGoals:match.score.home,awayGoals:match.score.away,
        shots:match.shots,passes:match.passAttempts,completedPasses:match.completedPasses,
        tackles:ctr('tackle'),broadInterceptions:ctr('interception'),
        directInterceptionControls:ctr('directPassInterceptionControl'),
        directInterceptionDeflections:ctr('directPassInterceptionDeflection')},
      quick:paired.quickResults
    });
  }
}
assert.equal(rows.length,300);
const sum=(a,k)=>a.reduce((acc,o)=>acc+(Number(o[k])||0),0);
const mean=(a,k)=>sum(a,k)/a.length;
function summarize(group,mode='phase9-pass-aggressive'){
  const tm=group.map(r=>r.tm),q=group.map(r=>r.quick[mode].stats);
  const reps=group.reduce((s,r)=>s+r.quick[mode].simulations,0);
  const aggTM={goals:mean(tm,'goals'),homeGoals:mean(tm,'homeGoals'),awayGoals:mean(tm,'awayGoals'),
    shots:mean(tm,'shots'),passing:sum(tm,'completedPasses')/Math.max(1,sum(tm,'passes')),
    tackles:mean(tm,'tackles'),broadInterceptions:mean(tm,'broadInterceptions'),
    directInterceptionControls:mean(tm,'directInterceptionControls'),
    directInterceptionDeflections:mean(tm,'directInterceptionDeflections')};
  const aggQuick={goals:sum(q,'goals')/reps,homeGoals:sum(q,'homeGoals')/reps,
    awayGoals:sum(q,'awayGoals')/reps,shots:sum(q,'shots')/reps,
    passing:sum(q,'completedPasses')/Math.max(1,sum(q,'passes')),
    tackles:sum(q,'tackleAttempts')/reps};
  return {tmMatches:group.length,quickSamples:reps,tm:aggTM,quick:aggQuick};
}
const overall={},byProfile={};
for(const variant of variants){
  const list=rows.filter(r=>r.variant===variant);
  assert.equal(list.length,60,'Expected 60 matches for '+variant);
  overall[variant]=summarize(list);
  byProfile[variant]={};
  for(const profile of profiles){
    const subset=list.filter(r=>r.profile===profile);
    assert.equal(subset.length,15,'Expected 15 matched seeds for '+variant+' / '+profile);
    byProfile[variant][profile]=summarize(subset);
    const seeds=subset.map(x=>x.seed).sort((a,b)=>a-b);
    assert.deepEqual(seeds,Array.from({length:15},(_,i)=>993001+i),'Mismatched seeds');
  }
}
// We rank experiments with a transparent HEURISTIC, not a calibrated loss
// function or production acceptance threshold. Check each strength profile.
const scores=variants.map(variant=>{
  let score=0;
  for(const profile of profiles){
    const x=byProfile[variant][profile],tm=x.tm,q=x.quick;
    score+=2*Math.abs(tm.goals-q.goals) + .18*Math.abs(tm.shots-q.shots)+
      .055*Math.abs(100*(tm.passing-q.passing)) +
      .45*Math.max(0,tm.goals-5) + .14*Math.max(0,12-tm.shots);
  }
  return {variant,heuristicError:Number((score/profiles.length).toFixed(3))};
}).sort((a,b)=>a.heuristicError-b.heuristicError);
const report={kind:'phase9-dual-engine-calibration',sourceHash,privateQuickSimCommit:quick.sourceQuickSimCommit,
  totalTmFullMatches:rows.length,uniqueQuickMatches:quick.quickSimulationCount,
  distinctStartingRosters:quick.uniqueRosterCount,quickReferenceVariant:'phase9-pass-aggressive',
  confidence:'exploratory; 15 full TM matches per strength profile per variant',
  targets:{goalsPerMatch:[2.5,3.2],shotsPerMatch:[20,26],passAccuracy:[.75,.80]},
  overall,byProfile,heuristicRanking:scores,fixtures:rows};
const fmt=x=>Number(x).toFixed(2),pct=x=>fmt(x*100)+'%';
const lines=['# PokéFC Phase 9 — Dual-engine matched-roster calibration','',
  '**300 genuine full-length TacticMesh matches** paired with **108,000 private experimental Quick Sim matches** across **120 distinct rated starting rosters**.',
  'Each TacticMesh variant has 60 full matches: 15 seeds × 4 weak/average/elite/mismatch profiles.',
  'All paired comparisons verify **exact 22-player attributes** via the deterministic roster fingerprint.',
  '',
  'Reference in the tables: **Quick Sim experimental aggressive passing model**. Legacy and moderate Quick Sim numeric references are included in the JSON dataset.',
  '',
  '| TacticMesh variant | TM goals | QS goals | TM shots | QS shots | TM pass % | QS pass % | TM direct pass INT |',
  '|---|---:|---:|---:|---:|---:|---:|---:|'];
for(const variant of variants){
  const r=overall[variant],a=r.tm,b=r.quick;
  lines.push('| '+variant+' | '+fmt(a.goals)+' | '+fmt(b.goals)+' | '+fmt(a.shots)+
    ' | '+fmt(b.shots)+' | '+pct(a.passing)+' | '+pct(b.passing)+' | '+fmt(a.directInterceptionControls)+' |');
}
lines.push('','## Strength profiles — compare goal and shot effects','',
  '| Variant | Strength | TM goals | QS goals | TM shots | QS shots | TM passing | QS passing |',
  '|---|---|---:|---:|---:|---:|---:|---:|');
for(const variant of variants)for(const profile of profiles){
  const r=byProfile[variant][profile];
  lines.push('| '+variant+' | '+profile+' | '+fmt(r.tm.goals)+' | '+fmt(r.quick.goals)+' | '+fmt(r.tm.shots)+
    ' | '+fmt(r.quick.shots)+' | '+pct(r.tm.passing)+' | '+pct(r.quick.passing)+' |');
}
lines.push('','## Exploratory ranking (lower discrepancy is better)','',
  'The following is a heuristic combining per-profile goal, shot and pass discrepancies plus penalties for extreme scoring or very low shot totals. **Not** a production go/no-go criterion.',
  ...scores.map((r,i)=>(i+1)+'. '+r.variant+': '+fmt(r.heuristicError)),
  '','## Caveats and next steps','',
  '- The original Quick Sim baseline is preserved. Both new passing modes are experimental and live on a private GitHub branch, not production.',
  '- The TacticMesh variants are experiments only. No game configuration is automatically promoted.',
  '- Realistic scoring remains the target: 2.5–3.2 goals and 20–26 shots; passing 75–80%.',
  '- Quick Sim challenge attempts are a statistical estimate, not the same event population as TacticMesh physical challenges.',
  '- Even matched teams do not share an event-by-event RNG sequence across engines.',
  '- Run separate holdout seeds plus watch-to-quick handoff tests before considering live deployment.',
  '- The stabilized experiment also alters the player rating *inputs* by compressing differences toward 60. That is a diagnostic only and must not silently rewrite Pokémon ratings.',
  '');
fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'phase9-dual-report.md'),lines.join('\n'));
fs.writeFileSync(path.join(output,'phase9-dual-report.json'),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(output,'phase9-fixtures.csv'),[
  'variant,profile,seed,tmGoals,qsGoals,tmShots,qsShots,tmPassRate,qsPassRate,tmDirectInterceptionControls',
  ...rows.map(x=>[x.variant,x.profile,x.seed,x.tm.goals,
   (x.quick['phase9-pass-aggressive'].stats.goals/x.quick['phase9-pass-aggressive'].simulations).toFixed(4),
   x.tm.shots,(x.quick['phase9-pass-aggressive'].stats.shots/x.quick['phase9-pass-aggressive'].simulations).toFixed(4),
   (x.tm.completedPasses/Math.max(1,x.tm.passes)).toFixed(4),
   (x.quick['phase9-pass-aggressive'].stats.completedPasses/x.quick['phase9-pass-aggressive'].stats.passes).toFixed(4),
   x.tm.directInterceptionControls].join(','))
].join('\n')+'\n');
console.log(lines.join('\n'));