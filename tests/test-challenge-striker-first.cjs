'use strict';
/* Every Challenges formation drafts an available striker first and keeper last. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const src=fs.readFileSync(path.join(root,'challenge/index.html'),'utf8');
const js=src.slice(src.lastIndexOf('<script>')+8,src.lastIndexOf('</script>'));
const cases=[['4-3-3',9],['4-2-3-1',10],['4-4-2',9],['3-5-2',9],['5-3-2',9]];
for(const [formation,expectedStriker] of cases){
 let saved=null;
 const controls={};
 const bound=new Map();
 const app={html:'',set innerHTML(value){this.html=value;bound.clear()},get innerHTML(){return this.html},querySelectorAll(sel){
  if(bound.has(sel))return bound.get(sel);
  let nodes=[];
  if(sel==='[data-pick]')nodes=[...this.innerHTML.matchAll(/<button data-pick="(\d+)"([^>]*)>/g)]
    .map(x=>({dataset:{pick:x[1]},disabled:/\bdisabled\b/.test(x[2]),onclick:null}));
  bound.set(sel,nodes);return nodes;
 }};
 const doc={getElementById(id){
  if(id==='app')return app;
  return controls[id]??={id,value:id==='pool'?'4':id==='leg'?'off':id==='form'?'4-3-3':'',
   onclick:null,onchange:null,textContent:'',setAttribute(){}};
 }};
 const context=vm.createContext({window:{},document:doc,console,
  localStorage:{getItem(){return saved},setItem(k,v){saved=v}},
  crypto:{getRandomValues(a){a[0]=123447;return a}},alert(){throw Error('Native alert')}});
 for(const f of ['assets/js/position-effectiveness.js','assets/js/national-species.js','challenge/special-items-data.js','challenge/tiers.js','play/opponents.js'])
  vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),context,{filename:f,timeout:15000});
 vm.runInContext(js,context,{filename:'challenge-inline',timeout:15000});
 doc.getElementById('form').value=formation;doc.getElementById('start').onclick();
 const st=()=>JSON.parse(saved);
 assert.equal(st().phase,'draft');
 assert.equal(st().selected,expectedStriker,formation+' picks ST first');
 assert.match(app.innerHTML,/ST POSITION/,formation+' position marker starts at ST');
 const draftedSlots=[];
 let tries=0;
 while(st().phase==='draft'&&tries++<12){
  draftedSlots.push(st().selected);
  const choice=app.querySelectorAll('[data-pick]').find(x=>!x.disabled);
  assert(choice,formation+' has available eligible Pokémon');
  choice.onclick();
 }
 assert.equal(draftedSlots.length,11,formation+' drafts 11 Pokémon');
 assert.equal(draftedSlots[0],expectedStriker,formation+' starts at ST');
 assert.equal(draftedSlots.at(-1),0,formation+' picks GK last');
 assert.equal(st().phase,'shop',formation+' advances to equipment');
}
console.log('PASS every Challenges formation drafts ST first and GK last');
