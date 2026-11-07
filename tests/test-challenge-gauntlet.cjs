'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const ids=[233,6,3,9,149,94,131,143,68,135,196];
let stored=JSON.stringify({version:1,phase:'locked',pool:9,legends:false,formation:'4-3-3',tactic:'balanced',
 roster:ids,items:['Eviolite',...Array(10).fill(null)],roll:null,selected:0,rng:67932,rerollType:1,rerollGen:1,moves:1,formationChanges:1,round:0,history:[],result:null,
 locked:{roster:ids,items:['Eviolite',...Array(10).fill(null)],formation:'4-3-3',tactic:'balanced',score:75}});
const elems={};
const app={innerHTML:'',querySelectorAll:()=>[]};
const captured=[];
const context=vm.createContext({window:{},document:{getElementById:id=>id==='app'?app:(elems[id]??={value:'balanced'})},
 localStorage:{getItem:key=>key==='pokefc-challenge-alpha-1'?stored:null,setItem:(key,v)=>{if(key==='pokefc-challenge-alpha-1')stored=v}},
 crypto:{getRandomValues(a){a[0]=12345;return a}},console,confirm:()=>true,alert:e=>{throw Error(e)}});
for(const name of ['assets/js/position-effectiveness.js','assets/js/national-species.js','challenge/special-items-data.js','challenge/match-report.js','challenge/performance.js','play/opponents.js'])vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),context,{filename:name});
context.window.FXI_QUICK={simulate(preview){
 captured.push(preview);
 return {score:[2,0],stats:[{shots:8,shotsOnTarget:5,passes:320,possession:56.2},{shots:4,shotsOnTarget:2,passes:210,possession:43.8}],
 events:[
 {type:'goal',team:preview.home.id,player:preview.home.lineup[9].id,assist:preview.home.lineup[8].id,minute:16.7,minuteLabel:'17',origin:'quick-sim'},
 {type:'goal',team:preview.home.id,player:preview.home.lineup[10].id,minute:72.3,minuteLabel:'73',origin:'quick-sim'}
 ]};
 },
 randomizer:()=>()=>0.3};
