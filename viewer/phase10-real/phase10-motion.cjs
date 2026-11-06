'use strict';
/**
 * Phase 10C v0.1: deterministic ILLUSTRATIVE five-minute visual sequences.
 * Runs only on official Quick Sim fixture snapshots. Does not simulate goals,
 * player stats, tackles, substitutions, shot probability, or possession totals.
 * All events except official Quick Sim goal timestamps are animation inventions.
 */
const limit=(n,a,b)=>Math.min(b,Math.max(a,n));
const lerp=(a,b,u)=>a+(b-a)*limit(u,0,1);
const ease=u=>{const t=limit(u,0,1);return t*t*(3-2*t)};
function hash(s){let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0}
function origin(side,x,field){return side===0?field.width*x:field.width*(1-x)}
function base(side,index,field){
 const x=v=>origin(side,v,field),y=field.height;
 if(index===0)return {x:x(.045),y:y*.5};
 if(index<5)return {x:x(.24),y:y*(.13+(index-1)*.245)};
 if(index<8)return {x:x(.45),y:y*(.19+(index-5)*.29)};
 return {x:x(.69),y:y*(.17+(index-8)*.31)};
}
// Official Quick Sim full-time totals. This is not an in-progress counter.
// A missed shot is not on target; keeper saves belong to the opposite side.
// Validation is presentation-only and never repairs or mutates result data.
function shotSummary(stats){
 if(!Array.isArray(stats)||stats.length!==2)throw Error('Missing official shot totals');
 for(let side=0;side<2;side++){
  const a=stats[side],other=stats[1-side];
  for(const key of ['shots','shotsOnTarget','goals','saves'])
   if(!Number.isInteger(a?.[key])||a[key]<0)throw Error('Invalid official '+key);
  if(a.shotsOnTarget>a.shots||a.goals>a.shotsOnTarget||
     a.shotsOnTarget-a.goals!==other.saves)
   throw Error('Quick Sim shots, goals and goalkeeper saves do not reconcile');
 }
 return 'FULL-TIME TOTALS (not live) · Shots '+stats[0].shots+'–'+stats[1].shots+
  ' · On target '+stats[0].shotsOnTarget+'–'+stats[1].shotsOnTarget+
  ' · Keeper saves '+stats[0].saves+'–'+stats[1].saves;
}
// Slow clock advancement only near official goal timestamps; keep the
// currently deployed, slower 1x base rate (0.32 match min / real second).
// At 1x, a real second advances exactly one match second, including goals.
// Faster rates retain some cinematic emphasis near recorded goal moments.
function playbackRate(t,events,speed){
 const chosen=limit(Number(speed)||1,1,16);
 const normal=chosen/60;
 if(chosen===1)return normal;
 let factor=1;
 for(const e of events||[]){
  if(e.type!=='goal'||!Number.isFinite(e.minute))continue;
  const distance=e.minute-t;
  if(distance>=-.22&&distance<=.60)factor=Math.min(factor,.55);
  else if(distance>=-.40&&distance<=.90)factor=Math.min(factor,.82);
 }
 return normal*factor;
}

