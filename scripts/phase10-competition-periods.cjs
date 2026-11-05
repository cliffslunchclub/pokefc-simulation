'use strict';
/**
 * Phase 10B competition period contract.
 * The authority is an externally generated (Quick Sim) event ledger.
 * Soccer-JS may render these periods; it does not choose the winner.
 * No external engine code or full match generation occurs here.
 */
const assert=require('node:assert/strict');
const ENDS={REGULATION:90,EXTRA_FIRST:105,EXTRA_FULL:120};
function validate(official){
 assert(official&&typeof official==='object','Official match required');
 assert(official.competition==='league'||official.competition==='knockout','Competition must be league or knockout');
 assert(Array.isArray(official.events),'Official goal events required');
 assert(Array.isArray(official.score)&&official.score.length===2,'Official score required');
 let last=-1;
 const totals=[0,0];
 for(const event of official.events){
  assert(event&&event.type==='goal'&&[0,1].includes(event.side),'Official goal needs team');
  assert(Number.isFinite(event.minute)&&event.minute>=0&&event.minute<120,'Event minute out of match bounds');
  assert(event.minute>=last,'Official goals must be chronological');
  last=event.minute;
  totals[event.side]++;
 }
 assert.deepEqual(totals,official.score,'Goal ledger does not match official score');
 if(official.competition==='league')
  assert(official.events.every(e=>e.minute<90),'League match has extra-time goal');
 const regulation=countScore(official.events,90);
 const tied90=regulation[0]===regulation[1];
 const extended=official.competition==='knockout'&&tied90;
 if(!extended)assert(official.events.every(e=>e.minute<90),'Extra-time goal in regulation-only match');
 return {extended,regulation};
}
function countScore(events,limit){
 const score=[0,0];
 for(const e of events)if(e.minute<limit)score[e.side]++;
 return score;
}
function stateAt(official,minute){
 const {extended,regulation}=validate(official);
 assert(Number.isFinite(minute)&&minute>=0&&minute<=120,'Invalid playback minute');
 const finalMinute=extended?120:90;
 const target=Math.min(minute,finalMinute);
 const score=countScore(official.events,Math.min(target+Number.EPSILON,finalMinute));
 const tied120=official.score[0]===official.score[1];
 let phase;
 if(target<45)phase='first-half';
 else if(target<90)phase='second-half';
 else if(!extended)phase='full-time';
 else if(target<105)phase='extra-time-first-half';
 else if(target<120)phase='extra-time-second-half';
 else if(tied120)phase='penalties-pending';
 else phase='full-time';
 return {
  minute:target,score,phase,extended,regulationScore:regulation,
  finalMinute,shootoutRequired:extended&&tied120&&target>=120,
  winnerSide:target>=finalMinute&&!tied120?(official.score[0]>official.score[1]?0:1):
   target>=finalMinute&&!extended&&official.score[0]!==official.score[1]?(official.score[0]>official.score[1]?0:1):null
 };
}
function periods(official){
 const {extended}=validate(official);
 return [
  {name:'first-half',start:0,end:45},
  {name:'second-half',start:45,end:90},
  ...(extended?[
   {name:'extra-time-first-half',start:90,end:105},
   {name:'extra-time-second-half',start:105,end:120}
  ]:[])
 ];
}
module.exports={validate,stateAt,periods,countScore,ENDS};
