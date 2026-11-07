'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const ids=[233,6,3,9,149,94,131,143,68,135,196];
const locked={version:1,phase:'locked',pool:4,legends:false,formation:'4-3-3',tactic:'balanced',
 roster:ids.slice(),items:['Eviolite',...Array(10).fill(null)],roll:null,selected:0,rng:1234567,rerollType:1,rerollGen:1,moves:1,formationChanges:1,
 locked:{roster:ids.slice(),items:['Eviolite',...Array(10).fill(null)],formation:'4-3-3',tactic:'balanced',score:75},result:null,round:0,history:[]};
const store=new Map([['pokefc-challenge-alpha-1',JSON.stringify(locked)]]);
const els=new Map();
const canvas={clearRect(){},fillRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){},fillText(){},set fillStyle(v){},set strokeStyle(v){},set lineWidth(v){},set font(v){},set textAlign(v){}};
function el(id){if(!els.has(id))els.set(id,{value:id==='region'?'all':id==='opponent'?'gym-1':id==='tactic'?'balanced':id==='watchSpeed'?'4':'',innerHTML:'',textContent:'',disabled:false,hidden:false,events:{},
 addEventListener(kind,fn){this.events[kind]=fn},getContext(){return canvas}});
 return els.get(id)}
const ctx=vm.createContext({window:{location:{search:'?challenge=1&watch=soccerjs'},addEventListener(){}},URLSearchParams,Date,Math,console,
 document:{getElementById:el,querySelector:()=>({classList:{remove(){}}}),createElement:()=>({src:'',onload:null,onerror:null}),head:{append(script){script.onload?.()}}},
 localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)}});
for(const file of ['assets/js/national-species.js','assets/js/calibration-profile.js','assets/js/position-effectiveness.js','assets/js/quick-sim.js','play/opponents.js','challenge/special-items-data.js','play/play.js']){
 vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file,timeout:20000});
}
const play=ctx.window.PFC_PLAY,preview=play.makePreview();
assert.equal(preview.challengeRound,0);
assert.equal(preview.opponent.leader,'Lorelei');
assert.equal(preview.home.lineup.length,11);
assert.equal(preview.home.lineup[0].speciesId,233);
assert.equal(preview.home.tactic,'balanced');
assert.equal(el('opponent').value,'e4-lorelei');
assert.equal(el('region').disabled,true,'Challenge opponent cannot be changed');
assert.equal(el('teamActions').hidden,true,'Locked XI cannot be edited through Play');
el('quick').events.click();
const saved=JSON.parse(store.get('pokefc-challenge-alpha-1'));
assert.equal(saved.result.boss,'Lorelei');
assert.equal(saved.history.length,1,'One boss match recorded, not duplicate');
assert(saved.phase==='finished'||saved.phase==='result');
assert.deepEqual(saved.locked.roster,ids,'Challenge team remained locked');
assert.equal(saved.locked.items[0],'Eviolite');
assert.equal(el('returnChallenge').hidden,false);
assert.equal(el('matchClock').textContent,'FULL TIME');
const challengeHTML=fs.readFileSync(path.join(root,'challenge/index.html'),'utf8');
assert(challengeHTML.includes('href="../play/?challenge=1&amp;watch=soccerjs"'),'Challenge Watch uses the locked 2.5D path');
console.log('PASS locked Challenge XI to Play, carried items, fixed boss, verified Quick Sim result and autosave');
