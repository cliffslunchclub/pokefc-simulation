'use strict';
// PokéFC public viewer: authentic Quick Sim JSON; native Soccer-JS rendering.
const {Settings}=require('./kernel/settings.js');
const {Simulator}=require('./kernel/providers/simulator/simulator.js');
const {Utils}=require('./kernel/core/lib/utils.js');
const {ImageDB}=require('./kernel/core/lib/imagedb.js');
const {motionFrame,shotSummary,playbackRate}=require('./phase10-motion.cjs');
const {prepare}=require('./pokemon-roster.cjs');
const {draw}=require('./pokemon-draw.cjs');
const $=id=>document.getElementById(id);
const mix=(a,b,t)=>a+(b-a)*Math.max(0,Math.min(1,t));
let match,sim,soccerBallSprite=null,minute=0,playing=false,last=null,speed=1,lastSent=-2,stopAt=90,spriteRoster=null,ballCarrier=-1,smoothedFocus=null,trackedActors=null,trackedBall=null,trackedMinute=null,kickIndex=0,kickElapsed=0;
const validViews=new Set(['isometric','orthographic','topdown']);
const embedded=new URLSearchParams(location.search).get('embedded')==='1';
const inlineView=embedded&&new URLSearchParams(location.search).get('inline')==='1';
if(inlineView)document.documentElement.classList.add('pfc-inline');
const send=(msg)=>{if(embedded&&window.parent!==window)window.parent.postMessage({...msg,type:'pfc-phase10-'+msg.type},location.origin)};
function receiveFixture(){
 return new Promise((resolve,reject)=>{
  let done=false;
  const onMsg=e=>{
   if(done||e.source!==window.parent||e.origin!==location.origin||e.data?.type!=='pfc-phase10-fixture')return;
   done=true;window.removeEventListener('message',onMsg);
   try{verify(e.data.fixture);resolve(e.data.fixture)}catch(err){reject(err)}
  };
  window.addEventListener('message',onMsg);
  window.parent.postMessage({type:'pfc-phase10-ready'},location.origin);
 });
}
function verify(m){
 if(m?.origin!=='quick-sim'||m?.schema!=='pokefc-quick-sim-export/v1')throw Error('Not a Quick Sim export');
 if(m.home.lineup.length!==11||m.away.lineup.length!==11)throw Error('Missing lineup');
 if(m.durationMinutes!==90&&m.durationMinutes!==120)throw Error('Unsupported match duration');
 if(m.durationMinutes===120&&m.knockoutRules!=='pse-knockout-v1')throw Error('Extra-time provenance missing');
 if(m.shootout){
  if(m.durationMinutes!==120||m.shootout.version!=='pse-shootout-v1'||!Array.isArray(m.shootout.attempts))
   throw Error('Invalid official shootout export');
 }
 if(m.events.some(e=>!Number.isFinite(e.minute)||e.minute<0||e.minute>=m.durationMinutes))
  throw Error('Official event outside match period');
 const goals=m.events.filter(e=>e.type==='goal');
 if(goals.length!==m.score[0]+m.score[1])throw Error('Goal ledger mismatch');
 for(const side of [m.home,m.away])for(const e of goals.filter(g=>g.team===side.id))
  if(!side.lineup.some(p=>p.id===e.player))throw Error('Invalid goal scorer');
}
function scoreAt(t){
 const s=[0,0];for(const g of match.events)if(g.type==='goal'&&g.minute<=t)s[g.team===match.home.id?0:1]++;
 return s;
}
function cameraFit(canvas,field,ball){
 const p=Settings.projectionMode;
 // Screen extents per one world unit, from the unchanged original Soccer-JS
 // projection transforms (Utils.toScreen). Do not substitute our own art.
 const w=p==='isometric'?(field.width+field.height)*.6:
   p==='orthographic'?field.width+field.height*.3:field.width;
 const h=p==='isometric'?(field.width+field.height)*.3:field.height*.8;
 const fit=Math.min(canvas.width*.78/w,canvas.height*.70/h);
 const camera=$('camera').value==='follow'?'follow':'wide';
 // Deliberately tighter television-style framing; camera tracks the ball.
 // Midfield/penalty-area FIFA-like framing without the extreme 4.8x closeup.
 Settings.camera.scale=fit*(camera==='follow'?3.15:1.35);
 const corners=[[0,0],[field.width,0],[0,field.height],[field.width,field.height]]
   .map(([x,y])=>Utils.toScreen(x,y,0));
 const xs=corners.map(v=>v.x),ys=corners.map(v=>v.y);
 const center={x:(Math.min(...xs)+Math.max(...xs))/2,y:(Math.min(...ys)+Math.max(...ys))/2};
 const focus=Utils.toScreen(ball.x,ball.y,0);
 if(camera==='follow'){
  center.x=mix(center.x,focus.x,.94);
  center.y=mix(center.y,focus.y,.94);
 }
 // Soften abrupt changes of possession in illustrative sequences.
 if(playing&&smoothedFocus&&smoothedFocus.projection===p&&smoothedFocus.camera===camera){
  center.x=mix(smoothedFocus.x,center.x,.15);
  center.y=mix(smoothedFocus.y,center.y,.15);
 }
 smoothedFocus={x:center.x,y:center.y,projection:p,camera};
 return {projection:p,camera,scale:Settings.camera.scale,
  tx:canvas.width/2-center.x,ty:canvas.height/2-center.y,
  visibleWorld:[field.width,field.height]};
}
// Screen-frame locomotion cap: off-ball Pokémon and the ball cannot
// instantaneously teleport when a new illustrative action is chosen.
// All tracking is presentation-only; official score/events stay untouched.
function smoothMotion(script,t){
 if(trackedMinute===null||t<trackedMinute||!trackedActors||!trackedBall){
  trackedActors=script.actors.map(p=>({x:p.x,y:p.y}));
  trackedBall={x:script.ball.x,y:script.ball.y,z:script.ball.z};
  trackedMinute=t;return script;
 }
 const seconds=Math.max(0,(t-trackedMinute)*60);
 const follow=(prev,next,maxDistance)=>{
  const dx=next.x-prev.x,dy=next.y-prev.y,distance=Math.hypot(dx,dy);
  if(!distance||distance<=maxDistance)return {...next};
  const ratio=maxDistance/distance;
  return {...next,x:prev.x+dx*ratio,y:prev.y+dy*ratio};
 };
 const actors=script.actors.map((p,i)=>{
  const prev=trackedActors[i];
  return {...p,...follow(prev,p,seconds*6.5)};
 });
 const ball=follow(trackedBall,script.ball,seconds*28);
 trackedActors=actors.map(p=>({x:p.x,y:p.y}));
 trackedBall={x:ball.x,y:ball.y,z:ball.z};
 trackedMinute=t;
 return {...script,actors,ball};
}
function render(t){
 const field=Utils.getFieldBounds(),s=scoreAt(t);
 // Shootout poses are official incident visualizations: bypass locomotion
 // smoothing at a fixed 120' clock, otherwise the ball would never move.
 const script=match.shootout&&t>=match.durationMinutes&&kickIndex>0?
  motionFrame(match,t,field,{kickIndex}):
  smoothMotion(motionFrame(match,t,field),t);
 for(const p of script.actors){
  const actor=(p.side===0?sim.teamA:sim.teamB).players[p.index];
  actor.x=p.x;actor.y=p.y;actor.z=p.z;
  actor.frame=p.frame;actor.orientation=p.orientation;
  actor.vx=actor.vy=actor.vz=0;
 }
 sim.ball.owner=null;sim.ball.x=script.ball.x;sim.ball.y=script.ball.y;sim.ball.z=script.ball.z;
 sim.ball.vx=sim.ball.vy=sim.ball.vz=0;
 sim.scoreA=s[0];sim.scoreB=s[1];sim.matchTimer=t*60;
 const canvas=$('pitch'),ctx=canvas.getContext('2d');
 const camera=cameraFit(canvas,field,script.ball);
 window.__PFC_DRAWN__=0;window.__PFC_REAL_SPRITES_DRAWN__=0;
 // Possession changes only once the intended receiver has actually touched
 // the ball; never guess a carrier merely because a Pokémon is 12m away.
 ballCarrier=Number.isInteger(script.ownerIndex)?script.ownerIndex:-1;
 ctx.clearRect(0,0,canvas.width,canvas.height);
 ctx.save();
 ctx.translate(camera.tx,camera.ty);
 // Original Soccer-JS pitch/players/ball renderer, no native sim ticks.
 sim.renderAll(ctx);
 ctx.restore();
 $('score').textContent=s.join(' – ');
 $('clock').textContent=Math.floor(t)+"'"+(t>=90&&match.durationMinutes===120?' · ET':'');
 $('scrub').value=t;$('played').textContent=t.toFixed(1)+"/"+match.durationMinutes+"'";
 $('toast').textContent=script.label;$('toast').hidden=!script.label;
 const totalKicks=match.shootout?.attempts.length||0;
 const shootoutPending=!!totalKicks&&t>=match.durationMinutes&&kickIndex<totalKicks;
 $('status').textContent=shootoutPending?'PENALTY SHOOTOUT':
  t>=match.durationMinutes?'FULL TIME':
  t>=90&&match.durationMinutes===120?'EXTRA TIME':playing?'WATCHING':'READY / PAUSED';
 $('nextKick').hidden=!shootoutPending;
 $('nextKick').disabled=!shootoutPending;
 const panel=$('shootoutOverlay');
 panel.hidden=!(totalKicks&&t>=match.durationMinutes);
 if(!panel.hidden){
  const shown=match.shootout.attempts.slice(0,kickIndex);
  const h=shown.filter(k=>k.side==='home'&&k.scored).length;
  const a=shown.filter(k=>k.side==='away'&&k.scored).length;
  $('shootoutScore').textContent='PENALTIES '+h+' – '+a+' · '+kickIndex+'/'+totalKicks;
  $('shootoutDetail').textContent=kickIndex?
   shown.at(-1).kicker+' · '+shown.at(-1).outcome.toUpperCase():
   'End of extra time · official PSE shootout';
  $('shootoutAdvance').disabled=!shootoutPending;
  $('shootoutAdvance').hidden=!shootoutPending;
 }
 const actionText={
  'illustrative-carry':'Ball carry','illustrative-pass':'Passing sequence',
  'illustrative-dribble':'Attacking dribble','illustrative-challenge':'Defensive challenge',
  'illustrative-goal-buildup':'Goal buildup','illustrative-shot':'Shooting animation',
  'official-goal':'OFFICIAL QUICK SIM GOAL',
  'official-shootout-goal':'OFFICIAL SHOOTOUT CONVERSION',
  'official-shootout-saved':'OFFICIAL SHOOTOUT SAVE',
  'official-shootout-off-target':'OFFICIAL SHOOTOUT MISS'
 };
 $('motionStatus').textContent=(actionText[script.action]||'Animated sequence')+
  (script.officialEvent?' · official PSE event':' · illustrative movement');
 if(sim.scoreA!==s[0]||sim.scoreB!==s[1])throw Error('Score changed during render');
 if(embedded&&(t===match.durationMinutes||t===0||Math.abs(t-lastSent)>=.1)){
  lastSent=t;send({type:'progress',minute:t,score:s,kickIndex,
   shootoutComplete:!match.shootout||kickIndex===match.shootout.attempts.length});
 }
 window.__PFC_SNAPSHOT__={minute:t,score:s,players:22,
  projection:camera.projection,camera:camera.camera,scale:camera.scale,
  animation:script.action,ball:{x:script.ball.x,y:script.ball.y,z:script.ball.z},
  carrier:ballCarrier,ballContact:script.contact||'set-piece',soccerBallSpriteLoaded:!!soccerBallSprite?.naturalWidth,
  cameraOffset:[camera.tx,camera.ty],ballDrawRadius:Settings.BALL_DRAW_RADIUS,
  actorWorldPositions:script.actors.map(p=>[p.x,p.y]),
  actualSprites:!!ImageDB.get('player_Brazil_main')&&!!ImageDB.get('player_Argentina_main'),
  pokemonSpritesLoaded:spriteRoster.entries.filter(e=>e.image?.naturalWidth>0).length,
  pokemonSpritesDrawn:window.__PFC_REAL_SPRITES_DRAWN__,pokemonEntitiesDrawn:window.__PFC_DRAWN__,
  numbersVisible:$('showNumbers').checked,teamColors:spriteRoster.colors,
  pokemonIds:spriteRoster.entries.map(e=>e.dexId),humanPlayerSprites:false,
  durationMinutes:match.durationMinutes,phase:t>=match.durationMinutes&&match.shootout?
   'shootout':t>=90&&match.durationMinutes===120?'extra-time':'regulation',
  kickIndex,totalKicks};
}
function advanceKick(){
 if(!match?.shootout||minute<match.durationMinutes||
    kickIndex>=match.shootout.attempts.length)return false;
 kickIndex++;kickElapsed=0;render(minute);return true;
}
function step(now){
 if(playing){
  if(last!==null){
   const elapsed=Math.max(0,(now-last)/1000);
   // A suspended tab pauses rather than skipping extra time or penalty kicks.
   if(elapsed>2){playing=false;last=null;}
   else if(minute<stopAt)minute=Math.min(stopAt,
    minute+elapsed*playbackRate(minute,match.events,speed));
   else if(minute>=match.durationMinutes&&match.shootout&&
    kickIndex<match.shootout.attempts.length){
    kickElapsed+=elapsed*speed;
    if(kickElapsed>=1.2)advanceKick();
   }else playing=false;
  }
  if(minute>=stopAt&&(minute<match.durationMinutes||
   !match.shootout||kickIndex>=match.shootout.attempts.length))playing=false;
  last=playing?now:null;
  render(minute);
 }
 requestAnimationFrame(step);
}
function seek(t){
 playing=false;last=null;smoothedFocus=null;
 trackedActors=null;trackedBall=null;trackedMinute=null;kickElapsed=0;
 minute=Math.max(0,Math.min(match.durationMinutes,t));
 if(minute<match.durationMinutes)kickIndex=0;
 render(minute);
}
function finish(){
 playing=false;last=null;smoothedFocus=null;
 trackedActors=null;trackedBall=null;trackedMinute=null;
 minute=match.durationMinutes;kickIndex=match.shootout?.attempts.length||0;
 kickElapsed=0;render(minute);
}
async function boot(){
 try{
  window.__APP_ROOT__=new URL('./',location.href).href;
  if(embedded){match=await receiveFixture()}
  else{
   const response=await fetch('./fixture.json');if(!response.ok)throw Error('Missing match fixture');
   match=await response.json();
  }
  verify(match);
  stopAt=match.durationMinutes;
  $('scrub').max=String(stopAt);$('seekEnd').textContent=stopAt+"'";
  if(match.durationMinutes===120)$('notice').textContent=
   'PSE knockout replay includes 90 minutes plus 30 minutes of extra time. Shootout kicks are separate from match goals and statistics. Player paths and ball physics remain illustrative.';
  Settings.app={canvas:$('pitch'),camX:0,camY:0};
  Settings.HEADLESS=false;Settings.showFPS=false;Settings.showTime=false;
  Settings.soundsMuted=true;
   // Cosmetic only: enlarge the drawn ball, never its physics radius.
   Settings.BALL_DRAW_RADIUS=9.5;Settings.camera.scale=8.6;
  Settings.camera.type='centered';Settings.camera.offsetX=0;Settings.camera.offsetY=0;
  Settings.projectionMode='orthographic';
   $('projection').value='orthographic';$('camera').value='follow';
  $('status').textContent='GENERATING REAL SOCCER-JS SPRITES…';
  sim=new Simulator({seed:12345});await sim.start();sim.active=true;
  // Use an actual original soccer-ball sprite at the native ball's projected
  // position. This replaces only graphics, never collision/physics or results.
  soccerBallSprite=new Image();
  soccerBallSprite.decoding='async';
  soccerBallSprite.src=new URL('./assets/pfc-soccer-ball.svg',window.__APP_ROOT__).href;
  const oldBallRender=sim.ball.render.bind(sim.ball);
  sim.ball.render=function(g){
   if(!soccerBallSprite?.naturalWidth){oldBallRender(g);return}
   const scale=Utils.getScaleMultiplier();
   const r=Math.max(4.5,Settings.BALL_DRAW_RADIUS*scale);
   const ground=Utils.toScreen(this.x,this.y,0);
   const ball=Utils.toScreen(this.x,this.y,this.z);
   g.save();
   g.fillStyle='#0008';g.beginPath();
   const shadow=Math.max(3.5,r*.72)/(1+this.z*.35);
   g.ellipse(ground.x,ground.y,shadow,shadow*.45,0,0,Math.PI*2);g.fill();
   g.drawImage(soccerBallSprite,ball.x-r,ball.y-r,r*2,r*2);
   g.restore();
  };
  // Keep native sprite/pitch/ball rendering; suppress upstream kickoff/score overlays.
  sim.render=()=>{};
  spriteRoster=prepare(match);await spriteRoster.load();
  for(let side=0;side<2;side++)for(let i=0;i<11;i++){
   const actor=(side===0?sim.teamA:sim.teamB).players[i],index=side*11+i;
   actor.preRender=()=>{};
   actor.render=g=>{
    window.__PFC_DRAWN__++;
    if(draw(g,actor,spriteRoster.entries[index],Utils.toScreen,$('showNumbers').checked,ballCarrier===index))window.__PFC_REAL_SPRITES_DRAWN__++;
   };
  }
  if(!ImageDB.get('player_Brazil_main')||!ImageDB.get('player_Argentina_main'))
   throw Error('Original Soccer-JS sprite generation failed');
  const list=$('goals');list.replaceChildren();
  for(const e of match.events.filter(e=>e.type==='goal')){
   const side=e.team===match.home.id?match.home:match.away;
   const row=document.createElement('div'),scorer=side.lineup.find(p=>p.id===e.player);
   const helper=side.lineup.find(p=>p.id===e.assist);
   row.textContent=Math.floor(e.minute+1)+"' · "+scorer.name+' — '+side.name+
     (helper?' (assist '+helper.name+')':'');
   list.append(row);
  }
  $('stats').textContent=shotSummary(match.stats);
  $('play').onclick=()=>{
    if(minute>=match.durationMinutes&&(!match.shootout||kickIndex>=match.shootout.attempts.length)){
     minute=0;kickIndex=0;
    }
    stopAt=match.durationMinutes;last=null;playing=true;
   };
  $('playFive').onclick=()=>{
    if(minute>=match.durationMinutes){playing=true;last=null;return}
    stopAt=Math.min(match.durationMinutes,(Math.floor(minute/5)+1)*5);
    last=null;playing=true;
   };
  $('pause').onclick=()=>seek(minute);
  $('restart').onclick=()=>{kickIndex=0;seek(0)};
  $('skip').onclick=finish;
  $('scrub').oninput=e=>seek(Number(e.target.value));
  $('nextGoal').onclick=()=>{
   const goal=match.events.find(e=>e.type==='goal'&&e.minute>minute+.01);
   seek(goal?Math.min(goal.minute+.01,match.durationMinutes):match.durationMinutes);
  };
  $('nextKick').onclick=advanceKick;
  $('shootoutAdvance').onclick=advanceKick;
  $('speed').onchange=e=>{speed=Number(e.target.value)||1;};
  $('projection').onchange=e=>{
   if(!validViews.has(e.target.value))return;
   Settings.projectionMode=e.target.value;
   sim.pitch?.invalidateRenderCache?.();
   render(minute);
  };
  $('camera').onchange=()=>{smoothedFocus=null;sim.pitch?.invalidateRenderCache?.();render(minute);};
  $('showNumbers').onchange=()=>render(minute);
  for(const id of ['play','playFive','pause','restart','skip','nextGoal','scrub'])$(id).disabled=false;
  window.addEventListener('message',e=>{
   if(!embedded||e.source!==window.parent||e.origin!==location.origin)return;
   const msg=e.data;
   if(!msg||typeof msg!=='object')return;
   if(msg.type==='pfc-phase10-seek'){
    const requested=Number(msg.minute);
    if(Number.isFinite(requested))seek(requested);
    return;
   }
   if(msg.type!=='pfc-phase10-control')return;
   if(msg.action==='play'){
    if(minute>=match.durationMinutes&&
     (!match.shootout||kickIndex>=match.shootout.attempts.length))return;
    speed=Math.max(.25,Math.min(16,Number(msg.speed)||1));
    $('speed').value=String([1,2,4,8,16].includes(speed)?speed:1);
    playing=true;last=null;
    render(minute);
   }else if(msg.action==='pause'){
    playing=false;last=null;render(minute);
   }else if(msg.action==='speed'){
    const v=Number(msg.speed);
    if(Number.isFinite(v)&&v>0&&v<=16){speed=v;last=null;render(minute);}
   }else if(msg.action==='seek'){
    const m=Number(msg.minute);
    if(Number.isFinite(m)&&m>=0&&m<=match.durationMinutes)seek(m);
   }else if(msg.action==='next-kick'){advanceKick();
   }else if(msg.action==='finish'){finish();
   }else if(msg.action==='projection'&&validViews.has(msg.projection)){
    $('projection').value=msg.projection;Settings.projectionMode=msg.projection;smoothedFocus=null;
    sim.pitch?.invalidateRenderCache?.();render(minute);
   }else if(msg.action==='camera'&&['wide','follow'].includes(msg.camera)){
    $('camera').value=msg.camera;smoothedFocus=null;sim.pitch?.invalidateRenderCache?.();render(minute);
   }else if(msg.action==='numbers'){
    $('showNumbers').checked=!!msg.visible;render(minute);
   }
  });
  seek(0);window.__PFC_VIEWER_READY__=true;
  send({type:'booted',projection:Settings.projectionMode,pokemonSpritesLoaded:spriteRoster.entries.filter(e=>e.image?.naturalWidth>0).length});
  requestAnimationFrame(step);
 }catch(e){
  console.error(e);window.__PFC_VIEWER_ERROR__=String(e.stack||e);
  $('status').textContent='VIEWER ERROR';$('notice').textContent=e.message||String(e);
  send({type:'error',message:String(e.message||e)});
 }
}
document.addEventListener('DOMContentLoaded',boot);
