'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const win={},c=vm.createContext({window:win,console});
vm.runInContext(fs.readFileSync(path.join(root,'challenge/tiers.js'),'utf8'),c);
const tiers=win.PFC_CHALLENGE_TIERS;
assert.deepEqual(Array.from(tiers.bands,x=>[x.tier,x.min]),[['S',85],['A',75],['B',65],['C',55],['D',0]]);
for(const [n,letter] of [[100,'S'],[85,'S'],[84.99,'A'],[75,'A'],[74.99,'B'],[65,'B'],[64.99,'C'],[55,'C'],[54.99,'D'],[20,'D']])
 assert.equal(tiers.tier(n),letter,'OVR '+n);
let saved=JSON.stringify({version:1,phase:'draft',pool:4,legends:false,formation:'4-3-3',tactic:'balanced',
 roster:[233,...Array(10).fill(null)],items:Array(11).fill(null),selected:1,rng:18391,
 roll:{gen:1,type:'fire'},rerollType:1,rerollGen:1,moves:1,formationChanges:1,locked:null,result:null});
const controls=new Map(),bound=new Map();
const app={innerHTML:'',querySelectorAll(sel){
 let elements=[];
 if(sel==='[data-slot-card]')elements=[...this.innerHTML.matchAll(/data-slot-card="(\d+)"/g)].map(m=>({
  dataset:{slotCard:m[1]},classList:{toggle(){}},onclick:null,onmouseenter:null}));
 if(sel==='[data-slot]')elements=[...this.innerHTML.matchAll(/<button type="button" data-slot="(\d+)"/g)].map(m=>({dataset:{slot:m[1]},onclick:null,onfocus:null}));
 if(sel==='[data-pick]')elements=[...this.innerHTML.matchAll(/<button data-pick="(\d+)"/g)].map(m=>({
  dataset:{pick:m[1]},onclick:null,closest(){return {querySelector(){return {textContent:'',className:''}}}}}));
 bound.set(sel,elements);return elements;
}};
const animations=[];let batches=0,reducedMotion=false;
const makeCard=(id,initialTier)=>{const classes=new Set(['pick',...(initialTier?['tier-group-start']:[])]);return {
 dataset:{speciesId:id,...(initialTier?{tierGroup:initialTier}: {})},
 classList:{contains:k=>classes.has(k),add:k=>classes.add(k),remove:k=>classes.delete(k)},
 animate(frames,options){animations.push({id,frames,options})}
}};
const grid={
 scrollTop:123,list:null,
 get children(){if(this.list===null)this.list=[...app.innerHTML.matchAll(/<div class="pick( tier-group-start)?" data-species-id="(\d+)"(?: data-tier-group="([A-D S]+)")?>/g)].map(x=>makeCard(x[2],x[3]));return this.list},
 appendChild(card){const i=this.list.indexOf(card);if(i>=0)this.list.splice(i,1);this.list.push(card)},
 replaceChildren(fragment){batches++;this.list=fragment.contents.slice()}
};
const doc={
 createDocumentFragment(){return {contents:[],appendChild(card){this.contents.push(card)}}},
 getElementById(id){if(id==='app')return app;if(id==='challengePickGrid')return grid;
 if(!controls.has(id))controls.set(id,{id,value:'',textContent:'',setAttribute(){}});
 return controls.get(id)}};
const ctx=vm.createContext({window:{matchMedia:()=>({matches:reducedMotion})},document:doc,console,localStorage:{getItem(){return saved},setItem(k,v){saved=v}},
 crypto:{getRandomValues(a){a[0]=18391;return a}},alert:()=>{},confirm:()=>true});
