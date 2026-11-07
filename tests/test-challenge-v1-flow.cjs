'use strict';
/* End-to-end browser-state checks: setup -> 11 drafted picks -> held item ->
 * locked XI -> all six bosses -> local division -> share -> PNG control -> restart.
 * Deliberately deterministic match stub; actual Quick Sim is covered separately. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),allNames=['Lorelei','Bruno','Agatha','Lance','Blue','Red'];
function runCase(pool,legends){
 const storage=new Map(),elements=new Map(),bound=new Map();
 const app={innerHTML:'',querySelectorAll(sel){
  let nodes=[];
  if(sel==='[data-pick]')nodes=[...this.innerHTML.matchAll(/<button data-pick="(\d+)"([^>]*)>/g)].map(x=>({dataset:{pick:x[1]},disabled:/\bdisabled\b/.test(x[2]),onclick:null}));
  if(sel==='[data-item]')nodes=[...this.innerHTML.matchAll(/<select data-item="(\d+)"([^>]*)>/g)].map(x=>({dataset:{item:x[1]},disabled:/\bdisabled\b/.test(x[2]),value:'',onchange:null}));
  if(sel==='[data-slot]')nodes=[...this.innerHTML.matchAll(/<button data-slot="(\d+)"([^>]*)>/g)].map(x=>({dataset:{slot:x[1]},onclick:null}));
  if(sel==='[data-shop-pick]')nodes=[...this.innerHTML.matchAll(/<button type="button" data-shop-pick="([^"]+)"[^>]*>/g)].map(x=>({dataset:{shopPick:x[1]},onclick:null}));
  bound.set(sel,nodes);return nodes;
 }};
 const document={getElementById(id){
  if(id==='app')return app;
  if(!elements.has(id))elements.set(id,{id,hidden:id==='runSharePanel',value:id==='pool'?'4':id==='leg'?'off':id==='form'?'4-3-3':'',textContent:'',onclick:null,onchange:null,
   setAttribute(k,v){this[k]=v}});
  return elements.get(id)
 }};
 const ctx=vm.createContext({window:{},document,crypto:{getRandomValues(a){a[0]=49652;return a}},console,
  navigator:{},confirm:()=>true,alert:e=>{throw Error(e)},
  localStorage:{getItem:key=>storage.get(key)||null,setItem:(k,v)=>storage.set(k,v)}});
 for(const file of ['assets/js/position-effectiveness.js','assets/js/national-species.js','challenge/special-items-data.js','play/opponents.js','challenge/leaderboard.js','challenge/run-card.js']){
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file,timeout:15000});
 }
 let simulations=0;
 ctx.window.FXI_QUICK={simulate(p){
  simulations++;
  assert.equal(p.home.lineup.length,11);assert.equal(p.away.lineup.length,11);
  return {score:[3,1],stats:[{shots:14,passes:320},{shots:7,passes:260}]}
 },randomizer:()=>()=>.3};
 const html=fs.readFileSync(path.join(root,'challenge/index.html'),'utf8');
 vm.runInContext(html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>')),ctx,{filename:'challenge-inline',timeout:15000});
 const get=()=>JSON.parse(storage.get('pokefc-challenge-alpha-1'));
 if(pool===9)document.getElementById('nationalMode').onclick();
 document.getElementById('leg').value=legends?'on':'off';
 document.getElementById('start').onclick();
 assert.equal(get().phase,'draft');
 assert.equal(get().selected,9,'First default 4-3-3 pick is ST, not LW');
 assert.match(app.innerHTML,/ST POSITION/,'Selected position label starts at striker');
 let picks=0;
 while(get().phase==='draft'&&picks<12){
  const opts=bound.get('[data-pick]')||[];
  const choice=opts.find(x=>!x.disabled);
  assert(choice,'There must be an eligible Pokémon for every draft slot ('+pool+', '+legends+')');
  choice.onclick();picks++;
  if(picks===1)assert.equal(get().selected,8,'After ST, draft continues to LW');
 }
 assert.equal(picks,11,'11 picks complete');
 assert.equal(get().phase,'shop');
 assert.equal(new Set(get().roster).size,11);
 assert.equal(get().roster.filter(Boolean).length,11);
 assert.match(app.innerHTML,/data-shop-pick="Leftovers"/,'Item-first catalog includes Leftovers');
 assert.match(app.innerHTML,/id="shopTarget"/,'Pokémon dropdown is available');
 const leftovers=bound.get('[data-shop-pick]')?.find(b=>b.dataset.shopPick==='Leftovers');
 assert(leftovers?.onclick,'Leftovers remains selectable despite price-ranked catalog');
 leftovers.onclick();
 document.getElementById('shopTarget').value='0';
 document.getElementById('equipShopItem').onclick();
 assert.equal(get().items[0],'Leftovers');
 document.getElementById('lock').onclick();
 assert.equal(get().phase,'shop','Lock requires modal confirmation');
 assert.equal(document.getElementById('challengeMessageModal').open,true);
 document.getElementById('challengeMessageCancel').onclick();
 assert.equal(get().phase,'shop','Cancelling the modal preserves the shop');
 document.getElementById('lock').onclick();
 document.getElementById('challengeMessageConfirm').onclick();
 assert.equal(get().phase,'locked');
 assert.match(app.innerHTML,/aria-label="Gauntlet match controls"/,'Quick Sim/Watch controls are inside the full-width Gauntlet');
 assert(app.innerHTML.indexOf('id="play"')<app.innerHTML.indexOf('challenge-run-layout'),'Quick Sim appears before pitch columns');
 assert(app.innerHTML.indexOf('WATCH MATCH')<app.innerHTML.indexOf('challenge-run-layout'),'Watch Match appears before pitch columns');
 assert.equal((app.innerHTML.match(/id="play"/g)||[]).length,1,'Only one Quick Sim action exists');
 assert.equal((app.innerHTML.match(/WATCH MATCH/g)||[]).length,1,'Only one Watch Match action exists');
 assert.equal(get().locked.items[0],'Leftovers');
 for(let round=0;round<6;round++){
  assert.equal(get().round,round);
  document.getElementById('play').onclick();
  assert.equal(get().result.boss,allNames[round]);
  assert.equal(get().history.length,round+1);
  if(round<5){assert.equal(get().phase,'result');document.getElementById('next').onclick()}
 }
 assert.equal(simulations,6,'Six matches finished');
 assert.equal(get().phase,'finished');
 assert.equal(document.getElementById('runCompleteModal').open,true,'Finish opens modal');
 assert.equal(document.getElementById('runFinishMatchStep').hidden,false,'Final boss match displayed before recap');
 assert.equal(document.getElementById('runFinishOverviewStep').hidden,true,'Overview starts minimized');
 document.getElementById('continueTournamentOverview').onclick();
 assert.equal(document.getElementById('runFinishOverviewStep').hidden,false,'Advance to overview in same modal');
 document.getElementById('backToFinalMatch').onclick();
 assert.equal(document.getElementById('runFinishMatchStep').hidden,false,'Can return to final match in same modal');
 document.getElementById('closeRunModal').onclick();
 assert.equal(document.getElementById('runCompleteModal').open,false,'Close dismisses recap');
 document.getElementById('openRunModal').onclick();
 assert.equal(document.getElementById('runCompleteModal').open,true,'Recap can be reopened');
 assert.equal(get().history.every(x=>x.outcome==='Victory'),true);
 assert.match(app.innerHTML,/CHALLENGE CHAMPION/);
 assert.match(app.innerHTML,/id="downloadRunCard"/);
 const API=ctx.window.PFC_CHALLENGE_LEADERBOARD,cat=API.categoryOf(get());
 assert.equal(API.rankings(cat,ctx.localStorage||{getItem:k=>storage.get(k)||null}).length,1);
 assert.equal(API.rankings(cat,{getItem:k=>storage.get(k)||null})[0].champion,true);
 document.getElementById('challengeTabRankings').onclick();
 assert.match(app.innerHTML,/LEADERBOARDS/);
 assert.match(app.innerHTML,/CHAMPION RUN/);
 assert.match(app.innerHTML,/6W–0L/);
 assert.equal((app.innerHTML.match(/class="leaderboard-category/g)||[]).length,4);
 document.getElementById('lb-classic-standard').onclick();
 assert.match(app.innerHTML,pool===4&&!legends?/CHAMPION RUN/:/NO COMPLETED RUNS YET/);
 document.getElementById('challengeTabRun').onclick();
 assert.equal(get().phase,'finished');
 document.getElementById('shareRun').onclick();
 assert.equal(document.getElementById('runSharePanel').hidden,false);
 document.getElementById('startNewRun').onclick();
 assert.equal(get().phase,'setup','New Run returns to mode selection');
 assert.match(app.innerHTML,/CHOOSE YOUR CHALLENGE/,'Mode chooser shown again');
 assert.equal(get().history.length,0);
 assert.equal(API.rankings(cat,{getItem:k=>storage.get(k)||null}).length,1,'New Run keeps old local leaderboard result');
 return cat;
}
for(const [pool,legends] of [[4,false],[4,true],[9,false],[9,true]])assert(runCase(pool,legends));
console.log('PASS Challenges v1.0 full gameplay in four categories: 44 picks, 24 boss matches, equipment, leaderboard, sharing and return-to-setup');
