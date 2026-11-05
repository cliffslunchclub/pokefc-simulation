'use strict';
// PokéFC public viewer: authentic Quick Sim JSON; native Soccer-JS rendering.
const {Settings}=require('./kernel/settings.js');
const {Simulator}=require('./kernel/providers/simulator/simulator.js');
const {Utils}=require('./kernel/core/lib/utils.js');
const {ImageDB}=require('./kernel/core/lib/imagedb.js');
const $=id=>document.getElementById(id);
const mix=(a,b,t)=>a+(b-a)*Math.max(0,Math.min(1,t));
let match,sim,minute=0,playing=false,last=null,speed=1;
function verify(m){
 if(m?.origin!=='quick-sim'||m?.schema!=='pokefc-quick-sim-export/v1')throw Error('Not a Quick Sim export');
 if(m.home.lineup.length!==11||m.away.lineup.length!==11)throw Error('Missing lineup');
 const goals=m.events.filter(e=>e.type==='goal');
 if(goals.length!==m.score[0]+m.score[1])throw Error('Goal ledger mismatch');
 for(const side of [m.home,m.away])for(const e of goals.filter(g=>g.team===side.id))
  if(!side.lineup.some(p=>p.id===e.player))throw Error('Invalid goal scorer');
}
function scoreAt(t){
 const s=[0,0];for(const g of match.events)if(g.minute<=t)s[g.team===match.home.id?0:1]++;
 return s;
}
function spot(side,index,f){
 const x=side===0?p=>p:p=>f.width-p;
 if(index===0)return {x:x(f.width*.07),y:f.height*.5};
 if(index<5)return {x:x(f.width*.23),y:f.height*(.12+(index-1)*.25)};
 if(index<8)return {x:x(f.width*.45),y:f.height*(.2+(index-5)*.30)};
 return {x:x(f.width*.70),y:f.height*(.20+(index-8)*.27)};
}
function render(t){
 const f=Utils.getFieldBounds(),s=scoreAt(t),players=[];
 for(let team=0;team<2;team++)for(let i=0;i<11;i++){
  const p=spot(team,i,f);players.push({team,i,x:p.x+Math.sin(t*.65+i)*.7,
   y:p.y+Math.cos(t*.85+i)*.55,frame:1,orientation:team===0?2:6,z:0});
 }
 let ball={x:f.width*(.5+.29*Math.sin(t*.8)),y:f.height*(.5+.2*Math.cos(t*.9)),z:.2};
 let label='';
 const g=match.events.find(e=>t>=e.minute-.18&&t<e.minute+.14);
 if(g){
  const side=g.team===match.home.id?0:1,roster=side===0?match.home:match.away;
  const shooter=roster.lineup.findIndex(p=>p.id===g.player);
  const p=players[side*11+shooter],gk=players[(1-side)*11];
  const start=g.minute-.18,kick=g.minute-.045;
  p.x=f.width*(side===0?.82:.18);p.y=f.height*.5;
  gk.x=f.width*(side===0?.98:.02);gk.y=f.height*.5;
  p.frame=t>=kick?3:1;gk.frame=t>=kick?8:0;
  ball.x=t<kick?mix(f.width*.5,p.x,(t-start)/(kick-start)):
    mix(p.x,gk.x,(t-kick)/(g.minute-kick));
  ball.y=f.height*.5;
  label=(t>=g.minute?'GOAL! ':'Attack: ')+roster.lineup[shooter].name;
 }
 for(const p of players){
  const actor=(p.team===0?sim.teamA:sim.teamB).players[p.i];
  actor.x=p.x;actor.y=p.y;actor.z=0;actor.frame=p.frame;actor.orientation=p.orientation;
  actor.vx=actor.vy=actor.vz=0;
 }
 sim.ball.owner=null;sim.ball.x=ball.x;sim.ball.y=ball.y;sim.ball.z=ball.z;
 sim.ball.vx=sim.ball.vy=sim.ball.vz=0;
 sim.scoreA=s[0];sim.scoreB=s[1];sim.matchTimer=t*60;
 const canvas=$('pitch'),ctx=canvas.getContext('2d');
 ctx.clearRect(0,0,canvas.width,canvas.height);sim.renderAll(ctx);
 $('score').textContent=s.join(' – ');
 $('clock').textContent=Math.floor(t)+"'";
 $('scrub').value=t;$('played').textContent=t.toFixed(1)+"/90'";
 $('toast').textContent=label;$('toast').hidden=!label;
 $('status').textContent=t>=90?'FULL TIME':playing?'WATCHING':'READY / PAUSED';
 if(sim.scoreA!==s[0]||sim.scoreB!==s[1])throw Error('Score changed during render');
 window.__PFC_SNAPSHOT__={minute:t,score:s,players:22,actualSprites:
  !!ImageDB.get('player_Brazil_main')&&!!ImageDB.get('player_Argentina_main')};
}
function step(now){
 if(playing){
  if(last!==null)minute=Math.min(90,minute+Math.min(.1,(now-last)/1000)*2.5*speed);
  if(minute>=90)playing=false;
  last=now;render(minute);
 }
 requestAnimationFrame(step);
}
function seek(t){playing=false;last=null;minute=Math.max(0,Math.min(90,t));render(minute);}
async function boot(){
 try{
  window.__APP_ROOT__=new URL('./',location.href).href;
  const response=await fetch('./fixture.json');if(!response.ok)throw Error('Missing match fixture');
  match=await response.json();verify(match);
  Settings.app={canvas:$('pitch'),camX:0,camY:0};
  Settings.HEADLESS=false;Settings.showFPS=false;Settings.showTime=false;
  Settings.soundsMuted=true;Settings.camera.scale=9.5;
  Settings.camera.offsetX=55;Settings.camera.offsetY=140;
  Settings.projectionMode='orthographic';
  $('status').textContent='GENERATING REAL SOCCER-JS SPRITES…';
  sim=new Simulator({seed:12345});await sim.start();sim.active=true;
  // Keep native sprite/pitch/ball rendering; suppress upstream kickoff/score overlays.
  sim.render=()=>{};
  if(!ImageDB.get('player_Brazil_main')||!ImageDB.get('player_Argentina_main'))
   throw Error('Original Soccer-JS sprite generation failed');
  const list=$('goals');list.replaceChildren();
  for(const e of match.events){
   const side=e.team===match.home.id?match.home:match.away;
   const row=document.createElement('div'),scorer=side.lineup.find(p=>p.id===e.player);
   const helper=side.lineup.find(p=>p.id===e.assist);
   row.textContent=Math.floor(e.minute+1)+"' · "+scorer.name+' — '+side.name+
     (helper?' (assist '+helper.name+')':'');
   list.append(row);
  }
  $('stats').textContent='Shots '+match.stats[0].shots+'–'+match.stats[1].shots+
   ' · On target '+match.stats[0].shotsOnTarget+'–'+match.stats[1].shotsOnTarget;
  $('play').onclick=()=>{if(minute>=90)minute=0;last=null;playing=true;};
  $('pause').onclick=()=>seek(minute);
  $('restart').onclick=()=>seek(0);
  $('skip').onclick=()=>seek(90);
  $('scrub').oninput=e=>seek(Number(e.target.value));
  $('nextGoal').onclick=()=>{
   const g=match.events.find(e=>e.minute>minute+.01);
   seek(g?g.minute+.01:90);
  };
  $('speed').onchange=e=>{speed=Number(e.target.value)||1;};
  for(const id of ['play','pause','restart','skip','nextGoal','scrub'])$(id).disabled=false;
  seek(0);window.__PFC_VIEWER_READY__=true;requestAnimationFrame(step);
 }catch(e){
  console.error(e);window.__PFC_VIEWER_ERROR__=String(e.stack||e);
  $('status').textContent='VIEWER ERROR';$('notice').textContent=e.message||String(e);
 }
}
document.addEventListener('DOMContentLoaded',boot);
