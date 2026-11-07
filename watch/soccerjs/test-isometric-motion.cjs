'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {motionFrame,shotSummary,playbackRate}=require('./phase10-motion.cjs');
const fixture=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'fixture.json'),'utf8'));
const initial=JSON.stringify(fixture);
const field={width:106,height:68};
const types=new Set(),teamIds=[fixture.home.id,fixture.away.id];
let runs=0;
for(let tick=0;tick<=1200;tick++){
 const minute=tick/240; // 0.25-second samples include short controlled first touches
 const frame=motionFrame(fixture,minute,field);
 assert.deepEqual(frame,motionFrame(fixture,minute,field));
 assert.equal(frame.actors.length,22);
 for(const actor of frame.actors){
  assert(Number.isFinite(actor.x)&&Number.isFinite(actor.y));
  assert(actor.x>=-2&&actor.x<=108,'Actor left field');
  assert(actor.y>=-2&&actor.y<=70,'Actor left field');
 }
 assert(Number.isFinite(frame.ball.x)&&Number.isFinite(frame.ball.y)&&Number.isFinite(frame.ball.z));
 assert(frame.ball.x>=-2&&frame.ball.x<=108);
 assert(frame.ball.y>=-2&&frame.ball.y<=70);
 types.add(frame.action);
 runs++;
}
for(const action of ['illustrative-carry','illustrative-dribble','illustrative-challenge'])
 assert(types.has(action),'No '+action+' in five-minute clip');
assert(['illustrative-pass','illustrative-give-and-go','illustrative-cross',
 'illustrative-through-ball','illustrative-bank-pass'].some(action=>types.has(action)),
 'No real passing animation (including a valid wall bank) in five-minute clip');
for(const goal of fixture.events){
 const before=motionFrame(fixture,goal.minute-.08,field);
 const at=motionFrame(fixture,goal.minute,field);
 assert(before.action==='illustrative-shot'||before.action==='illustrative-goal-buildup');
 assert.equal(at.action,'official-goal');
 assert.equal(at.officialEvent.player,goal.player,'Official player changed in animation');
 assert.equal(at.officialEvent.team,goal.team);
 const side=teamIds.indexOf(goal.team),idx=([fixture.home,fixture.away][side]).lineup.findIndex(p=>p.id===goal.player);
 assert(at.actors[side*11+idx].frame===3,'Shooter not in shot pose');
}
// PR #30 compatible improvements: validate official final shot ledger,
// not fictitious live on-target counts, and slow near official goal times.
const summary=shotSummary(fixture.stats);
assert.match(summary,/FULL-TIME TOTALS \(not live\)/);
assert.match(summary,/Shots 14–16/);
assert.match(summary,/On target 9–7/);
assert.match(summary,/Keeper saves 6–7/);
assert.throws(()=>shotSummary([{...fixture.stats[0],shotsOnTarget:99},fixture.stats[1]]),/reconcile/);
assert.throws(()=>shotSummary([{...fixture.stats[0],saves:100},fixture.stats[1]]),/reconcile/);
const goal=fixture.events.find(e=>e.type==='goal');
assert(goal);
const steady=playbackRate(0,fixture.events,1);
assert.equal(steady,1/60,'1x must be exactly one match second per real second');
assert.equal(playbackRate(goal.minute-.3,fixture.events,1),1/60,'Goal buildup must not speed up/slow real-time 1x');
assert.equal(playbackRate(goal.minute+.1,fixture.events,1),1/60,'Goal aftermath must remain true 1:1');
assert.equal(playbackRate(0,fixture.events,4),4/60,'4x advances four match seconds per real second');
assert.equal(playbackRate(goal.minute-.3,fixture.events,4),4/60,
 'Selected Watch speed must remain constant before an official goal');
assert.equal(playbackRate(0,[{type:'save',minute:0}],1),1/60,'A save cannot trigger goal slow-motion');
assert.equal(playbackRate(15,[],2),2/60,'2x with no goals stays exact');
assert.equal(playbackRate(0,[],1)*60*90,90,'90 minutes at 1x requires 90 real minutes');
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
let maxTransition=0,maxTransitionInfo='';
for(let cycle=1;cycle<210;cycle++){
 const t=cycle*.35;
 const left=motionFrame(fixture,t-0.000001,field);
 const right=motionFrame(fixture,t+0.000001,field);
 const distances=[distance(left.ball,right.ball),
  ...left.actors.map((player,i)=>distance(player,right.actors[i]))];
 const highest=Math.max(...distances);
 if(highest>maxTransition){
  maxTransition=highest;
  maxTransitionInfo=' at '+t+' minute, index '+distances.indexOf(highest)+
   ' actions '+left.action+' / '+right.action+' phase '+left.pressPhase+' / '+right.pressPhase+
   ' sides '+left.pressingSide+' / '+right.pressingSide+
   ' pressers '+JSON.stringify(left.pressingPlayers)+' / '+JSON.stringify(right.pressingPlayers)+
   ' points '+JSON.stringify(distances.indexOf(highest)>0?left.actors[distances.indexOf(highest)-1]:left.ball)+
   ' / '+JSON.stringify(distances.indexOf(highest)>0?right.actors[distances.indexOf(highest)-1]:right.ball);
 }
}
assert(maxTransition<.15,'Off-ball players/ball teleport at a possession boundary: '+maxTransition+maxTransitionInfo);
for(const event of fixture.events.filter(e=>e.type==='goal')){
 for(const moment of [event.minute-.7,event.minute+.22]){
  const left=motionFrame(fixture,moment-.000001,field);
  const right=motionFrame(fixture,moment+.000001,field);
  if(moment===event.minute-.7){
   assert(distance(left.ball,right.ball)<.15,'Ball teleports into goal scene');
   assert(Math.max(...left.actors.map((p,i)=>distance(p,right.actors[i])))<.15,
    'Defenders jump when the goal buildup starts');
  }else{
   assert.equal(left.action,'official-goal','Goal must finish in the net');
   assert.equal(right.action,'illustrative-kickoff','Goal must cut to a kickoff');
   assert.equal(right.sceneCut,'post-goal-kickoff');
   assert(distance(right.ball,{x:field.width/2,y:field.height/2})<.03,
    'Kickoff restarts at midfield');
  }
 }
}
const joggingA=motionFrame(fixture,2,field),joggingB=motionFrame(fixture,2+1/60,field);
assert(joggingA.actors.some((p,i)=>distance(p,joggingB.actors[i])>.02),
 'Off-ball Pokémon must keep moving when the ball is elsewhere');
assert.equal(JSON.stringify(fixture),initial,'Source match mutated by visuals');
console.log('PASS Phase10 isometric motion: '+runs+' identical five-minute frames, passes, contests, dribbles, all 3 official scorers, no source change');
