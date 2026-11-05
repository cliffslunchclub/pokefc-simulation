'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {motionFrame}=require('../viewer/phase10-real/phase10-motion.cjs');
const fixture=JSON.parse(fs.readFileSync('fixtures/phase10-real-quicksim-v07b.json','utf8'));
const initial=JSON.stringify(fixture);
const field={width:106,height:68};
const types=new Set(),teamIds=[fixture.home.id,fixture.away.id];
let runs=0;
for(let tenth=0;tenth<=100;tenth++){
 const minute=tenth/20; // first five match minutes, deterministic 0.05m samples
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
for(const action of ['illustrative-carry','illustrative-pass','illustrative-dribble','illustrative-challenge'])
 assert(types.has(action),'No '+action+' in five-minute clip');
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
assert.equal(JSON.stringify(fixture),initial,'Source match mutated by visuals');
console.log('PASS Phase10 isometric motion: '+runs+' identical five-minute frames, passes, contests, dribbles, all 3 official scorers, no source change');
