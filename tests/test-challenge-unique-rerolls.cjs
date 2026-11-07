'use strict';
/* Challenge rerolls never repeat a scouting pair seen earlier this run.
 * Empty candidate lists preserve the reroll credit and disable the control. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(root,'challenge/index.html'),'utf8');
const inline=css.slice(css.lastIndexOf('<script>')+8,css.lastIndexOf('</script>'));
const base=()=>({
 version:1,phase:'draft',pool:4,legends:false,formation:'4-3-3',tactic:'balanced',
 roster:Array(11).fill(null),items:Array(11).fill(null),selected:9,rng:32007,
 rerollType:1,rerollGen:1,moves:1,formationChanges:1,roll:{gen:1,type:'normal'},rollHistory:['1:normal'],
 locked:null,result:null,round:0,history:[]
});
function launch(seed){
 let stored=JSON.stringify(seed),cache={};
 const app={html:'',set innerHTML(value){this.html=value;cache={}},get innerHTML(){return this.html},
  querySelectorAll(sel){
   if(cache[sel])return cache[sel];
   const nodes=sel==='[data-pick]'?[...this.html.matchAll(/<button data-pick="(\d+)"([^>]*)>/g)]
    .map(m=>({dataset:{pick:m[1]},disabled:/\bdisabled\b/.test(m[2]),onclick:null})):[];
   return cache[sel]=nodes;
  }};
 const elements={};
 const document={getElementById(id){
  return id==='app'?app:(elements[id]??={id,value:'',textContent:'',onclick:null,onchange:null,disabled:false,
   setAttribute(){},removeAttribute(){}});
 }};
 const win={};
 const ctx=vm.createContext({window:win,document,console,
  localStorage:{getItem(){return stored},setItem(_k,v){stored=v}},
  crypto:{getRandomValues(a){a[0]=32007;return a}},alert:()=>{},confirm:()=>true});
 for(const file of ['assets/js/position-effectiveness.js','assets/js/national-species.js','challenge/special-items-data.js','challenge/tiers.js','play/opponents.js'])
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file,timeout:20000});
 vm.runInContext(inline,ctx,{filename:'challenge-inline',timeout:20000});
 return {app,elements,state:()=>JSON.parse(stored)};
}
const typeRun=launch(base());
assert.match(typeRun.app.innerHTML,/reroll-unique-note/);
assert.doesNotMatch(typeRun.app.innerHTML,/<button id="typeR" disabled/);
typeRun.elements.typeR.onclick();
const typeState=typeRun.state();
assert.equal(typeState.rerollType,0);
assert.equal(typeState.rerollGen,1);
assert.equal(typeState.roll.gen,1,'Type reroll preserves the generation');
assert.notEqual(typeState.roll.type,'normal','Type reroll changes the type');
assert.equal(typeState.rollHistory.length,2);
assert.equal(typeState.rollHistory[1],typeState.roll.gen+':'+typeState.roll.type);
assert.equal(new Set(typeState.rollHistory).size,typeState.rollHistory.length,'No duplicate scouting combinations');

const genRun=launch(base());
genRun.elements.genR.onclick();
const genState=genRun.state();
assert.equal(genState.rerollGen,0,'Successful generation reroll costs one credit');
assert.equal(genState.rerollType,1);
assert.equal(genState.roll.type,'normal','Generation reroll preserves the type');
assert.notEqual(genState.roll.gen,1,'Generation reroll switches region');
assert.equal(new Set(genState.rollHistory).size,2);

const seen=base();
const allTypes=['normal','fire','water','grass','electric','ice','fighting','poison','ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy'];
seen.rollHistory=allTypes.map(type=>'1:'+type).concat(['2:normal','3:normal','4:normal']);
const exhausted=launch(seen);
assert.match(exhausted.app.innerHTML,/<button id="typeR" disabled/,'Unavailable unique type options disable reroll');
assert.match(exhausted.app.innerHTML,/<button id="genR" disabled/,'Unavailable unique generation options disable reroll');
exhausted.elements.typeR.onclick();exhausted.elements.genR.onclick();
assert.equal(exhausted.state().rerollType,1,'Exhausted type options do not consume a credit');
assert.equal(exhausted.state().rerollGen,1,'Exhausted generation options do not consume a credit');
assert.deepEqual(exhausted.state().roll,{gen:1,type:'normal'},'Exhausted rerolls do not return the same selection');

const draft=launch(base());
const first=draft.app.querySelectorAll('[data-pick]').find(x=>!x.disabled);
assert(first?.onclick,'Draft pick available');
first.onclick();
const afterDraft=draft.state();
assert(afterDraft.roll&&afterDraft.rollHistory.length>=2,'Next scouting draw recorded');
assert.notEqual(afterDraft.roll.gen+':'+afterDraft.roll.type,'1:normal','Automatic scouting draws avoid previously seen pairs where possible');
console.log('PASS unique scout rerolls: type and generation change, never repeat prior pairs, no consumed credit when exhausted, saved history and fresh auto-draws');
