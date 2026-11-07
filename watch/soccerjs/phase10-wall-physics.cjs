'use strict';
/**
 * Soccer-JS Watch only: low ball banks from a rink-style enclosure.
 *
 * All four perimeter boards reflect the visual ball. Both goal-mouth
 * openings remain unobstructed; ONLY official PSE goal scenes may ever
 * cross a goal line through those openings. No events or stats are made.
 */
const RADIUS=.34;
const GOAL_HALF_WIDTH=3.66;
// Padding around the posts matches the collision no-board clearance. It
// keeps the raised rail visibly OUTSIDE the projected goal net too.
const GOAL_BOARD_OPEN_HALF_WIDTH=GOAL_HALF_WIDTH+RADIUS+.65;
// Very soft padded boards: retain only 3–7% of the prior .82 rebound.
// The ball rolls at most 0.6 m outward from the contact point.
const ORIGINAL_RESTITUTION=.82;
const DEFAULT_REBOUND_FACTOR=.05;
const MIN_REBOUND_FACTOR=.03;
const MAX_REBOUND_FACTOR=.07;
const MAX_REBOUND_DISTANCE=.60;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const ease=u=>{u=clamp(u,0,1);return u*u*(3-2*u)};
function candidate(from,to,field,axis,edge,reboundFactor=DEFAULT_REBOUND_FACTOR){
 if(!from||!to||!field||!['x','y'].includes(axis)||!['min','max'].includes(edge))return null;
 const near=RADIUS,far=field[axis==='x'?'width':'height']-RADIUS;
 const position=edge==='min'?near:far;
 const normalFrom=Math.abs(position-from[axis]);
 const normalTo=Math.abs(position-to[axis]);
 if(normalFrom<.15||normalTo<.15)return null;
 const ratio=normalFrom/(normalFrom+normalTo);
 const lateral=axis==='x'?'y':'x';
 const impact={x:0,y:0};
 impact[axis]=position;
 impact[lateral]=lerp(from[lateral],to[lateral],ratio);
 if(axis==='x'){
  // The goal is an OPENING in the end board. Never bounce across it.
  if(Math.abs(impact.y-field.height/2)<=GOAL_BOARD_OPEN_HALF_WIDTH)return null;
  if(impact.y<RADIUS+.8||impact.y>field.height-RADIUS-.8)return null;
 }else if(impact.x<RADIUS+.8||impact.x>field.width-RADIUS-.8)return null;
 const inLength=Math.hypot(impact.x-from.x,impact.y-from.y);
 const originalOutLength=Math.hypot(to.x-impact.x,to.y-impact.y);
 const originalPathLength=inLength+originalOutLength;
 // Keep the original geometry eligibility check, so bank frequency does
 // not increase just because the post-impact leg has become shorter.
 if(inLength<.65||originalOutLength<.65||!Number.isFinite(originalPathLength))return null;
 const strength=clamp(Number.isFinite(reboundFactor)?reboundFactor:
  DEFAULT_REBOUND_FACTOR,MIN_REBOUND_FACTOR,MAX_REBOUND_FACTOR);
 const outLength=Math.min(originalOutLength*strength,MAX_REBOUND_DISTANCE);
 const fraction=outLength/originalOutLength;
 const exit={x:lerp(impact.x,to.x,fraction),
  y:lerp(impact.y,to.y,fraction)};
 const restitution=ORIGINAL_RESTITUTION*strength;
 // Distance and exit velocity shrink in lockstep. Contact time stays
 // stable, keeping the existing Play Director timeline continuous.
 const timeAt=inLength/(inLength+outLength/restitution);
 // Precompute the inverse of the global cubic easing for exact impact time.
 let lo=0,hi=1;
 for(let i=0;i<24;i++){const mid=(lo+hi)/2;
  if(ease(mid)<timeAt)lo=mid;else hi=mid;}
 const impactU=(lo+hi)/2;
 return {axis,edge,hit:impact,exit,ratio:timeAt,impactU,
  pathLength:inLength+outLength,originalPathLength,
  reboundFactor:strength,restitution,goalOpeningPreserved:axis==='x'};
}
function bankAt(stage,seconds){
 const wall=stage.wall;
 if(!wall)return null;
 const duration=Math.max(.001,stage.duration||stage.end-stage.start);
 const u=ease((seconds-stage.start)/duration);
 const impactFraction=wall.ratio;
 const incoming=u<=impactFraction;
 const part=incoming?u/impactFraction:(u-impactFraction)/(1-impactFraction);
 const from=incoming?stage.from:wall.hit;
 const to=incoming?wall.hit:stage.to;
 return {x:lerp(from.x,to.x,clamp(part,0,1)),
  y:lerp(from.y,to.y,clamp(part,0,1)),
  z:.23+.10*Math.sin(Math.PI*u),contact:incoming?'approaching-wall':'rebounding',
  wallAxis:wall.axis,wallEdge:wall.edge,
  hit:wall.hit,impactSeconds:stage.start+duration*wall.impactU};
}
function sampleWall(stage,seconds){
 if(!stage.wall)return null;
 return bankAt(stage,seconds);
}
// Shared render geometry and physics goal-mouth model. There are no crossbar
// boards or rails spanning the goal opening; the six pieces meet the posts.
function boardSegments(field){
 const mid=field.height/2,half=GOAL_BOARD_OPEN_HALF_WIDTH,w=field.width,h=field.height;
 return [
  [[0,0],[w,0]],[[0,h],[w,h]],
  [[0,0],[0,mid-half]],[[0,mid+half],[0,h]],
  [[w,0],[w,mid-half]],[[w,mid+half],[w,h]]
 ];
}
function boundary(ball,field){
 return ball.x>=RADIUS-1e-6&&ball.x<=field.width-RADIUS+1e-6&&
  ball.y>=RADIUS-1e-6&&ball.y<=field.height-RADIUS+1e-6;
}
module.exports={candidate,sampleWall,boundary,RADIUS,GOAL_HALF_WIDTH,
 ORIGINAL_RESTITUTION,DEFAULT_REBOUND_FACTOR,MIN_REBOUND_FACTOR,MAX_REBOUND_FACTOR,
 MAX_REBOUND_DISTANCE,GOAL_BOARD_OPEN_HALF_WIDTH,boardSegments};