const html=fs.readFileSync(path.join(root,'challenge/index.html'),'utf8');
vm.runInContext(html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>')),context,{filename:'challenge-inline',timeout:20000});
const state=()=>JSON.parse(stored);
const names=['Lorelei','Bruno','Agatha','Lance','Blue','Red'];
function assertOpponentPitch(boss,phase){
 const html=app.innerHTML;
 assert.match(html,/class="panel challenge-opponent-panel"/,'Opponent panel during '+phase);
 assert(html.includes('aria-label="'+boss.leader+' football pitch, '+boss.formation+' formation"'),'Boss formation is rendered');
 const pitch=[...html.matchAll(/data-opponent-id="(\d+)"/g)].map(x=>Number(x[1]));
 const roster=[...html.matchAll(/data-opponent-roster-id="(\d+)"/g)].map(x=>Number(x[1]));
 assert.deepEqual(pitch,Array.from(boss.roster),'Opponent pitch follows canonical fixed XI');
 assert.deepEqual(roster,Array.from(boss.roster),'Full roster follows canonical fixed XI');
 assert.equal((html.match(/class="opponent-slot-role"/g)||[]).length,11,'Eleven role labels');
 assert.equal((html.match(/class="opponent-slot-name"/g)||[]).length,11,'Eleven names');
 assert(html.includes('VIEW ALL 11 POKÉMON &amp; STATS'),'Detailed roster expander available');
 assert(html.includes('class="opponent-row-stats"'),'Scouting values visible');
}
const opponentSource=context.window.PFC_PLAY_OPPONENTS.filter(x=>x.tier!=='gym');
assert.equal(opponentSource.length,6,'Six boss XIs available');
const roleMap={
 '4-3-3':['GK','LB','CB','CB','RB','CM','CM','CM','LW','ST','RW'],
 '4-2-3-1':['GK','LB','CB','CB','RB','CDM','CDM','LW','CAM','RW','ST'],
 '4-4-2':['GK','LB','CB','CB','RB','LM','CM','CM','RM','ST','ST'],
 '3-5-2':['GK','CB','CB','CB','LWB','RWB','CM','CM','CAM','ST','ST'],
 '5-3-2':['GK','LWB','CB','CB','CB','RWB','CM','CM','CM','ST','ST']
};
const pokemonById=new Map(context.window.FXI_SPECIES.map(s=>[s.id,s]));
function independentBossRating(boss){
 return boss.roster.reduce((sum,id,i)=>{
  const species=pokemonById.get(id),stats={...species.baseStats};
  const item=boss.key==='champion-blue'&&id===18?'Pidgeotite':boss.key==='champion-red'&&id===6?'Charizardite X':boss.key==='champion-red'&&id===25?'Light Ball':null;
  if(item==='Light Ball'){stats.attack*=2;stats.spAttack*=2}
  else if(item){const form=context.window.PFC_CHALLENGE_SPECIAL.megas[id]?.find(m=>m.stone===item);assert(form,'Mega form available: '+item);Object.assign(stats,form.stats)}
  const pos=roleMap[boss.formation][i];
  return sum+context.window.PFC_POSITION_EFFECTIVENESS.preciseFit(stats,pos);
 },0)/11;
}


for(let i=0;i<6;i++){
 assert.equal(state().phase,'locked');
 assert.equal(state().round,i);
 assertOpponentPitch(opponentSource[i],'locked');
 assert.match(app.innerHTML,/aria-label="Gauntlet match controls"/,'Match controls are in Indigo Gauntlet strip');
 assert.match(app.innerHTML,/href="\.\.\/play\/\?challenge=1&amp;watch=soccerjs"/,'Challenge Watch uses 2.5D without changing the locked boss fixture');
 assert(app.innerHTML.indexOf('id="play"')<app.innerHTML.indexOf('challenge-run-layout'),'Quick Sim is above both pitches');
 assert.equal((app.innerHTML.match(/id="play"/g)||[]).length,1,'Only one Quick Sim');
 assert.equal((app.innerHTML.match(/class="challenge-watch-link"/g)||[]).length,1,'Only one Watch Match');
 assert.match(app.innerHTML,/class="panel challenge-road-strip"/,'Full-width Gauntlet road appears after XI lock');
 assert(app.innerHTML.indexOf('challenge-road-strip')<app.innerHTML.indexOf('challenge-run-layout'),'Progress renders before the two pitches');
 assert.equal((app.innerHTML.match(/<h2>ROAD TO CHAMPION/g)||[]).length,1,'No duplicate sidebar progress');
 assert.doesNotMatch(app.innerHTML,/data-slot-card="0" class="slot active /,'Keeper has no stale active-draft highlight');
 const playerRating=app.innerHTML.match(/class="team-rating home"><span>[^<]+<\/span><strong>([\d.]+)<\/strong>/);
 const opponentRating=app.innerHTML.match(/class="team-rating away"><span>[^<]+<\/span><strong>([\d.]+)<\/strong>/);
 assert(playerRating&&opponentRating,'Both clubs have team rating values after lineup lock');
 assert.equal(Number(playerRating[1]),75,'Player team shows the stored locked rating');
 assert.equal(opponentRating[1],independentBossRating(opponentSource[i]).toFixed(1),'Boss rating matches item-adjusted position-fit formula');
 assert.match(app.innerHTML,/not predicted match odds/,'Comparison is labeled as a fit rating');
 if(i===4){
  assert(app.innerHTML.includes('Pidgeotite'),'Blue Mega Pidgeot appears');
  assert(app.innerHTML.includes('data-opponent-id="18"'),'Blue Pidgeot is positioned on pitch');
 }
 if(i===5){
  assert(app.innerHTML.includes('Charizardite X'),'Red Mega Charizard appears');
  assert(app.innerHTML.includes('Light Ball'),'Red Pikachu Light Ball appears');
  assert(app.innerHTML.includes('<b>ATK</b> 110'),'Red Pikachu doubled ATK is shown on scouting sheet');
 }
 elems.play.onclick();
 assert.equal(state().history.length,i+1,'Exactly one recorded match');
 assert.equal(state().result.boss,names[i]);
 assertOpponentPitch(opponentSource[i],'post-match');
 assert.match(app.innerHTML,/id="openHistoryModal"/,'Played matches can be viewed in history modal');
 assert.match(app.innerHTML,/<dialog id="challengeHistoryModal"/,'Match history is in a modal');
 elems.openHistoryModal.onclick();
 assert.equal(elems.challengeHistoryModal.open,true,'Match-history dialog opens');
 assert.match(app.innerHTML,/PREVIOUS MATCH REPORTS/);
 elems.closeHistoryModal.onclick();
 assert.equal(elems.challengeHistoryModal.open,false,'Match-history dialog closes');
 assert.equal(state().result.report.status,'complete','Quick Sim goal ledger is persisted');
 assert(state().result.award?.name,'Player of the match is saved');
 assert.match(app.innerHTML,/PLAYER OF THE MATCH/,'Match star appears in both win and loss reports');
 assert.equal(state().result.report.goals.length,2);
 assert.equal(state().result.report.goals[0].minuteLabel,'17');
 assert.equal(state().result.report.goals[0].player,'Jolteon');
 assert.equal(state().result.report.goals[0].assist,'Machamp');
 assert.equal(state().result.report.stats.shotsOnTarget[0],5);
 assert.match(app.innerHTML,/SHOTS ON TARGET/,'Challenge match details visibly display official SOT totals');
 assert.match(app.innerHTML,/MATCH TIMELINE/);
 assert.match(app.innerHTML,/Jolteon/);
 assert.deepEqual(Array.from(state().locked.roster),ids,'Final XI remains unchanged');
 assert.equal(state().locked.items[0],'Eviolite','Items cannot be changed after lock');
 if(i<5){
  assert.equal(state().phase,'result');
  assert.match(app.innerHTML,/<dialog id="challengeMatchResultModal"/,'Advance and score live in a match result dialog');
  assert.equal(elems.challengeMatchResultModal.open,true,'Each victory automatically opens the result modal');
  assert.match(app.innerHTML,/id="openMatchResultModal"/,'Reopen result from Gauntlet progress');
  assert(app.innerHTML.indexOf('id="next"')>app.innerHTML.indexOf('id="challengeMatchResultModal"'),'Advance button is inside match result popup');
  assert.equal((app.innerHTML.match(/id="next"/g)||[]).length,1,'Only one advance action');
  elems.next.onclick();
 }else assert.equal(state().phase,'finished');
}
assert.equal(state().history.length,6);
assert.match(app.innerHTML,/CHALLENGE CHAMPION/);
assert.match(app.innerHTML,/<dialog id="runCompleteModal"/,'Champion results are modal');
assert.equal(elems.runCompleteModal.open,true,'Completed six-boss run auto-opens results');
assert.equal(elems.runFinishMatchStep.hidden,false,'Final match details are the first modal view');
assert.equal(elems.runFinishOverviewStep.hidden,true,'Tournament recap stays hidden until Continue');
assert.match(app.innerHTML,/id="continueTournamentOverview"/);
elems.continueTournamentOverview.onclick();
assert.equal(elems.runFinishMatchStep.hidden,true,'Continue hides the final match');
assert.equal(elems.runFinishOverviewStep.hidden,false,'Continue reveals tournament stats in the same dialog');
elems.backToFinalMatch.onclick();
assert.equal(elems.runFinishMatchStep.hidden,false,'Back shows the final match again');
assert.equal(captured.length,6);
assert(captured.every(p=>p.home.lineup.length===11&&p.away.lineup.length===11));
const blue=captured[4].away.lineup.find(p=>p.name==='Mega Pidgeot');
const redPikachu=captured[5].away.lineup.find(p=>p.name==='Pikachu');
assert(blue&&redPikachu);
assert.match(app.innerHTML,/TOURNAMENT STATS/,'Champion recap includes tournament stats');
assert.equal((app.innerHTML.match(/class="tournament-pokemon(?: tournament-top-player)?"/g)||[]).length,11,'All 11 starter sprites get tournament stats');
assert.match(app.innerHTML,/BEST PLAYER OF THE TOURNAMENT/);
assert(blue.pokemonStats.spAttack>40,'Blue Mega Pidgeot');
assert(redPikachu.pokemonStats.attack===110,'Red Light Ball Pikachu boost');
console.log('PASS six-boss National Challenge gauntlet, fixed opponents, locked XI, champion and boss items');