for(const file of ['assets/js/national-species.js','assets/js/calibration-profile.js','assets/js/position-effectiveness.js','assets/js/quick-sim.js','challenge/special-items-data.js','challenge/tiers.js','play/opponents.js']){
 vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file,timeout:15000});
}
const html=fs.readFileSync(path.join(root,'challenge/index.html'),'utf8');
vm.runInContext(html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>')),ctx,{filename:'challenge-inline',timeout:15000});
assert.match(app.innerHTML,/class="slot-tier tier-/);
assert.match(app.innerHTML,/class="slot-fit-badges"/,'Filled Challenge card has tier + efficiency');
assert.match(app.innerHTML,/class="slot-efficiency"[^>]*>\d{2,3}%/,'Challenge shows numeric efficiency, not hidden role fit');
assert.match(app.innerHTML,/class="pick-tier tier-/);
assert.doesNotMatch(app.innerHTML,/\d+(?:\.\d+)? OVR/);
const slots=bound.get('[data-slot-card]');
assert.equal(slots.length,11);
const initial=JSON.parse(saved).selected;
assert.equal(initial,1);
const before=Array.from(grid.children,x=>Number(x.dataset.speciesId));
assert(before.length>2,'Multiple scouted Pokémon available');
slots[9].onmouseenter();
assert.deepEqual(Array.from(grid.children,x=>Number(x.dataset.speciesId)),before,'Hover previews grade without shuffling the list');
assert.equal(grid.scrollTop,123,'Hover does not reset scroll');
assert.equal(controls.get('selectedDraftPosition').textContent,'ST POSITION · PREVIEW');
assert.equal(JSON.parse(saved).selected,1,'hover is a transient preview until clicked');
slots[9].onclick();
assert.equal(JSON.parse(saved).selected,9,'click anywhere on the tile commits the position');
assert.equal(grid.scrollTop,0,'clicking a new position scrolls candidates to top');
const shuffled=before.some((id,i)=>id!==Number(grid.children[i].dataset.speciesId));
assert.equal(batches,shuffled?1:0,'At most one atomic DOM reorder, not appendChild on every card');
assert(animations.length<=12,'Only the top 12 cards animate, never the whole list');
assert(animations.every(x=>x.options.duration<=250),'Shuffle is fast and nonblocking');
assert(animations.every(x=>x.frames[0].transform.includes('translateY')),'Shuffle uses compositor transforms');
const species=new Map(ctx.window.FXI_SPECIES.map(x=>[x.id,x]));
const score=(s,pos='ST')=>ctx.window.PFC_POSITION_EFFECTIVENESS.preciseFit(s.baseStats,pos);
const rank={S:0,A:1,B:2,C:3,D:4};
const ordered=Array.from(grid.children,x=>species.get(Number(x.dataset.speciesId)));
const expected=before.map(id=>species.get(id)).sort((a,b)=>rank[tiers.tier(score(a))]-rank[tiers.tier(score(b))]||a.name.localeCompare(b.name)||a.id-b.id);
assert.deepEqual(ordered.map(x=>x.id),expected.map(x=>x.id),'selected ST position sorts Pokémon S-to-D then alphabetically within each tier');
const actualTiers=ordered.map(x=>rank[tiers.tier(score(x))]);
assert(actualTiers.every((rank,i)=>i===0||rank>=actualTiers[i-1]),'tiers are monotone descending');
const beforeWing=batches,preWing=Array.from(grid.children,x=>Number(x.dataset.speciesId));
slots[8].onclick(); // Winger now uses its own ratings, unlike ST.
const wingSorted=preWing.map(id=>species.get(id)).sort((a,b)=>rank[tiers.tier(score(a,'LW'))]-rank[tiers.tier(score(b,'LW'))]||a.name.localeCompare(b.name)||a.id-b.id);
assert.deepEqual(Array.from(grid.children,x=>Number(x.dataset.speciesId)),wingSorted.map(x=>x.id));
assert.equal(batches,beforeWing+(wingSorted.some((s,i)=>s.id!==preWing[i])?1:0),'One atomic reorder when switching ST to LW');
reducedMotion=true;
const animationsBefore=animations.length;
slots[1].onclick(); // LB is different rating family
assert.equal(animations.length,animationsBefore,'Reduced-motion preference skips shuffling entirely');
assert.equal(JSON.parse(saved).selected,1,'Reduced-motion selection still commits successfully');
assert.match(app.innerHTML,/SORTED BY POSITION FIT/);
const staticCards=app.innerHTML;
for(const key of ['HP','ATK','DEF','SpA','SpD','SPE'])
 assert.match(staticCards,new RegExp('<b>'+key+'</b> \\d+'),key+' base stat visible in draft');
assert.match(staticCards,/class="pick tier-group-start" data-species-id="/,'Tier category heading present');
const groups=grid.children.filter(x=>x.classList.contains('tier-group-start'));
const uniqueTiers=[...new Set(ordered.map(x=>tiers.tier(score(x))))];
assert.equal(groups.length,[...new Set(grid.children.map(x=>x.dataset.tierGroup).filter(Boolean))].length,'Each tier has one heading');
assert.equal(app.innerHTML,staticCards,'Position switching reuses existing cards and static base stats');
slots[0].onmouseenter();
assert.equal(JSON.parse(saved).selected,1,'occupied slot not treated as new draft destination');
const css=fs.readFileSync(path.join(root,'challenge/challenge.css'),'utf8');
assert.match(css,/\.challenge-pitch \.slot button\[data-slot\][^\n]*position:absolute/,'Full-tile click overlay');
assert.match(css,/\.challenge-pitch \.slot\.empty:hover/,'Hover indication');
const skin=fs.readFileSync(path.join(root,'assets/css/newtro.css'),'utf8');
assert.match(skin,/\.challenge-frame button:hover:not\(:disabled\):not\(\.primary\)/,
 'Shared newtro style contains the generic button hover that must not cover a pitch card');
assert.match(css,/\.challenge-frame \.challenge-pitch \.slot button\[data-slot\]:is\(:hover,:focus,:active\)\{\s*background:transparent!important;\s*border:0!important;\s*box-shadow:none!important;/,
 'Full-tile click target stays visually transparent during hover/focus instead of hiding the slot');
const cssCacheVersion=Number(html.match(/challenge\.css\?v=(\d+)/)?.[1]);
assert(Number.isInteger(cssCacheVersion)&&cssCacheVersion>=32,
 'The transparent-hover CSS retains a refreshed production cache version');
console.log('PASS fast S-D tier sorting: cached previews, one DOM batch, max 12 animated cards, no same-role reflow and reduced motion');
