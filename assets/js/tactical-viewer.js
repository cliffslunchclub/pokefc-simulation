/* PokéFC lightweight schematic for the precomputed, authoritative PSE result.
   Soccer-JS is the only animated Watch engine. The schematic is optional. */
(()=>{'use strict';
let active=null,raf=0,previous=0;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function hash(s){let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0}
const pitch={x:61,y:40,w:928,h:595};
const point=(x,y)=>[pitch.x+pitch.w*x/105,pitch.y+pitch.h*y/68];
function field(ctx){
 ctx.fillStyle='#062c26';ctx.fillRect(0,0,1050,680);
 const [x,y]=point(0,0);ctx.fillStyle='#116448';ctx.fillRect(x,y,pitch.w,pitch.h);
 ctx.fillStyle='rgba(255,255,255,.034)';for(let i=0;i<10;i++)if(i%2)ctx.fillRect(x+i*pitch.w/10,y,pitch.w/10,pitch.h);
 ctx.strokeStyle='rgba(233,255,242,.8)';ctx.lineWidth=2.2;ctx.strokeRect(x,y,pitch.w,pitch.h);
 let [mx,my]=point(52.5,34);ctx.beginPath();ctx.moveTo(mx,pitch.y);ctx.lineTo(mx,pitch.y+pitch.h);ctx.stroke();ctx.beginPath();ctx.arc(mx,my,76,0,7);ctx.stroke();
 for(const side of [0,105]){const dir=side===0?1:-1;let [px,py]=point(side,34);const [r1,r2]=point(side+dir*16.5,13.84);ctx.strokeRect(Math.min(px,r1),r2,Math.abs(r1-px),pitch.h*(40.32/68));const [s1,s2]=point(side+dir*5.5,24.84);ctx.strokeRect(Math.min(px,s1),s2,Math.abs(s1-px),pitch.h*(18.32/68));let [six]=point(side+dir*11,34);ctx.beginPath();ctx.arc(six,py,3,0,7);ctx.fillStyle='#effcf6';ctx.fill()}
 ctx.fillStyle='#a6d0c2';ctx.fillRect(pitch.x-8,pitch.y+pitch.h*.45,8,pitch.h*.10);ctx.fillRect(pitch.x+pitch.w,pitch.y+pitch.h*.45,8,pitch.h*.10);
 ctx.font='600 15px system-ui';ctx.fillStyle='rgba(231,255,240,.65)';ctx.textAlign='center';ctx.fillText('PokéFC · QUICK SIM SCHEMATIC',525,25);
}
function formation(team,side,t){let counts={GK:0,DEF:0,MID:0,FWD:0};
 const rows={GK:[5,34],DEF:[25,[12,27,41,56]],MID:[45,[17,34,51]],FWD:[70,[16,34,52]]};
 return team.lineup.map((p,i)=>{let n=counts[p.pos]++;let [ax,ys]=rows[p.pos]||rows.MID;let ay=typeof ys==='number'?ys:(ys[n]??34);
 if(side===1)ax=105-ax;let h=hash(p.id+':'+side),phase=h%628/100;
 return {p,i,x:clamp(ax+(t?Math.sin(t*.17+phase)*2.5:0),2.2,102.8),y:clamp(ay+(t?Math.sin(t*.13+phase*1.7)*2.7:0),3,65)};});}
function marker(ctx,item,side){const [x,y]=point(item.x,item.y),r=14;ctx.beginPath();ctx.arc(x,y,r+2,0,7);ctx.fillStyle='#102523';ctx.fill();ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fillStyle=side?'#83d8f7':'#eed07c';ctx.fill();ctx.strokeStyle='#14352e';ctx.lineWidth=1;ctx.stroke();ctx.fillStyle='#112722';ctx.textAlign='center';ctx.font='800 12px system-ui';ctx.fillText(String(item.i+1),x,y+4);ctx.font='600 10px system-ui';ctx.fillStyle='#f7fff9';ctx.lineWidth=3;ctx.strokeStyle='#003326';ctx.strokeText(item.p.species.slice(0,11),x,y-20);ctx.fillText(item.p.species.slice(0,11),x,y-20)}
function ballQuick(m){const g=m.result.events.filter(e=>e.type==='goal').sort((a,b)=>a.minute-b.minute),near=g.find(e=>Math.abs(e.minute-m.minute)<2.4);
 const control=near?(String(near.team)===String(m.home.id)?0:1):Math.floor(m.minute/7)%2;
 let x=control===0?52+18*Math.sin(m.minute*.27):53-18*Math.sin(m.minute*.27),y=34+15*Math.sin(m.minute*.42);
 if(near){const d=clamp((m.minute-near.minute+2.4)/4.8,0,1);x=control===0?74+d*30:31-d*30;y=34+Math.sin(m.minute*.7)*12}return {x:clamp(x,2,103),y:clamp(y,3,65)};
}
function statRows(m){const a=m.result.stats[0],b=m.result.stats[1];const f=(v,s='')=>v==null?'—':v+s;return [['Possession',f(a.possession,'%'),f(b.possession,'%')],['Shots',f(a.shots),f(b.shots)],['Shots on target',f(a.shotsOnTarget),f(b.shotsOnTarget)],['Passes',f(a.passes),f(b.passes)],['Completed passes',f(a.completedPasses),f(b.completedPasses)],['Tackle attempts',f(a.tackleAttempts),f(b.tackleAttempts)],['Tackles won',f(a.tackles),f(b.tackles)],['Goals',f(a.goals),f(b.goals)]].map(([label,h,w])=>`<div class="viewer-stat"><span>${h}</span><small>${label}</small><span>${w}</span></div>`).join('')}

function paint(m){
 const ctx=m.ctx;ctx.clearRect(0,0,1050,680);field(ctx);
 const home=formation(m.home,0,m.minute),away=formation(m.away,1,m.minute),ball=ballQuick(m);
 for(const p of home)marker(ctx,p,0);
 for(const p of away)marker(ctx,p,1);
 const [x,y]=point(ball.x,ball.y);
 ctx.beginPath();ctx.arc(x,y,8.7,0,7);ctx.fillStyle='#fff';ctx.fill();
 ctx.strokeStyle='#1b3931';ctx.lineWidth=2;ctx.stroke();
 ctx.beginPath();ctx.arc(x,y,2.5,0,7);ctx.fillStyle='#1e2c2c';ctx.fill();
}
function eventMarkup(m){
 const events=(m.result.events||[]).filter(e=>e.minute<=m.minute);
 const lines=events.map(e=>{
  const minute=e.minuteLabel||Math.floor(e.minute),label=String(e.type||'event').toUpperCase();
  let detail='';
  if(e.type==='goal'){
   detail=' · '+esc(String(e.team)===String(m.home.id)?m.home.city:m.away.city)+' · '+esc(m.lookup[e.player]?.species||'Pokémon');
   if(e.assist)detail+=' (assist: '+esc(m.lookup[e.assist]?.species||'Pokémon')+')';
  }else if(e.player)detail=' · '+esc(m.lookup[e.player]?.species||'Pokémon');
  return '<p><strong>'+esc(minute)+'′ '+esc(label)+'</strong>'+detail+'</p>';
 });
 if(m.minute>=45)lines.push('<p>45′ Half-time</p>');
 if(m.minute>=m.duration)lines.push('<p><strong>'+m.duration+'′ Full-time</strong></p>');
 return '<p>Kick-off · 0′</p>'+lines.slice(-65).join('');
}
function update(m){
 if(m!==active)return;
 const e=m.el,minute=m.minute;
 const goals=(m.result.events||[]).filter(ev=>ev.type==='goal'&&ev.minute<=minute);
 const score={home:goals.filter(x=>String(x.team)===String(m.home.id)).length,
 away:goals.filter(x=>String(x.team)===String(m.away.id)).length};
 e('liveScore').textContent=score.home+' – '+score.away;
 const mm=Math.floor(minute),ss=Math.floor((minute-mm)*60);
 e('liveClock').textContent=String(mm).padStart(2,'0')+':'+String(ss).padStart(2,'0');
 e('viewerSeek').value=minute;
 e('viewerEvents').innerHTML=eventMarkup(m);
 e('viewerStats').innerHTML=statRows(m);
 e('viewerPlay').textContent=m.running?'Ⅱ Pause':'▶ Play';
 e('viewerComplete').textContent=minute<m.duration?'⚡ SIM TO END · FINISH WEEK':'✓ RECORD RESULT & FINISH WEEK';
 paint(m);
}
function frame(ms){
 raf=0;if(!active||!active.running)return;
 const dt=Math.min(.2,(ms-previous)/1000||0);previous=ms;
 active.minute=clamp(active.minute+dt*active.speed/60,0,active.duration);
 if(active.minute>=active.duration)active.running=false;
 update(active);if(active.running)raf=requestAnimationFrame(frame);
}
function stop(){
 if(raf)cancelAnimationFrame(raf);
 raf=0;previous=0;if(active)active.running=false;active=null;
}
function mountQuick(data,finish){
 stop();
 const canvas=document.getElementById('tacticalPitch');if(!canvas)return null;
 const ctx=canvas.getContext('2d');if(!ctx)return null;
 const lookup={};
 [...data.home.lineup,...data.away.lineup].forEach(p=>lookup[p.id]=p);
 const duration=data.result?.durationMinutes===120?120:90;
 const m=active={...data,ctx,canvas,lookup,duration,minute:0,speed:4,running:false,
 el:id=>document.getElementById(id)};
 const e=m.el,seek=e('viewerSeek');
 seek.disabled=false;seek.max=String(duration);seek.title='Seek the precomputed Quick Sim schematic';
 e('viewerPlay').onclick=()=>{
  if(m!==active)return;
  if(m.minute>=m.duration)m.minute=0;
  m.running=!m.running;
  if(m.running){previous=performance.now();if(!raf)raf=requestAnimationFrame(frame)}
  else if(raf){cancelAnimationFrame(raf);raf=0}
  update(m);
 };
 e('viewerReset').onclick=()=>{
  if(m!==active)return;
  m.minute=0;m.running=false;if(raf){cancelAnimationFrame(raf);raf=0}update(m);
 };
 e('viewerSpeed').value='4';
 e('viewerSpeed').onchange=ev=>{m.speed=Number(ev.target.value)||4};
 seek.oninput=ev=>{
  if(m!==active)return;
  m.minute=clamp(Number(ev.target.value),0,m.duration);
  if(m.minute>=m.duration)m.running=false;update(m);
 };
 e('viewerComplete').onclick=()=>{
  if(m!==active)return;
  stop();finish(data);
 };
 const el=document.getElementById('engineInstallStatus');
 if(el)el.textContent='Quick Sim schematic: precomputed official result; movements are illustrative.';
 update(m);return m;
}
window.FXI_VIEWER={mount:mountQuick,mountQuick,unmount:stop};
})();