// Deterministic continuous pass-and-receive plan. It is presentation-only:
// these are not PSE possession, tackle, pass, or interception records.
const touchCache=new WeakMap();
function pose(owner,field,seconds){
 const side=Math.floor(owner/11),index=owner%11,p=base(side,index,field);
 const amp=index===0?.6:index<5?1.65:2.6;
 return {x:limit(p.x+Math.sin(seconds*.22+index*1.8+side)*amp,1,field.width-1),
  y:limit(p.y+Math.cos(seconds*.27+index*1.2+side)*amp*.8,1,field.height-1)};
}
function foot(player,owner){
 return {x:player.x+(owner<11?.72:-.72),y:player.y+.32,z:.23};
}
function touchPlan(fixture,field){
 const cached=touchCache.get(fixture);
 if(cached&&cached.width===field.width&&cached.height===field.height)return cached.sequence;
 const total=Math.ceil((fixture.durationMinutes===120?120:90)*60/8)+2;
 const sequence=[{owner:6}],seed=String(fixture.seed||'pfc');
 for(let k=0;k<total;k++){
  const previous=sequence[k].owner,side=Math.floor(previous/11);
  const switchSides=k%9===8; // illustrative challenge, not official event
  const candidateSide=switchSides?1-side:side;
  const passTime=k*8+8*.60;
  const from=pose(previous,field,passTime);
  const candidates=[];
  for(let j=1;j<11;j++){
   const owner=candidateSide*11+j;
   if(owner===previous)continue;
   const to=pose(owner,field,passTime+1.2);
   const distance=Math.hypot(from.x-to.x,from.y-to.y);
   if(distance>32)continue;
   const forward=side===0?to.x-from.x:from.x-to.x;
   const jitter=hash(seed+':'+k+':'+j)%1000/1000;
   candidates.push({owner,score:distance+6*jitter-(forward>2&&forward<17?3.3:0)});
  }
  candidates.sort((a,b)=>a.score-b.score||a.owner-b.owner);
  // If no reasonable receiver is nearby, dribble rather than teleport.
  const choice=candidates[hash(seed+':select:'+k)%Math.min(3,candidates.length)];
  sequence.push({owner:choice?.owner??previous});
 }
 touchCache.set(fixture,{width:field.width,height:field.height,sequence});
 return sequence;
}
function motionFrame(fixture,t,field,options=false){
 const ignoreGoal=options===true;
 const kickIndex=options&&typeof options==='object'&&Number.isInteger(options.kickIndex)?options.kickIndex:0;
 if(!fixture||!fixture.home||!fixture.away||!Array.isArray(fixture.events))
  throw Error('Motion requires official fixture');
 const duration=fixture.durationMinutes===120?120:90;
 if(!Number.isFinite(t)||t<0||t>duration)throw Error('Invalid replay minute');
 if(!field||!Number.isFinite(field.width)||!Number.isFinite(field.height))throw Error('Invalid soccer pitch');
 const teams=[fixture.home,fixture.away],actors=[],seconds=t*60;
 for(let side=0;side<2;side++)for(let i=0;i<11;i++){
  const p=pose(side*11+i,field,seconds);
  actors.push({side,index:i,
   x:p.x,y:p.y,z:0,
   frame:Math.floor(seconds*7+i)%3===0?1:0,orientation:side===0?2:6});
 }
 let ball={x:field.width*.5,y:field.height*.5,z:.22};
 // Separate PSE penalty shootout. Match score stays the official 120-minute
 // score; the panel owns independent penalty conversions.
 if(t>=duration&&fixture.shootout&&Number.isInteger(kickIndex)&&kickIndex>0){
  const kicks=fixture.shootout.attempts,kick=kicks[kickIndex-1];
  if(!kick)throw Error('Invalid shootout kick index');
  const side=kick.side==='home'?0:1,roster=teams[side];
  const takerIndex=roster.lineup.findIndex(p=>String(p.id)===String(kick.kickerId));
  if(takerIndex<0)throw Error('Shootout taker not on starting XI');
  const keeperIndex=teams[1-side].lineup.findIndex(p=>String(p.id)===String(kick.keeperId));
  if(keeperIndex<0)throw Error('Shootout keeper not on starting XI');
  const taker=actors[side*11+takerIndex],keeper=actors[(1-side)*11+keeperIndex];
  const shooting={x:origin(side,.84,field),y:field.height*.5};
  const net={x:origin(side,.985,field),y:field.height*.5};
  taker.x=shooting.x;taker.y=shooting.y;taker.frame=3;
  keeper.x=origin(side,.972,field);keeper.y=field.height*.5;
  const finishY=kick.outcome==='off-target'?field.height*.21:
   kick.outcome==='saved'?field.height*.48:field.height*.5;
  keeper.frame=kick.outcome==='saved'?8:1;
  keeper.y=kick.outcome==='saved'?field.height*.48:field.height*.58;
  ball={x:net.x,y:finishY,z:kick.outcome==='off-target'?1.2:.3};
  return {actors,ball,action:'official-shootout-'+kick.outcome,
   label:'PENALTY '+kickIndex+'/'+kicks.length+' · '+
    (roster.lineup[takerIndex].name||'Pokémon')+' · '+kick.outcome.toUpperCase(),
   officialEvent:kick,illustrative:false};
 }
 const goals=ignoreGoal?[]:fixture.events.filter(e=>e.type==='goal');
 const event=goals.find(g=>t>=g.minute-.7&&t<=g.minute+.22);
 if(event){
  const side=event.team===teams[0].id?0:1,roster=teams[side];
  const scorer=roster.lineup.findIndex(p=>String(p.id)===String(event.player));
  if(scorer<0)throw Error('Goal scorer absent');
  const assist=event.assist==null?-1:roster.lineup.findIndex(p=>String(p.id)===String(event.assist));
  const first=side*11+5,second=side*11+(assist>=0?assist:7),last=side*11+scorer;
  const kickoff={x:origin(side,.43,field),y:field.height*.38};
  const setup={x:origin(side,.63,field),y:field.height*.43};
  const finish={x:origin(side,.84,field),y:field.height*.51};
  const net={x:origin(side,.985,field),y:field.height*.5};
  const initial=event.minute-.7;
  const u=limit((t-initial)/.7,0,1);
  actors[first].x=kickoff.x;actors[first].y=kickoff.y;
  actors[second].x=setup.x;actors[second].y=setup.y;
  actors[last].x=finish.x;actors[last].y=finish.y;
  const keeper=actors[(1-side)*11];
  keeper.x=origin(side,.975,field);keeper.y=field.height*.5;
  const marker=actors[(1-side)*11+2];
  marker.x=lerp(origin(side,.74,field),finish.x,u);marker.y=lerp(field.height*.35,finish.y,u);
  if(u<.30){
   ball={x:lerp(kickoff.x,setup.x,ease(u/.30)),y:lerp(kickoff.y,setup.y,ease(u/.30)),z:.18};
  }else if(u<.70){
   ball={x:lerp(setup.x,finish.x,ease((u-.30)/.40)),y:lerp(setup.y,finish.y,ease((u-.30)/.40)),z:.2};
  }else{
   const shot=ease((u-.70)/.30);
   ball={x:lerp(finish.x,net.x,shot),y:lerp(finish.y,net.y,shot),z:.2+1.3*Math.sin(shot*Math.PI)};
   actors[last].frame=3;keeper.frame=8;
   keeper.y=lerp(field.height*.50,field.height*.57,shot);
  }
  if(t>=event.minute){ball=net;keeper.frame=8;}
  // Blend goal-scene boundaries into the ordinary continuous player paths
  // rather than snapping all 22 players and the ball to goal positions.
  const enter=ease((t-(event.minute-.7))/.08);
  const exit=ease(((event.minute+.22)-t)/.08);
  const blend=enter*exit;
  if(blend<1){
   const usual=motionFrame(fixture,t,field,true);
   for(let i=0;i<actors.length;i++){
    actors[i].x=lerp(usual.actors[i].x,actors[i].x,blend);
    actors[i].y=lerp(usual.actors[i].y,actors[i].y,blend);
   }
   ball={x:lerp(usual.ball.x,ball.x,blend),
    y:lerp(usual.ball.y,ball.y,blend),z:lerp(usual.ball.z,ball.z,blend)};
  }
  return {actors,ball,action:t>=event.minute?'official-goal':u>=.70?'illustrative-shot':'illustrative-goal-buildup',
   label:t>=event.minute?'GOAL! '+roster.lineup[scorer].name:
     'Attack: '+roster.lineup[scorer].name,
   officialEvent:t>=event.minute?event:null,illustrative:t<event.minute};
 }
 // The same receiver who controls the ball at the end of this passage
 // starts the next passage as its carrier. No hidden return to midfield.
 const cycleSeconds=8,at=seconds/cycleSeconds,cycle=Math.floor(at),u=at-cycle;
 const plan=touchPlan(fixture,field);
 const current=plan[Math.min(cycle,plan.length-2)];
 const next=plan[Math.min(cycle+1,plan.length-1)];
 const sender=pose(current.owner,field,seconds),receiver=pose(next.owner,field,seconds);
 const passStart=cycle*cycleSeconds+cycleSeconds*.44;
 const passArrival=cycle*cycleSeconds+cycleSeconds*.75;
 const passOrigin=foot(pose(current.owner,field,passStart),current.owner);
 const passTarget=foot(pose(next.owner,field,passArrival),next.owner);
 let action,ownerIndex,contact;
 if(u<.44){
  ball=foot(sender,current.owner);
  ownerIndex=current.owner;contact='controlled';action='illustrative-carry';
 }else if(u<.75){
  // Stop at the receiving player's foot. Decelerating there is a visible
  // first touch, not an unexplained pre-possession change of direction.
  const progress=ease((u-.44)/.31);
  ball={x:lerp(passOrigin.x,passTarget.x,progress),
   y:lerp(passOrigin.y,passTarget.y,progress),
   z:.23+.65*Math.sin(Math.PI*progress)};
  ownerIndex=-1;
  const contested=Math.floor(current.owner/11)!==Math.floor(next.owner/11);
  contact=contested?'contested-flight':'in-flight';
  action=contested&&u>.60?'illustrative-challenge':'illustrative-pass';
 }else{
  ball=foot(receiver,next.owner);
  ownerIndex=next.owner;contact='received';
  action=Math.floor(current.owner/11)!==Math.floor(next.owner/11)
   ?'illustrative-challenge':'illustrative-dribble';
 }
 // Off-ball movement is continuous absolute-time motion, rather than
 // randomly selecting a new position for the receiving Pokémon.
 const targetPlayer=actors[next.owner];
 const preparation=ease((u-.20)/.35)*(1-ease((u-.76)/.16));
 const anticipated=pose(next.owner,field,passArrival);
 targetPlayer.x=lerp(targetPlayer.x,anticipated.x,preparation*.20);
 targetPlayer.y=lerp(targetPlayer.y,anticipated.y,preparation*.20);
 if(u>=.40&&u<.50)actors[current.owner].frame=3;
 if(u>.68&&u<.80)targetPlayer.frame=3;
 return {actors,ball,action,ownerIndex,contact,label:'',officialEvent:null,
  illustrative:true,cycle,passStart,passArrival,passOrigin,passTarget};

}
module.exports={motionFrame,base,hash,shotSummary,playbackRate};
