'use strict';
/**
 * Watch-only goalkeeper positioning. Goalkeepers rush when an opponent
 * reaches the last 10 metres and can claim ONLY already scripted keeper
 * rebounds. All paths are integrated once with a physical 5 m/s speed cap.
 * Nothing here generates a PSE save, goal, interception or match event.
 */
const Director=require('./phase10-play-director.cjs');
const SPEED_LIMIT=5,RETURN_SPEED=4,TRIGGER_DISTANCE=10;
const STEP=.25;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const ease=x=>{const u=clamp(x,0,1);return u*u*(3-2*u)};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const memo=new WeakMap();
const center=(side,field)=>({
 x:side===0?field.width*.045:field.width*.955,y:field.height*.5
});
function danger(ball,side,field){
 return Math.hypot(ball.x-(side===0?0:field.width),
  ball.y-field.height*.5);
}
function target(side,field,stage,ball){
 const home=center(side,field),opponent=Math.floor(stage.owner/11)!==side;
 const goalDistance=danger(ball,side,field);
 const picker=stage.mode==='rebound'&&stage.receiver===side*11;
 if(picker){
  const pickup={x:stage.to.x,y:stage.to.y};
  // Only near-goal, legitimately reachable loose balls are scripted for GK.
  if(distance(home,pickup)<=SPEED_LIMIT*stage.duration-.35)
   return {x:pickup.x,y:pickup.y,urgent:true,collecting:true};
 }
 if(!opponent||goalDistance>=TRIGGER_DISTANCE||ball.z>1.5)
  return {...home,urgent:false,collecting:false};
 const urgency=ease((TRIGGER_DISTANCE-goalDistance)/3.0);
 const towardGoal=side===0?-1:1;
 const x=clamp(ball.x+towardGoal*1.15,
  side===0?1.1:field.width-12,side===0?12:field.width-1.1);
 const y=clamp(ball.y,field.height*.5-8,field.height*.5+8);
 return {x:home.x+(x-home.x)*urgency,y:home.y+(y-home.y)*urgency,
  urgent:true,collecting:false};
}
function build(f,field){
 const plan=Director.planFor(f,field);
 const previous=memo.get(plan);
 if(previous)return previous;
 const n=Math.ceil(plan.duration/STEP),coords=[
  new Float64Array((n+1)*2),new Float64Array((n+1)*2)
 ];
 const active=[center(0,field),center(1,field)];
 for(let i=0;i<=n;i++){
  const sec=Math.min(plan.duration,i*STEP);
  const stage=Director.stageAt(plan,sec);
  const ball=Director.ballAt(stage,sec);
  for(let side=0;side<2;side++){
   const requested=target(side,field,stage,ball);
   const actor=active[side];
   const dx=requested.x-actor.x,dy=requested.y-actor.y;
   const gap=Math.hypot(dx,dy);
   const cap=(requested.urgent?SPEED_LIMIT:RETURN_SPEED)*STEP;
   if(i&&gap>0){
    const u=Math.min(1,cap/gap);
    actor.x+=dx*u;actor.y+=dy*u;
   }
   coords[side][i*2]=actor.x;
   coords[side][i*2+1]=actor.y;
  }
 }
 const result={coords,duration:plan.duration,n,field};
 memo.set(plan,result);return result;
}
function at(f,field,seconds){
 const path=build(f,field),u=clamp(seconds/STEP,0,path.n);
 const i=Math.min(Math.floor(u),path.n-1),fraction=u-i;
 const answer=[];
 for(let side=0;side<2;side++){
  const a=path.coords[side],index=i*2;
  answer.push({
   x:a[index]+(a[index+2]-a[index])*fraction,
   y:a[index+1]+(a[index+3]-a[index+1])*fraction
  });
 }
 return answer;
}
module.exports={at,build,target,center,danger,SPEED_LIMIT,RETURN_SPEED,
 TRIGGER_DISTANCE,STEP};
