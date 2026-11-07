'use strict';
/**
 * Watch-only team shape and Hybrid Counterpress.
 * No generated PSE tackle, foul, turnover, goal or match statistic.
 * Deterministic from the same official fixture + illustrative director stages.
 */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ease=v=>{v=clamp(v,0,1);return v*v*(3-2*v)};
const lerp=(a,b,t)=>a+(b-a)*t;
function hash(s){let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0}
const PROFILES=Object.freeze({
 balanced:  {push:1,press:1,overlap:1,dribble:1,oneTwo:1,cross:1,through:1,switch:1},
 attacking: {push:1.12,press:1.08,overlap:1.25,dribble:1.07,oneTwo:1.1,cross:1.2,through:1.12,switch:.86},
 defensive: {push:.78,press:.78,overlap:.70,dribble:.94,oneTwo:.88,cross:.80,through:1.07,switch:1.12},
 press:     {push:1.07,press:1.38,overlap:1.10,dribble:1.12,oneTwo:1.15,cross:1.00,through:1.12,switch:.88},
 counter:   {push:.92,press:.92,overlap:1.05,dribble:1.32,oneTwo:.84,cross:.92,through:1.45,switch:.76},
 possession:{push:.97,press:1.02,overlap:1.0,dribble:.92,oneTwo:1.45,cross:.92,through:.79,switch:1.36},
 direct:    {push:1.06,press:1.0,overlap:1.07,dribble:1.14,oneTwo:.82,cross:1.06,through:1.47,switch:.79},
 wing:      {push:1.06,press:1.0,overlap:1.35,dribble:.96,oneTwo:.96,cross:1.55,through:.89,switch:1.08}
});
function styleFor(name){
 const key=String(name||'balanced').toLowerCase().replace(/[\s_-]/g,'');
 return PROFILES[key]||PROFILES.balanced;
}
const sideOf=id=>Math.floor(id/11);
const seedOf=f=>String(f.visualSeed||f.seed||'pfc');
// Compute turnover entry weights once. A second regain during a recovery
// inherits the actual pre-regain shape, rather than resetting both lines.
const weightCache=new WeakMap();
function weightAfter(item,age){
 if(!item)return [1,0];
 const {turn,before}=item;
 if(age>=10)return turn.newSide===0?[1,0]:[0,1];
 const output=before.slice();
 output[turn.oldSide]=age<4?lerp(before[turn.oldSide],1,ease(age/1.4)):
  1-ease((age-4)/6);
 output[turn.newSide]=age<4?lerp(before[turn.newSide],1,ease(age/3)):1;
 return output;
}
function preparedTurns(plan){
 const cached=weightCache.get(plan);if(cached)return cached;
 const out=[];
 for(const turn of plan.turnovers||[]){
  const previous=out.at(-1);
  out.push({turn,before:previous?weightAfter(previous,turn.time-previous.turn.time):[1,0]});
 }
 weightCache.set(plan,out);return out;
}
function turnoverPosition(items,t){
 let low=0,high=items.length;
 while(low<high){const mid=(low+high)>>1;
  if(items[mid].turn.time<=t)low=mid+1;else high=mid;}
 return low;
}
function lastTurnover(plan,t){
 const items=preparedTurns(plan),i=turnoverPosition(items,t);
 return items[i-1]?.turn||null;
}
function status(f,field,seconds,visual){
 const active=visual.stage.mode==='challenge'&&
  seconds>=visual.stage.end-.000001?
  sideOf(visual.stage.receiver):sideOf(visual.stage.owner);
 const turns=preparedTurns(visual.plan),index=turnoverPosition(turns,seconds);
 const latest=turns[index-1]||null,next=turns[index]||null;
 const age=latest?seconds-latest.turn.time:Infinity;
 const attack=weightAfter(latest,age);
 const phase=age<4?'counterpress':age<10?'recover':'settled';
 return {ball:visual.ball,active,attack,
  turnover:latest?.turn||null,nextTurnover:next?.turn||null,age,phase,
  pattern:visual.sequenceType,
  profiles:[styleFor(f.home.tactic),styleFor(f.away.tactic)]};
}
function roleOf(player,index){
 const role=String(player?.pos||'').toUpperCase();
 if(index===0||role==='GK')return 'GK';
 if(/^(CB|SW|DEF|LB|RB|LWB|RWB)$/.test(role))return 'DEF';
 if(/^(CM|CDM|CAM|LM|RM|MID)$/.test(role))return 'MID';
 if(/^(LW|RW|ST|CF|FWD)$/.test(role))return 'FWD';
 return index<5?'DEF':index<8?'MID':'FWD';
}
function position(f,field,id,seconds,shape,baseline){
 const side=sideOf(id),i=id%11,role=roleOf((side===0?f.home:f.away).lineup[i],i);
 if(role==='GK')return baseline;
 const p0=side===0?baseline.x/field.width:1-baseline.x/field.width;
 const ballProgress=side===0?shape.ball.x/field.width:1-shape.ball.x/field.width;
 const wave=ease((ballProgress-.16)/.66);
 const strength=shape.attack[side]*shape.profiles[side].push;
 const factors=role==='DEF'?.28:role==='MID'?.32:.17;
 let progress=p0+factors*wave*strength;
 const salt=hash(seedOf(f)+':'+side)%190/100;
 if(role==='DEF'){
  const label=String((side===0?f.home:f.away).lineup[i]?.pos||'').toUpperCase();
  const fullback=/^(LB|RB|LWB|RWB)$/.test(label)||i===1||i===4;
  if(fullback){
   // Frequent overlaps on both flanks, staggered in time.
   const rolling=(Math.sin(seconds*.057+salt+i*1.22)+1)*.5;
   progress+=.23*wave*strength*shape.profiles[side].overlap*ease((rolling-.19)/.62);
  }else{
   // Centre backs alternate forward surges while their partner covers.
   // Sine crosses zero with no sudden reassignment or position snaps.
   const surge=Math.sin(seconds*.043+salt);
   const active=i===2?Math.max(0,surge):i===3?Math.max(0,-surge):0;
   // Distinct surges and rare box arrivals (~10% of established
   // attacking-third frames), while the other CB stays in covering depth.
   progress+=wave*strength*shape.profiles[side].overlap*
    (.20*ease((active-.60)/.40)+.14*ease((active-.95)/.05));
   if(active<.01)progress=Math.min(progress,.465);
  }
 }
 // Defensive side also moves toward the ball; no static anchored backline.
 const closing=(1-shape.attack[side])*ease((.7-ballProgress)/.58);
 if(role==='DEF')progress-=closing*.025;
 if(role==='MID')progress-=closing*.035;
 progress=clamp(progress,.06,.955);
 const lanePull=(shape.ball.y-field.height*.5)*.10*
  (role==='MID'?.75:role==='FWD'?.55:.35);
 const y=clamp(baseline.y+lanePull,1,field.height-1);
 return {x:clamp(side===0?progress*field.width:(1-progress)*field.width,
  1,field.width-1),y};
}
function press(f,field,seconds,visual,shape,actors,ball){
 const stage=visual.stage,phase=(seconds-stage.start)/Math.max(.001,stage.duration);
 let side,intensity;
 if(shape.turnover&&shape.age>=0&&shape.age<10){
  side=shape.turnover.oldSide;
  intensity=ease(shape.age/1.25)*(1-ease((shape.age-4)/6));
 }else{
  side=1-shape.active;
  const attackProgress=shape.active===0?ball.x/field.width:1-ball.x/field.width;
  const finalThird=ease((attackProgress-.60)/.16);
  const ordinary=.48*ease(phase/.30)*(1-ease((phase-.62)/.36));
  const end=Number.isFinite(stage.end)?stage.end:stage.start+stage.duration;
  const edgeSeconds=Math.max(0,Math.min(seconds-stage.start,end-seconds));
  const settledThreat=finalThird*.65*ease(edgeSeconds/.55);
  intensity=Math.max(ordinary,settledThreat);
  if(shape.turnover)intensity*=ease((shape.age-10)/1.3);
 }
 intensity*=shape.profiles[side].press;
 // The nearest three defenders, not their fixed lineup slots, respond as
 // the ball enters the last 16 m. Unlike ordinary stage urgency, danger
 // pressure does NOT fade when the Play Director moves to another pass.
 const defending=1-shape.active;
 const goalX=defending===0?0:field.width;
 const goalDistance=Math.hypot(ball.x-goalX,ball.y-field.height*.5);
 let nearGoal=ease((16-goalDistance)/5);
 if(nearGoal>0){
  side=defending;
  // Actual turnovers (not passes) still ease to zero at the handoff:
  // incoming defenders accelerate over 1.1 s, avoiding instant swaps.
  if(shape.turnover&&shape.age<1.1)
   nearGoal*=ease(shape.age/1.1);
  intensity=Math.max(intensity,nearGoal*.99);
 }
 if(shape.nextTurnover){
  const timeLeft=shape.nextTurnover.time-seconds;
  const handoff=ease(timeLeft/1.4);
  intensity*=handoff;
 }
 intensity=clamp(intensity,0,1);
 if(intensity<=.001)return {side,phase:shape.phase,intensity:0,ids:[],nearGoal};
 // Use the CURRENT physical actor locations, not their nominal formation
 // positions. Each selected defender's individual target depends on their
 // own position, not their sorting rank. This avoids switching roles when
 // the nearest two defenders exchange ordering in a running play.
 const candidates=Array.from({length:10},(_,i)=>side*11+i+1)
  .map(id=>({id,dist:Math.hypot(actors[id].x-ball.x,actors[id].y-ball.y)}));
 candidates.sort((a,b)=>a.dist-b.dist||a.id-b.id);
 const fourth=candidates[3]?.dist??Infinity;
 const ids=candidates.slice(0,3).map(x=>x.id);
 for(const item of candidates.slice(0,3)){
  const actor=actors[item.id];
  // Third/fourth-place ties must never make the displaced player snap.
  // A smoothly vanishing membership weight handles each handoff while
  // keeping the number of active outfield pressers at three or fewer.
  const membership=ease((fourth-item.dist)/2);
  const depth=side===0?-1:1;
  const target={
   x:clamp(ball.x+depth*(1.0+nearGoal*.25),1,field.width-1),
   y:clamp(ball.y+clamp((actor.y-ball.y)*.20,-1.7,1.7),1,field.height-1)
  };
  const dist=Math.max(.01,Math.hypot(actor.x-target.x,actor.y-target.y));
  const limit=10+nearGoal*9;
  const move=clamp(dist-(1.4-nearGoal*.5),0,limit)*intensity*membership;
  actor.x=clamp(actor.x+(target.x-actor.x)/dist*move,1,field.width-1);
  actor.y=clamp(actor.y+(target.y-actor.y)/dist*move,1,field.height-1);
 }
 return {side,phase:shape.phase,intensity,ids,nearGoal};
}
module.exports={styleFor,status,roleOf,position,press,lastTurnover};
