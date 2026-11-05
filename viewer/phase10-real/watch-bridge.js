/* Phase 10 experimental Watch -> Quick Sim integration.
 * Private staging only. Real Quick Sim generates the completed authoritative
 * match before Watch begins; Soccer-JS NEVER determines or changes the outcome.
 * Replay/seek/Sim to End are views into that same immutable result.
 */
(function(root){'use strict';
 const TYPE='pfc-phase10';
 let active=null;
 const requireValid=(ok,msg)=>{if(!ok)throw Error('Phase 10 Watch: '+msg)};
 function snapshot(preview,result){
  requireValid(preview?.home?.lineup?.length===11&&preview?.away?.lineup?.length===11,'Two starting XIs required');
  requireValid(result?.origin==='quick-sim','Only an authoritative Quick Sim result is supported');
  requireValid(Array.isArray(result.score)&&result.score.length===2&&Array.isArray(result.stats)&&result.stats.length===2,'Official result is incomplete');
  requireValid(String(result.home)===String(preview.home.id)&&String(result.away)===String(preview.away.id),'Result fixture mismatch');
  const teams=[preview.home,preview.away];
  const ids=new Set();
  const clean=t=>({
   id:String(t.id),name:String(t.name||t.city||t.id),
   lineup:t.lineup.map(p=>{
    const id=String(p.id);
    requireValid(id&&!ids.has(id),'Player IDs must be unique');ids.add(id);
    return {id,name:String(p.name||p.species||id),pos:String(p.pos||'MID'),speciesId:p.speciesId??p.pokemonId??p.dexId??null,jerseyNumber:p.jerseyNumber??p.shirtNumber??null};
   })
  });
  // Export only actual recorded Quick Sim goals and goalkeeper saves.
  // A save is an official on-target shot by the opposing side; do not
  // invent corners, penalties, fouls or any unreported shot timestamp.
  const safeTeams=teams.map(clean),events=(result.events||[])
   .filter(e=>e.type==='goal'||e.type==='save').map(e=>{
    requireValid(Number.isFinite(e.minute)&&e.minute>=0&&e.minute<90,'Invalid official event time');
    const side=teams.findIndex(t=>String(t.id)===String(e.team));
    requireValid(side!==-1,'Official event team does not match fixture');
    requireValid(safeTeams[side].lineup.some(p=>p.id===String(e.player)),'Official event player not on team');
    if(e.type==='goal'){
     if(e.assist!=null)requireValid(safeTeams[side].lineup.some(p=>p.id===String(e.assist)),'Invalid assist');
     return {type:'goal',minute:e.minute,team:safeTeams[side].id,player:String(e.player),
      assist:e.assist==null?null:String(e.assist),source:'quick-sim'};
    }
    if(e.shooter!=null)requireValid(safeTeams[1-side].lineup.some(p=>p.id===String(e.shooter)),'Invalid saved shot shooter');
    return {type:'save',minute:e.minute,team:safeTeams[side].id,player:String(e.player),
     shooter:e.shooter==null?null:String(e.shooter),source:'quick-sim'};
   }).sort((a,b)=>a.minute-b.minute);
  const box={};
  for(const team of safeTeams)for(const p of team.lineup){
   const b=result.box?.[p.id];
   requireValid(b,'Missing official player box score for '+p.id);
   box[p.id]={};
   for(const k of ['goals','assists','saves','shots','tackleAttempts','tackles','minutes'])
    box[p.id][k]=Number(b[k]||0);
   // Older public fixtures omitted individual shots-on-target; preserve
   // unknown rather than silently inventing zeros.
   box[p.id].shotsOnTarget=b.shotsOnTarget==null?null:Number(b.shotsOnTarget);
  }
  for(let side=0;side<2;side++){
   const count=events.filter(e=>e.type==='goal'&&e.team===safeTeams[side].id).length;
   requireValid(count===result.score[side]&&count===result.stats[side].goals,'Official goal tally mismatch');
   requireValid(safeTeams[side].lineup.reduce((n,p)=>n+box[p.id].shots,0)===result.stats[side].shots,'Player shots mismatch');
   const individual=safeTeams[side].lineup.map(p=>box[p.id].shotsOnTarget);
   if(individual.every(n=>n!==null)){
    requireValid(individual.every((n,i)=>Number.isInteger(n)&&n>=0&&n<=box[safeTeams[side].lineup[i].id].shots),'Invalid individual shots on target');
    requireValid(individual.reduce((a,b)=>a+b,0)===result.stats[side].shotsOnTarget,'Player shots-on-target total mismatch');
   }
  }
  return {
   schema:'pokefc-quick-sim-export/v1',origin:'quick-sim',competition:'league',durationMinutes:90,
   source:'Private PokeFC Quick Sim live fixture (result data only)',
   home:safeTeams[0],away:safeTeams[1],score:result.score.slice(),
   stats:result.stats.map(s=>({...s})),events,box
  };
 }
 function scoreAt(fixture,minute){
  const s=[0,0];
  for(const e of fixture.events)if(e.type==='goal'&&e.minute<=minute){
   const i=e.team===fixture.home.id?0:1;s[i]++;
  }
  return s;
 }
 function open({preview,result,onRecord,onClose,source='PokéFC',viewerUrl='../watch/soccerjs/dist/index.html?embedded=1'}){
  if(active)throw Error('Another Phase 10 Watch session is already open');
  requireValid(typeof onRecord==='function','Result callback required');
  const fixture=snapshot(preview,result);
  const expectedFinal=result.score.slice(),origin=root.location.origin;
  let minute=0,closed=false,finished=false,handedOff=false,recorded=false,ready=false;
  const body=document.body;
  const mask=document.createElement('div');
  mask.id='phase10-soccer-watch';
  mask.setAttribute('role','dialog');mask.setAttribute('aria-modal','true');mask.setAttribute('aria-label','Phase 10 Soccer-JS watched match');
  Object.assign(mask.style,{position:'fixed',inset:'0',zIndex:'100000',background:'rgba(6,13,24,.96)',display:'flex',flexDirection:'column',color:'#f4f7fc',fontFamily:'system-ui'});
  const header=document.createElement('div');
  Object.assign(header.style,{display:'flex',alignItems:'center',gap:'12px',flexWrap:'wrap',padding:'10px 15px',background:'#16253e',borderBottom:'1px solid #3c5674'});
  const label=document.createElement('strong');label.style.flex='1';label.textContent='PHASE 10 EXPERIMENT · '+source;
  const status=document.createElement('span');status.setAttribute('role','status');status.textContent='Loading Soccer-JS…';status.style.fontSize='12px';
  const btn=(title,click)=>{
   const b=document.createElement('button');b.type='button';b.textContent=title;
   Object.assign(b.style,{background:'#e3e971',color:'#182638',border:'0',borderRadius:'7px',padding:'10px 13px',fontWeight:'800',cursor:'pointer'});
   b.addEventListener('click',click);return b;
  };
  const frame=document.createElement('iframe');
  frame.title='Soccer-JS watched replay of an official Quick Sim match';
  frame.src=viewerUrl;
  Object.assign(frame.style,{border:'0',width:'100%',flex:'1',background:'#0b172a',minHeight:'200px'});
  const foot=document.createElement('div');
  Object.assign(foot.style,{fontSize:'11px',padding:'5px 12px',background:'#17283c',color:'#c0d6e1'});
  foot.textContent='Quick Sim result is locked before kickoff. Soccer-JS only animates; no tactical changes or independent goals. Closing without recording leaves the game unchanged.';
  const cleanup=()=>{
   if(closed)return;
   closed=true;root.removeEventListener('message',onMessage);root.removeEventListener('keydown',onKey);
   mask.remove();active=null;if(typeof onClose==='function')onClose({recorded});
  };
  const cancel=btn('✕ Close without recording',()=>{if(recorded)return;cleanup()});
  cancel.style.background='#33465b';cancel.style.color='#f5f6fc';
  const record=btn('✓ Record official result',()=>{
   if(recorded||!finished)return;
   requireValid(minute>=90,'Cannot record before full time');
   requireValid(scoreAt(fixture,90).every((x,i)=>x===expectedFinal[i]),'Official score drift');
   recorded=true;record.disabled=true;
   try{onRecord({result,minute:90,origin:'quick-sim',handoff:handedOff?'watch-to-quick-sim':'watched-replay'})}
   finally{cleanup()}
  });
  record.disabled=true;
  const end=btn('⚡ Sim to End',()=>{
   if(!ready||finished)return;
   const from=minute;handedOff=true;finished=true;minute=90;
   frame.contentWindow.postMessage({type:TYPE+'-seek',minute:90},origin);
   record.disabled=false;
   status.textContent='Switched at '+from.toFixed(1)+"′ → official "+expectedFinal.join('–')+' · ready to record';
  });
  end.disabled=true;
  header.append(label,status,end,record,cancel);
  mask.append(header,frame,foot);body.append(mask);
  function onMessage(e){
   if(closed||e.origin!==origin||e.source!==frame.contentWindow||!e.data||typeof e.data!=='object')return;
   if(e.data.type===TYPE+'-ready'){
    if(ready)return;ready=true;end.disabled=false;
    frame.contentWindow.postMessage({type:TYPE+'-fixture',fixture},origin);
    status.textContent='Official match loaded · '+fixture.home.name+' vs '+fixture.away.name;
   }else if(e.data.type===TYPE+'-progress'){
    const n=Number(e.data.minute);
    if(!Number.isFinite(n)||n<0||n>90)return;
    const s=scoreAt(fixture,n);
    if(!Array.isArray(e.data.score)||!s.every((v,i)=>v===e.data.score[i])){status.textContent='Score synchronization error — cannot record';record.disabled=true;end.disabled=true;return;}
    if(handedOff&&n<90)return;
    minute=n;
    if(minute>=90){
     finished=true;record.disabled=false;end.disabled=true;
     status.textContent='Full time '+expectedFinal.join('–')+' · ready to record';
    }else if(!handedOff)status.textContent=n.toFixed(1)+"′ · "+s.join('–')+' · Quick Sim-authoritative';
   }else if(e.data.type===TYPE+'-error'){
    status.textContent='Viewer error: '+String(e.data.message||'unknown');
    end.disabled=true;record.disabled=true;
   }
  }
  function onKey(e){if(e.key==='Escape'&&!recorded)cleanup()}
  root.addEventListener('message',onMessage);root.addEventListener('keydown',onKey);
  active={close:cleanup,fixture};
  return active;
 }

 // Inline 2.5D presentation. Unlike open(), this mounts directly in Quick Play's
 // match viewport; the outer page owns Pause, Resume, Sim to End and Record.
 // No result is committed unless record() is explicitly invoked.
 function mountInline({
  preview,result,container,onRecord,onCancel,onProgress,onReady,onStatus,
  viewerUrl='../watch/soccerjs/dist/index.html?embedded=1&inline=1'
 }){
  requireValid(!active,'Another Watch session is already active');
  requireValid(container&&typeof container.appendChild==='function','A match viewport is required');
  requireValid(typeof onRecord==='function','Record callback required');
  const fixture=snapshot(preview,result);
  const expectedFinal=result.score.slice();
  const url=new URL(viewerUrl,root.location.href);
  const origin=root.location.origin;
  requireValid(url.origin===origin,'Inline viewer must be same-origin');
  let closed=false,ready=false,booted=false,finished=false,handedOff=false,recorded=false,error=null,minute=0,watchdog=null;
  const frame=document.createElement('iframe');
  frame.className='soccerjs-inline-frame';
  frame.title='Broadcast Soccer-JS Pokémon match (Quick Sim-authoritative)';
  frame.setAttribute('aria-label','Soccer-JS 2.5D watched match');
  frame.src=url.href;
  function announce(state,extra={}){
   if(typeof onStatus==='function')onStatus({state,minute,score:scoreAt(fixture,minute),recorded,...extra});
  }
  function cleanup(){
   if(closed)return;
   closed=true;
   if(watchdog!==null)root.clearTimeout(watchdog);
   root.removeEventListener('message',onMessage);
   frame.remove();
   if(active===session)active=null;
  }
  function fail(message){
   if(error||closed)return;
   error=String(message);
   announce('error',{message:error});
  }
  function send(action,details={}){
   if(!booted||closed||error)return false;
   frame.contentWindow?.postMessage({type:TYPE+'-control',action,...details},origin);
   return true;
  }
  function onMessage(e){
   if(closed||e.origin!==origin||e.source!==frame.contentWindow||!e.data||typeof e.data!=='object')return;
   if(e.data.type===TYPE+'-ready'){
    if(ready)return;ready=true;
    frame.contentWindow.postMessage({type:TYPE+'-fixture',fixture},origin);
    announce('loading',{message:'Official Quick Sim fixture accepted; preparing Broadcast Soccer-JS'});
   }else if(e.data.type===TYPE+'-booted'){
    if(booted||!ready||error)return;
    if(e.data.projection!=='orthographic'){
     fail('Expected a Broadcast 2.5D Soccer-JS camera at startup');return;
    }
    booted=true;
    if(watchdog!==null){root.clearTimeout(watchdog);watchdog=null;}
    announce('ready',{projection:'orthographic'});
    if(typeof onReady==='function')onReady(session);
   }else if(e.data.type===TYPE+'-progress'){
    const next=Number(e.data.minute);
    if(error||!ready||!Number.isFinite(next)||next<0||next>90)return;
    const official=scoreAt(fixture,next);
    if(!Array.isArray(e.data.score)||!official.every((n,i)=>n===e.data.score[i])){
     fail('Viewer score differs from authoritative Quick Sim ledger');return;
    }
    if(handedOff&&next<90)return;
    minute=next;finished=next>=90;
    if(typeof onProgress==='function')onProgress({minute,score:official,finished,handedOff,recorded});
    if(finished)announce('full-time');
   }else if(e.data.type===TYPE+'-error'){
    fail('Soccer-JS renderer: '+String(e.data.message||'Unknown rendering error'));
   }
  }
  const session={
   fixture,frame,
   getState:()=>({ready:booted,minute,score:scoreAt(fixture,minute),finished,handedOff,recorded,error,closed}),
   play:(speed=1)=>!finished&&send('play',{speed:Number(speed)||1}),
   pause:()=>send('pause'),
   setSpeed:(speed)=>Number.isFinite(Number(speed))&&Number(speed)>0&&Number(speed)<=16&&send('speed',{speed:Number(speed)}),
   setProjection:(projection)=>['isometric','orthographic','topdown'].includes(projection)&&send('projection',{projection}),
   setCamera:(camera)=>['wide','follow'].includes(camera)&&send('camera',{camera}),
   setNumbers:(visible)=>send('numbers',{visible:!!visible}),
   // Rewind/scrub is visual only. After Watch → Sim, replay cannot resume.
   seek:(target)=>Number.isFinite(Number(target))&&Number(target)>=0&&Number(target)<=90&&!handedOff&&!recorded&&send('seek',{minute:Number(target)}),
   simToEnd:()=>{
    if(!booted||finished||closed||error)return false;
    handedOff=true;announce('simulating-to-end',{fromMinute:minute});
    return send('seek',{minute:90});
   },
   record:()=>{
    if(closed||recorded||!finished||error||minute<90)return false;
    requireValid(scoreAt(fixture,90).every((n,i)=>n===expectedFinal[i]),'Official final score drift');
    recorded=true;
    onRecord({result,minute:90,origin:'quick-sim',handoff:handedOff?'watch-to-quick-sim':'watched-replay'});
    announce('recorded');
    return true;
   },
   cancel:()=>{
    if(closed||recorded)return false;
    cleanup();
    if(typeof onCancel==='function')onCancel();
    return true;
   },
   destroy:()=>{cleanup();}
  };
  active=session;
  root.addEventListener('message',onMessage);
  container.appendChild(frame);
  watchdog=root.setTimeout(()=>{if(!booted)fail('Soccer-JS viewer bundle did not initialize. Build watch/soccerjs/dist locally.');},15000);
  announce('loading',{message:'Loading the 2.5D Soccer-JS field'});
  return session;
 }

 root.FXI_PHASE10_WATCH={open,mountInline,snapshot,scoreAt,isActive:()=>!!active};
 if(typeof module!=='undefined'&&module.exports)module.exports={snapshot,scoreAt,mountInline,isActive:()=>!!active};
})(typeof window!=='undefined'?window:globalThis);
