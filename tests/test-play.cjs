'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const ids=[25,6,3,9,149,94,131,143,68,135,196];
const stored={version:1,name:'Test XI',formation:'4-3-3',lineup:ids.slice(),selected:0,spriteStyle:'pixel'};
const values=new Map([['pokefc-free-builder-v1',JSON.stringify(stored)]]);
const els=new Map();
const drawing={clearRect(){},fillRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){},fillText(){},set fillStyle(v){},set strokeStyle(v){},set lineWidth(v){},set font(v){},set textAlign(v){}};
function el(id){
 if(!els.has(id)){
  const e={value:id==='region'?'all':id==='opponent'?'gym-1':id==='watchSpeed'?'4':id==='tactic'?'balanced':'',innerHTML:'',textContent:'',disabled:false,events:{},
   addEventListener(type,fn){this.events[type]=fn},
   getContext(){return drawing}};
  els.set(id,e);
 }return els.get(id);
}
const ctx=vm.createContext({
 window:{addEventListener(){}},
 document:{getElementById:el},
 localStorage:{getItem:key=>values.get(key)||null,setItem:(k,v)=>values.set(k,v)},
 Date,Math,console
});
for(const f of ['assets/js/national-species.js','assets/js/calibration-profile.js','assets/js/position-effectiveness.js','assets/js/quick-sim.js','play/opponents.js','play/play.js']){
 vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f,timeout:20000});
}
const play=ctx.window.PFC_PLAY;
assert(play,'Play page initialized');
assert.equal(play.opponents.length,38,'32 gyms + Elite Four + Champions');
assert.equal(play.opponents.filter(x=>x.tier==='gym').length,32);
assert.equal(play.opponents.filter(x=>x.tier!=='gym').length,6);
const dex=new Map(ctx.window.FXI_SPECIES.map(x=>[x.id,x]));
for(const gym of play.opponents.filter(x=>x.tier==='gym')){
 const ids=play.gymSquad(gym);
 assert.equal(ids.length,11,'11 generated starters: '+gym.city);
 assert.equal(new Set(ids).size,11,'No duplicates: '+gym.city);
 assert(ids.every(id=>dex.has(id)&&!dex.get(id).legendary),'No missing or legendary Gym Pokémon');
 assert(ids.includes(gym.signature),'Signature Pokémon retained: '+gym.city);
 assert.deepEqual(Array.from(play.gymSquad(gym)),Array.from(ids),'Stable generation: '+gym.city);
}
assert.equal(play.getXI().lineup.filter(Boolean).length,11);
const preview=play.makePreview();
assert.equal(preview.home.lineup.length,11);
assert.equal(preview.away.lineup.length,11);
assert.equal((el('homePreview').innerHTML.match(/class="mini-fit"/g)||[]).length,11,'All Play XI cards show S-D tier and efficiency');
assert(preview.home.lineup.every(x=>x.pokemonStats&&x.exactPosition&&x.positionEfficiency>=.70&&x.positionEfficiency<=1));
assert(preview.away.lineup.every(x=>x.pokemonStats&&x.exactPosition&&x.positionFit>0));
assert(preview.home.lineup.every(x=>x.pokemonStats&&x.exactPosition&&!('main' in x)&&!('detail' in x)));
el('quick').events.click();
assert.equal(el('matchClock').textContent,'FULL TIME','Quick Sim completion');
assert.match(el('score').textContent,/\d+ : \d+/);
assert.match(el('matchResult').innerHTML,/Shots/);
assert.match(el('matchResult').innerHTML,/Positional suitability/);
assert.doesNotMatch(el('matchResult').innerHTML,/<small>Corners<\/small>/);
assert.match(el('matchResult').innerHTML,/Enclosed pitch/);
const html=fs.readFileSync(path.join(root,'play/index.html'),'utf8');
assert(html.includes('WATCH MATCH')&&html.includes('QUICK SIM')&&html.includes('SIM TO END'));
assert(!/tm-engine-bridge|hybrid-sim|tacticmesh/i.test(html),'Legacy TacticMesh scripts removed from Play');
assert(Number(html.match(/play\.js\?v=(\d+)/)?.[1])>=17,'Enclosed Play and attacking-run runtime remain versioned with Goal Replay updates');
assert(!html.includes('id="setPiecesMode"'),'Retired set-piece selector remains visible');
const home=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert(home.includes('href="./play/"'),'Home links to Play');
console.log('PASS Play: 32 gym squads, six bosses, Free Builder carryover, match adapter, 90-minute Quick Sim');
