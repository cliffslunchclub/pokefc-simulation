'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
let clock=0,nextId=1;const tasks=new Map();
function schedule(fn,delay,repeat){const id=nextId++;tasks.set(id,{at:clock+delay,delay,repeat,fn});return id}
function clear(id){tasks.delete(id)}
function advance(ms){
 const until=clock+ms;
 for(let ticks=0;ticks<5000;ticks++){
  let first=null;for(const [id,t] of tasks)if(t.at<=until&&(!first||t.at<first[1].at))first=[id,t];
  if(!first)break;
  const [id,t]=first;clock=t.at;
  if(t.repeat)t.at+=t.delay;else tasks.delete(id);
  t.fn();
 }
 clock=until;
}
const win={matchMedia:()=>({matches:false})};
const ctx=vm.createContext({window:win,console,setInterval:(fn,ms)=>schedule(fn,ms,true),clearInterval:clear,
 setTimeout:(fn,ms)=>schedule(fn,ms,false),clearTimeout:clear});
vm.runInContext(fs.readFileSync(path.join(root,'challenge/slot-reels.js'),'utf8'),ctx,{filename:'slot-reels.js'});
const api=win.PFC_CHALLENGE_SLOT_REELS;
assert(api);
function nodes(){
 const labels=['region','type'];
 const reels=labels.map(()=>{const classes=new Set();return{classes,classList:{
  toggle(k,on){on?classes.add(k):classes.delete(k)},add:k=>classes.add(k),remove:k=>classes.delete(k)}}});
 const values=Object.fromEntries(labels.map((x,i)=>[x,{textContent:'?',closest:()=>reels[i]}]));
 const skip={hidden:true,onclick:null},live={textContent:''},classes=new Set();
 const els={
  '[data-reel-value="region"]':values.region,'[data-reel-value="type"]':values.type,
  '[data-reel-skip]':skip,'[data-reel-live]':live
 };
 const element={querySelector:q=>els[q],querySelectorAll:q=>q==='.slot-reel'?reels:[],
  classList:{add:k=>classes.add(k),remove:k=>classes.delete(k)}};
 return{element,values,reels,classes,skip,live};
}
const final={gen:4,type:'water',count:17};
let done=0;const a=nodes();
api.mount(a.element,final,{animate:true,pool:4,onDone:()=>done++});
assert.equal(a.skip.hidden,false);
assert.equal(a.classes.has('slot-machine-spinning'),true);
assert.equal(a.element.querySelector('[data-reel-value="pool"]'),undefined,'Only two reels are present');
advance(900);
assert.equal(a.values.region.textContent,'SINNOH','region reel settles first');
advance(350);
assert.equal(a.values.type.textContent,'WATER','type reel settles second');
advance(75);
assert.equal(done,1,'Candidate reveal completes shortly after second reel, with no third reel delay');
assert.equal(a.classes.has('slot-machine-spinning'),false,'Spinner completes after region and type');
assert.equal(a.classes.has('slot-machine-spinning'),false);
assert.equal(a.skip.hidden,true);
assert.equal(done,1);
assert.match(a.live.textContent,/Scouting complete/);
assert.doesNotMatch(a.live.textContent,/\d+ eligible Pokémon/,'No pool quantity is exposed in reel status');
assert.equal(tasks.size,0,'no timers left after finished animation');
const b=nodes();let skipped=0;
api.mount(b.element,{gen:9,type:'fire',count:28},{animate:true,pool:9,onDone:()=>skipped++});
advance(200);
b.skip.onclick();
assert.equal(skipped,1);
assert.equal(b.values.region.textContent,'PALDEA');
assert.equal(b.values.type.textContent,'FIRE');
assert.equal(b.element.querySelector('[data-reel-value="pool"]'),undefined,'No third status reel after skip');
assert.equal(tasks.size,0,'skipping clears all intervals');
const c=nodes();let cancelled=0;
api.mount(c.element,final,{animate:true,pool:4,onDone:()=>cancelled++});
api.cancel();
advance(3000);
assert.equal(cancelled,0,'discarded animation does not re-trigger stale callback');
win.matchMedia=()=>({matches:true});
const d=nodes();let reduced=0;
api.mount(d.element,final,{animate:true,pool:4,onDone:()=>reduced++});
assert.equal(d.values.region.textContent,'SINNOH');
assert.equal(d.skip.hidden,true);
assert.equal(reduced,1,'reduced motion resolves without animation');
assert.equal(tasks.size,0);
let noReelsDone=0;
api.mount({querySelector(){return null}},final,{animate:true,onDone:()=>noReelsDone++});
assert.equal(noReelsDone,1,'Incomplete reel UI still triggers reveal callback');
console.log('PASS Challenge two-reel scouting: staggered settle, skip, cancel, reduced motion and exact pre-rolled outcome');
