'use strict';
// Public builder regression: first-visit Gen I showcase, persistent saves,
// ten-at-a-time scouting, accessible dialogs and no browser confirm windows.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const KEY='pokefc-free-builder-v1';
function start(store=new Map()){
 const elements=new Map();
 function get(id){
  if(!elements.has(id)){
   const el={
    id,value:'',textContent:'',innerHTML:'',hidden:false,dataset:{},open:false,
    events:{},addEventListener(type,fn){this.events[type]=fn},
    showModal(){this.open=true;this.shown=(this.shown||0)+1},
    close(){this.open=false;this.events.close?.()},
    setAttribute(name){if(name==='open')this.open=true},
    removeAttribute(name){if(name==='open')this.open=false},
   };
   elements.set(id,el);
  }
  return elements.get(id);
 }
 const env={
  window:{},document:{getElementById:get},
  localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)},
  confirm:()=>{throw Error('Browser confirm must never be called')},
  navigator:{},console
 };
 const ctx=vm.createContext(env);
 vm.runInContext(fs.readFileSync(path.join(root,'assets/js/national-species.js'),'utf8'),ctx,{timeout:10000});
 vm.runInContext(fs.readFileSync(path.join(root,'assets/js/position-effectiveness.js'),'utf8'),ctx,{timeout:10000});
 vm.runInContext(fs.readFileSync(path.join(root,'assets/js/builder.js'),'utf8'),ctx,{timeout:10000});
 return {get,store,env,api:env.window.PFC_BUILDER};
}
const {get,store,env,api}=start();
assert.equal(env.window.FXI_SPECIES.length,1025,'National Gen I-IX data available');
assert(api,'Builder initializes');
const showcase=[144,91,76,151,112,135,65,145,149,150,142];
assert.deepEqual(Array.from(api.getState().lineup),showcase,'Strong, nonduplicated Gen I showcase starts filled');
assert.equal(new Set(api.getState().lineup).size,11,'Every showcase species appears once');
assert(api.getState().lineup.every(id=>env.window.FXI_SPECIES[id-1].gen===1));
assert.equal(get('genFilter').value,'1','Gen I filter is selected for first visit');
assert.equal(api.getState().formation,'4-3-3');
assert.equal(api.getState().selected,0);
assert.match(get('pitchSlots').innerHTML,/data-slot="10"/);
assert.equal((get('pitchSlots').innerHTML.match(/class="fit-badges"/g)||[]).length,11,'All filled XI cards show tier and efficiency together');
assert.match(get('pitchSlots').innerHTML,/class="efficiency" title="Competitive match efficiency">\d{2,3}%/);
assert.match(get('prospects').innerHTML,/\d{2,3}% EFF/);
assert.equal((get('prospects').innerHTML.match(/data-species="/g)||[]).length,10,'Only ten scouts initially');
assert.equal(get('prospects').dataset.expanded,'false','List is initially not scroll-clamped');
assert.equal(get('more').hidden,false);
get('more').events.click();
assert.equal((get('prospects').innerHTML.match(/data-species="/g)||[]).length,20,'Show more reveals ten additional scouts');
assert.equal(get('prospects').dataset.expanded,'true','Expanded list is capped and scrollable');
get('genFilter').value='';
get('genFilter').events.change();
assert.equal((get('prospects').innerHTML.match(/data-species="/g)||[]).length,10,'Filter change resets pagination');
assert.equal(get('prospects').dataset.expanded,'false');
get('genFilter').value='1';
get('genFilter').events.change();
assert.equal(Object.keys(api.formations).length,5);
assert(/^[SABCD]$/.test(api.gradeFor(env.window.FXI_SPECIES[5],'ST')));
assert(/^[SABCD]$/.test(get('teamScore').textContent),'Public XI grade is letter-only');
assert.doesNotMatch(get('pitchSlots').innerHTML,/\d+(?:\.\d+)?\s*OVR/);
assert.doesNotMatch(get('prospects').innerHTML,/raw-stats|BST\s*\d+|\d+\.\d+<\/b>/);
assert.match(get('prospects').innerHTML,/<b class="grade-[sabcd]">[SABCD]<\/b>/);

// Loading the preset is explicit for returning visitors; cancellation preserves XI.
get('loadGen1').events.click();
assert.equal(get('builderConfirmTitle').textContent,'LOAD BEST GEN I XI?');
get('builderConfirmCancel').events.click();
assert.deepEqual(Array.from(api.getState().lineup),showcase);
// Canceling either action is non-destructive; confirming is deliberate.
get('randomize').events.click();
assert.equal(get('builderConfirm').open,true,'Random XI uses an in-app dialog');
assert.equal(get('builderConfirmTitle').textContent,'RANDOMIZE YOUR XI?');
get('builderConfirmCancel').events.click();
assert.equal(get('builderConfirm').open,false);
assert.deepEqual(Array.from(api.getState().lineup),showcase,'Canceled randomize leaves XI alone');
get('clear').events.click();
assert.equal(get('builderConfirm').open,true);
assert.equal(get('builderConfirmTitle').textContent,'CLEAR YOUR XI?');
get('builderConfirmCancel').events.click();
assert.deepEqual(Array.from(api.getState().lineup),showcase,'Canceled clear leaves XI alone');
get('randomize').events.click();
get('builderConfirmOk').events.click();
assert.equal(api.getState().lineup.filter(Boolean).length,11);
assert.equal(new Set(api.getState().lineup).size,11,'No duplicates in randomized XI');
assert.equal(get('builderConfirm').open,false);
get('formation').events.change({target:{value:'4-4-2'}});
assert.equal(api.getState().formation,'4-4-2');
get('clear').events.click();
get('builderConfirmOk').events.click();
assert.equal(api.getState().lineup.filter(Boolean).length,0,'Clear removes all eleven');
assert.equal(api.getState().selected,0);
const next=start(store);
assert.equal(next.api.getState().lineup.filter(Boolean).length,0,'Intentionally cleared lineup stays empty on reload');
const restored=start(store);
restored.get('loadGen1').events.click();
assert.deepEqual(Array.from(restored.api.getState().lineup),showcase,'Old empty saves can explicitly load the Gen I preset');
restored.get('clear').events.click();
restored.get('builderConfirmOk').events.click();

assert.equal(next.get('genFilter').value,'1','Filter defaults to Gen I on every page load');

// Clicking prospects still fills the selected slot and rejects duplicates.
next.get('prospects').events.click({target:{closest:()=>({dataset:{species:'6'},disabled:false})}});
assert.equal(next.api.getState().lineup[0],6,'A species can be selected from the list');
assert.equal(next.api.getState().selected,1,'Auto-advance to next empty slot');
next.get('prospects').events.click({target:{closest:()=>({dataset:{species:'6'},disabled:false})}});
assert.equal(next.api.getState().lineup[1],null,'Duplicate species are blocked');
const last=start(store);
assert.equal(last.api.getState().lineup[0],6,'Existing browser saves survive first-visit defaults');
assert.equal(last.api.getState().lineup[1],null);

// Site navigation and public UI declarations.
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const link of ['./play/','./challenge/','./franchise/'])assert(html.includes(link),'Missing nav: '+link);
assert.match(html,/id="genFilter"[^>]*>\s*<option value="1" selected>Gen I<\/option>/);
assert.match(html,/Gen IX<\/option><option value="">All 9 Generations<\/option>/);
assert(html.includes('id="builderConfirm"'),'Branded dialog exists');
assert(html.includes('id="loadGen1"'),'User can load best Gen I XI after a saved clear');
assert(html.includes('id="builderConfirmCancel"'),'Dialog has cancel control');
assert(html.includes('id="builderConfirmOk"'),'Dialog has explicit action control');
assert(html.includes('id="spriteStyle"'));
assert(html.includes('href="./ratings/"'));
assert(html.includes('XI GRADE'));
assert.equal((html.match(/class="pfc-nav"/g)||[]).length,1);
assert(!/legacy-v07c|legacy-v05|Arcade/.test(html));
const css=fs.readFileSync(path.join(root,'assets/css/builder.css'),'utf8');
assert(css.includes('#prospects[data-expanded="true"]'),'Expanded scouts have bounded scroll');
assert(css.includes('max-height:min(650px,72dvh)'),'Expanded desktop height is fixed');
assert(css.includes('.builder-confirm-dialog::backdrop'),'Dialog uses branded backdrop');
const franchise=fs.readFileSync(path.join(root,'franchise/index.html'),'utf8');
const challenge=fs.readFileSync(path.join(root,'challenge/index.html'),'utf8');
assert(franchise.includes('../challenge/')&&franchise.includes('../play/'));
assert(challenge.includes('../franchise/')&&challenge.includes('../play/'));
assert.equal(env.window.FXI_SPECIES[1024].name,'Pecharunt');
console.log('PASS Free Builder: optimal Gen I showcase, save preservation, ten-at-a-time scrolling, custom confirmations, grades and navigation');
