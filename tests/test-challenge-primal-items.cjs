'use strict';
/* Primal Reversion (Blue/Red Orb) and shop ordering regression. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),roster=[382,383,6,9,149,94,131,143,68,135,196];
let stored=JSON.stringify({version:1,phase:'shop',pool:4,legends:true,formation:'4-3-3',tactic:'balanced',
 roster,items:Array(11).fill(null),selected:9,rng:2026,rerollType:1,rerollGen:1,moves:1,formationChanges:1,
 locked:null,result:null,round:0,history:[]});
const controls={},bound={},app={innerHTML:'',querySelectorAll(selector){
 let out=[];
 if(selector==='[data-shop-pick]')out=[...this.innerHTML.matchAll(/<button type="button" data-shop-pick="([^"]+)"[^>]*>/g)]
   .map(m=>({dataset:{shopPick:m[1]},disabled:/\bdisabled\b/.test(m[0]),onclick:null}));
 if(selector==='[data-shop-clear]')out=[...this.innerHTML.matchAll(/data-shop-clear="(\d+)"/g)]
   .map(m=>({dataset:{shopClear:m[1]},onclick:null}));
 bound[selector]=out;return out;
}};
const doc={getElementById(id){return id==='app'?app:(controls[id]??={id,value:'',textContent:'',scrollTop:0,onclick:null})}};
const win={},ctx=vm.createContext({window:win,document:doc,console,
 localStorage:{getItem(){return stored},setItem(k,v){stored=v}},
 crypto:{getRandomValues(arr){arr[0]=2026;return arr}},alert:()=>{},confirm:()=>true});
for(const file of ['assets/js/position-effectiveness.js','assets/js/national-species.js','assets/js/calibration-profile.js','assets/js/quick-sim.js','challenge/special-items-data.js','challenge/tiers.js','challenge/run-card.js','play/opponents.js'])
 vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file,timeout:15000});
const special=win.PFC_CHALLENGE_SPECIAL;
assert.equal(special.megas[382][0].stone,'Blue Orb');
assert.equal(special.megas[383][0].stone,'Red Orb');
assert.equal(win.PFC_CHALLENGE_MEGA_SPRITES['kyogre-primal'],10077);
assert.equal(win.PFC_CHALLENGE_MEGA_SPRITES['groudon-primal'],10078);
assert.deepEqual(JSON.parse(JSON.stringify(special.megas[382][0].stats)),{hp:100,attack:150,defense:90,spAttack:180,spDefense:160,speed:90});
assert.deepEqual(JSON.parse(JSON.stringify(special.megas[383][0].stats)),{hp:100,attack:180,defense:160,spAttack:150,spDefense:90,speed:90});
const html=fs.readFileSync(path.join(root,'challenge/index.html'),'utf8');
vm.runInContext(html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>')),ctx,{filename:'challenge-inline',timeout:15000});
const state=()=>JSON.parse(stored);
const choose=name=>{
 const button=bound['[data-shop-pick]']?.find(x=>x.dataset.shopPick===name);
 assert(button&&!button.disabled,'Selectable item '+name);button.onclick();
};
const equip=(name,index)=>{
 choose(name);doc.getElementById('shopTarget').value=String(index);controls.equipShopItem.onclick();
};
assert.match(app.innerHTML,/sprites\/items\/leftovers\.png/,'Common shop items have image sprites');
assert.match(app.innerHTML,/sprites\/items\/blue-orb\.png/,'Blue Orb icon');
assert.match(app.innerHTML,/sprites\/items\/red-orb\.png/,'Red Orb icon');
assert.match(app.innerHTML,/data-shop-pick="Blue Orb"/);
assert.match(app.innerHTML,/data-shop-pick="Red Orb"/);
choose('Leftovers'); // Item sorting now starts with expensive species-specific stones.
const chooser=app.innerHTML.match(/<select id="shopTarget"[^>]*>([\s\S]*?)<\/select>/)?.[1];
assert(chooser,'Shop target selector exists');
const positions=[...chooser.matchAll(/<option value="(\d+)"/g)].map(m=>Number(m[1]));
assert.equal(positions[0],9,'ST appears first in item target menu');
assert.equal(positions.at(-1),0,'GK is last in item target menu');
assert(positions.indexOf(8)<positions.indexOf(5),'Wingers precede midfielders');
assert(positions.indexOf(5)<positions.indexOf(1),'Midfielders precede defenders');
choose('Blue Orb');
assert.match(app.innerHTML,/Primal Reversion/,'Primal item is labeled as a Primal form, not Mega');
const kyogreTargets=app.innerHTML.match(/<select id="shopTarget"[^>]*>([\s\S]*?)<\/select>/)?.[1]||'';
assert.deepEqual([...kyogreTargets.matchAll(/<option value="(\d+)"/g)].map(m=>Number(m[1])),[0],'Blue Orb exclusive to Kyogre');
doc.getElementById('shopTarget').value='1';controls.equipShopItem.onclick();
assert.equal(state().items[1],null,'Blue Orb rejects Groudon');
assert.match(controls.shopFeedback.textContent,/not compatible/);
equip('Blue Orb',0);
assert.equal(state().items[0],'Blue Orb');
assert.match(app.innerHTML,/class="slot-name">Primal Kyogre</);
assert.match(app.innerHTML,/sprites\/pokemon\/10077\.png/,'Kyogre primal sprite visible');
assert.match(app.innerHTML,/sprites\/items\/blue-orb\.png/,'Equipped orb sprite visible');
assert.match(app.innerHTML,/₽300 LEFT/,'Primal Orb costs ₽700');
assert.doesNotMatch(app.innerHTML,/data-shop-pick="Red Orb"/,'Second Primal Orb is hidden because only ₽300 remains');
assert.equal(state().items[1],null,'Unpurchased Primal Orb stays unequipped');
choose('Blue Orb');controls.removeSelectedItem.onclick();
assert.equal(state().items[0],null,'Removing Blue Orb clears transformation');
assert.match(app.innerHTML,/data-shop-pick="Red Orb"/,'Refund makes Red Orb affordable again');
equip('Red Orb',1);
assert.equal(state().items[1],'Red Orb');
assert.match(app.innerHTML,/class="slot-name">Primal Groudon/);
assert.match(app.innerHTML,/sprites\/pokemon\/10078\.png/,'Groudon primal sprite visible');
const card=win.PFC_CHALLENGE_RUN_CARD;
const complete={...state(),phase:'finished',locked:{roster:roster.slice(),items:state().items.slice(),formation:'4-3-3',tactic:'balanced',score:79},history:[{boss:'Lorelei',score:[1,0],outcome:'Victory'}]};
const byId=new Map(win.FXI_SPECIES.map(s=>[s.id,s]));
const summary=card.summary(complete,byId);
assert.equal(summary.players[1].name,'Primal Groudon','Downloadable card uses Primal form name');
assert.equal(summary.players[1].spriteId,10078,'Downloadable card uses Primal sprite');
console.log('PASS Primal Reversion: authentic stats/sprites, exclusive orbs, ₽700, one transformation, ST-first dropdown, item icons');
