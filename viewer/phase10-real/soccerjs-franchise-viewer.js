/* PokéFC Franchise: Soccer-JS 2.5D Watch adapter.
 * Locked official Quick Sim fixture drives the viewer. No state mutation
 * until explicit Record; Franchise simWeek owns all XP, results and saves.
 */
(function(root){'use strict';
 let current=null;
 const $=id=>document.getElementById(id);
 const escape=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
 const clock=m=>String(Math.floor(m)).padStart(2,'0')+':'+String(Math.floor((m-Math.floor(m))*60)).padStart(2,'0');
 function details(m){
  const official=m.data.result;
  const player=new Map([...m.data.home.lineup,...m.data.away.lineup].map(p=>[String(p.id),String(p.species||p.name||p.id)]));
  const team=new Map([[String(m.data.home.id),m.data.home.name],[String(m.data.away.id),m.data.away.name]]);
  const events=(official.events||[]).filter(e=>Number.isFinite(e.minute)&&e.minute<=m.minute).slice(-65);
  $('viewerEvents').innerHTML='<p>Kick-off · 0′</p>'+events.map(e=>{
    let description=String(e.type||'event').toUpperCase()+' · '+(team.get(String(e.team))||'Match');
    if(e.player)description+=' · '+(player.get(String(e.player))||'Pokémon');
    if(e.assist)description+=' (assist: '+(player.get(String(e.assist))||'Pokémon')+')';
    return '<p><strong>'+escape(Math.floor(e.minute))+'′ '+escape(description)+'</strong></p>';
  }).join('')+(m.minute>=90?'<p><strong>90′ Full-time</strong></p>':'');
 }
 function stats(m){
  const a=m.data.result.stats||[];
  const fields=[['Goals','goals'],['Shots','shots'],['Shots on target','shotsOnTarget'],['Passes','passes'],['Possession','possession'],['Tackles','tackles'],['Saves','saves']];
  $('viewerStats').innerHTML='<p class="tiny muted">Official full-time Quick Sim statistics</p>'+
   fields.map(([label,key])=>'<div class="viewer-stat"><span>'+escape(a[0]?.[key]??'—')+'</span><small>'+escape(label)+'</small><span>'+escape(a[1]?.[key]??'—')+'</span></div>').join('');
 }
 function update(m,score){
  if(current!==m)return;
  $('liveScore').textContent=score.join(' – ');$('liveClock').textContent=clock(m.minute);
  const seek=$('viewerSeek');seek.value=m.minute;seek.disabled=m.handedOff||m.recorded||m.failed;
  $('viewerPlay').textContent=m.playing?'Ⅱ Pause':'▶ Play';
  $('viewerPlay').disabled=!m.ready||m.finished||m.handedOff||m.failed;
  $('viewerComplete').textContent=m.finished?'FULL TIME':m.handedOff?'Finishing with Quick Sim…':'⚡ SIM TO END';
  $('viewerComplete').disabled=!m.ready||m.finished||m.handedOff||m.failed;
  $('viewerReset').disabled=!m.ready||m.handedOff||m.recorded||m.failed;
  $('viewerSoccerRecord').disabled=!m.finished||m.recorded||m.failed;
  $('viewerSoccerCancel').disabled=m.recorded;
  // Mode switching while a watched match is running would abandon its
  // recorded prefix and misleadingly look like Sim → Watch. Cancel first.
  $('viewerMode').disabled=!!m.ready&&!m.finished&&!m.failed;
  details(m);stats(m);
 }
 function unmount(){
  const m=current;if(!m)return;
  current=null;
  m.session?.destroy();
  m.canvas.hidden=false;
  m.pitch.classList.remove('soccerjs-franchise-active');
  if($('viewerSoccerRecord')){$('viewerSoccerRecord').hidden=true;$('viewerSoccerRecord').disabled=true}
  if($('viewerSoccerCancel'))$('viewerSoccerCancel').hidden=true;
  if($('viewerMode'))$('viewerMode').disabled=false;
 }
 function mount(data,finish){
  unmount();
  const bridge=root.FXI_PHASE10_WATCH,canvas=$('tacticalPitch');
  const pitch=canvas?.parentElement,note=$('engineInstallStatus');
  if(!bridge?.mountInline||!pitch){if(note)note.textContent='Soccer-JS 2.5D unavailable. Select Legacy TacticMesh or Quick Sim schematic.';return false}
  const m={data,finish,canvas,pitch,session:null,ready:false,failed:false,minute:0,finished:false,handedOff:false,recorded:false,playing:false};
  current=m;canvas.hidden=true;pitch.classList.add('soccerjs-franchise-active');
  $('viewerSoccerRecord').hidden=false;$('viewerSoccerRecord').disabled=true;
  $('viewerSoccerCancel').hidden=false;$('viewerSoccerCancel').disabled=false;
  $('viewerTMFull').hidden=true;
  $('viewerProjection').value='isometric';$('viewerCamera').value='wide';
  $('viewerComplete').textContent='⚡ SIM TO END';
  $('viewerComplete').disabled=true;$('viewerPlay').disabled=true;$('viewerReset').disabled=true;
  const lookup=()=>current===m;
  $('viewerPlay').onclick=()=>{
   if(!lookup()||!m.ready||m.finished||m.handedOff)return;
   m.playing=!m.playing;
   if(m.playing)m.session.play(Number($('viewerSpeed').value)||4);else m.session.pause();
   update(m,bridge.scoreAt(m.session.fixture,m.minute));
  };
  $('viewerComplete').onclick=()=>{
   if(!lookup()||!m.ready||m.handedOff||m.finished)return;
   if(m.session.simToEnd()){
    m.handedOff=true;m.playing=false;
    if(note)note.textContent='Watch → Sim to End: replaying the same locked official result.';
    update(m,bridge.scoreAt(m.session.fixture,m.minute));
   }
  };
  $('viewerSoccerRecord').onclick=()=>{
   if(!lookup()||!m.finished||m.recorded)return;
   try{m.session.record()}catch(error){if(note)note.textContent='Recording error: '+error.message}
  };
  $('viewerSoccerCancel').onclick=()=>{if(lookup()&&!m.recorded)m.session.cancel()};
  $('viewerReset').onclick=()=>{if(!lookup()||m.handedOff||m.recorded)return;m.session.seek(0);m.session.pause();m.playing=false};
  $('viewerSeek').oninput=e=>{if(lookup()&&!m.handedOff&&!m.recorded)m.session.seek(Number(e.target.value))};
  $('viewerSpeed').onchange=e=>{if(lookup()&&m.ready)m.session.setSpeed(Number(e.target.value)||4)};
  $('viewerProjection').onchange=e=>{if(lookup()&&m.ready)m.session.setProjection(e.target.value)};
  $('viewerCamera').onchange=e=>{if(lookup()&&m.ready)m.session.setCamera(e.target.value)};
  if(note)note.textContent='Loading native Soccer-JS 2.5D Pokémon match…';
  try{
   m.session=bridge.mountInline({
    preview:{home:data.home,away:data.away},result:data.result,container:pitch,
    onReady:session=>{
     if(!lookup())return;
     m.ready=true;session.setProjection('isometric');session.setCamera('wide');
     if(note)note.textContent='2.5D ready. Score, goals and statistics are locked by Quick Sim; Play to watch.';
     update(m,[0,0]);
    },
    onProgress:({minute,score,finished})=>{
     if(!lookup())return;
     m.minute=minute;m.finished=finished;
     if(finished){m.playing=false;if(note)note.textContent='Full time. Record official result to advance this matchweek.'}
     update(m,score);
    },
    onRecord:({result})=>{
     if(!lookup()||m.recorded)return;
     m.recorded=true;
     // Franchise accepts this exact precomputed result. No simulation occurs twice.
     m.finish({...m.data,result});
    },
    onCancel:()=>{
     if(!lookup())return;
     unmount();
     $('viewerSoccerRecord').hidden=true;$('viewerSoccerCancel').hidden=true;
     $('viewerMode').disabled=false;
     if(note)note.textContent='Watch canceled — no results, XP or standings saved. Change mode or reselect 2.5D to retry.';
    },
    onStatus:({state,message})=>{
     if(!lookup())return;
     if(state==='error'){
      m.failed=true;m.playing=false;
      if(note)note.textContent=message||'Soccer-JS Watch failed; cancel to use an alternate viewer.';
      update(m,[0,0]);
     }
    }
   });
   update(m,[0,0]);
   return m;
  }catch(error){
   unmount();
   $('viewerSoccerRecord').hidden=true;$('viewerSoccerCancel').hidden=true;
   $('viewerMode').disabled=false;
   if(note)note.textContent='Could not start 2.5D Watch: '+error.message;
   return false;
  }
 }
 root.FXI_SOCCERJS_FRANCHISE={mount,unmount,isActive:()=>!!current};
 if(typeof module!=='undefined'&&module.exports)module.exports={mount,unmount};
})(typeof window!=='undefined'?window:globalThis);
