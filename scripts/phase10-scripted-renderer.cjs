'use strict';
/**
 * Phase 10B: an externally-authored match drives existing Soccer-JS *entities*.
 * No native Soccer-JS simulation ticks, goals, or automatic decisions run.
 * This deliberately avoids importing any private PokéFC Quick Sim source.
 *
 * Result is an API feasibility adapter, not the browser/UI integration.
 */
const assert=require('node:assert/strict');

function validateScript(script){
 assert(script&&typeof script==='object','Match script is required');
 assert(script.mode==='league'||script.mode==='knockout','Competition type required');
 assert(script.duration===90||script.duration===120,'Only 90/120 minute matches supported');
 assert(Array.isArray(script.events),'Time-ordered goal events required');
 assert(Array.isArray(script.score)&&script.score.length===2,'Final score required');
 let last=-Infinity,totals=[0,0];
 for(const goal of script.events){
  assert(goal.type==='goal','Only official goals supported in this first visualization proof');
  assert([0,1].includes(goal.side),'Invalid team side');
  assert(Number.isInteger(goal.scorerIndex)&&goal.scorerIndex>=0&&goal.scorerIndex<11,'Invalid shooter index');
  assert(Number.isFinite(goal.minute)&&goal.minute>=0&&goal.minute<script.duration,'Goal outside match');
  assert(goal.minute>=last,'Goal events out of order');
  last=goal.minute; totals[goal.side]++;
 }
 assert.deepEqual(totals,script.score,'Scripted goals differ from official score');
 return true;
}
function scoreAt(script,minute){
 assert(Number.isFinite(minute)&&minute>=0&&minute<=script.duration,'Invalid clock');
 const goals=[0,0];
 for(const goal of script.events){
  if(goal.minute<=minute)goals[goal.side]++;
 }
 return goals;
}
function formationPoint(side,i,field){
 const invert=side===0?x=>x:x=>field.width-x;
 const h=field.height,unit=h/68;
 if(i===0)return {x:invert(field.width*.07),y:h/2};
 if(i<5)return {x:invert(field.width*.24),y:(12+(i-1)*14)*unit};
 if(i<8)return {x:invert(field.width*.45),y:(18+(i-5)*16)*unit};
 return {x:invert(field.width*.68),y:(18+(i-8)*16)*unit};
}
function lerp(a,b,t){return a+(b-a)*Math.max(0,Math.min(1,t));}
function frameAt(script,minute,field){
 validateScript(script);scoreAt(script,minute);
 assert(field&&field.width>0&&field.height>0,'Soccer-JS pitch bounds required');
 const players=[];
 for(let side=0;side<2;side++)
  for(let i=0;i<11;i++)
   players.push({side,index:i,...formationPoint(side,i,field),orientation:side===0?2:6,frame:0,z:0});
 let ball={x:field.width/2,y:field.height/2,z:0.15};
 let action=null;
 // Approximate 10 seconds BEFORE the scripted goal; score remains authoritative.
 for(const g of script.events){
  if(minute>=g.minute-0.16 && minute<g.minute+0.13){
   const kicker=players[g.side*11+g.scorerIndex],keeper=players[(1-g.side)*11];
   const right=g.side===0,fromX=right?field.width*.83:field.width*.17;
   const toX=right?field.width*.995:field.width*.005;
   const shotStart=g.minute-.055,shotEnd=g.minute+.01;
   kicker.x=fromX;kicker.y=field.height*.52;keeper.x=right?field.width*.98:field.width*.02;
   keeper.y=field.height*.52;
   kicker.frame=minute<shotStart?1:3;
   keeper.frame=minute>=shotStart?8:0;
   if(minute<shotStart) ball={x:lerp(field.width*.5,fromX,(minute-(g.minute-.16))/.105),y:field.height*.52,z:.2};
   else ball={x:lerp(fromX,toX,(minute-shotStart)/(shotEnd-shotStart)),y:field.height*.52,z:.15};
   action={type:'goal',minute:g.minute,side:g.side,scorerIndex:g.scorerIndex,phase:minute<shotStart?'approach':'shot'};
   break;
  }
 }
 return {minute,score:scoreAt(script,minute),players,ball,action};
}
function applyToSoccerJS(sim,frame){
 assert(sim&&Array.isArray(sim.players)&&sim.players.length===22,'A live Soccer-JS 22-player match required');
 assert(sim.ball,'Soccer-JS ball entity required');
 // Important: position injection happens WITHOUT sim.updateAll(), avoiding
 // independent native physics, goal checks, and AI decisions.
 for(const spec of frame.players){
  const p=spec.side===0?sim.teamA.players[spec.index]:sim.teamB.players[spec.index];
  assert(p,'Player mapping missing for '+spec.side+'/'+spec.index);
  p.x=spec.x;p.y=spec.y;p.z=spec.z;
  p.orientation=spec.orientation;p.frame=spec.frame;
  p.vx=p.vy=p.vz=0;
 }
 sim.ball.owner=null;sim.ball.x=frame.ball.x;sim.ball.y=frame.ball.y;sim.ball.z=frame.ball.z;
 sim.ball.vx=sim.ball.vy=sim.ball.vz=0;
 sim.matchTimer=frame.minute*60;
 sim.scoreA=frame.score[0];sim.scoreB=frame.score[1];
 assert.deepEqual([sim.scoreA,sim.scoreB],frame.score,'Soccer-JS scoreboard drift');
 return sim;
}
module.exports={validateScript,scoreAt,frameAt,applyToSoccerJS};
