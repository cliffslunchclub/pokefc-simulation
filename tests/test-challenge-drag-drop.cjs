'use strict';
/* Live Challenge UI + Drag Drop regression. Tests native drag and touch grip paths. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const roster=[233,6,9,94,25,1,2,3,4,5,7];
const initial=(phase='shop')=>({version:1,phase,pool:4,legends:false,formation:'4-3-3',tactic:'balanced',
 roster:phase==='draft'?[233,...Array(10).fill(null)]:roster.slice(),
 items:Array(11).fill(null),roll:phase==='draft'?{gen:1,type:'fire'}:null,
 selected:phase==='draft'?1:0,rng:321345,rerollType:1,rerollGen:1,moves:1,formationChanges:1,
 locked:null,result:null,round:0,history:[]});
function launch(seed){
 let stored=JSON.stringify(seed),target=null,ghosts=0,lastGhost=null,lastDragImage=null;
 const listeners={},controls={};
 const cls=()=>({add(){},remove(){},toggle(){},contains(){return false}});
 const app={
  html:'',nodes:{},set innerHTML(str){
   this.html=str;this.nodes={};
   const thisApp=this;
   const make=(sel,regex,fn)=>{this.nodes[sel]=[...str.matchAll(regex)].map(fn)};
   make('[data-slot-card]',/data-slot-card="(\d+)" class="([^"]+)"/g,m=>({
    dataset:{slotCard:m[1]},className:m[2],classList:cls(),draggable:false,
    querySelector(){const id=JSON.parse(stored).roster[Number(m[1])];
     return id?{src:'https://sprites.example/pokemon/'+id+'.png',width:35,height:35,
      getBoundingClientRect(){return {width:35,height:35}}}:null}
   }));
   make('[data-slot]',/data-slot="(\d+)"/g,m=>({dataset:{slot:m[1]},classList:cls()}));
   make('[data-shop-pick]',/data-shop-pick="([^"]+)"/g,m=>({
    dataset:{shopPick:m[1]},classList:cls(),draggable:false,
    querySelector(){const slug=m[1].toLowerCase().replace(/[^a-z0-9]+/g,'-');
     return {src:'https://sprites.example/items/'+slug+'.png',width:29,height:29,
      getBoundingClientRect(){return {width:29,height:29}}}}
   }));
   make('[data-shop-clear]',/data-shop-clear="(\d+)"/g,m=>({dataset:{shopClear:m[1]},classList:cls()}));
   make('[data-species-id]',/data-species-id="(\d+)"/g,m=>({
    dataset:{speciesId:m[1]},classList:cls(),draggable:false,
    querySelector(){return{src:'https://sprites.example/pokemon/'+m[1]+'.png',
     width:49,height:49,getBoundingClientRect(){return {width:49,height:49}}}}
   }));
   make('[data-pick]',/data-pick="(\d+)"/g,m=>({dataset:{pick:m[1]},classList:cls(),closest(){return null}}));
   make('[data-held-item-source]',/data-held-item-source="(\d+)"/g,m=>({dataset:{heldItemSource:m[1]},classList:cls(),draggable:false}));
   make('[data-drag-grip]',/data-drag-grip="([^"]+)" data-drag-value="([^"]+)"/g,m=>({
    dataset:{dragGrip:m[1],dragValue:m[2]},classList:cls(),
    closest(){return m[1]==='candidate'?thisApp.querySelectorAll('[data-species-id]').find(x=>x.dataset.speciesId===m[2]):
      m[1]==='pokemon'?thisApp.querySelectorAll('[data-slot-card]').find(x=>x.dataset.slotCard===m[2]):
      m[1]==='item'?thisApp.querySelectorAll('[data-shop-pick]').find(x=>x.dataset.shopPick===m[2]):null}
   }));
  },get innerHTML(){return this.html;},
  querySelectorAll(sel){return this.nodes[sel]||[]}
 };
 const doc={
  body:{appendChild(ghost){ghosts++;lastGhost=ghost}},
  createElement(tag){return{tagName:tag,style:{},remove(){},classList:cls()}},
  elementFromPoint(){return target},
  getElementById(id){
   if(id==='app')return app;
   if(!controls[id])controls[id]={id,value:'',textContent:'',hidden:false,classList:cls(),setAttribute(){},removeAttribute(){},open:false,onclick:null};
   return controls[id];
  }
 };
 const win={
  addEventListener(type,fn){listeners[type]=fn},
  removeEventListener(type,fn){if(listeners[type]===fn)delete listeners[type]},
  innerHeight:900,
  scrollBy(){},
  matchMedia(){return{matches:true}}
 };
 const context=vm.createContext({window:win,document:doc,
  localStorage:{getItem(){return stored},setItem(_k,v){stored=v}},
  crypto:{getRandomValues(a){a[0]=321345;return a}},
  console,alert:e=>{throw Error(e)},confirm:()=>true});
 for(const file of ['assets/js/position-effectiveness.js','assets/js/national-species.js','assets/js/calibration-profile.js','assets/js/quick-sim.js','challenge/special-items-data.js','challenge/tiers.js','challenge/drag-drop.js','play/opponents.js']){
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file,timeout:15000});
 }
 const html=fs.readFileSync(path.join(root,'challenge/index.html'),'utf8');
 vm.runInContext(html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>')),context,{filename:'challenge-inline',timeout:15000});
 const state=()=>JSON.parse(stored);
 const node=(selector,value,key)=>app.querySelectorAll(selector).find(n=>n.dataset[key]===String(value));
 const start=(source)=>{
  assert(source?.ondragstart,'Expected draggable source');
  lastDragImage=null;
  source.ondragstart({dataTransfer:{setData(){},effectAllowed:'',setDragImage(img,x,y){lastDragImage={img,x,y}}},stopPropagation(){},preventDefault(){throw Error('Unexpected drag prevention')}});
  return lastDragImage;
 };
 const drop=i=>{
  const t=node('[data-slot-card]',i,'slotCard');
  assert(t?.ondrop,'Expected pitch drop target');
  t.ondragover({preventDefault(){},dataTransfer:{}});
  t.ondrop({preventDefault(){},stopPropagation(){}});
 };
 return {app,doc,win,listeners,controls,state,node,start,drop,
  setTarget(i){const spot=node('[data-slot-card]',i,'slotCard');target={closest(){return spot}}},
  ghosts:()=>ghosts,lastGhost:()=>lastGhost};
}
const shop=launch(initial());
assert.match(shop.app.innerHTML,/data-drag-grip="item"/);
assert.match(shop.app.innerHTML,/data-drag-grip="pokemon"/);
assert.match(shop.app.innerHTML,/DRAG &amp; DROP POKÉMON/,'Visible Pokémon drag hint by the pitch');
assert.match(shop.app.innerHTML,/sprites\/items\/leftovers\.png/,'Item shop uses item images');
const itemPreview=shop.start(shop.node('[data-shop-pick]','Leftovers','shopPick'));
assert.match(itemPreview.img.src,/\/items\/leftovers\.png$/,'Native item drag uses item icon');
assert.equal(itemPreview.x,15);assert.equal(itemPreview.y,15);
shop.drop(0);
assert.equal(shop.state().items[0],'Leftovers','Drop equips item onto occupied Porygon2');
shop.start(shop.node('[data-shop-pick]','Leftovers','shopPick'));
shop.drop(5);
assert.equal(shop.state().items[0],null,'Unique item removed from former holder');
assert.equal(shop.state().items[5],'Leftovers','Item transferred to new Pokémon');
shop.start(shop.node('[data-shop-pick]','Eviolite','shopPick'));
shop.drop(1);
assert.equal(shop.state().items[1],null,'Incompatible item does not equip on Charizard');
assert.match(shop.app.innerHTML,/not compatible/,'Drop error is visible');
shop.start(shop.node('[data-shop-pick]','Eviolite','shopPick'));
shop.drop(0);
assert.equal(shop.state().items[0],'Eviolite');
const pitchPreview=shop.start(shop.node('[data-slot-card]',0,'slotCard'));
assert.match(pitchPreview.img.src,/\/233\.png$/,'Dragging a drafted Pokémon displays its sprite, not a card');
assert.equal(pitchPreview.x,18,'Desktop Pokémon sprite is centered under the cursor');
assert.equal(pitchPreview.y,18);
shop.drop(1);
assert.equal(shop.state().roster[1],233,'Pokémon swaps positions');
assert.equal(shop.state().items[1],'Eviolite','Held item stays with moved Pokémon');
assert.equal(shop.state().items[0],null,'Former slot no longer holds Eviolite');
assert.equal(shop.state().moves,0,'Swap consumes exactly the existing one-time move');
const mouseItem=launch(initial());
const itemCard=mouseItem.node('[data-shop-pick]','Leftovers','shopPick');
assert.equal(typeof itemCard.onpointerdown,'function','Entire item card supports pointer dragging on desktop');
mouseItem.setTarget(7);
itemCard.onpointerdown({pointerType:'mouse',button:0,clientX:120,clientY:240,cancelable:true,preventDefault(){}});
assert.equal(mouseItem.lastGhost().tagName,'img','Desktop item pointer ghost uses item sprite');
mouseItem.listeners.pointermove({clientX:130,clientY:250,cancelable:true,preventDefault(){}});
mouseItem.listeners.pointerup({clientX:130,clientY:250});
assert.equal(mouseItem.state().items[7],'Leftovers','Dragging item card with mouse equips target');
assert.equal(shop.node('[data-slot-card]',1,'slotCard').draggable,false,'No additional moves draggable');

const touch=launch(initial());
const grip=touch.node('[data-drag-grip]','Leftovers','dragValue');
assert(grip?.onpointerdown,'Touch grip available');
touch.setTarget(3);
grip.onpointerdown({pointerType:'touch',clientX:70,clientY:300,cancelable:true,preventDefault(){}});
assert.equal(touch.ghosts(),1,'Touch drag creates floating preview');
assert.equal(touch.lastGhost().tagName,'img','Touch item uses item sprite');
assert.match(touch.lastGhost().src,/\/items\/leftovers\.png$/);
touch.listeners.pointerup({clientX:70,clientY:300});
assert.equal(touch.state().items[3],'Leftovers','Touch release equips item');

const draft=launch(initial('draft'));
assert(draft.node('[data-species-id]',6,'speciesId'),'Charizard visible in Gen I fire roll');
const draftPreview=draft.start(draft.node('[data-species-id]',6,'speciesId'));
assert.match(draftPreview.img.src,/\/6\.png$/,'Dragging a draft candidate displays only its sprite');
assert.equal(draftPreview.x,25);
assert.equal(draftPreview.y,25);
draft.drop(9);
assert.equal(draft.state().roster[9],6,'Scouted Pokémon drafted directly onto ST');
assert.equal(draft.state().roster[1],null,'Default selected slot remains empty');
assert.equal(draft.state().phase,'draft','Draft continues with empty slots');
const touchPokemon=launch(initial('draft'));
assert.match(touchPokemon.app.innerHTML,/DRAG &amp; DROP POKÉMON/);
const pokemonGrip=touchPokemon.node('[data-drag-grip]',6,'dragValue');
assert(pokemonGrip?.onpointerdown,'Touch Pokémon grip is available');
touchPokemon.setTarget(9);
pokemonGrip.onpointerdown({pointerType:'touch',clientX:105,clientY:210,cancelable:true,preventDefault(){}});
assert.equal(touchPokemon.lastGhost().tagName,'img','Touch uses sprite-only image ghost');
assert.match(touchPokemon.lastGhost().src,/\/6\.png$/,'Touch follows Pokémon sprite, not the full tile');
assert.match(touchPokemon.lastGhost().className,/challenge-drag-sprite/);
assert.equal(touchPokemon.lastGhost().style.transform,'translate(73px,178px)','Touch sprite centered at finger');
touchPokemon.listeners.pointerup({clientX:105,clientY:210});
assert.equal(touchPokemon.state().roster[9],6,'Touch Pokémon drop still drafts correctly');
console.log('PASS Challenge drag/drop: native item equip/transfer, invalid equipment, one-swap rule, item follows Pokémon, touch grip, Pokémon draft');
