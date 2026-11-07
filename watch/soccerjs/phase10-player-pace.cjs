'use strict';
/**
 * Visual player movement limits measured in pitch meters per match second.
 * The same limits apply before and after passing at all Watch speeds.
 * PSE scoring, events, ball flight and tackle outcomes are not changed.
 */
const NORMAL_RUN=4.0;
const BALL_CARRY=3.8;
const SHORT_SPRINT=5.0;
function speedFor(script,index){
 // Keepers alone can charge or retreat at a bounded five metres/second;
 // ordinary players retain the existing with/without-ball limits.
 if(index%11===0)return SHORT_SPRINT;
 if(script?.ownerIndex===index)return BALL_CARRY;
 if(script?.pressPhase==='counterpress'&&
   Array.isArray(script.pressingPlayers)&&script.pressingPlayers.includes(index))
  return SHORT_SPRINT;
 return NORMAL_RUN;
}
function approach(previous,target,elapsed,maxSpeed){
 if(!previous||!target)return target;
 const dt=Math.max(0,Number(elapsed)||0);
 const dx=target.x-previous.x,dy=target.y-previous.y;
 const distance=Math.hypot(dx,dy),limit=dt*maxSpeed;
 if(!distance||distance<=limit)return {...target};
 const u=limit/distance;
 return {...target,x:previous.x+dx*u,y:previous.y+dy*u};
}
module.exports={NORMAL_RUN,BALL_CARRY,SHORT_SPRINT,speedFor,approach};
