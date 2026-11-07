'use strict';
/* Challenge continuity after removing explicit manual Save/Load UI. Verify that
 * automatic active-run persistence, old snapshots, and historical leaderboards
 * remain intact, and that the home Challenge Card shows top archived scores. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'challenge/index.html'),'utf8');
const inline=html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>'));
const css=fs.readFileSync(path.join(root,'challenge/challenge.css'),'utf8');
const ACTIVE_KEY='pokefc-challenge-alpha-1',SLOT_KEY='pokefc-challenge-manual-saves-v1';
const divisions=[
 ['classic-standard',4,false],
 ['classic-legends',4,true],
 ['national-standard',9,false],
 ['national-legends',9,true]
];
const roster=[6,3,9,94,25,131,143,68,135,65,149];
function fixture(pool,legends,rng,phase='shop'){
 const run={
  version:1,phase,pool,legends,formation:'4-3-3',tactic:'balanced',
  roster:roster.slice(),items:Array(11).fill(null),roll:null,rollHistory:['1:fire'],
  selected:9,rng,rerollType:1,rerollGen:1,moves:1,formationChanges:1,
  locked:null,result:null,round:0,history:[]
 };
 if(phase==='locked')run.locked={
  roster:run.roster.slice(),items:run.items.slice(),formation:run.formation,
  tactic:run.tactic,score:65
 };
 return run;
}
function launch(storage,initial){
 if(initial)storage.set(ACTIVE_KEY,JSON.stringify(initial));
 const elements=new Map(),app={innerHTML:'',querySelectorAll(){return []}};
 const document={getElementById(id){
  if(id==='app')return app;
  if(!elements.has(id))elements.set(id,{
   id,value:'',textContent:'',hidden:false,disabled:false,open:false,onclick:null,
   className:'',scrollTop:0,style:{setProperty(){},removeProperty(){}},
   classList:{toggle(){}},
   setAttribute(k,v){if(k==='open')this.open=true;else this[k]=v},
   removeAttribute(k){if(k==='open')this.open=false;else delete this[k]},
   show(){this.open=true},showModal(){this.open=true},close(){this.open=false;if(this.onclose)this.onclose()},
   addEventListener(){},querySelectorAll(){return []}
  });
  return elements.get(id);
 }};
 const env={window:{},document,localStorage:{
  getItem:k=>storage.get(k)||null,
  setItem(k,v){storage.set(k,v)}
 },navigator:{},console,
 crypto:{getRandomValues(a){a[0]=87321;return a}},
 alert(){throw Error('Browser alert forbidden')},
 confirm(){throw Error('Browser confirm forbidden')}
 };
 const ctx=vm.createContext(env);
 for(const file of ['assets/js/position-effectiveness.js','assets/js/national-species.js','assets/js/calibration-profile.js','challenge/special-items-data.js','challenge/tiers.js','play/opponents.js','challenge/leaderboard.js']){
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file,timeout:15000});
 }
 vm.runInContext(inline,ctx,{filename:'challenge-inline',timeout:15000});
 const get=id=>document.getElementById(id);
 const state=()=>JSON.parse(storage.get(ACTIVE_KEY));
 const slots=()=>JSON.parse(storage.get(SLOT_KEY)||'{}');
 return {get,state,slots,storage,app,ctx};
}

const archived={
 'classic-standard':[{id:'classic-standard-old',champion:false,wins:4,teamScore:69.2}],
 'classic-legends':[
  {id:'classic-legends-champ',champion:true,wins:6,teamScore:77.3},
  {id:'classic-legends-other',champion:false,wins:4,teamScore:72.1}
 ],
 'national-standard':[],
 'national-legends':[{id:'national-legends-champ',champion:true,wins:6,teamScore:88.8}]
};
const manualLegacy={
 'classic-standard':{version:1,savedAt:'2026-11-05T01:00:00.000Z',state:fixture(4,false,44444)}
};
const storage=new Map([
 [SLOT_KEY,JSON.stringify(manualLegacy)],
 ['pokefc-challenge-local-runs-v1',JSON.stringify(archived)],
 ['pokefc-challenge-personal-records-v1',JSON.stringify({
  'classic-standard':{attempts:4,best:4,champions:0},
  'classic-legends':{attempts:13,best:6,champions:1},
  'national-standard':{attempts:1,best:4,champions:0},
  'national-legends':{attempts:7,best:6,champions:1}
 })]
]);
const beforeManual=storage.get(SLOT_KEY),beforeHistory=storage.get('pokefc-challenge-local-runs-v1');
const active=launch(storage,fixture(4,true,271828,'shop'));
assert.equal(active.state().rng,271828,'Current run auto-resumes deterministically');
assert.equal(active.state().phase,'shop','Current phase remains intact');
assert.equal(active.state().roster.length,11,'XI remains intact');
assert.equal(active.state().pool,4);
const again=launch(storage);
assert.equal(again.state().rng,271828,'Auto-progress survives browser refresh without manual Save');
assert.equal(again.state().phase,'shop','Auto-progress restores original stage');
assert.equal(again.state().legends,true);
assert.equal(storage.get(SLOT_KEY),beforeManual,'Removing Save/Load UI does not delete legacy user snapshots');
assert.equal(storage.get('pokefc-challenge-local-runs-v1'),beforeHistory,'Completed leaderboard records remain intact');

const setup=launch(storage,{...fixture(4,false,9277),phase:'setup',roster:Array(11).fill(null)});
assert.match(setup.app.innerHTML,/CHOOSE YOUR CHALLENGE/);
assert.match(setup.app.innerHTML,/TOP TEAM SCORE/,'All four division cards show a top score field');
assert.match(setup.app.innerHTML,/77\.3/,'Classic Legends displays best archived XI score');
assert.match(setup.app.innerHTML,/88\.8/,'National Legends displays best archived XI score');
assert.match(setup.app.innerHTML,/69\.2/,'Classic Standard displays best archived XI score');
assert.match(setup.app.innerHTML,/TOP TEAM SCORE<\/small><\/strong>/,'Score label has accessible visible text');
assert.match(setup.app.innerHTML,/13 runs · 1 champions/,'Existing run and champion totals still display');
assert.doesNotMatch(setup.app.innerHTML,/MANUAL SAVE|LOAD SAVED RUN|SAVE RUN/,'No manual save controls appear');

assert.doesNotMatch(html,/id="saveChallengeSlot"|id="loadChallengeSlot"|id="challengeSaveLoadModal"|id="challengeSaveStatus"/,
 'Manual Save/Load buttons and dialog are removed from document');
assert.doesNotMatch(inline,/MANUAL_SAVE_KEY|readManualSaves|validManualSave|saveChallengeSnapshot|loadChallengeSnapshot|wireManualSaveControls/,
 'Removed manual snapshot handlers rather than leaving unusable hidden controls');
assert.doesNotMatch(css,/\.challenge-save-toolbar|\.challenge-save-slot-grid/,'Unused manual save CSS removed');
assert.match(css,/\.challenge-record-metrics/,'New score and win record layout present');
const cssCacheVersion=Number(html.match(/challenge\.css\?v=(\d+)/)?.[1]);
assert(Number.isInteger(cssCacheVersion)&&cssCacheVersion>=33,
 'All Challenges UI updates use a refreshed stylesheet cache version');
assert.doesNotMatch(inline,/\b(?:window\.)?(?:alert|confirm|prompt)\s*\(/,'No native popup methods used');
console.log('PASS Challenges: automatic run resume, legacy snapshots untouched, leaderboard records retained, top team scores and no manual Save/Load UI');
