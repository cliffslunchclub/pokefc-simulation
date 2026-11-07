'use strict';
/**
 * PokéFC Watch broadcast captions (text-only).
 *
 * Ordinary passes, carries and challenges are ILLUSTRATIVE Play Director
 * choreography. Recorded goals, saves and set pieces come EXCLUSIVELY
 * from the immutable PSE fixture. This module never mutates that fixture.
 *
 * Generate the full seeded timeline once so seeking, replays, changes to
 * playback speed and all three game modes produce the same commentary.
 */
const {planFor,hash}=require('./phase10-play-director.cjs');
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const PREFIX='broadcast-v1:';
const OFFICIAL_TYPES=new Set([
 'goal','save','shot','corner','foul','free-kick','penalty-kick'
]);
const pick=(seed,variants)=>variants[hash(seed)%variants.length];
function teamsOf(f){return [f.home,f.away]}
function player(f,id){
 if(!Number.isInteger(id)||id<0||id>21)return 'A Pokémon';
 const team=teamsOf(f)[Math.floor(id/11)];
 const p=team?.lineup?.[id%11];
 return String(p?.name||'A Pokémon');
}
function teamForEvent(f,e){
 return teamsOf(f).find(t=>String(t.id)===String(e.team))||null;
}
function eventPlayer(team,id){
 const p=team?.lineup?.find(x=>String(x.id)===String(id));
 return String(p?.name||'A Pokémon');
}
function officialLine(f,e,index){
 if(!OFFICIAL_TYPES.has(e?.type)||!Number.isFinite(e.minute)||
    (e.source!=='quick-sim'&&e.origin!=='quick-sim'))return null;
 const team=teamForEvent(f,e);
 if(!team)return null;
 const squad=String(team.name||team.id);
 const name=eventPlayer(team,e.player);
 const key=PREFIX+'official:'+e.type+':'+(e.id||index);
 const variation=key+':'+String(f.visualSeed||f.seed||'pfc');
 let text;
 switch(e.type){
 case 'goal': text=pick(variation,[
  'GOOOOOAL! '+name+' scores for '+squad+'! What a moment!',
  'GOAL! '+name+' puts it away! '+squad+' celebrates!',
  'THE BALL IS IN THE NET! '+name+' delivers for '+squad+'!'
 ]);break;
 case 'save': text=pick(variation,[
  'WHAT A SAVE! '+name+' keeps the ball out!',
  'Brilliant goalkeeping from '+name+'! A crucial stop!',
  name+' gets to it! A superb save!'
 ]);break;
 case 'shot':
  if(e.outcome==='goal'||e.outcome==='saved')return null;
  text=e.outcome==='off-target'
   ? pick(variation,['That effort from '+squad+' goes wide!',
      'Not quite the finish '+squad+' wanted—off target!'])
   : pick(variation,[squad+' gets a shot away!',
      'An attempt on goal from '+squad+'!']);
  break;
 case 'corner':text='A corner awarded to '+squad+'.';break;
 case 'foul':text='The referee signals a foul against '+squad+'.';break;
 case 'free-kick':text='A free kick for '+squad+'.';break;
 case 'penalty-kick':text='A penalty kick for '+squad+'! A huge moment!';break;
 default:return null;
 }
 return {id:key,seconds:e.minute*60,kind:'official',type:e.type,
  text,minute:Math.floor(e.minute),priority:e.type==='goal'?4:3};
}
function illustrationLine(f,a,i,field){
 const who=player(f,a.owner),to=player(f,a.receiver);
 const side=Math.floor(a.owner/11);
 const p=side===0?a.from.x/field.width:
  (field.width-a.from.x)/field.width;
 const advanced=p>.79;
 const nearWing=a.from.y<field.height*.24||a.from.y>field.height*.76;
 const key=PREFIX+'visual:'+String(f.visualSeed||f.seed||'pfc')+':'+i;
 let lines=[];
 if(a.mode==='pass'){
  if(a.pattern==='weave')lines=[
   who+' angles the ball across to '+to+'—lovely movement!',
   'Quick passing! '+who+' finds '+to+' on the other side.',
   who+' and '+to+' combine in a neat passing triangle.'
  ];
  else if(a.pattern==='one-two')lines=[
   who+' plays the give-and-go toward '+to+'!',
   'First-time combination: '+who+' to '+to+'!',
   who+' releases it quickly for '+to+'.'
  ];
  else if(a.pattern==='through')lines=[
   who+' sees the run! A through ball for '+to+'!',
   'There is space ahead—'+who+' sends '+to+' through!',
   'A searching pass from '+who+' toward '+to+'!'
  ];
  else if(a.pattern==='cross')lines=[
   who+' sends it across toward '+to+'!',
   'A ball from the flank! '+to+' is the target.',
   who+' looks for '+to+' with a cross.'
  ];
  else if(a.pattern==='switch')lines=[
   who+' switches play toward '+to+'!',
   'Across the pitch! '+who+' changes the angle for '+to+'.',
   who+' spots '+to+' on the far side.'
  ];
  else if(a.wall)lines=[
   'That pass from '+who+' glances off the boards!',
   who+' uses the wall—the ball stays in play!'
  ];
  else lines=[who+' works the ball toward '+to+'.',
   who+' finds a passing lane for '+to+'.'];
  if(a.wall&&a.pattern!=='weave')lines.push(
   'Off the boards! '+who+' looks to keep possession moving.');
 }else if(a.mode==='carry'){
  lines=advanced?[
   who+' drives toward the area—this is dangerous territory!',
   who+' carries it near goal, searching for an opening!',
   who+' is probing the last line of defense.'
  ]:nearWing?[
   who+' brings it up the flank, looking for support.',
   who+' is working the wide channel.'
  ]:[
   who+' moves forward with possession.',
   who+' takes a touch and surveys the options.',
   who+' carries into space, waiting for support.'
  ];
 }else if(a.mode==='rebound'){
  lines=['The ball comes off the wall—still alive!',
   'Loose ball by the boards! Players move to collect it.'];
 }else if(a.mode==='challenge'){
  lines=['A challenge for possession! The players converge.',
   'Pressure on the ball—who is going to come away with it?',
   'The defense steps in to contest the ball.'];
 }else return null;
 return {id:PREFIX+'visual:'+i,seconds:a.start,kind:'visual',
  type:a.pattern||a.mode,text:pick(key,lines),
  minute:Math.floor(a.start/60),priority:1};
}
function build(f,field){
 if(!f?.home?.lineup||!f?.away?.lineup||!Array.isArray(f.events))
  throw Error('Commentary requires the verified PSE fixture');
 const plan=planFor(f,field);
 const entries=[{id:PREFIX+'opening',seconds:0,kind:'visual',type:'intro',
  text:'We are underway! Both sides looking to settle into the match.',
  minute:0,priority:1}];
 let last=0,visualNumber=0;
 const seed=String(f.visualSeed||f.seed||'pfc');
 for(let i=0;i<plan.actions.length;i++){
  const a=plan.actions[i];
  // Natural commentary cadence: ~3–6 seconds of *match time*.
  const gap=3+(hash(seed+':commentary-gap:'+visualNumber)%301)/100;
  if(a.start<last+gap)continue;
  const line=illustrationLine(f,a,i,field);
  if(!line)continue;
  entries.push(line);last=a.start;visualNumber++;
 }
 f.events.forEach((e,i)=>{
  const line=officialLine(f,e,i);
  if(line)entries.push(line);
 });
 entries.sort((a,b)=>a.seconds-b.seconds||a.priority-b.priority||
  a.id.localeCompare(b.id));
 // A PSE incident wins if it shares the same second with a visual caption.
 return {entries,duration:plan.duration,seed,fixture:f};
}
function shootoutLine(f,kick,index){
 const team=kick.side==='home'?f.home:f.away;
 const taker=eventPlayer(team,kick.kickerId);
 const name=taker==='A Pokémon'?String(kick.kicker||'The taker'):taker;
 let text;
 if(kick.outcome==='goal'||kick.scored===true)
  text='PENALTY SCORED! '+name+' holds their nerve!';
 else if(kick.outcome==='saved')
  text='PENALTY SAVED! A massive stop against '+name+'!';
 else text=name+' misses the penalty! Dramatic scenes!';
 return {id:PREFIX+'shootout:'+index,seconds:(f.durationMinutes||90)*60,
  kind:'official',type:'shootout',text,minute:f.durationMinutes||90,
  priority:4,kickIndex:index+1};
}
function visible(feed,seconds,kickIndex=0){
 const time=clamp(Number(seconds)||0,0,feed.duration);
 // Binary search ensures no future lines appear during a seek or rewind.
 const all=feed.entries;let lo=0,hi=all.length;
 while(lo<hi){
  const mid=(lo+hi)>>1;
  if(all[mid].seconds<=time+1e-8)lo=mid+1;else hi=mid;
 }
 const lines=all.slice(0,lo);
 if(time>=feed.duration&&feed.fixture.shootout?.version==='pse-shootout-v1'&&
    feed.fixture.shootout.attempts?.length){
  const attempts=feed.fixture.shootout.attempts;
  for(let i=0;i<Math.min(kickIndex,attempts.length);i++)
   lines.push(shootoutLine(feed.fixture,attempts[i],i));
 }
 return lines;
}
function latest(feed,seconds,kickIndex){
 const lines=visible(feed,seconds,kickIndex);
 return lines.at(-1)||null;
}
function history(feed,seconds,kickIndex=0,max=120){
 return visible(feed,seconds,kickIndex).slice(-max).reverse();
}
module.exports={build,visible,latest,history,officialLine,illustrationLine,shootoutLine};
