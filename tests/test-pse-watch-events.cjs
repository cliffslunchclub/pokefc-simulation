'use strict';
// PSE generates continuous-play matches with goals, saves and no whistle events.
// Historical reports may retain archived fields without altering new results.
const assert=require('node:assert/strict');
const qs=require('../assets/js/quick-sim.js'),bridge=require('../watch/soccerjs/watch-bridge.js');
const {motionFrame}=require('../watch/soccerjs/phase10-motion.cjs');
require('../challenge/match-report.js');
const report=globalThis.PFC_MATCH_REPORT;
const roles=['GK','DEF','DEF','DEF','DEF','MID','MID','MID','FWD','FWD','FWD'];
function team(id){return {id,name:id+' Gym FC',tactic:'press',
 lineup:roles.map((pos,i)=>({id:id+'-'+i,name:id+' Pokémon '+i,pos,
 main:{finishing:69+i,shortPassing:71+i,vision:70+i,firstTouch:72+i,sprintSpeed:75+i,tackling:76+i},
 detail:{reflexes:74,handling:75,positioning:74,diving:72,kicking:75,strength:73,decisionMaking:73}
 }))};}
const preview={home:team('home'),away:team('away'),seed:'enclosed-fixture'};
const field={width:106,height:68},forbidden=new Set(['corner','throw-in','foul','free-kick','penalty-kick']);
let matches=0,goals=0,bounded=0;
for(let i=0;i<120;i++){
 const result=qs.simulate(preview,{seed:'ENCLOSED-WATCH-'+i});
 const original=JSON.stringify(result),fixture=bridge.snapshot(preview,result);
 assert.equal(fixture.setPieceRules,undefined);
 assert.deepEqual(bridge.scoreAt(fixture,90),result.score);
 assert.deepEqual(bridge.scoreAt(fixture,0),[0,0]);
 assert.deepEqual(fixture.events.map(e=>e.type),result.events.map(e=>e.type));
 assert(fixture.events.every(e=>!forbidden.has(e.type)));
 assert(fixture.events.every(e=>e.type==='goal'||e.type==='save'));
 const parsed=report.fromResult(result,preview);
 assert.equal(parsed.status,'complete');
 assert.equal(parsed.setPieceRules,undefined);
 assert.equal(parsed.timeline.length,result.events.length);
 assert.equal(parsed.goals.length,result.score[0]+result.score[1]);
 for(const event of fixture.events.filter(e=>e.type==='goal')){
  // Multiple goals within a short window share the same illustrative
  // buildup; no single frame is required to depict both scorers.
  if(fixture.events.some(other=>other!==event&&other.type==='goal'&&
      Math.abs(other.minute-event.minute)<.75))continue;
  const frame=motionFrame(fixture,event.minute,field),direction=event.team===fixture.home.id?1:-1;
  assert.equal(frame.action,'official-goal');
  assert.equal(frame.officialEvent.player,event.player);
  assert((frame.ball.x-(direction===1?field.width:0))*direction>.5,
    'A goal must still cross the end line into the net');
  goals++;
 }
 for(let minute=0;minute<90;minute+=.7){
  const frame=motionFrame(fixture,minute,field);
  if(frame.action==='official-goal'||frame.action==='illustrative-goal-buildup'||
     frame.action==='illustrative-kickoff'||frame.action==='illustrative-shot')continue;
  assert(frame.ball.x>=0&&frame.ball.x<=field.width&&
   frame.ball.y>=0&&frame.ball.y<=field.height,
   'Open-play ball went out of bounds');
  bounded++;
 }
 assert.equal(JSON.stringify(result),original,'Watch/report mutated PSE');
 matches++;
}
assert(matches===120&&goals>0&&bounded>0);
console.log('PASS enclosed Watch/PSE integration: '+matches+' matches; '+goals+
 ' official goals, bounded ball and no recorded whistles');
