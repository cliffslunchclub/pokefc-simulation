/* PokéFC Challenges v1.0 — LOCAL run history. Not a verified/online leaderboard.
 * Shared by Challenges and Quick Play's locked Challenge match handoff. */
(function (root) {
 'use strict';
 const KEY='pokefc-challenge-local-runs-v1';
 const LIMIT=50;
 const CATEGORIES=[
  {id:'classic-standard',label:'Classic · Standard',pool:4,legends:false},
  {id:'classic-legends',label:'Classic · Legends',pool:4,legends:true},
  {id:'national-standard',label:'National · Standard',pool:9,legends:false},
  {id:'national-legends',label:'National · Legends',pool:9,legends:true}
 ];
 const categoryOf=s=>(s.pool===4?'classic':'national')+'-'+(s.legends?'legends':'standard');
 const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
 function getAll(storage){
  try{
   const saved=JSON.parse(storage.getItem(KEY)||'null');
   if(!saved||typeof saved!=='object')return {};
   const result={};
   for(const cat of CATEGORIES){result[cat.id]=Array.isArray(saved[cat.id])?saved[cat.id].slice(0,LIMIT):[]}
   return result;
  }catch{return {}}
 }
 function snapshot(st){
  if(!st||st.phase!=='finished'||!st.locked||!Array.isArray(st.history)||st.history.length<1||st.history.length>6)return null;
  if(!Array.isArray(st.locked.roster)||st.locked.roster.length!==11)return null;
  const history=st.history;
  const wins=history.filter(m=>m.outcome==='Victory').length;
  const goalsFor=history.reduce((n,m)=>n+finite(m.score?.[0]),0),goalsAgainst=history.reduce((n,m)=>n+finite(m.score?.[1]),0);
  const category=categoryOf(st);
  const champion=history.length===6&&wins===6;
  return {
   id:category+'-'+String(st.rng??'unknown'),category,champion,
   wins,losses:history.length-wins,played:history.length,
   goalDifference:goalsFor-goalsAgainst,goalsFor,goalsAgainst,
   teamScore:Math.max(0,finite(st.locked.score)),formation:String(st.locked.formation||st.formation||'4-3-3'),
   tactics:String(st.locked.tactic||st.tactic||'balanced'),
   roster:st.locked.roster.slice(),items:Array.isArray(st.locked.items)?st.locked.items.slice():[],
   matches:history.map(m=>({
    boss:String(m.boss||'Unknown'),score:[finite(m.score?.[0]),finite(m.score?.[1])],
    outcome:String(m.outcome||'Defeat'),origin:String(m.origin||'quick-sim'),report:m.report||null
   })),finishedAt:new Date().toISOString()
  };
 }
 function archive(st,storage){
  const run=snapshot(st);
  if(!run)return null;
  const client=storage||root.localStorage;
  if(!client)return null;
  const all=getAll(client);
  const list=all[run.category]||[];
  const existing=list.find(x=>x.id===run.id);
  if(existing)return existing;
  all[run.category]=[run,...list].slice(0,LIMIT);
  try{client.setItem(KEY,JSON.stringify(all));return run}catch{return null}
 }
 function compare(a,b){
  return Number(Boolean(b.champion))-Number(Boolean(a.champion)) ||
   finite(b.wins)-finite(a.wins) ||
   finite(b.goalDifference)-finite(a.goalDifference) ||
   finite(b.teamScore)-finite(a.teamScore) ||
   String(b.finishedAt||'').localeCompare(String(a.finishedAt||''));
 }
 function rankings(category,storage){
  if(!CATEGORIES.some(c=>c.id===category))return [];
  const all=getAll(storage||root.localStorage||{getItem:()=>null});
  return (all[category]||[]).filter(r=>r&&typeof r==='object'&&typeof r.id==='string').slice().sort(compare);
 }
 function stats(category,storage){
  const list=rankings(category,storage);
  return {runs:list.length,champions:list.filter(x=>x.champion).length,
   bestWins:list.length?Math.max(...list.map(x=>finite(x.wins))):0,
   bestScore:list.length?Math.max(...list.map(x=>finite(x.teamScore))):null};
 }
 root.PFC_CHALLENGE_LEADERBOARD={KEY,CATEGORIES,categoryOf,snapshot,archive,rankings,stats,compare};
})(typeof window!=='undefined'?window:globalThis);
