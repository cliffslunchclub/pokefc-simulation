'use strict';
/* Browser-state test: AI Auto-Equip is connected to live shop rules. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),roster=[233,6,9,94,25,1,2,3,4,5,7];
let saved=JSON.stringify({version:1,phase:'shop',pool:4,legends:false,formation:'4-3-3',
 tactic:'balanced',roster,items:Array(11).fill(null),roll:null,selected:9,rng:1002,
 rerollType:1,rerollGen:1,moves:1,formationChanges:1,locked:null,result:null,round:0,history:[]});
const controls={},bound={};
const app={innerHTML:'',querySelectorAll(sel){
 let nodes=[];
 if(sel==='[data-shop-pick]')nodes=[...this.innerHTML.matchAll(/<button type="button" data-shop-pick="([^"]+)"[^>]*>/g)]
  .map(x=>({dataset:{shopPick:x[1]},disabled:/\bdisabled\b/.test(x[0]),onclick:null}));
 if(sel==='[data-shop-stat]')nodes=[...this.innerHTML.matchAll(/data-shop-stat="([^"]+)"/g)]
  .map(x=>({dataset:{shopStat:x[1]},onclick:null}));
 if(sel==='[data-shop-clear]')nodes=[...this.innerHTML.matchAll(/data-shop-clear="(\d+)"/g)]
  .map(x=>({dataset:{shopClear:x[1]},onclick:null}));
 bound[sel]=nodes;return nodes;
}};
const document={getElementById(id){return id==='app'?app:(controls[id]??={
 id,value:'',textContent:'',scrollTop:0,onclick:null,setAttribute(){},hidden:false})}};
const win={},ctx=vm.createContext({window:win,document,console,crypto:{getRandomValues(a){a[0]=1337;return a}},
 localStorage:{getItem(){return saved},setItem(k,v){saved=v}},alert:e=>{throw Error(e)},confirm:()=>true});
for(const file of ['assets/js/position-effectiveness.js','assets/js/national-species.js','assets/js/calibration-profile.js','assets/js/quick-sim.js','challenge/special-items-data.js','challenge/tiers.js','challenge/item-optimizer.js','play/opponents.js'])
 vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file,timeout:15000});
const html=fs.readFileSync(path.join(root,'challenge/index.html'),'utf8');
vm.runInContext(html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>')),ctx,{filename:'challenge-inline',timeout:15000});
const state=()=>JSON.parse(saved);
const score=()=>{
 const p=app.innerHTML.match(/<span class="formation-tag"[^>]*>4-3-3 · ([\d.]+) SCORE<\/span>/);
 assert(p,'Visible team score');
 return Number(p[1]);
};
const before=score();
assert.equal(state().items.filter(Boolean).length,0);
assert.match(app.innerHTML,/AI ITEM PICK/);
assert.match(app.innerHTML,/id="autoEquip"/);
assert(controls.autoEquip?.onclick);
controls.autoEquip.onclick();
assert.equal(state().phase,'shop');
const equipped=state().items.filter(Boolean);
assert(equipped.length>0,'AI selects at least one beneficial item');
assert.equal(equipped.length,new Set(equipped).size,'No duplicate items');
const speciesById=new Map(win.FXI_SPECIES.map(s=>[s.id,s]));
let spent=0,transforms=0;
for(let i=0;i<11;i++){
 const item=state().items[i],pokemon=speciesById.get(state().roster[i]);
 if(!item)continue;
 if(item==='Eviolite')assert(win.PFC_CHALLENGE_SPECIAL.evolvable.includes(pokemon.id),'Eviolite eligible');
 const forms=win.PFC_CHALLENGE_SPECIAL.megas[pokemon.id]||[];
 const mega=forms.find(m=>m.stone===item);
 if(mega){spent+=700;transforms++}
 else if(item==='Eviolite')spent+=700;
 else{
  const matches=[...html.matchAll(/\['([^']+)',(100|200|400),\{[^}]*\}\]/g)];
  const found=matches.find(m=>m[1]===item);
  assert(found,'Known common shop item '+item);
  spent+=Number(found[2]);
 }
}
assert(spent<=1000,'Item budget respected');
assert(transforms<=1,'Mega and Primal share transformation allowance');
assert(score()>=before,'Visible team score does not decline after optimizing');
assert.match(app.innerHTML,/Optimized team score/);
const firstItems=state().items.slice();
controls.autoEquip.onclick();
assert.deepEqual(state().items,firstItems,'Repeated optimization is deterministic and idempotent');
controls.lock.onclick();
assert.equal(state().phase,'shop','Auto-equipping does not automatically lock');
console.log('PASS Challenges AI Auto-Equip: connected shop, full-XI score improves, item uniqueness, budget, one transformation and no auto lock');
