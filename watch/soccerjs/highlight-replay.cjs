'use strict';
/* Official PokéFC highlight catalog and deterministic presentation windows.
 * The result ledger is read-only. Clip poses are illustrative, not recordings.
 * Only logged PSE goals and knockout shootout kicks are eligible.
 */
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const durationOf=fixture=>fixture?.durationMinutes===120?120:90;
function catalog(fixture,minute=0,kickIndex=0){
 if(!fixture||!Array.isArray(fixture.events))return [];
 const max=durationOf(fixture),current=clamp(Number(minute)||0,0,max);
 const entries=[];
 let goalNumber=0;
 for(const event of fixture.events){
  if(event?.type!=='goal')continue;
  const id='goal-'+goalNumber++;
  if(!Number.isFinite(event.minute)||event.minute>current+1e-7||event.minute<0||event.minute>=max)continue;
  const team=String(event.team)===String(fixture.home?.id)?fixture.home:
   String(event.team)===String(fixture.away?.id)?fixture.away:null;
  if(!team)continue;
  const player=team.lineup?.find(p=>String(p.id)===String(event.player));
  if(!player)continue;
  entries.push({id,kind:'goal',minute:event.minute,side:team.id,
   name:String(player.name||player.id),teamName:String(team.name||team.id),
   title:'GOAL',description:String(player.name||player.id)+' · '+String(team.name||team.id),
   event});
 }
 if(current>=max&&fixture.shootout?.version==='pse-shootout-v1'){
  const attempts=fixture.shootout.attempts||[];
  const known=clamp(Number.isInteger(kickIndex)?kickIndex:0,0,attempts.length);
  for(let i=0;i<known;i++){
   const kick=attempts[i],team=kick.side==='home'?fixture.home:fixture.away;
   const taker=team.lineup?.find(p=>String(p.id)===String(kick.kickerId));
   if(!taker)continue;
   entries.push({id:'pk-'+i,kind:'set',setPiece:'shootout',minute:max,
    kickIndex:i+1,name:String(taker.name||taker.id),teamName:String(team.name||team.id),
    title:'PENALTY '+(kick.scored?'SCORED':kick.outcome==='saved'?'SAVED':'MISSED'),
    description:String(taker.name||taker.id)+' · '+String(team.name||team.id),event:kick});
  }
 }
 return entries.sort((a,b)=>a.minute-b.minute||a.id.localeCompare(b.id));
}
function clipFor(fixture,entry){
 if(!entry||typeof entry.id!=='string')return null;
 const duration=durationOf(fixture);
 if(entry.kind==='goal'){
  const start=clamp(entry.minute-.7,0,duration);
  const end=clamp(entry.minute+.22,0,duration);
  return {id:entry.id,kind:'goal',start,end,durationSeconds:6,minute:entry.minute};
 }
 if(entry.kind==='set'&&entry.setPiece==='shootout'){
  return {id:entry.id,kind:'shootout',start:duration,end:duration,
   kickIndex:entry.kickIndex,durationSeconds:3.2,minute:duration};
 }
 return null;
}
function resolve(fixture,id,minute,kickIndex){
 return catalog(fixture,minute,kickIndex).find(e=>e.id===id)||null;
}
module.exports={catalog,clipFor,resolve};
