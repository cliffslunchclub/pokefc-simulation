'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const Director=require('./phase10-play-director.cjs');
const field={width:106,height:68};
const sample=JSON.parse(fs.readFileSync(path.join(__dirname,'fixture.json'),'utf8'));
const original=JSON.stringify(sample);
const line=Director.offsideLine(sample,field,0,60);
assert(line>field.width*.5&&line<field.width);
assert(Director.isOffside(sample,field,0,60,line+2),'Offside beyond line in attacking half');
assert(!Director.isOffside(sample,field,0,60,line-2),'Onside level or behind defense');
assert(!Director.isOffside(sample,field,0,92,90),'Receiver behind ball is onside');
assert(!Director.isOffside(sample,field,0,28,35),'Own half is always onside');
const awayLine=Director.offsideLine(sample,field,1,47);
assert(Director.isOffside(sample,field,1,47,106-awayLine-2),
 'Away offside is mirrored correctly');
assert(!Director.isOffside(sample,field,1,47,106-awayLine+2),
 'Away onside is mirrored correctly');
const plan=Director.planFor(sample,field);
assert(plan.actions.length>100,'Expected full visual match plan');
assert(plan.actions.some(a=>a.pattern==='through'&&a.mode==='pass'),
 'Through balls must remain possible');
assert(plan.actions.some(a=>a.mode==='pass'),'Passes must remain possible');
assert(!plan.actions.some(a=>a.mode==='offside'||a.mode==='keeper-restart'),
 'Visual-only offside prevention must never interrupt possession');
for(let i=1;i<plan.actions.length;i++){
 const a=plan.actions[i-1],b=plan.actions[i];
 assert(Math.abs(a.end-b.start)<1e-7,'Play timeline has a gap');
 assert(Math.hypot(a.to.x-b.from.x,a.to.y-b.from.y)<1e-7,
  'Ball position was reset between possession stages');
}
for(const a of plan.actions){
 assert(Number.isFinite(a.from.x)&&Number.isFinite(a.to.x));
 assert(a.receiver>=0&&a.receiver<22);
 if(a.mode==='pass')assert.equal(Math.floor(a.owner/11),Math.floor(a.receiver/11),
  'A completed pass cannot change teams');
}
assert.equal(JSON.stringify(sample),original,'Visual plan must not mutate PSE result');
console.log('Offside-aware receiver screening and uninterrupted visual sequence passed');
