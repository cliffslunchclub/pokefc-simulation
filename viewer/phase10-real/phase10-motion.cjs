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
function motionFrame(fixture,t,field){
 if(!fixture||!fixture.home||!fixture.away||!Array.isArray(fixture.events))
  throw Error('Motion requires official fixture');
 if(!Number.isFinite(t)||t<0||t>90)throw Error('Invalid replay minute');
 if(!field||!Number.isFinite(field.width)||!Number.isFinite(field.height))throw Error('Invalid soccer pitch');
 const teams=[fixture.home,fixture.away],actors=[];
 for(let side=0;side<2;side++)for(let i=0;i<11;i++){
  const p=base(side,i,field);
  actors.push({side,index:i,x:p.x+Math.sin(t*.9+i*1.8+side)*.48,
   y:p.y+Math.cos(t*1.05+i*1.2+side)*.48,z:0,
   frame:Math.floor(t*3.5+i)%3===0?1:0,orientation:side===0?2:6});
 }
 let ball={x:field.width*.5,y:field.height*.5,z:.22};
 const goals=fixture.events.filter(e=>e.type==='goal');
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
  return {actors,ball,action:t>=event.minute?'official-goal':u>=.70?'illustrative-shot':'illustrative-goal-buildup',
   label:t>=event.minute?'GOAL! '+roster.lineup[scorer].name:
     'Attack: '+roster.lineup[scorer].name,
   officialEvent:t>=event.minute?event:null,illustrative:t<event.minute};
 }
 // Continuous deterministic build-up. Each new cycle is a fresh illustrative
 // passage, NOT a recorded or statistically authoritative possession sequence.
 // Longer illustrative passages reduce exaggerated sprinting and camera whiplash.
  const cycleLen=1.55,cycle=Math.floor(t/cycleLen);
 const u=(t-cycle*cycleLen)/cycleLen,roll=hash(String(fixture.seed||'pfc')+':'+cycle);
 const side=roll%2,teamOffset=side*11;
 const passer=teamOffset+5+((roll>>>2)%3);
 const receiver=teamOffset+8+((roll>>>5)%3);
 const defender=(1-side)*11+1+((roll>>>8)%4);
 const source={x:origin(side,.46,field),y:field.height*(.30+((roll>>>11)%4)*.12)};
 const target={x:origin(side,.67,field),y:field.height*(.27+((roll>>>13)%4)*.13)};
 const contest={x:origin(side,.74,field),y:lerp(target.y,field.height*.5,.3)};
 const center={x:field.width*.5,y:field.height*.5};
 actors[passer].x=source.x;actors[passer].y=source.y;
 actors[receiver].x=lerp(target.x,contest.x,ease((u-.55)/.3));
 actors[receiver].y=lerp(target.y,contest.y,ease((u-.55)/.3));
 actors[defender].x=lerp(origin(side,.80,field),contest.x,ease((u-.6)/.28));
 actors[defender].y=lerp(field.height*.48,contest.y,ease((u-.6)/.28));
 let action;
 if(u<.16){ball={x:lerp(center.x,source.x,ease(u/.16)),y:lerp(center.y,source.y,ease(u/.16)),z:.2};action='illustrative-carry'}
 else if(u<.55){ball={x:lerp(source.x,target.x,ease((u-.16)/.39)),y:lerp(source.y,target.y,ease((u-.16)/.39)),z:.2+.27*Math.sin(Math.PI*(u-.16)/.39)};action='illustrative-pass'}
 else if(u<.83){ball={x:lerp(target.x,contest.x,ease((u-.55)/.28)),y:lerp(target.y,contest.y,ease((u-.55)/.28)),z:.2};action='illustrative-dribble'}
 else {ball={x:lerp(contest.x,center.x,ease((u-.83)/.17)),y:lerp(contest.y,center.y,ease((u-.83)/.17)),z:.2};action='illustrative-challenge';actors[defender].frame=3}
 return {actors,ball,action,label:'',officialEvent:null,illustrative:true,cycle};
}
module.exports={motionFrame,base,hash};
