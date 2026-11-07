'use strict';
/* Hybrid Counterpress and offensive tactics are visuals, never PSE events. */
const assert=require('node:assert/strict');
const fixture=require('./fixture.json');
const {planFor,sample}=require('./phase10-play-director.cjs');
const {status,position,press,styleFor}=require('./phase10-team-shape.cjs');
const {motionFrame,base}=require('./phase10-motion.cjs');
const field={width:106,height:68},old=JSON.stringify(fixture);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const progress=(p,side)=>(side===0?p.x:field.width-p.x)/field.width;
const plan=planFor(fixture,field);
assert(plan.turnovers.length>25,'Too few visual regains to show counterpressing');
let tight=0,overlap=0,centerRuns=0,boxRuns=0,cover=0;
for(let seconds=0;seconds<12*60;seconds+=.5){
 const s=sample(fixture,field,seconds),frame=motionFrame(fixture,seconds/60,field);
 if(frame.action!=='illustrative-carry'||frame.ownerIndex<0)continue;
 const side=Math.floor(frame.ownerIndex/11);
 if(progress(frame.ball,side)<.665)continue;
 const mid=frame.actors[side*11+6],fullback=frame.actors[side*11+1],
  cb2=frame.actors[side*11+2],cb3=frame.actors[side*11+3];
 if(progress(mid,side)-.45>.15)tight++;
 if(progress(fullback,side)-.24>.16)overlap++;
 if(Math.max(progress(cb2,side),progress(cb3,side))>.64)centerRuns++;
 if(Math.max(progress(cb2,side),progress(cb3,side))>.82)boxRuns++;
 if(Math.min(progress(cb2,side),progress(cb3,side))<.50)cover++;
 assert(progress(frame.actors[side*11],side)<.12,'Goalkeeper must remain home');
}
assert(tight>70,'Midfield lacks aggressive forward team wave');
assert(overlap>50,'Fullback overlap frequency too low');
assert(centerRuns>20,'Center backs never join ordinary attacks');
assert(cover>70,'At least one center back must always cover');

// A turnover starts without snapping the existing shape, progresses to 0–4s
// press, 4–10s recovery, then re-forms. Rapid double turnovers stay smooth.
let tested=0,maxGap=0;
for(const turn of plan.turnovers){
 if(turn.time+11>=plan.duration||fixture.events.some(e=>e.type==='goal'&&
  Math.abs(turn.time-e.minute*60)<65))continue;
 const before=motionFrame(fixture,(turn.time-.00006)/60,field);
 const after=motionFrame(fixture,(turn.time+.00006)/60,field);
 const gap=Math.max(...before.actors.map((p,i)=>distance(p,after.actors[i])));
 maxGap=Math.max(maxGap,gap);
 assert(gap<.06,'Defenders teleport at regain '+turn.time+' gap='+gap);
 const p1=motionFrame(fixture,(turn.time+1)/60,field);
 assert.equal(p1.pressPhase,'counterpress');
 assert.equal(p1.pressingSide,turn.oldSide);
 assert.equal(p1.pressingPlayers.length,3);
 // A second turnover can legitimately interrupt the previous recovery.
 // Include the 10.5-second settled-state sample: a new turnover just
 // after 10s legitimately starts its own counterpress window.
 const another=plan.turnovers.some(x=>x.time>turn.time&&x.time<=turn.time+10.5);
 if(!another){
  assert.equal(motionFrame(fixture,(turn.time+5)/60,field).pressPhase,'recover');
  assert.equal(motionFrame(fixture,(turn.time+8)/60,field).pressPhase,'recover');
  assert.equal(motionFrame(fixture,(turn.time+10.5)/60,field).pressPhase,'settled');
  // Do not jump from a recovery press directly into a strong settled
  // marking displacement at precisely the 10-second boundary.
  const endLeft=motionFrame(fixture,(turn.time+10-.00006)/60,field);
  const endRight=motionFrame(fixture,(turn.time+10+.00006)/60,field);
  const settledJump=Math.max(...endLeft.actors.map((p,i)=>
   distance(p,endRight.actors[i])));
  assert(settledJump<.06,'Press-to-settled transition teleported a defender');
 }
 tested++;
}
assert(tested>15&&maxGap<.06,'Insufficient counterpress turnover samples');

// Existing team tactics must meaningfully change visible play selection.
function patternMix(tactic){
 const adapted={...fixture,
  home:{...fixture.home,tactic},away:{...fixture.away,tactic}};
 const sequences=planFor(adapted,field).sequences;
 const tally={};for(const row of sequences)tally[row.kind]=(tally[row.kind]||0)+1;
 return tally;
}
const possess=patternMix('possession'),counter=patternMix('counter'),
 wing=patternMix('wing'),balanced=patternMix('balanced');
assert(possess['one-two']>counter['one-two']*1.35,
 'Possession tactic does not emphasize give-and-go');
assert(counter.through>possess.through*1.3,
 'Counter tactic does not emphasize through balls');
assert(wing.cross>balanced.cross*1.2,'Wing tactic does not favor crosses');
assert(styleFor('press').press>styleFor('balanced').press);
assert(styleFor('attacking').push>styleFor('defensive').push);
assert(styleFor('balanced')===styleFor('unexpected'),'Unknown tactic must default safely');
for(const goal of fixture.events.filter(e=>e.type==='goal')){
 const frame=motionFrame(fixture,goal.minute,field);
 assert.equal(frame.action,'official-goal');
 assert.equal(frame.officialEvent.player,goal.player);
}
assert.equal(JSON.stringify(fixture),old,'Official PSE fixture changed');
console.log('PASS Hybrid Counterpress and tactics: '+tested+' turnovers, '+
 tight+' midfield surges, '+overlap+' overlaps, '+centerRuns+
 ' CB surges, '+boxRuns+' box arrivals, '+cover+' covering frames, '+
 maxGap.toFixed(5)+'m max turnover jump; PSE immutable');
