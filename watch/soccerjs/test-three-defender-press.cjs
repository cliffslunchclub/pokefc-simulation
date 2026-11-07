'use strict';
const assert=require('node:assert/strict');
const TeamShape=require('./phase10-team-shape.cjs');
const field={width:106,height:68};
const lineup=Array.from({length:11},(_,i)=>({id:String(i),pos:i===0?'GK':i<5?'DEF':i<8?'MID':'FWD'}));
const fixture={home:{lineup,tactic:'balanced'},away:{lineup,tactic:'balanced'}};
function sample(ballX){
 const ball={x:ballX,y:34};
 const actors=Array.from({length:22},(_,id)=>({x:id<11?40:75,y:34+(id%11-5)*3}));
 const visual={stage:{start:0,duration:12,from:ball},plan:{turnovers:[]}};
 const shape={active:0,age:Infinity,phase:'settled',turnover:null,nextTurnover:null,
  profiles:[TeamShape.styleFor('balanced'),TeamShape.styleFor('balanced')]};
 const before=actors.map(p=>({...p}));
 const result=TeamShape.press(fixture,field,6,visual,shape,actors,ball);
 return {result,actors,before,ball};
}
const midfield=sample(53),danger=sample(96);
assert(danger.result.intensity>midfield.result.intensity,'Scoring-zone pressure must increase');
assert(danger.result.ids.length<=3,'Never press with more than three players');
assert.equal(new Set(danger.result.ids).size,danger.result.ids.length,'Duplicate presser');
assert(danger.result.ids.every(id=>id>=11&&id<22&&id!==11),
 'Only outfield defenders from the nonpossessing team may press');
assert(danger.result.ids.some(id=>Math.hypot(
 danger.actors[id].x-danger.ball.x,danger.actors[id].y-danger.ball.y)<
 Math.hypot(danger.before[id].x-danger.ball.x,danger.before[id].y-danger.ball.y)),
 'A defender must actually converge on the danger');
console.log('Three-defender danger press smoke test passed');
