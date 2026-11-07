'use strict';
/* Modal regressions: no native browser dialogs, explicit destructive confirmation,
 * error notices, copied-text fallback, and result modal close/reopen. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'challenge/index.html'),'utf8');
const inline=html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>'));
assert.match(html,/<dialog id="challengeMessageModal"/,'Branded shared alert/confirm dialog');
assert.match(html,/<dialog id="runCompleteModal"|runCompleteModal/,'Completed-run dialog template');
assert.doesNotMatch(inline,/\b(?:window\.)?(?:alert|confirm|prompt)\s*\(/,'No blocking browser popups');

const roster=[233,6,3,9,149,94,131,143,68,135,196];
const shopState=()=>({version:1,phase:'shop',pool:4,legends:false,formation:'4-3-3',tactic:'balanced',
 roster:roster.slice(),items:Array(11).fill(null),roll:null,selected:0,rng:1589,rerollType:1,rerollGen:1,moves:1,formationChanges:1,round:0,history:[],result:null,locked:null});
function launch(initial){
 let saved=JSON.stringify(initial),shown=0,nativeCalled=0,selected=0;
 const elements={},app={innerHTML:'',querySelectorAll(){return []}};
 const doc={getElementById(id){
  if(id==='app')return app;
  if(!elements[id])elements[id]={id,value:'',hidden:false,textContent:'',onclick:null,onclose:null,
   setAttribute(k,v){this[k]=v},removeAttribute(k){delete this[k]},classList:{toggle(){}},
   showModal(){shown++;this.open=true},close(){this.open=false;this.onclose?.()},select(){selected++}};
  return elements[id];
 }};
 const context=vm.createContext({window:{},document:doc,
  localStorage:{getItem:k=>k==='pokefc-challenge-alpha-1'?saved:null,setItem(k,v){if(k==='pokefc-challenge-alpha-1')saved=v}},
  crypto:{getRandomValues(a){a[0]=1589;return a}},navigator:{},console,
  confirm(){nativeCalled++;throw Error('native confirm forbidden')},
  alert(){nativeCalled++;throw Error('native alert forbidden')}});
 for(const name of ['assets/js/position-effectiveness.js','assets/js/national-species.js','assets/js/calibration-profile.js','challenge/special-items-data.js','challenge/tiers.js','play/opponents.js']){
  vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),context,{filename:name,timeout:15000});
 }
 vm.runInContext(inline,context,{filename:'challenge-inline',timeout:15000});
 return {app,elements,context,get:()=>JSON.parse(saved),shown:()=>shown,native:()=>nativeCalled,selected:()=>selected};
}
const game=launch(shopState());
game.elements.lock.onclick();
assert.equal(game.get().phase,'shop','Lock modal does not immediately mutate the run');
assert.equal(game.elements.challengeMessageModal.open,true,'Lock dialog opened');
assert.equal(game.elements.challengeMessageTitle.textContent,'LOCK FINAL XI?');
game.elements.challengeMessageCancel.onclick();
assert.equal(game.get().phase,'shop','Cancel preserves squad');
assert.equal(game.elements.challengeMessageModal.open,false);
game.elements.lock.onclick();
game.elements.challengeMessageConfirm.onclick();
assert.equal(game.get().phase,'locked','Explicit confirmation locks XI');
assert.equal(game.elements.challengeMessageModal.open,false);
game.elements.play.onclick();
assert.equal(game.get().phase,'locked','Missing Quick Sim does not alter saved run');
assert.equal(game.elements.challengeMessageTitle.textContent,'QUICK SIM ERROR');
assert.equal(game.elements.challengeMessageModal.open,true,'Simulation error appears in in-game modal');
game.elements.challengeMessageConfirm.onclick();
game.elements.reset.onclick();
assert.equal(game.get().phase,'locked','Reset is not immediate');
assert.equal(game.elements.challengeMessageModal.open,true,'Abandon confirmation appears');
game.elements.challengeMessageCancel.onclick();
assert.equal(game.get().phase,'locked','Abandon cancel preserves locked run');
game.elements.reset.onclick();
game.elements.challengeMessageConfirm.onclick();
assert.equal(game.get().phase,'setup','Abandon confirmation resets the run');
assert.equal(game.native(),0,'No native JS alert/confirm invoked');

const lost=shopState();
const match={boss:'Lorelei',round:1,score:[1,2],outcome:'Defeat',origin:'quick-sim'};
lost.phase='finished';lost.round=0;lost.history=[match];lost.result=match;
lost.locked={roster:lost.roster.slice(),items:lost.items.slice(),formation:'4-3-3',tactic:'balanced',score:65.2};
const ended=launch(lost);
assert.equal(ended.elements.runCompleteModal.open,true,'Completed run auto-opens result dialog');
ended.elements.closeRunModal.onclick();
assert.equal(ended.elements.runCompleteModal.open,false,'Close dismisses result dialog');
ended.elements.openRunModal.onclick();
assert.equal(ended.elements.runCompleteModal.open,true,'Completed result can be reopened');
ended.elements.copyRunSummary.onclick();
assert.equal(ended.elements.challengeMessageTitle.textContent,'COPY RUN SUMMARY','Clipboard fallback uses modal');
assert.equal(ended.elements.challengeMessageCopy.hidden,false);
assert.match(ended.elements.challengeMessageCopy.value,/TEAM SCORE: 65\.2/);
assert(ended.selected()>0,'Manual-copy textarea is selected');
assert.equal(ended.native(),0);
console.log('PASS branded Challenge modals: confirm/cancel lock and reset, simulated error, run results, manual copy fallback');
