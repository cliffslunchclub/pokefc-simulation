'use strict';
const assert=require('node:assert/strict');
const fixture=require('./fixture.json');
const {motionFrame}=require('./phase10-motion.cjs');
const {nextBoundary}=require('./phase10-play-director.cjs');
const field={width:106,height:68},original=JSON.stringify(fixture);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
let tested=0;
for(const goal of fixture.events.filter(e=>e.type==='goal')){
 const pos=goal.minute;
 const side=goal.team===fixture.home.id?0:1;
 const goalkeeperIndex=(1-side)*11;
 const net={x:side===0?field.width+.9:-.9};
 const nearLine=side===0?field.width:0;
 const direction=side===0?1:-1;
 const flight=[.90,.94,.97,.99,1].map(frac=>
  motionFrame(fixture,pos-.7+.7*frac,field));
 for(let i=1;i<flight.length;i++)
  assert((flight[i].ball.x-flight[i-1].ball.x)*direction>0,
   'Shot must advance continuously toward goal; no reverse/whip');
 const goalFrame=motionFrame(fixture,pos,field);
 const keeper=goalFrame.actors[goalkeeperIndex];
 assert((goalFrame.ball.x-nearLine)*direction>.5,'Ball must cross end line into goal');
 assert((goalFrame.ball.x-keeper.x)*direction>2,'Scored ball must pass keeper');
 assert(Math.abs(goalFrame.ball.y-keeper.y)>2,'Keeper must visibly miss shot');
 assert(Math.abs(goalFrame.ball.y-field.height*.5)<3.5,
  'Scored ball must finish inside goal-mouth posts');
 const held=motionFrame(fixture,pos+.14,field);
 assert.equal(held.action,'official-goal');
 assert(Math.abs(held.ball.x-net.x)<.001,'Scored ball must remain behind end line');
 const cut=pos+.22;
 const before=motionFrame(fixture,cut-1e-7,field);
 const after=motionFrame(fixture,cut+1e-7,field);
 assert.equal(before.action,'official-goal');
 assert.equal(after.action,'illustrative-kickoff');
 assert.equal(after.sceneCut,'post-goal-kickoff');
 assert(distance(after.ball,{x:field.width/2,y:field.height/2})<.001);
 assert.equal(after.officialEvent,null,'Kickoff is not an invented official PSE event');
 const restartStart=(pos+.22)*60;
 const restartEnd=nextBoundary(fixture,field,restartStart+4);
 const mid=motionFrame(fixture,((restartStart+restartEnd)/2)/60,field);
 assert.equal(mid.action,'illustrative-kickoff');
 const landingBefore=motionFrame(fixture,(restartEnd-1e-5)/60,field);
 const landingAfter=motionFrame(fixture,(restartEnd+1e-5)/60,field);
 assert(distance(landingBefore.ball,landingAfter.ball)<.01,
  'Kickoff pass must connect to next possession without a jump');
 const actorGaps=landingBefore.actors.map((actor,i)=>distance(actor,landingAfter.actors[i]));
 const largest=Math.max(...actorGaps),id=actorGaps.indexOf(largest);
 assert(largest<.05,'Kickoff players must return continuously to regular play; '+
  'goal '+pos+', boundary '+restartEnd+', player '+id+', gap '+largest+
  ', before '+JSON.stringify(landingBefore.actors[id])+
  ', after '+JSON.stringify(landingAfter.actors[id]));
 tested++;
}
assert(tested>=2,'Expected multiple goal restart checks');
assert.equal(JSON.stringify(fixture),original,'Visual restart mutated the PSE fixture');
console.log('PASS Watch goal crossing and kickoff cuts: '+tested+' goals past keeper/end line into side netting, net holds, midfield cut');
