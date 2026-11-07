'use strict';
/**
 * Phase 10C v0.1: deterministic ILLUSTRATIVE five-minute visual sequences.
 * Runs only on official Quick Sim fixture snapshots. Does not simulate goals,
 * player stats, tackles, substitutions, shot probability, or possession totals.
 * All events except official Quick Sim goal timestamps are animation inventions.
 */
const PlayDirector=require('./phase10-play-director.cjs');
const TeamShape=require('./phase10-team-shape.cjs');
const Wall=require('./phase10-wall-physics.cjs');
const Keeper=require('./phase10-goalkeeper-rush.cjs');
const Onside=require('./phase10-onside-movement.cjs');
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
// Preserve the viewer-selected speed all the way through the goal. The
// goal modal, not a hidden time dilation, handles celebration and replay.
function playbackRate(t,events,speed){
 return limit(Number(speed)||1,1,16)/60;
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
 const sequence=[{owner:6}],seed=String(fixture.visualSeed||fixture.seed||'pfc');
 for(let k=0;k<total;k++){
  const previous=sequence[k].owner,side=Math.floor(previous/11);
  const switchSides=k%9===8; // illustrative challenge, not official event
  const candidateSide=switchSides?1-side:side;
  const passTime=k*8+8*.82;
  const from=pose(previous,field,passTime);
  const candidates=[];
  for(let j=1;j<11;j++){
   const owner=candidateSide*11+j;
   if(owner===previous)continue;
   const to=pose(owner,field,passTime+1.2);
   const distance=Math.hypot(from.x-to.x,from.y-to.y);
   if(distance>35)continue;
   const forward=side===0?to.x-from.x:from.x-to.x;
   const jitter=hash(seed+':'+k+':'+j)%1000/1000;
   // Forward and diagonal choices are common. A pressured backwards pass
   // remains possible but is not the default nearest-neighbor behavior.
   const backwardPenalty=forward < -2?11:0;
   candidates.push({owner,score:distance*.57-Math.max(0,Math.min(22,forward))*.64+
    backwardPenalty+6*jitter});
  }
  candidates.sort((a,b)=>a.score-b.score||a.owner-b.owner);
  // If no reasonable receiver is nearby, dribble rather than teleport.
  const choice=candidates[hash(seed+':select:'+k)%Math.min(3,candidates.length)];
  sequence.push({owner:choice?.owner??previous});
 }
 touchCache.set(fixture,{width:field.width,height:field.height,sequence});
 return sequence;
}
// Positionally disciplined supporting runs in the attacking third.
// They are illustrative, never extra official PSE possessions or shots.
function roleOf(player,index){
 const role=String(player?.pos||'').toUpperCase();
 if(index===0||role==='GK')return 'keeper';
 if(/^(CB|SW|DEF|LB|RB|LWB|RWB)$/.test(role))return 'defender';
 if(/^(CM|CDM|CAM|LM|RM|MID)$/.test(role))return 'midfielder';
 if(/^(LW|RW|ST|CF|FWD)$/.test(role))return 'forward';
 return index<5?'defender':index<8?'midfielder':'forward';
}
function waveAt(fixture,field,seconds){
 const cycle=Math.floor(seconds/8),u=seconds/8-cycle,plan=touchPlan(fixture,field);
 const value=k=>{
  const owner=plan[Math.max(0,Math.min(k,plan.length-1))].owner,side=Math.floor(owner/11);
  const p=pose(owner,field,k*8+5),progress=(side===0?p.x:field.width-p.x)/field.width;
  return {side,pressure:ease((progress-.585)/.105)};
 };
 const before=value(cycle),after=value(cycle+1),blend=ease((u-.54)/.46);
 return [0,1].map(side=>(before.side===side?before.pressure*(1-blend):0)+
  (after.side===side?after.pressure*blend:0));
}
function supportingPose(fixture,owner,field,seconds,wave=waveAt(fixture,field,seconds)){
 const side=Math.floor(owner/11),index=owner%11;
 const player=(side===0?fixture.home:fixture.away).lineup[index],role=roleOf(player,index);
 const original=pose(owner,field,seconds),pressure=wave[side];
 if(!pressure||role==='keeper'||role==='forward')return original;
 const progress=side===0?original.x/field.width:1-original.x/field.width;
 const seed=String(fixture.visualSeed||fixture.seed||'pfc');
 const oscillation=Math.sin(seconds*.046+side*2.8+index*.83+(hash(seed)%17)*.19);
 const overlap=(oscillation+1)/2;
 let target,amount;
 if(role==='midfielder'){target=.67;amount=.88;}
 else{
  // Fullbacks can overlap; centre backs retain a cover line, with rare
  // supporting surges. Never drag the keeper or everyone into the box.
  const wide=/^(LB|RB|LWB|RWB)$/.test(String(player?.pos||'').toUpperCase())||
   (String(player?.pos||'').toUpperCase()==='DEF'&&(index===1||index===4));
  if(wide){target=.615;amount=.35+.56*overlap;}
  else{target=.51;amount=.26+.64*Math.pow(overlap,8);}
 }
 const advanced=lerp(progress,Math.max(progress,target),pressure*amount);
 return {x:limit(origin(side,advanced,field),1,field.width-1),y:original.y};
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
 const visual=PlayDirector.sample(fixture,field,seconds);
 const plan=visual.plan,shape=TeamShape.status(fixture,field,seconds,visual);
 for(let side=0;side<2;side++)for(let i=0;i<11;i++){
  const id=side*11+i;
  const baseline=TeamShape.position(fixture,field,id,seconds,shape,pose(id,field,seconds));
  const p=PlayDirector.actorAt(plan,id,seconds,baseline);
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
  // Presentations can animate a stored attempt from ball setup to outcome;
  // regular shootout playback defaults to its already recorded final pose.
  const p=options&&typeof options==='object'&&Number.isFinite(options.kickProgress)?
   limit(options.kickProgress,0,1):1;
  const approach=ease(p/.35),shot=ease((p-.38)/.60);
  const start={x:origin(side,.80,field),y:shooting.y};
  taker.x=lerp(start.x,shooting.x,approach);taker.y=shooting.y;
  taker.frame=p>.33?3:0;
  keeper.x=origin(side,.972,field);keeper.y=field.height*.5;
  const finishY=kick.outcome==='off-target'?field.height*.21:
   kick.outcome==='saved'?field.height*.48:field.height*.5;
  keeper.frame=p>.50?(kick.outcome==='saved'?8:1):0;
  keeper.y=lerp(field.height*.5,kick.outcome==='saved'?field.height*.48:field.height*.58,shot);
  ball={x:lerp(shooting.x,net.x,shot),
   y:lerp(shooting.y,finishY,shot),
   z:.22+shot*(kick.outcome==='off-target'?1.2:.1)+Math.sin(shot*Math.PI)*.55};
  const complete=p>=.99;
  return {actors,ball,
   action:complete?'official-shootout-'+kick.outcome:'illustrative-shot',
   label:'PENALTY '+kickIndex+'/'+kicks.length+' · '+
    (roster.lineup[takerIndex].name||'Pokémon')+
    (complete?' · '+kick.outcome.toUpperCase():' · SHOT IN PROGRESS'),
   officialEvent:complete?kick:null,illustrative:!complete};
 }
 const goals=ignoreGoal?[]:fixture.events.filter(e=>e.type==='goal');
 const event=goals.find(g=>t>=g.minute-.7&&t<=g.minute+.22);
 if(event){
  const side=event.team===teams[0].id?0:1,roster=teams[side];
  const scorer=roster.lineup.findIndex(p=>String(p.id)===String(event.player));
  if(scorer<0)throw Error('Goal scorer absent');
  const assist=event.assist==null?-1:roster.lineup.findIndex(p=>String(p.id)===String(event.assist));
  const scorerId=side*11+scorer,initial=Math.max(0,event.minute-.7);
  const span=Math.max(.001,event.minute-initial),u=limit((t-initial)/span,0,1);
  // Anchor the first touch to the *existing* ball and player positions.
  // Earlier goal animation placed three players at preset coordinates and
  // dragged the ball to those spots, causing the visible backward whip.
  const opening=motionFrame(fixture,initial,field,true);
  const p0=opening.ball;
  let support=assist>=0?side*11+assist:-1;
  if(support===scorerId||support<0){
   let nearest=Infinity;
   for(let i=1;i<11;i++){
    const id=side*11+i;
    if(id===scorerId)continue;
    const d=Math.hypot(opening.actors[id].x-p0.x,opening.actors[id].y-p0.y);
    if(d<nearest){nearest=d;support=id;}
   }
  }
  const attack=side===0?1:-1;
  // Late receiving touches may already be inside the box. Keep every
  // part of the buildup moving toward the goal, never retreat to 83%.
  const firstProgress=(side===0?p0.x:field.width-p0.x)/field.width;
  // The shooter must reach a legal point INSIDE the end board before the
  // PSE-confirmed shot. Only the subsequent shot may cross the open goal.
  const lastInBounds=1-(Wall.RADIUS+.025)/field.width;
  const finishProgress=Math.min(lastInBounds,Math.max(.83,firstProgress+.025));
  const finish={x:origin(side,finishProgress,field),y:field.height*.50};
  const wing=(hash(String(event.player)+':'+String(event.minute))%2?1:-1);
  // Goal line is the end of the field, not 98.5% of its length.
  // Finish with the ball visibly BEHIND the keeper and the line.
  const net={x:(side===0?field.width+.9:-.9),
   y:field.height*.5+wing*2.15,z:.23};
  const p1={x:lerp(p0.x,finish.x,.30),y:lerp(p0.y,finish.y,.30)};
  const p2={x:lerp(p0.x,finish.x,.74),
   y:limit(lerp(p0.y,finish.y,.72)+wing*3,field.height*.13,field.height*.87)};
  const lob=(hash(String(event.player)+':through:'+String(event.minute))%4===0);
  let phase='run',ownerIndex=support;
  if(u<.34){
   const v=ease(u/.34);
   ball={x:lerp(p0.x,p1.x,v),y:lerp(p0.y,p1.y,v),z:.23};
  }else if(u<.70){
   const v=ease((u-.34)/.36);
   ball={x:lerp(p1.x,p2.x,v),y:lerp(p1.y,p2.y,v),
    z:.23+(lob?3:.48)*Math.sin(Math.PI*v)};
   phase=lob?'lofted-through':'through';ownerIndex=-1;
  }else if(u<.88){
   const v=ease((u-.70)/.18);
   ball={x:lerp(p2.x,finish.x,v),y:lerp(p2.y,finish.y,v),z:.23};
   phase='run';ownerIndex=scorerId;
  }else{
   const v=ease((u-.88)/.12);
   ball={x:lerp(finish.x,net.x,v),y:lerp(finish.y,net.y,v),
    z:.23+1.3*Math.sin(v*Math.PI)};
   phase='shot';ownerIndex=-1;
  }
  // Two attackers arrive at the ball along continuous paths. They never
  // teleport into their shooting poses at a goal-scene boundary.
  const starter=actors[support],startActor=opening.actors[support];
  const settle=ease(u/.32);
  starter.x=lerp(startActor.x,p1.x-attack*.6,settle);
  starter.y=lerp(startActor.y,p1.y-.3,settle);
  const finisher=actors[scorerId],startScorer=opening.actors[scorerId];
  const arrival=ease(u/.70);
  const follow=u>.70&&u<.88?ball:finish;
  finisher.x=lerp(startScorer.x,u>=.70?follow.x-attack*.55:p2.x-attack*.55,arrival);
  finisher.y=lerp(startScorer.y,u>=.70?follow.y-.3:p2.y-.3,arrival);
  const keeper=actors[(1-side)*11],ready=ease(u/.70);
  // Keeper guards the goal line, then dives the wrong way as the ball
  // crosses in the opposite side-netting lane. Entirely illustrative.
  keeper.x=lerp(keeper.x,origin(side,.955,field),ready);
  const shotDive=ease((u-.88)/.12);
  keeper.y=lerp(keeper.y,field.height*.5-wing*2.2*shotDive,ready);
  // The attack moves together before the official scorer takes the shot.
  // An official defender scorer makes a late run from deeper cover; others
  // follow without all abandoning their defensive positions.
  const build=ease((u-.14)/.56);
  for(let i=1;i<11;i++){
   const id=side*11+i;
   if(id===scorerId||id===support)continue;
   const role=roleOf(roster.lineup[i],i);
   if(role==='forward')continue;
   const p=actors[id],position=side===0?p.x/field.width:1-p.x/field.width;
   const target=role==='midfielder'?.69:.47;
   p.x=origin(side,lerp(position,Math.max(position,target),
    build*(role==='midfielder'?.65:.30)),field);
  }
  // Keep the entire 22-player frame continuous at the goal-scene entry.
  const enter=ease(u/.03);
  for(let i=0;i<actors.length;i++){
   actors[i].x=lerp(opening.actors[i].x,actors[i].x,enter);
   actors[i].y=lerp(opening.actors[i].y,actors[i].y,enter);
  }
  if(u>=.88){finisher.frame=3;keeper.frame=8;}
  if(t>=event.minute){ball=net;ownerIndex=-1;keeper.frame=8;finisher.frame=3;}
  // Hold supporting attackers and the scorer onside until the through
  // ball leaves the foot. Then permit the scorer's receiving run.
  Onside.apply(actors,field,ball,side,{
   carrier:ownerIndex,runner:scorerId,run:(u-.34)/.36,
   strength:enter
  });
  return {actors,ball,ownerIndex,contact:phase,
   action:t>=event.minute?'official-goal':u>=.88?'illustrative-shot':'illustrative-goal-buildup',
   label:t>=event.minute?'GOAL! '+roster.lineup[scorer].name:'',
   buildup:phase,officialEvent:t>=event.minute?event:null,illustrative:t<event.minute};
 }
 // After an official PSE goal, pause on the ball in the net, then use
 // a clearly labelled, discrete kickoff camera CUT to midfield. Never tween
 // the ball backward from the goal to a random illustrative possession.
 // Kickoff itself is illustrative; it changes no PSE event or match statistic.
 if(!ignoreGoal){
  let scored=null;
  for(const g of goals)if(t>g.minute+.22&&(!scored||g.minute>scored.minute))scored=g;
  if(scored){
   const start=(scored.minute+.22)*60,finish=PlayDirector.nextBoundary(fixture,field,start+4);
   if(seconds<finish){
    const nextSide=scored.team===teams[0].id?1:0;
    const kicker=nextSide*11+6;
    const center={x:field.width*.5,y:field.height*.5,z:.23};
    const phase=limit((seconds-start)/(finish-start),0,1);
    // Finish on an existing controlled position at a deterministic cycle
    // boundary. The kickoff pass lands without a second visual jump.
    const landingFrame=motionFrame(fixture,finish/60,field,true);
    const landing=landingFrame.ball;
    const release=ease((phase-.22)/.78);
    const recover=ease((phase-.24)/.76);
    // Faster possession can change the scripted team shape at the exact
    // restart boundary. Have every player finish the kickoff by matching
    // their next live-play position, not just the kicker. That avoids a
    // sudden post-goal 8m defensive reposition when normal play resumes.
    for(let i=0;i<actors.length;i++){
     actors[i].x=lerp(actors[i].x,landingFrame.actors[i].x,recover);
     actors[i].y=lerp(actors[i].y,landingFrame.actors[i].y,recover);
    }
    const actor=actors[kicker];
    actor.x=lerp(center.x-(nextSide===0?.72:-.72),actor.x,recover);
    actor.y=lerp(center.y-.32,actor.y,recover);
    actor.frame=phase>.20&&phase<.40?3:0;
    const controlled=phase<=.22;
    ball=controlled?center:{
     x:lerp(center.x,landing.x,release),
     y:lerp(center.y,landing.y,release),
     z:.23+.40*Math.sin(Math.PI*release)};
    return {actors,ball,action:'illustrative-kickoff',ownerIndex:controlled?kicker:-1,
     contact:controlled?'kickoff-setup':'kickoff-pass',sceneCut:'post-goal-kickoff',
     label:phase<.35?'KICKOFF · '+teams[nextSide].name:'',
     officialEvent:null,illustrative:true};
   }
  }
 }
 // Variable-length play sequences are visual only. Never alter PSE events.
 ball=visual.ball;
 const step=visual.stage;
 const phase=limit((seconds-step.start)/Math.max(.001,step.duration),0,1);
 if(step.mode==='carry')actors[step.owner].frame=phase>.92?3:0;
 if(step.mode==='pass'){
  if(phase<.19)actors[step.owner].frame=3;
  if(phase>.84)actors[step.receiver].frame=3;
 }
 if(step.mode==='challenge'&&phase>.6)actors[step.receiver].frame=2;
 if(step.mode==='rebound'){
  if(phase>step.wall?.impactU)actors[step.receiver].frame=2; // chase the bank
  if(phase>.88)actors[step.receiver].frame=3; // collect the loose ball
 }
 // Hybrid Counterpress: 0–4 seconds pressure, 4–10 seconds recovery.
 // Away from turnovers the closest defenders still close passing lanes.
 const defensive=TeamShape.press(fixture,field,seconds,visual,shape,actors,ball);
 // Deterministic 5 m/s maximum keeper pursuit, not a PSE save or turnover.
 // A goalkeeper can take the ball only if the director's existing rebound
 // action explicitly assigned that visual pickup to the keeper.
 const keeperPositions=Keeper.at(fixture,field,seconds);
 for(let side=0;side<2;side++){
  actors[side*11].x=keeperPositions[side].x;
  actors[side*11].y=keeperPositions[side].y;
 }
 const attackerSide=Math.floor(visual.stage.owner/11);
 const defenderSide=1-attackerSide;
 const keeperTarget=Keeper.target(defenderSide,field,visual.stage,ball);
 // Keep the outgoing attack's constraint during its existing recovery
 // blend, so a possession change never releases stranded players in a jump.
 let offsideBoundary;
 for(const side of [defenderSide,attackerSide]){
  const boundary=Onside.apply(actors,field,ball,side,{
   carrier:visual.ownerIndex,
   runner:step.mode!=='carry'?step.receiver:-1,
   run:step.mode!=='carry'?(seconds-step.start)/Math.min(.6,step.duration):0,
   strength:shape.attack[side]
  });
  if(side===attackerSide)offsideBoundary=boundary;
 }
 return {actors,ball,action:visual.action,ownerIndex:visual.ownerIndex,
  contact:visual.contact,label:'',officialEvent:null,illustrative:true,
  sequenceType:visual.sequenceType,sequenceIndex:visual.sequenceIndex,
  pressPhase:defensive.phase,pressingSide:defensive.side,
  pressingPlayers:defensive.ids,goalkeeperRushSide:keeperTarget.urgent?defenderSide:null,
  visualTactic:teams[shape.active].tactic||'balanced',
  segmentStart:visual.segmentStart,segmentEnd:visual.segmentEnd,
  passStart:visual.passStart,passArrival:visual.passArrival,
  passOrigin:visual.passOrigin,passTarget:visual.passTarget,
  offsideBoundary,
  wall:visual.wall,wallImpactSeconds:visual.wallImpactSeconds};

}
module.exports={motionFrame,base,hash,shotSummary,playbackRate};
