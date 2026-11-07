'use strict';
/**
 * PokéFC Watch Play Sequence Director.
 * Visual choreography only: PSE alone owns scores, saves and match events.
 * All patterns appear in ordinary non-scoring play as well as goal buildups.
 */
const {styleFor}=require('./phase10-team-shape.cjs');
const Wall=require('./phase10-wall-physics.cjs');
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
const lerp=(a,b,u)=>a+(b-a)*u;
const CARRY_SPEED=3.8;
const CARRY_EASE_PEAK=1.5; // cubic smoothstep has 1.5x peak speed
function hash(s){let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0}
const seed=f=>String(f.visualSeed||f.seed||'pfc');
const sideOf=id=>Math.floor(id/11);
const offset=id=>id<11?.72:-.72;
const point=(field,x,y)=>({x:clamp(x,1,field.width-1),y:clamp(y,1,field.height-1)});
const progress=(side,x,field)=>(side===0?x:field.width-x)/field.width;
function base(id,field){
 const side=sideOf(id),i=id%11,h=field.height;
 const x=v=>side===0?field.width*v:field.width*(1-v);
 if(i===0)return point(field,x(.045),h*.5);
 if(i<5)return point(field,x(.24),h*(.13+(i-1)*.245));
 if(i<8)return point(field,x(.45),h*(.19+(i-5)*.29));
 return point(field,x(.69),h*(.17+(i-8)*.31));
}
// Only the attacking half is subject to offside. Check at release, never
// at arrival. This visual eligibility rule cannot create official PSE events.
function offsideLine(f,field,side,ballX){
 const opponent=side===0?f.away:f.home;
 const attackProgress=progress(side,ballX,field);
 // Back four retreat toward goal as attacks enter the final third.
 const drop=.12*smooth((attackProgress-.52)/.37);
 const positions=opponent.lineup.map((player,i)=>{
  const p=base((1-side)*11+i,field);
  const depth=i>0&&i<5?drop*field.width:0;
  return progress(side,p.x,field)*field.width+depth;
 }).sort((a,b)=>b-a);
 return positions[1]; // second-last opponent, including the goalkeeper
}
function isOffside(f,field,side,ballX,receiverX){
 const attackX=progress(side,receiverX,field)*field.width;
 const ball=progress(side,ballX,field)*field.width;
 return attackX>field.width/2+1e-6&&
  attackX>ball+1e-6&&attackX>offsideLine(f,field,side,ballX)+1e-6;
}
function receiver(f,field,owner,aim,pattern,salt,ballX,releaseAt=base){
 const side=sideOf(owner),team=side===0?f.home:f.away;
 const candidates=[];
 for(let i=1;i<11;i++){
  const id=side*11+i;if(id===owner)continue;
  const b=releaseAt(id,field),role=String(team.lineup[i]?.pos||'').toUpperCase();
  if(isOffside(f,field,side,ballX,b.x))continue;
  const defender=i<5||/^(CB|DEF|LB|RB|LWB|RWB)$/.test(role);
  const mid=i>=5&&i<8||/^(CM|MID|CAM|CDM)$/.test(role);
  const wide=[1,4,8,10].includes(i);
  let score=Math.hypot(aim.x-b.x,aim.y-b.y)*.5+
   hash(seed(f)+':receiver:'+salt+':'+i)%1000/100;
  if(pattern==='wing')score+=wide?-14:10;
  if(pattern==='box')score+=mid?-9:defender?0:-3;
  if(pattern==='through')score+=i>=8?-13:defender?7:0;
  if(pattern==='one-two')score+=mid?-6:defender?3:0;
  if(pattern==='overlap')score+=defender?-16:8;
  if(defender&&hash(seed(f)+':back:'+salt)%100<32)score-=14;
  candidates.push({id,score});
 }
 candidates.sort((a,b)=>a.score-b.score||a.id-b.id);
 return candidates[0]?.id??null;
}
const planCache=new WeakMap();
function makePlan(f,field){
 if(!f?.home?.lineup||!f?.away?.lineup||!Array.isArray(f.events))
  throw Error('Play Director needs a PSE fixture');
 const total=(f.durationMinutes===120?120:90)*60;
 const actions=[],sequences=[],tracks=Array.from({length:22},()=>[]);
 let seconds=0,owner=6,ball=point(field,field.width*.45,field.height*.5),count=0;
 const dice=(key,n)=>hash(seed(f)+':'+count+':'+key)%n;
 function mark(id,t,p){
  const arr=tracks[id],spot=point(field,p.x-offset(id),p.y-.32);
  const last=arr.at(-1);
  if(last&&Math.abs(last.t-t)<.000001){last.p=spot;return}
  arr.push({t,p:spot});
 }
 function releasePosition(id){
  const last=tracks[id].at(-1),baseline=base(id,field);
  if(!last)return baseline;
  // Recent actual touches can leave a runner ahead of the defensive line.
  // Blend stale touch positions back to formation; never use pass arrival.
  const age=Math.max(0,seconds-last.t),weight=1-smooth((age-2)/8);
  return point(field,lerp(baseline.x,last.p.x,weight),
   lerp(baseline.y,last.p.y,weight));
 }
 function destination(forward,dy,duration){
  const side=sideOf(owner),percent=progress(side,ball.x,field);
  const run=forward*duration/6;
  const delta=percent>.87&&run>0?-Math.min(5,run*.6):run;
  return point(field,ball.x+(side===0?delta:-delta),ball.y+dy);
 }
 // A low pass can bank from a nearby board. One mirrored segment guarantees
 // a real directional rebound at the exact wall contact; never cross an
 // unprotected goal opening or fabricate a PSE goal.
 function chooseWall(from,to,time,pattern,arc,salt){
  if(arc>1.2)return null; // high crosses clear the rink-height boards
  const chance=pattern==='weave'?6:pattern==='cross'?48:pattern==='switch'?35:
   pattern==='one-two'?24:pattern==='through'?24:29;
  if(dice('wall-bank:'+salt,100)>=chance)return null;
  const axes=[['y','min'],['y','max'],['x','min'],['x','max']];
  const strength=(3+dice('wall-softness:'+salt,41)/10)/100;
  const candidates=axes.map(([axis,edge])=>
   Wall.candidate(from,to,field,axis,edge,strength))
   .filter(w=>w&&w.originalPathLength<Math.min(45,time*10.8+7) &&
    w.originalPathLength>Math.hypot(to.x-from.x,to.y-from.y)+1.4);
  if(!candidates.length)return null;
  candidates.sort((a,b)=>(a.originalPathLength+(hash(seed(f)+':wall:'+salt+':'+a.axis+a.edge)%700)/100)-
   (b.originalPathLength+(hash(seed(f)+':wall:'+salt+':'+b.axis+b.edge)%700)/100));
  return candidates[0];
 }
 function append(mode,duration,end,recipient,pattern,arc=0,forcedWall=null){
  if(seconds>=total)return;
  // All passes, including give-and-go returns, must validate their receiver
  // at release. Fallback is a controlled dribble, never a whistle or reset.
  if(mode==='pass'&&recipient!=null){
   const side=sideOf(owner),target=releasePosition(recipient);
   if(isOffside(f,field,side,ball.x,target.x)){
    const replacement=receiver(f,field,owner,end,pattern,
     count+':fallback:'+actions.length,ball.x,releasePosition);
    if(replacement!=null)recipient=replacement;
    else{
     mode='carry';recipient=owner;end=point(field,
      ball.x+(side===0?1:-1)*Math.min(3,duration*1.3),ball.y);
     arc=0;forcedWall=null;
    }
   }
  }
  const length=Math.min(duration,total-seconds);
  if(length<.00001)return;
  // A controlled carry cannot outrun the Pokémon carrying it. Cubic easing
  // peaks at 1.5x the average travel speed, so bound the full displacement.
  if(mode==='carry'){
   const dx=end.x-ball.x,dy=end.y-ball.y,distance=Math.hypot(dx,dy);
   const limit=CARRY_SPEED*length/CARRY_EASE_PEAK;
   if(distance>limit){end=point(field,ball.x+dx*limit/distance,
    ball.y+dy*limit/distance)}
  }
  const start=seconds,from={...ball},aim=point(field,end.x,end.y),next=recipient??owner;
  const wall=forcedWall||(mode==='pass'?
   chooseWall(from,aim,length,pattern,arc,actions.length):null);
  // Softened wall banks land where their slowed ball actually stops, not
  // at the pre-collision full-strength destination.
  const to=wall?wall.exit:aim;
  const action={start,end:start+length,mode,from,to,owner,receiver:next,
   pattern,arc:wall?Math.min(arc,.25):arc,wall,sequence:count,duration:length};
  actions.push(action);
  mark(owner,start,from);
  mark(mode==='carry'?owner:next,action.end,to);
  seconds=action.end;ball=to;owner=next;
 }
 const carry=(time,forward,dy,kind)=>append('carry',time,destination(forward,dy,time),owner,kind);
 function pass(time,target,kind,arc=0,prefer=kind){
  const id=receiver(f,field,owner,target,prefer,count+':'+actions.length,ball.x,releasePosition);
  if(id==null){
   // A dribble is preferable to a speculative illegal pass.
   carry(time,Math.min(3,time*1.3),0,kind);
  }else append('pass',time,target,id,kind,arc);
 }
 function looseRebound(kind){
  // Occasional genuine loose balls: an overrun dribble/cross hits a board,
  // returns inward and gets collected without a whistle or invented shot.
  if(seconds>=total-2.1||dice('loose-chance',100)>=27)return;
  const side=sideOf(owner),forward=side===0?1:-1;
  const options=[
   {axis:'y',edge:'min',gap:ball.y-Wall.RADIUS,
    to:point(field,ball.x+forward*3.5,ball.y+5.5)},
   {axis:'y',edge:'max',gap:field.height-Wall.RADIUS-ball.y,
    to:point(field,ball.x+forward*3.5,ball.y-5.5)},
   {axis:'x',edge:'min',gap:ball.x-Wall.RADIUS,
    to:point(field,ball.x+5.5,ball.y+1.5)},
   {axis:'x',edge:'max',gap:field.width-Wall.RADIUS-ball.x,
    to:point(field,ball.x-5.5,ball.y-1.5)}
  ];
  const duration=2.6+dice('loose-duration',23)/10;
  const strength=(3+dice('loose-softness',41)/10)/100;
  const choices=options.filter(c=>c.gap<13.5).map(c=>({
   ...c,wall:Wall.candidate(ball,c.to,field,c.axis,c.edge,strength)
  })).filter(c=>c.wall&&c.wall.originalPathLength<duration*9.3+5);
  if(!choices.length)return;
  choices.sort((a,b)=>a.gap-b.gap||a.axis.localeCompare(b.axis));
  const choice=choices[0];
  let collector=owner;
  const reboundTarget=choice.wall.exit;
  // An opposing keeper can only claim a scripted loose ball inside their
  // own last 10m and within a realistic 5m/s collection window. The next
  // sequence must then be a keeper distribution, never a goalkeeper dribble.
  const keeperSide=1-side,keeperId=keeperSide*11;
  const keeperBase=base(keeperId,field);
  const keeperGoal=keeperSide===0?0:field.width;
  const keeperReach=Math.hypot(keeperBase.x-reboundTarget.x,
   keeperBase.y-reboundTarget.y);
  const keeperDanger=Math.hypot(keeperGoal-reboundTarget.x,
   field.height*.5-reboundTarget.y);
  if(keeperDanger<=10&&keeperReach<=Math.min(8,5*duration-.45)){
   collector=keeperId;
  }else if(dice('loose-receiver',100)<55){
   const otherSide=dice('loose-steal',100)<20?1-side:side;
   const nearby=Array.from({length:10},(_,i)=>otherSide*11+i+1)
    .map(id=>({id,dist:Math.hypot(base(id,field).x-reboundTarget.x,
     base(id,field).y-reboundTarget.y)}))
    .sort((a,b)=>a.dist-b.dist||a.id-b.id);
   // The pickup Pokémon must be able to reach the rebound; otherwise
   // the original dribbler recovers it at the bank.
   if(nearby[0]?.dist<34)collector=nearby[0].id;
  }
  append('rebound',duration,reboundTarget,collector,kind,0,choice.wall);
 }
 function choose(){
  // These are relative weights; all plays remain possible in every tactic.
  // A counterattack can change the next visual pattern without changing PSE.
  const team=sideOf(owner)===0?f.home:f.away;
  const p=styleFor(team.tactic),regained=actions.at(-1)?.mode==='challenge';
  const list=[
   ['dribble',15*p.dribble*(regained?1.18:1)],
   ['one-two',25*p.oneTwo],
   ['weave',17*p.oneTwo],
   ['cross',17*p.cross],
   ['through',16*p.through*(regained?1.36:1)],
   ['switch',10*p.switch]
  ];
  const total=list.reduce((sum,row)=>sum+row[1],0);
  let target=dice('pattern',100000)/100000*total;
  for(const [name,weight] of list){if(target<weight)return name;target-=weight}
  return 'dribble';
 }
 function sequence(kind){
  const started=seconds,initial=owner,side=sideOf(owner);
  const sign=dice('side',2)?1:-1;
  const lane=sign*(3+dice('lane',60)/10);
  if(owner%11===0){
   // Keeper collections are already visual possession boundaries. Resume
   // immediately with a normal distribution, preserving PSE match authority.
   const to=point(field,ball.x+(side===0?10:-10),
    clamp(ball.y+sign*3,4,field.height-4));
   pass(1.6+dice('keeper-release',16)/10,to,'keeper-distribution',.28,'one-two');
   sequences.push({index:count,start:started,end:seconds,
    kind:'keeper-distribution',firstOwner:initial});
   return;
  }
  if(kind==='dribble'){
   // Make a deliberate forward carry, then release rather than waiting
   // 5–15 seconds for the next meaningful action.
   carry(1.6+dice('carry-time',20)/10,5+dice('carry-move',32)/10,lane*.26,kind);
   pass(1.4+dice('dribble-release',14)/10,
    destination(7,-lane*.42,3),kind,.22,'one-two');
  }else if(kind==='weave'){
   // Three-player triangle combination: alternate the two lateral lanes
   // while gaining ground. Receiver selection still enforces offside.
   const run=side===0?1:-1,shift=5+dice('weave-lane',35)/10;
   pass(1.4+dice('weave-first',11)/10,
    point(field,ball.x+run*2.2,clamp(ball.y+sign*shift,4,field.height-4)),kind,.14,'one-two');
   carry(1.0+dice('weave-control-1',10)/10,2.1,-sign*.9,kind);
   pass(1.3+dice('weave-second',12)/10,
    point(field,ball.x+run*2.8,clamp(ball.y-sign*(shift+1.5),4,field.height-4)),kind,.16,'one-two');
   carry(1.0+dice('weave-control-2',9)/10,2.0,sign*.8,kind);
   pass(1.5+dice('weave-third',13)/10,
    point(field,ball.x+run*3.2,clamp(ball.y+sign*shift,4,field.height-4)),kind,.18,'one-two');
  }else if(kind==='one-two'){
   pass(1.3+dice('one-first',12)/10,destination(11,lane*.55,3),kind,.45,'one-two');
   carry(1.0+dice('one-touch',11)/10,2,sign*.8,kind);
   append('pass',1.4+dice('one-return',12)/10,destination(12,lane*.3,3),
    initial,kind,.45);
   carry(1.3+dice('one-run',15)/10,5,sign,kind);
  }else if(kind==='cross'){
   const wingY=sign>0?field.height-7:7;
   pass(2+dice('cross-open',14)/10,
    point(field,ball.x+(side===0?10:-10),lerp(ball.y,wingY,.58)),
    kind,.7,'wing');
   carry(1.5+dice('cross-run',18)/10,6,(wingY-ball.y)*.30,kind);
   pass(2.1+dice('cross-flight',20)/10,
    point(field,ball.x+(side===0?11:-11),field.height*.5+sign*(dice('target',7)-3)),
    kind,3,'box');
   carry(1+dice('cross-control',20)/10,3,-sign*1.2,kind);
  }else if(kind==='through'){
   carry(1.4+dice('through-carry',14)/10,6,lane*.2,kind);
   pass(2.5+dice('through-flight',16)/10,
    destination(18+dice('through-long',80)/10,sign*3,5),
    kind,2.6,'through');
   carry(1.3+dice('through-finish',17)/10,6,sign*1.5,kind);
  }else{
   carry(1.6+dice('switch-start',17)/10,5,sign*2,kind);
   const farSide=sign>0?field.height*.2:field.height*.8;
   pass(3+dice('switch-pass',22)/10,
    point(field,ball.x+(side===0?7:-7),lerp(ball.y,farSide,.8)),kind,1.1,'switch');
   carry(1.7+dice('switch-carry',16)/10,5,-sign*2,kind);
   if(dice('long-attack',3)===0)
    pass(1.6+dice('extra',15)/10,destination(6,sign*2,3),kind,.35,'one-two');
  }
  // Low rebounds and spontaneous pickups occur in ordinary play too.
  // The next attacking pattern starts from whoever collects this ball.
  looseRebound(kind);
  // The standing challenge is illustrative, not a PSE tackle or foul.
  const turnover=count%6===5||(count>0&&dice('turnover',100)<6);
  if(turnover&&seconds<total){
   const other=1-sideOf(owner),target=destination(1.5,sign*.5,2);
   const ids=Array.from({length:10},(_,i)=>other*11+i+1);
   ids.sort((a,b)=>{
    const pa=base(a,field),pb=base(b,field);
    return Math.hypot(pa.x-target.x,pa.y-target.y)-
     Math.hypot(pb.x-target.x,pb.y-target.y)||a-b;
   });
   append('challenge',1.5+dice('contest',19)/10,target,ids[0],kind);
  }
  sequences.push({index:count,start:started,end:seconds,kind,firstOwner:initial});
 }
 while(seconds<total-.01&&count<1600){sequence(choose());count++}
 for(const t of tracks)t.sort((a,b)=>a.t-b.t);
 const turnovers=actions.filter(a=>
  (a.mode==='challenge'||a.mode==='rebound')&&
  sideOf(a.owner)!==sideOf(a.receiver)).map(a=>({
  time:a.end,oldSide:sideOf(a.owner),newSide:sideOf(a.receiver),
  ball:a.to,stageStart:a.start
 }));
 return {actions,sequences,tracks,turnovers,duration:total,
  field:{width:field.width,height:field.height}};
}
function planFor(f,field){
 const previous=planCache.get(f);
 if(previous&&previous.field.width===field.width&&previous.field.height===field.height)
  return previous;
 const next=makePlan(f,field);planCache.set(f,next);return next;
}
// Binary lookup allows deterministic seeking to any arbitrary match second.
function stageAt(plan,seconds){
 const arr=plan.actions;
 let lo=0,hi=arr.length-1;
 while(lo<hi){const mid=(lo+hi)>>1;
  if(arr[mid].end<=seconds)lo=mid+1;else hi=mid;}
 return arr[lo]||null;
}
function ballAt(stage,seconds){
 if(stage.wall)return Wall.sampleWall(stage,seconds);
 const phase=smooth((seconds-stage.start)/Math.max(.001,stage.duration));
 return {x:lerp(stage.from.x,stage.to.x,phase),
  y:lerp(stage.from.y,stage.to.y,phase),
  z:.23+(stage.mode==='pass'?stage.arc:0)*Math.sin(Math.PI*phase)};
}
// Every player has deterministic touch keyframes (including off-ball
// return runs). Blend into and out of those keyframes without hard cuts.
function actorAt(plan,id,seconds,baseline){
 const arr=plan.tracks[id];if(!arr?.length)return baseline;
 let lo=0,hi=arr.length;
 while(lo<hi){const mid=(lo+hi)>>1;
  if(arr[mid].t<=seconds)lo=mid+1;else hi=mid;}
 const prev=arr[lo-1],next=arr[lo],settle=4;
 if(prev&&next&&next.t-prev.t<=17){
  const u=smooth((seconds-prev.t)/Math.max(.001,next.t-prev.t));
  return {x:lerp(prev.p.x,next.p.x,u),y:lerp(prev.p.y,next.p.y,u)};
 }
 if(prev&&seconds-prev.t<settle){
  const u=smooth((seconds-prev.t)/settle);
  return {x:lerp(prev.p.x,baseline.x,u),y:lerp(prev.p.y,baseline.y,u)};
 }
 if(next&&next.t-seconds<settle){
  const u=smooth((seconds-(next.t-settle))/settle);
  return {x:lerp(baseline.x,next.p.x,u),y:lerp(baseline.y,next.p.y,u)};
 }
 return baseline;
}
function sample(f,field,seconds){
 const plan=planFor(f,field),stage=stageAt(plan,clamp(seconds,0,plan.duration));
 if(!stage)throw Error('Missing visual stage');
 const u=(seconds-stage.start)/Math.max(.001,stage.duration);
 const ball=ballAt(stage,seconds);
 const ownerIndex=stage.mode==='carry'?stage.owner:
  (stage.mode==='challenge'||stage.mode==='rebound')&&u>.96?stage.receiver:-1;
 let action,contact;
 if(stage.mode==='carry'){
  action=u>.94?'illustrative-dribble':'illustrative-carry';
  contact='controlled';
 }else if(stage.mode==='challenge'){
  action='illustrative-challenge';contact='standing-challenge';
 }else if(stage.mode==='rebound'){
  action=u>.96?(stage.receiver%11===0?
    'illustrative-keeper-collection':'illustrative-wall-pickup'):'illustrative-wall-rebound';
  contact=u>.96?'collected-loose-ball':
   ball.contact==='approaching-wall'?'loose-wall-approach':'loose-wall-rebound';
 }else{
  action=stage.wall?'illustrative-bank-pass':
   stage.pattern==='one-two'?'illustrative-give-and-go':
   stage.pattern==='cross'?'illustrative-cross':
   stage.pattern==='through'?'illustrative-through-ball':'illustrative-pass';
  contact=stage.wall?
   (ball.contact==='approaching-wall'?'bank-approach':'bank-rebound'):
   stage.arc>2?'lofted-through':'in-flight';
 }
 return {plan,stage,ball,ownerIndex,action,contact,
  sequenceType:stage.pattern,sequenceIndex:stage.sequence,
  segmentStart:stage.start,segmentEnd:stage.end,
  passStart:stage.mode==='pass'?stage.start:null,
  passArrival:stage.mode==='pass'?stage.end:null,
  passOrigin:stage.mode==='pass'?stage.from:null,
  passTarget:stage.mode==='pass'?stage.to:null,
  wall:stage.wall||null,wallImpactSeconds:stage.wall?
   stage.start+stage.duration*stage.wall.impactU:null};
}
function nextBoundary(f,field,after){
 const plan=planFor(f,field);
 return plan.actions.find(a=>a.start>=after-.000001)?.start??plan.duration;
}
module.exports={planFor,stageAt,ballAt,actorAt,sample,nextBoundary,base,hash,smooth,isOffside,offsideLine,CARRY_SPEED};

