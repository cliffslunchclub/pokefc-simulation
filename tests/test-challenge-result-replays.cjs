'use strict';
/* Result replays must be visible after Watch→Sim leaves the old viewer and
 * must never recalculate, record or overwrite the authoritative PSE result. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const roster=[233,6,3,9,149,94,131,143,68,135,196];
function fixture(){
 const home={id:'challenger',lineup:Array.from({length:11},(_,i)=>({id:'home-'+i,name:i===9?'Charizard':'Home '+i,speciesId:i+1,pos:i===0?'GK':'MID'}))};
 const away={id:'e4-lorelei',lineup:Array.from({length:11},(_,i)=>({id:'away-'+i,name:'Away '+i,speciesId:i+20,pos:i===0?'GK':'MID'}))};
 const result={origin:'quick-sim',home:home.id,away:away.id,score:[1,0],
  stats:[{goals:1,shots:1,shotsOnTarget:1,passes:200},{goals:0,shots:0,shotsOnTarget:0,passes:190}],
  events:[{type:'goal',minute:22.5,team:home.id,player:'home-9'}]};
 return {preview:{home,away},result};
}
function setup({withReplay=true,shootout=false}={}){
 const replay=fixture();
 if(shootout)replay.result.shootout={version:'pse-shootout-v1',
  attempts:[{side:'home',kickerId:'home-9',scored:true,outcome:'goal'}]};
 const match={boss:'Lorelei',round:1,seed:'challenge:123:0',score:[1,0],outcome:'Victory',
  origin:'quick-sim',report:{status:'complete',score:[1,0],
   goals:[{side:0,minute:22.5,minuteLabel:'23',player:'Charizard'}],
   timeline:[{type:'goal',side:0,minute:22.5,minuteLabel:'23',player:'Charizard'}],
   stats:{shots:[1,0],passes:[200,190]}}};
 if(withReplay)match.replay={version:1,...replay};
 const state={version:1,phase:'finished',pool:4,legends:true,formation:'4-3-3',tactic:'press',
  roster:roster.slice(),items:Array(11).fill(null),selected:0,roll:null,rng:123,
  rerollType:0,rerollGen:0,moves:0,formationChanges:0,round:0,
  history:[match],result:match,locked:{roster:roster.slice(),items:Array(11).fill(null),formation:'4-3-3',tactic:'press',score:72.9}};
 let stored=JSON.stringify(state),writes=0,mounts=0,destroys=0,records=0;
 const played=[],seeks=[],buttons=[],els=new Map();
 const app={markup:'',get innerHTML(){return this.markup},set innerHTML(x){this.markup=x},
  querySelectorAll(sel){
   if(sel!=='[data-match-replay]')return [];
   buttons.length=0;
   for(const m of this.markup.matchAll(/<button[^>]+data-match-replay="(\d+)" data-replay-id="([^"]+)"/g)){
    buttons.push({dataset:{matchReplay:m[1],replayId:m[2]},onclick:null});
   }
   return buttons;
  }};
 const doc={getElementById(id){
  if(id==='app')return app;
  if(!els.has(id))els.set(id,{id,open:false,hidden:false,textContent:'',
   style:{},onclick:null,setAttribute(){},removeAttribute(){},
   show(){this.open=true},showModal(){this.open=true},close(){this.open=false;this.onclose?.()}});
  return els.get(id);
 }};
 const bridge={mountInline(options){
  mounts++;
  assert.equal(options.autoRecordOnSimToEnd,undefined,'Read-only viewer must not opt in to auto-record');
  assert.equal(options.result.origin,'quick-sim');
  assert.equal(JSON.stringify(options.result),JSON.stringify(replay.result),'Use the saved PSE event ledger');
  const session={
   seek(minute){seeks.push(minute);return true},
   simToEnd(){options.onProgress({finished:true});return true},
   replayHighlight(id){played.push(id);return true},
   destroy(){destroys++}
  };
  options.onReady(session);
  return session;
 }};
 const win={FXI_PHASE10_WATCH:bridge};
 const ctx=vm.createContext({window:win,document:doc,console,localStorage:{
   getItem:k=>k==='pokefc-challenge-alpha-1'?stored:null,
   setItem(k,v){writes++;if(k==='pokefc-challenge-alpha-1')stored=v}
  },crypto:{getRandomValues(a){a[0]=123}},navigator:{},confirm:()=>true,alert:e=>{throw Error(e)}});
 for(const file of ['assets/js/position-effectiveness.js','assets/js/national-species.js','assets/js/calibration-profile.js','assets/js/quick-sim.js','challenge/special-items-data.js',
   'challenge/tiers.js','challenge/match-report.js','challenge/performance.js','play/opponents.js']){
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file,timeout:20000});
 }
 const html=fs.readFileSync(path.join(root,'challenge/index.html'),'utf8');
 assert.match(html,/src="\.\.\/watch\/soccerjs\/watch-bridge\.js\?v=\d+"/,'Result screen loads Soccer-JS bridge');
 vm.runInContext(html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>')),
  ctx,{filename:'challenge-inline',timeout:20000});
 return {app,buttons,els,played,seeks,replay,stored:()=>stored,
  writes:()=>writes,mounts:()=>mounts,destroys:()=>destroys,records:()=>records};
}
const playable=setup();
assert.match(playable.app.innerHTML,/GOAL REPLAYS/,'Result screen exposes replay controls for authentic goals');
assert.match(playable.app.innerHTML,/data-replay-id="goal-0"/,'Goal clip ID maps to official chronological ledger');
assert.match(playable.app.innerHTML,/id="challengeGoalReplayModal"/,'Replay player is attached to results screen');
const initial=playable.stored(),writeCount=playable.writes();
const goal=playable.buttons.find(b=>b.dataset.replayId==='goal-0');
assert(goal?.onclick,'Result goal replay button receives a click handler');
goal.onclick();
assert.deepEqual(playable.played,['goal-0'],'Read-only player launches selected goal');
assert.deepEqual(playable.seeks,[90],'Goal replay seeks within saved fixture, not a new simulation');
assert.equal(playable.els.get('challengeGoalReplayModal').open,true);
assert.equal(playable.stored(),initial,'Goal replay never changes run progress or saved result');
assert.equal(playable.writes(),writeCount,'Goal replay never writes to localStorage');
playable.els.get('closeGoalReplayModal').onclick();
assert.equal(playable.destroys(),1,'Closing the replay releases the embedded viewer');
assert.equal(playable.els.get('challengeGoalReplayModal').open,false);
const penalties=setup({shootout:true});
const kick=penalties.buttons.find(b=>b.dataset.replayId==='pk-0');
assert(kick?.onclick,'Recorded PSE shootout attempts are replayable');
const original=penalties.stored();
kick.onclick();
assert.deepEqual(penalties.played,['pk-0'],'Penalty kick replay plays after the final shootout frame');
assert.equal(penalties.stored(),original,'Penalty replay also leaves official result unchanged');
const legacy=setup({withReplay:false});
assert.doesNotMatch(legacy.app.innerHTML,/data-replay-id=/,'Historical saves without fixture data do not invent replays');
console.log('PASS Challenges result goal/penalty highlights: saved PSE snapshots, read-only viewer, modal cleanup and legacy safety');
