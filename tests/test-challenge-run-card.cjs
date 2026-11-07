'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const ctx=vm.createContext({window:{},Date,console,setTimeout,clearTimeout});
vm.runInContext(fs.readFileSync(path.join(root,'challenge/special-items-data.js'),'utf8'),ctx,{filename:'special-items-data.js'});
vm.runInContext(fs.readFileSync(path.join(root,'challenge/run-card.js'),'utf8'),ctx,{filename:'run-card.js'});
const card=ctx.window.PFC_CHALLENGE_RUN_CARD;
assert(card,'run card module loaded');
const ids=[233,6,3,9,149,94,131,143,68,135,196];
const map=new Map(ids.map(id=>[id,{name:'Pokémon #'+id}]));
const matches=['Lorelei','Bruno','Agatha','Lance','Blue','Red'].map((boss,i)=>({boss,score:[i+1,i],outcome:'Victory'}));
const state={phase:'finished',pool:9,legends:true,formation:'4-3-3',tactic:'press',
 locked:{roster:ids.slice(),items:['Eviolite',...Array(10).fill(null)],formation:'4-3-3',tactic:'press',score:72.9},
 history:matches};
const data=card.summary(state,map);
assert.equal(data.players.length,11);
assert.equal(data.results.length,6);
assert.equal(data.teamScore,72.9);
assert.equal(data.players[0].item,'Eviolite');
const megaState={...state,locked:{...state.locked,items:['Eviolite','Charizardite X',...Array(9).fill(null)]}};
const megaData=card.summary(megaState,map);
assert.equal(megaData.players[1].spriteId,10034,'Mega Charizard X uses PokeAPI form sprite');
assert.match(megaData.players[1].name,/Mega Pokémon #6 X/,'Mega form is named correctly with mock species');
assert.equal(data.champions,true);
assert.match(data.category,/NATIONAL/);
let draws=[],labels=[];
const paint={
 createLinearGradient(){return{addColorStop(){}}},beginPath(){},roundRect(){},moveTo(){},lineTo(){},quadraticCurveTo(){},closePath(){},arc(){},fill(){},stroke(){},
 fillRect(){},strokeRect(){},drawImage(...args){draws.push(args)},fillText(value){labels.push(value)},
 set fillStyle(v){},set strokeStyle(v){},set lineWidth(v){},set textAlign(v){},set font(v){}
};
let clickCount=0,anchors=[];
const canvas={width:0,height:0,getContext(type){assert.equal(type,'2d');return paint},toBlob(fn,type){assert.equal(type,'image/png');fn({type:'image/png',size:18700})}};
const sprites=Object.fromEntries(ids.map(id=>[id,{id,width:96,height:96}]));
const painted=card.render(canvas,data,sprites);
assert.equal(painted,canvas);
assert.equal(canvas.width,1200);
assert.equal(canvas.height,1600);
assert.equal(draws.length,11,'11 sprite portraits rendered on the PNG');
for(const boss of ['LORELEI','BRUNO','AGATHA','LANCE','BLUE','RED'])assert(labels.some(x=>String(x).includes(boss)),'boss name drawn: '+boss);
assert(labels.some(x=>String(x).includes('72.9')),'team score rendered');
const doc={body:{appendChild(a){anchors.push(a)}},createElement(tag){if(tag==='canvas')return canvas;if(tag==='a')return{
 click(){clickCount++},remove(){},href:'',download:''};throw Error(tag)}};
const urls={createObjectURL(blob){assert.equal(blob.type,'image/png');return'blob:pokefc-test'},revokeObjectURL(){}};
(async()=>{
 const file=await card.download(data,{canvas,sprites,document:doc,URL:urls});
 assert.match(file,/^PokeFC-Challenge-Champion-\d{4}-\d{2}-\d{2}\.png$/);
 assert.equal(anchors[0].download,file);
 assert.equal(anchors[0].href,'blob:pokefc-test');
 assert.equal(clickCount,1,'download was initiated');
 const broken={...data,champions:false,results:data.results.slice(0,4)};
 const empty=card.render(canvas,broken,{});
 assert.equal(empty,canvas,'failed sprite loads use safe fallback');
 assert.equal(draws.length,22,'sprites were drawn exactly once per first render and once per download');
 console.log('PASS Challenges v1.0 PNG: 1200×1600, 11 sprites, six boss scores, score/formation and browser download');
})().catch(e=>{console.error(e);process.exitCode=1});
