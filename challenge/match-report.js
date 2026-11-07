/* PokéFC match-report adapter.
 * Converts actual match engine goal events to a compact, saved Challenge ledger.
 * Does not generate imaginary scorers/minutes for matches missing their event log. */
(function(root){'use strict';
 const num=v=>v===null||v===undefined||v===''?null:Number.isFinite(Number(v))?Number(v):null;
 const safe=v=>v==null?'':String(v);
 const scalar=(n)=>n==null?null:Math.round(n*10)/10;
 const inRange=(n)=>n!=null&&n>=0&&n<=150;
 const validLabel=s=>/^\d{1,3}(?:\+\d{1,2})?$/.test(s);
 const TYPES=new Set(['goal','save','shot','corner','foul','free-kick','penalty-kick','card','substitution','half-time','second-half','full-time']);
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function timelineFromEvents(events,fixture,defaultOrigin='quick-sim'){
  const teams=[fixture?.home||{},fixture?.away||{}];
  const names=teams.map(t=>new Map((t.lineup||[]).map(p=>[safe(p.id),safe(p.name)||'Unknown Pokémon'])));
  const resolve=(side,id)=>id==null?null:names[side]?.get(safe(id))||null;
  const all=[];
  for(const [index,e] of (Array.isArray(events)?events:[]).entries()){
   if(!TYPES.has(e?.type))continue;
   const period=['half-time','second-half','full-time'].includes(e.type);
   const side=safe(e.team)===safe(teams[0].id)?0:safe(e.team)===safe(teams[1].id)?1:null;
   if(!period&&side==null)continue;
   const minute=num(e.minute);
   let minuteLabel=safe(e.minuteLabel).replace(/'$/,'').trim();
   if(!validLabel(minuteLabel))minuteLabel=inRange(minute)?String(Math.floor(minute)+(period?0:1)):'?';
   const rawCard=typeof e.card==='string'?e.card:typeof e.card?.type==='string'?e.card.type:'';
   const card=/red/i.test(rawCard)?'red':/yellow/i.test(rawCard)?'yellow':null;
   all.push({type:e.type,side,minute:inRange(minute)?scalar(minute):null,minuteLabel,
    player:side==null?null:resolve(side,e.player),
    assist:side==null?null:resolve(side,e.assist),
    shooter:side==null?null:resolve(1-side,e.shooter),
    playerOff:side==null?null:resolve(side,e.playerOff),
    playerOn:side==null?null:resolve(side,e.playerOn),
    card,id:safe(e.id)||null,causedBy:safe(e.causedBy)||null,
    outcome:['goal','saved','off-target'].includes(e.outcome)?e.outcome:null,
    origin:safe(e.origin||defaultOrigin),index});
  }
  return all.sort((a,b)=>(a.minute??999)-(b.minute??999)||a.index-b.index).map(({index,...entry})=>entry);
 }
 function renderTimeline(entries,opts={}){
  const list=Array.isArray(entries)?entries.filter(x=>TYPES.has(x?.type)):[];
  if(!list.length)return '<p class="match-event-empty">'+escape(opts.empty||'No individual match events were recorded.')+'</p>';
  const labels={goal:'GOAL',save:'SHOT ON TARGET · SAVED',shot:'SHOT',corner:'CORNER',foul:'FOUL','free-kick':'FREE KICK','penalty-kick':'PENALTY KICK',card:'CARD',substitution:'SUBSTITUTION','half-time':'HALF-TIME','second-half':'SECOND HALF','full-time':'FULL-TIME'};
  const symbols={goal:'⚽',save:'🧤',shot:'◉',corner:'⚑',foul:'⚑','free-kick':'⚽','penalty-kick':'◎',card:'▣',substitution:'⇄','half-time':'◷','second-half':'▶','full-time':'■'};
  return '<ol class="pfc-event-timeline">'+list.map(e=>{
   const type=e.type,side=e.side===0?'home':e.side===1?'away':'neutral';
   const name=e.player||'Pokémon unavailable';
   const heading=type==='card'?(e.card?e.card.toUpperCase()+' CARD':'CARD'):labels[type];
   const detail=type==='goal'?name+(e.assist?' · Assist: '+e.assist:''):
    type==='save'?name+(e.shooter?' · Against '+e.shooter:''):
    ['foul','shot','corner','free-kick','penalty-kick'].includes(type)?
     name+(e.outcome?' · '+e.outcome.replace(/-/g,' '):''):type==='card'?name:
    type==='substitution'?(e.playerOff||'Player off unavailable')+' → '+(e.playerOn||'Player on unavailable'):'';
   return '<li class="pfc-event-entry '+side+' '+type+'"><span class="pfc-event-minute">'+escape(String(e.minuteLabel||'?'))+'′</span>'+
    '<span class="pfc-event-icon" aria-hidden="true">'+symbols[type]+'</span>'+
    '<span class="pfc-event-content"><strong>'+escape(heading)+'</strong>'+
     (detail?'<span>'+escape(detail)+'</span>':'')+
     '<small>'+(side==='home'?'YOUR XI':side==='away'?'OPPONENT':'MATCH')+'</small></span></li>';
  }).join('')+'</ol>';
 }
 function renderGroupedTimeline(entries,opts={}){
  const list=Array.isArray(entries)?entries.filter(e=>TYPES.has(e?.type)):[];
  const goals=list.filter(e=>e.type==='goal');
  const other=list.filter(e=>e.type!=='goal');
  const goalOpen=opts.goalsOpen!==false,otherOpen=opts.otherOpen===true;
  const goalEmpty=opts.goalsEmpty||'No goals recorded yet.';
  const otherEmpty=opts.otherEmpty||'No saves or other match incidents recorded.';
  return '<div class="pfc-timeline-groups">'+
   '<details class="pfc-timeline-group pfc-timeline-goals" data-timeline-group="goals"'+(goalOpen?' open':'')+'>'+
   '<summary><span>⚽ GOALS</span><strong>'+goals.length+' RECORDED</strong></summary>'+
   '<div class="pfc-timeline-group-body">'+renderTimeline(goals,{empty:goalEmpty})+'</div></details>'+
   '<details class="pfc-timeline-group pfc-timeline-other" data-timeline-group="other"'+(otherOpen?' open':'')+'>'+
   '<summary><span>🧤 SAVES &amp; OTHER EVENTS</span><strong>'+other.length+' RECORDED</strong></summary>'+
   '<div class="pfc-timeline-group-body">'+renderTimeline(other,{empty:otherEmpty})+'</div></details>'+
   '</div>';
 }
 function fromResult(result,fixture){
  const teams=[fixture?.home||{},fixture?.away||{}];
  const score=[num(result?.score?.[0])??0,num(result?.score?.[1])??0];
  const members=teams.map(t=>new Map((t.lineup||[]).map(p=>[safe(p.id),safe(p.name)||'Unknown Pokémon'])));
  const all=new Map([...members[0],...members[1]]);
  const events=Array.isArray(result?.events)?result.events:[];
  const timeline=timelineFromEvents(events,fixture,safe(result?.origin||'quick-sim'));
  const goals=events.filter(e=>e?.type==='goal').map(e=>{
   const side=safe(e.team)===safe(teams[0].id)?0:safe(e.team)===safe(teams[1].id)?1:null;
   if(side==null)return null;
   const minute=num(e.minute);
   let label=safe(e.minuteLabel).trim().replace(/'$/,'');
   if(!validLabel(label))label=inRange(minute)?String(Math.max(1,Math.floor(minute)+1)):'?';
   return {
    side,minute:inRange(minute)?scalar(minute):null,minuteLabel:label,
    player:members[side].get(safe(e.player))||'Scorer unavailable',
    assist:e.assist?(all.get(safe(e.assist))||'Assist unavailable'):null,
    origin:safe(e.origin||result?.origin||'quick-sim')
   };
  }).filter(Boolean).sort((a,b)=>(a.minute??999)-(b.minute??999));
  const logged=[0,0];for(const e of goals)logged[e.side]++;
  const complete=logged.every((count,i)=>count===score[i]);
  const fields=['shots','shotsOnTarget','passes','completedPasses','possession','tackleAttempts','tackles','saves','corners','foulsCommitted','freeKicks','penaltyKicks'];
  const stats={};for(const field of fields)stats[field]=[0,1].map(i=>scalar(num(result?.stats?.[i]?.[field])));
  // Individual shots on goal come directly from each match engine player's box
  // (Quick Sim supplies these values). Never allocate team totals by guesswork.
  const playerShotsOnTarget=teams.flatMap((team,side)=>(team.lineup||[]).map(player=>{
   const count=num(result?.box?.[safe(player.id)]?.shotsOnTarget);
   return count!=null&&Number.isInteger(count)&&count>=0?
    {side,id:safe(player.id),player:safe(player.name),count}:null;
  }).filter(Boolean));
  // Tackles won/attempted are present in the actual Quick Sim player box.
  // Legacy matches without a player box remain unknown, never estimated.
  const playerTackles=teams.flatMap((team,side)=>(team.lineup||[]).map(player=>{
   const entry=result?.box?.[safe(player.id)];
   const attempts=num(entry?.tackleAttempts),won=num(entry?.tackles);
   return attempts!=null&&won!=null&&Number.isInteger(attempts)&&Number.isInteger(won)&&
    attempts>=0&&won>=0&&won<=attempts?
    {side,id:safe(player.id),player:safe(player.name),attempts,won}:null;
  }).filter(Boolean));
  return {
   version:3,score,goals,stats,playerShotsOnTarget,playerTackles,timeline,
   ...(result?.setPieceRules==='v1'?{setPieceRules:'v1'}:{}),
   status:complete?'complete':goals.length?'partial':'unavailable',
   note:complete?'':(events.length?'Some scorer or minute details were not supplied by the match engine.':'Scorer and minute details were not recorded for this match.'),
   origin:safe(result?.origin||'quick-sim'),
   handoffMinute:scalar(num(result?.handoff?.minute))
  };
 }
 root.PFC_MATCH_REPORT={fromResult,timelineFromEvents,renderTimeline,renderGroupedTimeline};
})(typeof window!=='undefined'?window:globalThis);
