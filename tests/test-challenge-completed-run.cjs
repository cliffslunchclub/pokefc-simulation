'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const roster=[233,6,3,9,149,94,131,143,68,135,196],names=['Lorelei','Bruno','Agatha','Lance','Blue','Red'];
const matches=names.map((boss,i)=>({boss,round:i+1,score:[2,1],shots:[8,4],passes:[310,250],outcome:'Victory',origin:'quick-sim'}));
const makeState=champion=>{
 const history=champion?matches:matches.slice(0,5).map((x,i)=>i===4?{...x,score:[2,3],outcome:'Defeat'}:x);
 return {version:1,phase:'finished',pool:4,legends:true,formation:'4-3-3',tactic:'press',
  roster:roster.slice(),items:['Eviolite',...Array(10).fill(null)],selected:0,roll:null,rng:52399,
  rerollType:0,rerollGen:0,moves:0,formationChanges:0,round:history.length-1,
  history,result:history.at(-1),
  locked:{roster:roster.slice(),items:['Eviolite',...Array(10).fill(null)],formation:'4-3-3',tactic:'press',score:72.9}};
};
function launch(champion,withShotData=false){
 const saved=makeState(champion);
 if(withShotData)saved.history.forEach((match,i)=>{
  if(i%2===0)match.report={stats:{shotsOnTarget:[i+3,i+1],
    passes:[100+i*10,90],completedPasses:[75+i*8,70],
    tackles:[2+i,3],tackleAttempts:[5+i,9],possession:[55+i,45-i]},
   playerShotsOnTarget:[
    {side:0,player:'Jolteon',count:i+3},
    {side:0,player:'Charizard',count:0},
    {side:1,player:'Lapras',count:i+1}
   ],
   playerTackles:[
    {side:0,player:'Jolteon',attempts:5+i,won:2+i},
    {side:0,player:'Charizard',attempts:0,won:0},
    {side:1,player:'Lapras',attempts:9,won:3}
   ]};
 });
 let stored=JSON.stringify(saved);
 const localRecords=JSON.stringify({'classic-legends':{attempts:4,best:6,champions:1}});
 const elements={};
 const app={innerHTML:'',querySelectorAll(){return[]}};
 const clipboard=[];
 const doc={getElementById(id){
  if(id==='app')return app;
  return elements[id]??={id,value:'',hidden:id==='runSharePanel',textContent:'',onclick:null,setAttribute(k,v){this[k]=v}};
 }};
 const context=vm.createContext({window:{},document:doc,
  localStorage:{getItem:k=>k==='pokefc-challenge-alpha-1'?stored:k==='pokefc-challenge-personal-records-v1'?localRecords:null,
   setItem(k,v){if(k==='pokefc-challenge-alpha-1')stored=v;else throw Error('Restart must preserve local records')}},
  navigator:{clipboard:{writeText:async s=>{clipboard.push(s)}}},
  crypto:{getRandomValues(a){a[0]=34567;return a}},
  console,confirm:()=>true,alert:e=>{throw Error(e)}});
 for(const file of ['assets/js/position-effectiveness.js','assets/js/national-species.js','assets/js/calibration-profile.js','assets/js/quick-sim.js','challenge/special-items-data.js','challenge/performance.js','play/opponents.js']){
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file,timeout:15000});
 }
 const html=fs.readFileSync(path.join(root,'challenge/index.html'),'utf8');
 vm.runInContext(html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>')),context,{filename:'challenge-inline',timeout:15000});
 return {app,elements,clipboard,getState:()=>JSON.parse(stored)};
}
(async()=>{
 const lost=launch(false);
 assert.match(lost.app.innerHTML,/RUN COMPLETE/);
 assert.match(lost.app.innerHTML,/LOSS · VS BLUE/,'Failed run label identifies whose loss');
 assert.match(lost.app.innerHTML,/FINAL MATCH · VS BLUE/,'Final match names the opponent without outcome ambiguity');
 assert.match(lost.app.innerHTML,/id="finalMatchHeading"[^>]*>DEFEAT<\/h2>/,'Player-perspective loss heading');
 assert.match(lost.app.innerHTML,/VS BLUE<\/span><strong>2–3<\/strong><small>LOSS/,'Tournament result history says VS Blue / Loss');
 assert.doesNotMatch(lost.app.innerHTML,/Blue · Defeat|BLUE DEFEATED/,'No ambiguous opponent-defeated label');
 assert.match(lost.app.innerHTML,/72\.9/,'Team score shown');
 assert.match(lost.app.innerHTML,/4W · 1L/,'Record shown');
 assert.match(lost.app.innerHTML,/5 \/ 6/,'Five matches played shown');
 assert.match(lost.app.innerHTML,/FORMATION/);
 assert.match(lost.app.innerHTML,/id="shareRun"/);
 assert.match(lost.app.innerHTML,/id="startNewRun"/,'Results offer a clear return to challenge setup');
 assert.doesNotMatch(lost.app.innerHTML,/QUICK RESTART|id="quickRestart"/,'Misleading Quick Restart no longer appears');
 assert.match(lost.app.innerHTML,/BEST PLAYER OF THE TOURNAMENT/,'Tournament MVP shown in loss recap');
 assert.equal((lost.app.innerHTML.match(/class="tournament-pokemon(?: tournament-top-player)?"/g)||[]).length,11,'Eleven Pokémon portraits in recap');
 assert.match(lost.app.innerHTML,/TOURNAMENT STATS/);
 assert.doesNotMatch(lost.app.innerHTML,/SHOTS ON GOAL · TOTAL/,'No team-level shot totals in recap');
 assert.match(lost.app.innerHTML,/Individual shots on goal recorded for 0 of 5 matches/,'Legacy shot coverage clearly disclosed');
 assert.match(lost.app.innerHTML,/class="pokemon-shot-stat"><b>—<\/b>SOG/,'Legacy Pokémon show unknown, not zero');
 assert.match(lost.app.innerHTML,/class="pokemon-tackle-stat"><b>—<\/b>TCK/,'Older saves show unavailable tackles, never fake zero');
 assert.match(lost.app.innerHTML,/Passing, tackle and possession statistics were not saved for this run/,'No fabricated team passing for legacy runs');
 assert.match(lost.app.innerHTML,/Individual Pokémon shots on goal were not recorded for this match/,'Legacy detailed match does not invent shooters');
 assert.match(lost.app.innerHTML,/<dialog id="runCompleteModal"/,'Completed run is rendered inside a dialog');
 assert.equal(lost.elements.runCompleteModal.open,true,'Loss opens run results modal');
 lost.elements.closeRunModal.onclick();
 assert.equal(lost.elements.runCompleteModal.open,false,'Run results modal closes');
 lost.elements.openRunModal.onclick();
 assert.equal(lost.elements.runCompleteModal.open,true,'Run results modal reopens');
 assert.match(lost.app.innerHTML,/id="copyRunSummary"/);
 assert.match(lost.app.innerHTML,/id="postTwitter"[^>]*disabled/,'Direct posting remains unavailable');
 assert.match(lost.app.innerHTML,/LOCAL RECORDS|RUN COMPLETE/);
 const share=lost.elements.shareRun;
 assert(share?.onclick,'Share opens preview');
 share.onclick();
 assert.equal(lost.elements.runSharePanel.hidden,false);
 assert.equal(share['aria-expanded'],'true');
 lost.elements.copyRunSummary.onclick();
 await Promise.resolve();
 assert.equal(lost.clipboard.length,1,'Share copies a summary');
 const copied=lost.clipboard[0];
 assert.match(copied,/TEAM SCORE: 72\.9/);
 assert.match(copied,/RECORD: 4W–1L/);
 assert.match(copied,/MATCHES: 5\/6/);
 assert.match(copied,/Porygon2/);
 assert.match(copied,/HELD ITEMS: Porygon2: Eviolite/);
 assert.match(copied,/https:\/\/pfc.cliffslunchclub.com\/challenge\//);
 lost.elements.startNewRun.onclick();
 const fresh=lost.getState();
 assert.equal(fresh.phase,'setup','Start New Run returns to Challenge selection, not a new draft');
 assert.equal(fresh.pool,4);
 assert.equal(fresh.legends,false,'Default setup is restored for the next run');
 assert.equal(fresh.formation,'4-3-3');
 assert.equal(fresh.tactic,'balanced');
 assert.equal(fresh.history.length,0);
 assert.equal(fresh.items.filter(Boolean).length,0);
 assert.equal(fresh.roster.filter(Boolean).length,0);
 assert.equal(fresh.rerollType,1);
 assert.equal(fresh.rerollGen,1);
 assert.equal(fresh.moves,1);
 assert.equal(fresh.formationChanges,1);
 assert.match(lost.app.innerHTML,/CHOOSE YOUR CHALLENGE/,'New run returns to the home mode chooser');
 assert.doesNotMatch(lost.app.innerHTML,/challenge-draft-panel/,'Does not jump straight into a draft');
 const withShots=launch(true,true);
 assert.match(withShots.app.innerHTML,/Individual shots on goal recorded for 3 of 6 matches/,'Player SOG coverage reflects saved games');
 assert.match(withShots.app.innerHTML,/class="pokemon-shot-stat"><b>15<\/b>SOG/,'Jolteon has 15 actual shots on goal');
 assert.match(withShots.app.innerHTML,/class="pokemon-shot-stat"><b>0<\/b>SOG/,'Known zero is displayed as 0');
 assert.doesNotMatch(withShots.app.innerHTML,/class="run-shots-summary"/,'No aggregate team shooting panel');
 assert.match(withShots.app.innerHTML,/POKÉMON SHOTS ON GOAL/,'Expanded game shows individual shooter lines');
 assert.match(withShots.app.innerHTML,/Jolteon<\/strong><b>3 SOG/,'Scoring report attributes shot to correct Pokémon');
 assert.match(withShots.app.innerHTML,/TEAM PASSING &amp; DEFENSE/,'Team aggregate passing and defense panel is shown');
 assert.match(withShots.app.innerHTML,/273 \/ 360/,'Completed and attempted passes sum over recorded games');
 assert.match(withShots.app.innerHTML,/75\.8%/,'Pass accuracy computed from recorded team totals');
 assert.match(withShots.app.innerHTML,/12 \/ 21/,'Tackle attempts and wins reconcile over available games');
 assert.match(withShots.app.innerHTML,/57\.1%/,'Tackle win rate computed from recorded tackles');
 assert.match(withShots.app.innerHTML,/Pokémon tackle data recorded for 3 of 6 matches/,'Player tackle coverage disclosed');
 assert.match(withShots.app.innerHTML,/class="pokemon-tackle-stat"><b>12\/21<\/b>TCK/,'Jolteon tournament tackle stats displayed');
 assert.match(withShots.app.innerHTML,/class="pokemon-tackle-stat"><b>0\/0<\/b>TCK/,'Recorded zero tackles distinct from missing');
 assert.match(withShots.app.innerHTML,/Individual passes are not yet tracked by Quick Sim/,'Per-player passing limitations disclosed');
 const won=launch(true);
 assert.match(won.app.innerHTML,/CHALLENGE CHAMPION/);
 assert.match(won.app.innerHTML,/SIX WINS · CHAMPION/,'Champion summary celebrates six wins, not defeated player');
 assert.match(won.app.innerHTML,/FINAL MATCH · VS RED/);
 assert.match(won.app.innerHTML,/id="finalMatchHeading"[^>]*>VICTORY<\/h2>/);
 assert.match(won.app.innerHTML,/VS LANCE<\/span><strong>2–1<\/strong><small>WIN/,'Tournament match history uses Win from the player perspective');
 assert.equal(won.elements.runCompleteModal.open,true,'Champion completion opens results modal');
 assert.match(won.app.innerHTML,/6W · 0L/);
 assert.match(won.app.innerHTML,/6 \/ 6/);
 console.log('PASS Challenge completed-run recap, sharing, Start New Run to mode chooser, champion/defeat');
})().catch(e=>{console.error(e);process.exitCode=1});
