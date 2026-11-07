'use strict';
/* Validate item-first Challenge catalog: compatible targets, refunds, one Mega,
 * unique items, Eviolite and budget, from real browser scripts. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
let stored=JSON.stringify({version:1,phase:'shop',pool:4,legends:false,formation:'4-3-3',tactic:'balanced',
 roster:[233,6,9,94,25,1,2,3,4,5,7],items:Array(11).fill(null),
 roll:null,selected:0,rng:752139,rerollType:1,rerollGen:1,moves:1,formationChanges:1,locked:null,result:null});
const controls={};const bound={};
const app={innerHTML:'',querySelectorAll(sel){
 let buttons=[];
 if(sel==='[data-shop-pick]')buttons=[...this.innerHTML.matchAll(/<button type="button" data-shop-pick="([^"]+)"[^>]*>/g)]
  .map(x=>({dataset:{shopPick:x[1]},onclick:null,disabled:/\bdisabled\b/.test(x[0])}));
 if(sel==='[data-shop-clear]')buttons=[...this.innerHTML.matchAll(/data-shop-clear="(\d+)"/g)].map(x=>({dataset:{shopClear:x[1]},onclick:null}));
 if(sel==='[data-shop-stat]')buttons=[...this.innerHTML.matchAll(/data-shop-stat="([^"]+)"/g)].map(x=>({dataset:{shopStat:x[1]},onclick:null}));
 bound[sel]=buttons;return buttons;
}};
const doc={getElementById(id){return id==='app'?app:(controls[id]??={id,value:id==='tactic'?'balanced':'',textContent:'',scrollTop:0,onclick:null})}};
const window={},logs=[];
const ctx=vm.createContext({window,document:doc,localStorage:{
 getItem(){return stored},setItem(_key,v){stored=v}},crypto:{getRandomValues(a){a[0]=752139;return a}},
 alert:s=>logs.push(s),confirm:()=>true,console});
for(const file of ['assets/js/position-effectiveness.js','assets/js/national-species.js','assets/js/calibration-profile.js','assets/js/quick-sim.js','challenge/special-items-data.js','challenge/tiers.js','play/opponents.js']){
 vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file,timeout:15000});
}
const special=window.PFC_CHALLENGE_SPECIAL;
assert(special.evolvable.includes(233));
assert(!special.evolvable.includes(6));
assert.deepEqual(Array.from(special.megas[6].map(m=>m.stone)),['Charizardite X','Charizardite Y']);
const html=fs.readFileSync(path.join(root,'challenge/index.html'),'utf8');
vm.runInContext(html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>')),ctx,{filename:'challenge-inline',timeout:15000});
const state=()=>JSON.parse(stored);
assert.match(app.innerHTML,/id="shopCatalog"/);
assert.match(app.innerHTML,/id="shopTarget"/);
assert.doesNotMatch(app.innerHTML,/LORELEI · OPPONENT XI/,'Opponent remains hidden until lineup and equipment locked');
assert.doesNotMatch(app.innerHTML,/data-slot-card="0" class="slot active /,'GK no longer highlighted during equipment selection');
assert.doesNotMatch(app.innerHTML,/challenge-versus-rating/,'Head-to-head team ratings only appear once locked');
assert.equal((app.innerHTML.match(/data-opponent-id="\d+"/g)||[]).length,0,'No opponent sprites leaked during equipment shopping');
assert.match(app.innerHTML,/data-shop-pick="Leftovers"/);
const sortedShop=()=>[...app.innerHTML.matchAll(/<button type="button" data-shop-pick="([^"]+)"[^>]*>[\s\S]*?<strong>₽(\d+)<\/strong>/g)]
 .map(m=>({name:m[1],price:Number(m[2])}));
function expectPriceOrder(message){
 const shop=sortedShop();
 assert(shop.length>0,'Shop items visible');
 const expected=shop.slice().sort((a,b)=>b.price-a.price||a.name.localeCompare(b.name,'en',{sensitivity:'base'}));
 assert.deepEqual(shop,expected,message);
}
expectPriceOrder('Default item shop sorted by descending price, then alphabetically');
assert.equal(sortedShop()[0].price,700,'Mega Stones / Eviolite appear ahead of cheaper items');

assert.equal((app.innerHTML.match(/data-shop-stat="/g)||[]).length,6,'Exactly six stat filter buttons');
function filterStat(stat){
 const button=bound['[data-shop-stat]']?.find(x=>x.dataset.shopStat===stat);
 assert(button?.onclick,'Filter '+stat+' available');button.onclick();
}
filterStat('attack');
assert.match(app.innerHTML,/data-shop-pick="Muscle Band"/,'Attack filter includes attack boost');
assert.match(app.innerHTML,/data-shop-pick="Eviolite"/,'Attack filter includes multi-stat Eviolite');
expectPriceOrder('Filtered items preserve descending price and A-Z within each tier');
assert.doesNotMatch(app.innerHTML,/data-shop-pick="Leftovers"/,'Attack filter removes HP-only item');
assert.doesNotMatch(app.innerHTML,/data-shop-pick="Wise Glasses"/,'Attack filter removes SpA-only item');
assert.match(app.innerHTML,/data-shop-stat="attack"[^>]*aria-pressed="true"/,'Active stat filter marked for screen reader');
filterStat('spAttack');
assert.match(app.innerHTML,/data-shop-pick="Wise Glasses"/,'Combined filters include SpA items');
assert.doesNotMatch(app.innerHTML,/data-shop-pick="Leftovers"/,'OR filters still exclude HP-only items');
filterStat('attack');
assert.doesNotMatch(app.innerHTML,/data-shop-pick="Muscle Band"/,'Toggling attack off retains SpA filter');
filterStat('spAttack');
assert.match(app.innerHTML,/data-shop-pick="Leftovers"/,'Clearing filters restores all items');

assert.match(app.innerHTML,/data-shop-pick="Eviolite"/);
assert.match(app.innerHTML,/data-shop-pick="Charizardite X"/);
assert.match(app.innerHTML,/data-shop-pick="Charizardite Y"/);
assert.match(app.innerHTML,/data-shop-pick="Blastoisinite"/);
assert.doesNotMatch(app.innerHTML,/\d+(?:\.\d+)? OVR/,'raw OVR hidden from Challenge');
const statKeys=[['HP','hp'],['ATK','attack'],['DEF','defense'],['SpA','spAttack'],['SpD','spDefense'],['SPE','speed']];
const expected=(base,modifier=()=>0)=>Object.fromEntries(statKeys.map(([label,key])=>[label,base[key]+modifier(key)]));
const statsFor=name=>{
 const expression=new RegExp('<span class="slot-name">'+name+'</span>[\\s\\S]*?<div class="slot-stats"[^>]*>([\\s\\S]*?)</div>');
 const fragment=app.innerHTML.match(expression)?.[1];
 assert(fragment,'visible pitch stats for '+name);
 return Object.fromEntries([...fragment.matchAll(/<b>(HP|ATK|DEF|SpA|SpD|SPE)<\/b><span>(\d+)<\/span>/g)].map(x=>[x[1],Number(x[2])]));
};
const basePory=window.FXI_SPECIES.find(x=>x.id===233).baseStats;
const baseCharizard=window.FXI_SPECIES.find(x=>x.id===6).baseStats;
assert.deepEqual(statsFor('Porygon2'),expected(basePory),'pitch shows six base stats before equipment');
assert.match(app.innerHTML,/HOW POSITION FIT WORKS/);
assert.match(app.innerHTML,/Fit score = min\(100, 20 \+ 0\.55/);
assert.match(app.innerHTML,/HP 20% · SPE 20% · ATK 15% · DEF 15% · SpA 15% · SpD 15%/);
const poryTier=()=>app.innerHTML.match(/<span class="slot-name">Porygon2<\/span>[\s\S]*?<span class="slot-tier tier-([sabcd])">/)?.[1];
assert.equal(poryTier(),'b','Porygon2 initial midfield tier');
function choose(name){
 const b=bound['[data-shop-pick]']?.find(b=>b.dataset.shopPick===name);
 assert(b&&!b.disabled,'selectable item '+name);b.onclick();
}
function equip(name,index){
 choose(name);doc.getElementById('shopTarget').value=String(index);doc.getElementById('equipShopItem').onclick();
}
equip('Eviolite',0);
assert.equal(state().items[0],'Eviolite');
assert.equal(poryTier(),'a','Eviolite improves Porygon2 from B to A');
assert.deepEqual(statsFor('Porygon2'),expected(basePory,()=>20),'Eviolite updates all six pitch values immediately');
assert.match(app.innerHTML,/₽300 LEFT/);
equip('Eviolite',1);
assert.equal(state().items[1],null,'Eviolite not usable by Charizard');
assert.match(controls.shopFeedback.textContent,/not compatible/);
assert.doesNotMatch(app.innerHTML,/data-shop-pick="Charizardite X"/,'Items above ₽300 left are hidden before selection');
assert.doesNotMatch(app.innerHTML,/data-shop-pick="Choice Band"/,'₽400 items disappear with ₽300 remaining');
assert.match(app.innerHTML,/data-shop-pick="Eviolite"/,'Equipped costly item remains visible for removal');
assert.match(app.innerHTML,/data-shop-pick="Leftovers"/,'Affordable ₽100 items remain available');
expectPriceOrder('Budget-filtered items retain descending price and name ordering');
assert.equal(state().items[1],null,'Unaffordable item not equipped');
choose('Eviolite');controls.removeSelectedItem.onclick();
assert.equal(state().items[0],null,'remove Eviolite refunds');
assert.match(app.innerHTML,/data-shop-pick="Charizardite X"/,'Refund restores ₽700 special items');
assert.match(app.innerHTML,/data-shop-pick="Choice Band"/,'Refund restores ₽400 items');
expectPriceOrder('Refunded items return to the correct price / alphabetical position');
assert.deepEqual(statsFor('Porygon2'),expected(basePory),'removing item restores base stats on pitch');
equip('Charizardite X',1);
assert.equal(state().items[1],'Charizardite X');
const megaStats=special.megas[6].find(x=>x.stone==='Charizardite X').stats;
assert.deepEqual(statsFor('Mega Charizard X'),expected(megaStats),'Mega Stone replaces all displayed pitch stats with Mega form');
assert.match(app.innerHTML,/sprites\/pokemon\/10034\.png/,'Real Mega Charizard X sprite displays');
assert.notDeepEqual(statsFor('Mega Charizard X'),expected(baseCharizard),'Mega values differ from normal base form');
assert.match(app.innerHTML,/₽300 LEFT/);
assert.doesNotMatch(app.innerHTML,/data-shop-pick="Blastoisinite"/,'Second Mega Stone hidden when ₽300 remains');
assert.equal(state().items[2],null,'Second Mega Stone not equipped');
equip('Leftovers',0);
assert.equal(state().items[0],'Leftovers');
equip('Leftovers',5);
assert.equal(state().items[0],null,'reassign moves unique held item');
assert.equal(state().items[5],'Leftovers');
assert.equal(state().items.filter(x=>x==='Leftovers').length,1);
controls.lock.onclick();
assert.equal(state().phase,'shop','Lock opens confirmation modal');
assert.equal(doc.getElementById('challengeMessageModal').open,true);
doc.getElementById('challengeMessageConfirm').onclick();
assert.equal(state().phase,'locked');
assert.match(app.innerHTML,/LORELEI · OPPONENT XI/,'Opponent revealed after lock');
assert.equal((app.innerHTML.match(/data-opponent-id="\d+"/g)||[]).length,11,'All 11 opponent Pokémon appear after lock');
assert.match(app.innerHTML,/challenge-versus-rating/,'Ratings appear after locking the XI');
assert.doesNotMatch(app.innerHTML,/data-slot-card="0" class="slot active /,'GK remains unselected after lineup lock');
assert.deepEqual(statsFor('Mega Charizard X'),expected(megaStats),'locked squad preserves Mega-adjusted pitch values');
assert.match(app.innerHTML,/HOW POSITION FIT WORKS/,'fit explanation remains on Gauntlet match screen');
controls.play.onclick();
assert(['result','finished'].includes(state().phase));
assert.equal(state().result.boss,'Lorelei');
assert.equal(state().history.length,1);
assert.deepEqual(state().locked.items.slice(0,6),[null,'Charizardite X',null,null,null,'Leftovers']);
console.log('PASS item-first Challenge shop: tier boosts, item eligibility, budget, one Mega, reassignment, refunds and locked match');
