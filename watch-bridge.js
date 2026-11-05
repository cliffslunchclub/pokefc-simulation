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
    return {id,name:String(p.name||p.species||id),pos:String(p.pos||'MID')};
   })
  });
  const safeTeams=teams.map(clean),events=result.events.filter(e=>e.type==='goal').map(e=>{
   requireValid(Number.isFinite(e.minute)&&e.minute>=0&&e.minute<90,'Invalid official goal time');
   const side=teams.findIndex(t=>String(t.id)===String(e.team));
   requireValid(side!==-1,'Goal team does not match fixture');
   requireValid(safeTeams[side].lineup.some(p=>p.id===String(e.player)),'Goal scorer not on team');
   if(e.assist!=null)requireValid(safeTeams[side].lineup.some(p=>p.id===String(e.assist)),'Invalid assist');
   return {type:'goal',minute:e.minute,team:safeTeams[side].id,player:String(e.player),assist:e.assist==null?null:String(e.assist),source:'quick-sim'};
  }).sort((a,b)=>a.minute-b.minute);
  const box={};
  for(const team of safeTeams)for(const p of team.lineup){
   const b=result.box?.[p.id];
   requireValid(b,'Missing official player box score for '+p.id);
   box[p.id]={};
   for(const k of ['goals','assists','saves','shots','tackleAttempts','tackles','minutes'])
    box[p.id][k]=Number(b[k]||0);
  }
  for(let side=0;side<2;side++){
   const count=events.filter(e=>e.team===safeTeams[side].id).length;
   requireValid(count===result.score[side]&&count===result.stats[side].goals,'Official goal tally mismatch');
   requireValid(safeTeams[side].lineup.reduce((n,p)=>n+box[p.id].shots,0)===result.stats[side].shots,'Player shots mismatch');
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
  for(const e of fixture.events)if(e.minute<=minute){
   const i=e.team===fixture.home.id?0:1;s[i]++;
  }
  return s;
 }
 function open({preview,result,onRecord,onClose,source='PokéFC',viewerUrl='../experiments/phase10-soccerjs/dist/index.html?embedded=1'}){
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
 root.FXI_PHASE10_WATCH={open,snapshot,scoreAt,isActive:()=>!!active};
 if(typeof module!=='undefined'&&module.exports)module.exports={snapshot,scoreAt};
})(typeof window!=='undefined'?window:globalThis);
