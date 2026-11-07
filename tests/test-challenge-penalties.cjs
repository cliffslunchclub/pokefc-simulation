'use strict';
/* Modeled penalty resolution is saved per kick; losses and wins show the same report.
 * Old runs without attempt logs retain a truthful score-only summary. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const lineup=[233,6,3,9,149,94,131,143,68,135,196];
function caseFor(sequence){
 let saved=JSON.stringify({version:1,phase:'locked',pool:4,legends:false,formation:'4-3-3',
  tactic:'balanced',roster:lineup,items:Array(11).fill(null),roll:null,selected:0,rng:921,
  rerollType:1,rerollGen:1,moves:1,formationChanges:1,round:0,result:null,history:[],locked:{
   roster:lineup,items:Array(11).fill(null),formation:'4-3-3',tactic:'balanced',score:71}});
 const app={innerHTML:'',querySelectorAll(){return []}},elements={};
 const ctx=vm.createContext({window:{},document:{getElementById(id){
  if(id==='app')return app;
  return elements[id]??={id,open:false,hidden:false,textContent:'',value:'',
   setAttribute(k,v){this[k]=v},removeAttribute(k){delete this[k]},onclick:null};
 }},localStorage:{getItem:k=>k==='pokefc-challenge-alpha-1'?saved:null,setItem(k,v){if(k==='pokefc-challenge-alpha-1')saved=v}},
 crypto:{getRandomValues(a){a[0]=921;return a}},console,confirm:()=>true,alert:e=>{throw Error(e)}});
 for(const f of ['assets/js/position-effectiveness.js','assets/js/national-species.js','challenge/special-items-data.js','challenge/tiers.js','challenge/match-report.js','challenge/performance.js','play/opponents.js'])
  vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f,timeout:15000});
 ctx.window.FXI_QUICK={
  simulate(fixture){return{score:[1,1],stats:[
   {shots:8,shotsOnTarget:4,passes:170},{shots:7,shotsOnTarget:4,passes:182}],
   events:[{type:'goal',team:fixture.home.id,player:fixture.home.lineup[9].id,minute:18},
    {type:'goal',team:fixture.away.id,player:fixture.away.lineup[9].id,minute:65}]
  }},
  randomizer(){let i=0;return()=>sequence[i++%sequence.length]}
 };
 const html=fs.readFileSync(path.join(root,'challenge/index.html'),'utf8');
 vm.runInContext(html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>')),ctx,{filename:'challenge-inline',timeout:15000});
 elements.play.onclick();
 return {app,elements,state:JSON.parse(saved)};
}
for(const [sequence,winner] of [[[.01,.99],'home'],[[.99,.01],'away']]){
 const played=caseFor(sequence),match=played.state.result,p=match.shootout;
 assert(p,'Structured shootout saved');
 assert(p.home!==p.away,'Shoots until one side wins');
 assert.equal(p.winner,winner,'Winner follows made/missed kicks');
 assert.equal(match.outcome,winner==='home'?'Victory':'Defeat');
 assert.match(played.app.innerHTML,/FINAL MATCH · VS LORELEI|MATCH 1 · VS LORELEI/,'Opposing boss named after VS');
 if(winner==='away'){
  assert.match(played.app.innerHTML,/id="finalMatchHeading"[^>]*>DEFEAT<\/h2>/,'Loss is explicitly player-perspective');
  assert.match(played.app.innerHTML,/class="challenge-shootout-caption">PENALTIES \d+–\d+/,'Penalty score separated from regulation score');
 }else assert.match(played.app.innerHTML,/id="challengeMatchResultTitle"[^>]*>VICTORY<\/h2>/,'Win is explicitly player-perspective');
 assert.deepEqual(Array.from(match.score),[1,1],'Regulation score unchanged');
 assert.equal(match.tiebreak.includes(p.home+'–'+p.away),true);
 assert(p.attempts.length>=5,'Each shootout contains modeled kick events');
 assert.equal(p.attempts.filter(k=>k.side==='home'&&k.scored).length,p.home,'Recorded home makes match score');
 assert.equal(p.attempts.filter(k=>k.side==='away'&&k.scored).length,p.away,'Recorded away makes match score');
 assert(p.attempts.every(k=>k.kicker&&typeof k.scored==='boolean'),'Player and result saved for every kick');
 assert.match(played.app.innerHTML,/PENALTY SHOOTOUT/);
 assert(match.award?.name,'Shootout game records a match award');
 assert.match(played.app.innerHTML,/PLAYER OF THE MATCH/);
 assert.match(played.app.innerHTML,/VIEW PENALTY KICKS/);
 assert.match(played.app.innerHTML,/R1/);
 assert.match(played.app.innerHTML,/GOAL/);
 assert.match(played.app.innerHTML,/MISS/);
 if(winner==='away'){
  assert.equal(played.state.phase,'finished','Penalty shootout loss ends Gauntlet');
  assert.match(played.app.innerHTML,/id="runFinishMatchStep"/,'Lost match gets a dedicated first step in the results modal');
  assert.match(played.app.innerHTML,/MATCH TIMELINE/,'Lost match shows detailed goal timeline');
  assert.match(played.app.innerHTML,/MATCH STATISTICS/,'Lost match shows statistics');
  assert.match(played.app.innerHTML,/<dialog id="runCompleteModal"/,'Run recap is modal');
  assert.equal(played.elements.runCompleteModal.open,true,'Recap opens automatically');
  assert.equal(played.elements.runFinishMatchStep.hidden,false,'Loss opens the match detail screen first');
  assert.equal(played.elements.runFinishOverviewStep.hidden,true,'Tournament overview is secondary');
  played.elements.continueTournamentOverview.onclick();
  assert.equal(played.elements.runFinishOverviewStep.hidden,false,'Continue switches to the tournament overview');
  played.elements.backToFinalMatch.onclick();
  assert.equal(played.elements.runFinishMatchStep.hidden,false,'Back returns to loss report');
  assert.match(played.app.innerHTML,/run-match lost" open/,'Final loss report expands by default in run modal');
 }else assert.equal(played.state.phase,'result','Penalty win continues Gauntlet');
}
console.log('PASS modeled penalty kicks: winner, kicker results and counts, regulation draw preserved, defeat report and recap modal');
