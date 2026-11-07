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
  const duration=result.durationMinutes===120?120:90;
  requireValid(result.durationMinutes==null||duration===result.durationMinutes,'Invalid match duration');
  requireValid(duration===90||result.knockoutRules==='pse-knockout-v1','Extra time requires PSE knockout provenance');
  if(duration===120){
   requireValid(Array.isArray(result.regulationScore)&&result.regulationScore.length===2,
    'Missing regulation score');
   const regulationGoals=result.events.filter(e=>e.type==='goal'&&e.minute<90);
   requireValid(regulationGoals.filter(e=>String(e.team)===String(preview.home.id)).length===result.regulationScore[0]&&
    regulationGoals.filter(e=>String(e.team)===String(preview.away.id)).length===result.regulationScore[1],
    'Regulation score differs from event history');
  }
  const shootout=result.shootout||null;
  if(shootout){
   requireValid(duration===120&&shootout.version==='pse-shootout-v1','Unsupported shootout');
   requireValid(Array.isArray(shootout.attempts)&&shootout.attempts.length>=6,'Missing official kicks');
   requireValid(shootout.countsInMatchStats===false,'Shootout cannot count as regulation goals');
   const sums={home:0,away:0};
   for(const [index,k] of shootout.attempts.entries()){
    requireValid(k.id==='pse-pk-'+String(index+1).padStart(4,'0')&&
     k.side===(index%2?'away':'home')&&k.round===Math.floor(index/2)+1,
     'Invalid official penalty sequence');
    const own=k.side==='home'?preview.home:preview.away,other=k.side==='home'?preview.away:preview.home;
    requireValid(own.lineup.some(p=>String(p.id)===String(k.kickerId))&&
     other.lineup.some(p=>String(p.id)===String(k.keeperId)), 'Invalid official penalty player');
    requireValid(k.phase==='shootout'&&['goal','saved','off-target'].includes(k.outcome)&&
     k.scored===(k.outcome==='goal'),'Invalid official penalty outcome');
    sums[k.side]+=Number(k.scored);
   }
   requireValid(sums.home===shootout.home&&sums.away===shootout.away&&
    ['home','away'].includes(shootout.winner)&&
    shootout.home!==shootout.away&&
    (shootout.home>shootout.away?'home':'away')===shootout.winner,
    'Shootout final total or winner does not reconcile');
  }
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

  // Strict v1 event pass-through; legacy exports remain goal/save-only.
  const safeTeams=teams.map(clean),v1=result.setPieceRules==='v1';
  requireValid(result.setPieceRules==null||v1,'Unknown PSE set-piece ruleset');
  requireValid(!v1||duration===90,'Set-piece v1 extra time is not enabled');
  const supported=new Set(v1?['goal','save','shot','corner','foul','free-kick','penalty-kick']:['goal','save']);
  const raw=Array.isArray(result.events)?result.events:[];
  if(v1)requireValid(raw.every(e=>supported.has(e?.type)),'Unsupported official PSE event');
  const eventIds=new Set();
  const events=raw.filter(e=>supported.has(e?.type)).map(e=>{
   requireValid(Number.isFinite(e.minute)&&e.minute>=0&&e.minute<duration,'Invalid official event time');
   const side=teams.findIndex(t=>String(t.id)===String(e.team));
   requireValid(side!==-1,'Official event team does not match fixture');
   const actor=safeTeams[side].lineup.find(p=>p.id===String(e.player));
   requireValid(actor,'Official event player not on team');
   if(e.type==='goal'&&e.assist!=null)
    requireValid(safeTeams[side].lineup.some(p=>p.id===String(e.assist)),'Invalid assist');
   if(e.type==='save'&&e.shooter!=null)
    requireValid(safeTeams[1-side].lineup.some(p=>p.id===String(e.shooter)),'Invalid saved shot shooter');
   if(v1){
    requireValid(typeof e.id==='string'&&/^pse-v1-\d{5,}$/.test(e.id)&&!eventIds.has(e.id),
     'Duplicate or missing event ID');
    eventIds.add(e.id);
    requireValid(e.origin==='quick-sim'&&e.ruleset==='set-pieces-v1','Invalid PSE event provenance');
    if(e.type==='shot'||e.type==='penalty-kick')
     requireValid(['goal','saved','off-target'].includes(e.outcome),'Unknown shot outcome');
    return {...e,team:safeTeams[side].id,player:actor.id,source:'quick-sim'};
   }
   if(e.type==='goal')return {type:'goal',minute:e.minute,team:safeTeams[side].id,player:actor.id,
    assist:e.assist==null?null:String(e.assist),source:'quick-sim'};
   return {type:'save',minute:e.minute,team:safeTeams[side].id,player:actor.id,
    shooter:e.shooter==null?null:String(e.shooter),source:'quick-sim'};
  }).sort((a,b)=>a.minute-b.minute);
  if(v1){
   const byId=new Map(events.map(e=>[e.id,e]));
   for(const e of events)if(e.causedBy!=null){
    const parent=byId.get(e.causedBy);
    requireValid(parent,'Missing linked PSE incident '+e.causedBy);
    requireValid(parent.minute<=e.minute,'PSE event cannot precede its cause');
    const expected={corner:'shot','free-kick':'foul','penalty-kick':'foul',
     shot:'penalty-kick',goal:'shot',save:'shot'}[e.type];
    requireValid(!expected||parent.type===expected,'Invalid set-piece cause '+e.type);
   }
  }
  const box={};
  for(const team of safeTeams)for(const p of team.lineup){
   const b=result.box?.[p.id];
   requireValid(b,'Missing official player box score for '+p.id);
   box[p.id]={};
   for(const k of ['goals','assists','saves','shots','tackleAttempts','tackles','minutes'])
    box[p.id][k]=Number(b[k]||0);
   if(v1)for(const k of ['cornersTaken','freeKicksTaken','penaltiesTaken','penaltiesScored'])
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
   if(v1){
    const team=safeTeams[side],stat=result.stats[side],opp=result.stats[1-side];
    requireValid(stat.shotsOnTarget===stat.goals+opp.saves,'PSE shot/save ledger mismatch');
    for(const [type,key] of [['shot','shots'],['corner','corners'],['foul','foulsCommitted'],
      ['free-kick','freeKicks'],['penalty-kick','penaltyKicks']])
     requireValid(events.filter(e=>e.type===type&&e.team===team.id).length===stat[key],
      'Incorrect official '+type+' count');
    for(const [teamKey,playerKey] of [['corners','cornersTaken'],
      ['freeKicks','freeKicksTaken'],['penaltyKicks','penaltiesTaken']])
     requireValid(team.lineup.reduce((n,p)=>n+box[p.id][playerKey],0)===stat[teamKey],
      'PSE player count mismatch '+teamKey);
   }
  }
  return {
   schema:'pokefc-quick-sim-export/v1',origin:'quick-sim',competition:duration===120?'knockout':'league',durationMinutes:duration,
   source:'Private PokeFC Quick Sim live fixture (result data only)',
   // Presentation RNG is deterministic but not part of the official ledger.
   visualSeed:String(preview.seed||'pfc')+':'+safeTeams.map(t=>t.id).join(':')+':'+
    result.events.filter(e=>e.type==='goal').map(e=>String(e.minute)).join(':'),
   home:safeTeams[0],away:safeTeams[1],score:result.score.slice(),
   ...(v1?{setPieceRules:'v1'}:{}),stats:result.stats.map(s=>({...s})),events,box,
   ...(duration===120?{knockoutRules:result.knockoutRules,regulationScore:result.regulationScore.slice()}:{}),
   ...(shootout?{shootout:JSON.parse(JSON.stringify(shootout))}:{})
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
  const expectedFinal=result.score.slice(),origin=root.location.origin,duration=fixture.durationMinutes;
  let minute=0,closed=false,finished=false,handedOff=false,recorded=false,ready=false,kickIndex=0;
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
   requireValid(minute>=duration&&(!fixture.shootout||kickIndex===fixture.shootout.attempts.length),'Cannot record before shootout finishes');
   requireValid(scoreAt(fixture,duration).every((x,i)=>x===expectedFinal[i]),'Official score drift');
   recorded=true;record.disabled=true;
   try{onRecord({result,minute:duration,origin:'quick-sim',handoff:handedOff?'watch-to-quick-sim':'watched-replay'})}
   finally{cleanup()}
  });
  record.disabled=true;
  const end=btn('⚡ Sim to End',()=>{
   if(!ready||finished)return;
   const from=minute;handedOff=true;finished=true;minute=duration;kickIndex=fixture.shootout?.attempts.length||0;
   frame.contentWindow.postMessage({type:TYPE+'-control',action:'finish'},origin);
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
    if(!Number.isFinite(n)||n<0||n>duration)return;
    const s=scoreAt(fixture,n);
    if(!Array.isArray(e.data.score)||!s.every((v,i)=>v===e.data.score[i])){status.textContent='Score synchronization error — cannot record';record.disabled=true;end.disabled=true;return;}
    if(handedOff&&n<duration)return;
    minute=n;
    const expectedKicks=fixture.shootout?.attempts.length||0;
    const reportedKicks=Number(e.data.kickIndex||0);
    if(!Number.isInteger(reportedKicks)||reportedKicks<0||reportedKicks>expectedKicks)return;
    kickIndex=reportedKicks;
    if(minute>=duration&&(!fixture.shootout||kickIndex===expectedKicks)){
     finished=true;record.disabled=false;end.disabled=true;
     status.textContent='Full time '+expectedFinal.join('–')+' · ready to record';
    }else if(!handedOff)status.textContent=(duration===120&&n>=90?'EXTRA TIME · ':'')+n.toFixed(1)+"′ · "+s.join('–')+' · Quick Sim-authoritative';
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

 // Inline 2.5D presentation. Unlike open(), this mounts in the match viewport.
 // The caller may opt into recording the immutable PSE result automatically
 // after a verified Watch → Sim to End handoff. Normal full-time still offers
 // manual Record, and Cancel before full-time remains non-mutating.
 // Fullscreen belongs to the outer match viewport, not its iframe.
 // Mobile browsers lacking element fullscreen use a viewport-sized theater.
 let expandedPitch=null,fullscreenListenersBound=false;
 const fullscreenActive=el=>!!el&&(expandedPitch===el||document.fullscreenElement===el);
 function syncFullscreenButton(el,expanded){
  const button=el?.querySelector?.('[data-pfc-fullscreen]');
  if(button){
   button.textContent=expanded?'✕ EXIT FULLSCREEN':'⛶ FULLSCREEN';
   button.setAttribute('aria-pressed',expanded?'true':'false');
  }
  // Outer viewport controls fullscreen; the iframe gets its own synced bar.
  const frame=el?.querySelector?.('iframe.soccerjs-inline-frame');
  frame?.contentWindow?.postMessage?.({type:TYPE+'-control',
   action:'fullscreen',active:!!expanded},root.location.origin);
 }
 function clearFullscreen(el=expandedPitch){
  if(!el)return;
  el.classList?.remove('pfc-watch-theater');
  document.body?.classList?.remove('pfc-watch-no-scroll');
  syncFullscreenButton(el,false);
  if(expandedPitch===el)expandedPitch=null;
 }
 async function leaveFullscreen(el=expandedPitch){
  if(!el)return false;
  if(document.fullscreenElement===el&&typeof document.exitFullscreen==='function'){
   try{await document.exitFullscreen()}catch(_){}
  }
  clearFullscreen(el);return true;
 }
 async function toggleFullscreen(el){
  requireValid(el?.classList&&el?.querySelector,'Match viewport required for fullscreen');
  if(fullscreenActive(el)){
   await leaveFullscreen(el);return false;
  }
  if(expandedPitch)await leaveFullscreen(expandedPitch);
  if(!fullscreenListenersBound){
   fullscreenListenersBound=true;
   document.addEventListener('fullscreenchange',()=>{
    if(expandedPitch&&!document.fullscreenElement)clearFullscreen(expandedPitch);
   });
   document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&expandedPitch&&!document.fullscreenElement)clearFullscreen(expandedPitch);
   });
  }
  expandedPitch=el;el.classList.add('pfc-watch-theater');
  document.body?.classList?.add('pfc-watch-no-scroll');
  syncFullscreenButton(el,true);
  // Rejected/fullscreen-unsupported requests leave theater mode available.
  if(typeof el.requestFullscreen==='function'){
   try{await el.requestFullscreen({navigationUI:'hide'})}catch(_){}
  }
  return true;
 }
 function mountInline({
  preview,result,container,onRecord,onCancel,onProgress,onReady,onStatus,
  autoRecordOnSimToEnd=false,
  viewerUrl='../watch/soccerjs/dist/index.html?embedded=1&inline=1&v=16'
 }){
  requireValid(!active,'Another Watch session is already active');
  requireValid(container&&typeof container.appendChild==='function','A match viewport is required');
  requireValid(typeof onRecord==='function','Record callback required');
  const fixture=snapshot(preview,result);
  const expectedFinal=result.score.slice(),duration=fixture.durationMinutes;
  const url=new URL(viewerUrl,root.location.href);
  const origin=root.location.origin;
  requireValid(url.origin===origin,'Inline viewer must be same-origin');
  let closed=false,ready=false,booted=false,finished=false,handedOff=false,recorded=false,error=null,minute=0,watchdog=null,kickIndex=0;
  const frame=document.createElement('iframe');
  frame.className='soccerjs-inline-frame';
  frame.title='Broadcast Soccer-JS Pokémon match (Quick Sim-authoritative)';
  frame.setAttribute('aria-label','Soccer-JS 2.5D watched match');
  frame.setAttribute('allowfullscreen','');
  frame.setAttribute('allow','fullscreen');
  frame.src=url.href;
  function announce(state,extra={}){
   if(typeof onStatus==='function')onStatus({state,minute,score:scoreAt(fixture,minute),recorded,...extra});
  }
  function cleanup(){
   if(closed)return;
   closed=true;
   if(watchdog!==null)root.clearTimeout(watchdog);
   root.removeEventListener('message',onMessage);
   if(fullscreenActive(container))void leaveFullscreen(container);
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
    if(error||!ready||!Number.isFinite(next)||next<0||next>duration)return;
    const official=scoreAt(fixture,next);
    if(!Array.isArray(e.data.score)||!official.every((n,i)=>n===e.data.score[i])){
     fail('Viewer score differs from authoritative Quick Sim ledger');return;
    }
    if(handedOff&&next<duration)return;
    const expectedKicks=fixture.shootout?.attempts.length||0;
    const reportedKicks=Number(e.data.kickIndex||0);
    if(!Number.isInteger(reportedKicks)||reportedKicks<0||reportedKicks>expectedKicks){
     fail('Invalid shootout position');return;
    }
    if(handedOff&&expectedKicks&&reportedKicks<expectedKicks)return;
    minute=next;kickIndex=reportedKicks;
    finished=next>=duration&&(!fixture.shootout||kickIndex===expectedKicks);
    if(typeof onProgress==='function')onProgress({
     minute,score:official,finished,handedOff,recorded,
     durationMinutes:duration,kickIndex,shootout:fixture.shootout||null,
     pausedForGoal:e.data.pausedForGoal===true,
     watchPlaying:typeof e.data.watchPlaying==='boolean'?e.data.watchPlaying:null,
     watchSpeed:[1,2,4,8,16].includes(Number(e.data.watchSpeed))?Number(e.data.watchSpeed):null
    });
    if(finished){
     announce('full-time');
     // Never record merely because a viewer reaches full time. Only a
     // caller-enabled Sim to End handoff finalizes automatically, after the
     // official score and any extra-time/shootout gates have been verified.
     if(handedOff&&autoRecordOnSimToEnd&&!recorded)session.record();
    }
   }else if(e.data.type===TYPE+'-error'){
    fail('Soccer-JS renderer: '+String(e.data.message||'Unknown rendering error'));
   }
  }
  const session={
   fixture,frame,
   getState:()=>({ready:booted,minute,durationMinutes:duration,kickIndex,score:scoreAt(fixture,minute),finished,handedOff,recorded,error,closed}),
   play:(speed=1)=>!finished&&send('play',{speed:Number(speed)||1}),
   pause:()=>send('pause'),
   setSpeed:(speed)=>Number.isFinite(Number(speed))&&Number(speed)>0&&Number(speed)<=16&&send('speed',{speed:Number(speed)}),
   setProjection:(projection)=>['isometric','orthographic','topdown'].includes(projection)&&send('projection',{projection}),
   setCamera:(camera)=>['wide','follow'].includes(camera)&&send('camera',{camera}),
   setNumbers:(visible)=>send('numbers',{visible:!!visible}),
   // Highlight controls are presentation-only; no Sim-to-Watch handoff.
   openHighlights:()=>!closed&&(!handedOff||finished)&&send('highlights'),
   replayHighlight:(id)=>!closed&&(!handedOff||finished)&&
    typeof id==='string'&&/^(goal|pk)-\d+$/.test(id)&&send('replay',{id}),
   // Rewind/scrub is visual only. After Watch → Sim, replay cannot resume.
   seek:(target)=>Number.isFinite(Number(target))&&Number(target)>=0&&Number(target)<=duration&&!handedOff&&!recorded&&send('seek',{minute:Number(target)}),
   simToEnd:()=>{
    if(!booted||finished||closed||error)return false;
    handedOff=true;announce('simulating-to-end',{fromMinute:minute});
    return duration===90?send('seek',{minute:duration}):send('finish');
   },
   nextKick:()=>!handedOff&&minute>=duration&&!!fixture.shootout&&kickIndex<fixture.shootout.attempts.length&&send('next-kick'),
   record:()=>{
    if(closed||recorded||!finished||error||minute<duration||(fixture.shootout&&kickIndex!==fixture.shootout.attempts.length))return false;
    requireValid(scoreAt(fixture,duration).every((n,i)=>n===expectedFinal[i]),'Official final score drift');
    recorded=true;
    onRecord({result,minute:duration,origin:'quick-sim',handoff:handedOff?'watch-to-quick-sim':'watched-replay'});
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

 root.FXI_PHASE10_WATCH={open,mountInline,snapshot,scoreAt,toggleFullscreen,leaveFullscreen,fullscreenActive,isActive:()=>!!active};
 if(typeof module!=='undefined'&&module.exports)module.exports={snapshot,scoreAt,mountInline,isActive:()=>!!active};
})(typeof window!=='undefined'?window:globalThis);
