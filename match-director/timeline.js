/* PokéFC Match Director v0.1 — read-only shot/outcome timeline.
 * Phase 10A, chunk 1: Quick Sim is the sole match authority. This module
 * neither changes Quick Sim nor attempts to run independent TM match logic.
 * Non-goal shot timestamps are reconstructions, not real Quick Sim events.
 */
(function(root){'use strict';
 const VERSION='phase10-shot-ledger-v1';
 const MAX_MINUTE=90;
 function insist(ok,message){if(!ok)throw Error('Match Director: '+message)}
 function count(value,label){
  insist(Number.isSafeInteger(value)&&value>=0,'Invalid '+label);
  return value;
 }
 function hash(str){let h=2166136261;for(const c of String(str))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0}
 function randomizer(seed){
  let a=hash(seed)||1;
  return function(){
   a=(a+0x6d2b79f5)|0;let t=a;t=Math.imul(t^(t>>>15),t|1);
   t^=t+Math.imul(t^(t>>>7),t|61);
   return ((t^(t>>>14))>>>0)/4294967296;
  };
 }
 function normalize(preview,result){
  insist(preview&&preview.home&&preview.away&&Array.isArray(preview.home.lineup)&&Array.isArray(preview.away.lineup),
   'Starting lineups required');
  insist(preview.home.lineup.length===11&&preview.away.lineup.length===11,'Expected starting XIs');
  insist(result&&result.origin==='quick-sim','A completed authoritative Quick Sim result is required');
  insist(Array.isArray(result.stats)&&result.stats.length===2&&Array.isArray(result.score)&&result.score.length===2,
   'Quick Sim team stats and score required');
  insist(Array.isArray(result.events)&&result.box&&typeof result.box==='object',
   'Quick Sim player box score and events required');
  const teams=[preview.home,preview.away],ids=teams.map(t=>String(t.id));
  insist(ids[0]!==ids[1],'Distinct teams required');
  insist(String(result.home)===ids[0]&&String(result.away)===ids[1],'Quick Sim result is for a different fixture');
  const seen=new Set();
  for(const t of teams)for(const p of t.lineup){
   insist(p&&p.id!=null&&!seen.has(String(p.id)),'Duplicate or invalid player ID');
   seen.add(String(p.id));
  }
  return {teams,ids};
 }
 function build(preview,result,options){
  options=options||{};
  const pair=normalize(preview,result);
  const next=randomizer(String(options.seed==null?preview.seed==null?'PokeFC':preview.seed:options.seed)+':'+VERSION);
  const staged=[],totals=[],keepers=pair.teams.map(t=>t.lineup.find(p=>p.pos==='GK')||null);
  const officialGoals=result.events.filter(e=>e.type==='goal');
  const officialByTeam=[[],[]];
  for(let index=0;index<officialGoals.length;index++){
   const goal=officialGoals[index],side=pair.ids.indexOf(String(goal.team));
   insist(side!==-1,'Unknown goal team');
   insist(Number.isFinite(goal.minute)&&goal.minute>=0&&goal.minute<MAX_MINUTE,'Invalid official goal minute');
   insist(pair.teams[side].lineup.some(p=>String(p.id)===String(goal.player)),'Goal scorer is not on the team');
   if(goal.assist!=null){
    insist(pair.teams[side].lineup.some(p=>String(p.id)===String(goal.assist)),'Assist is not on the team');
    insist(String(goal.assist)!==String(goal.player),'Self-assist is invalid');
   }
   officialByTeam[side].push(goal);
   staged.push({kind:'shot',outcome:'goal',minute:goal.minute,teamId:pair.ids[side],
    playerId:String(goal.player),assistId:goal.assist==null?null:String(goal.assist),
    goalkeeperId:keepers[1-side]?String(keepers[1-side].id):null,
    onTarget:true,source:'official-quick-sim-goal',officialGoalIndex:index});
  }
  for(let side=0;side<2;side++){
   const stats=result.stats[side],opponentStats=result.stats[1-side];
   const shots=count(stats.shots,'shots'),onTarget=count(stats.shotsOnTarget,'shots on target');
   const goals=count(stats.goals,'goals'),saves=count(opponentStats.saves,'opponent goalkeeper saves');
   insist(count(result.score[side],'score')===goals,'Score differs from team goals');
   insist(goals===officialByTeam[side].length,'Goal event count differs from scoreboard');
   insist(goals<=onTarget&&onTarget<=shots,'Impossible shot counts');
   insist(saves===onTarget-goals,'Saved shots differ from on-target non-goals');
   totals.push({teamId:pair.ids[side],shots,shotsOnTarget:onTarget,goals,savesAgainst:saves});
   const scorerCounts=new Map();
   for(const g of officialByTeam[side]){
    const key=String(g.player);scorerCounts.set(key,(scorerCounts.get(key)||0)+1);
   }
   const nonGoalAttempts=[];let playerTotal=0;
   for(const player of pair.teams[side].lineup){
    const key=String(player.id);
    const record=result.box[player.id]||result.box[key];
    insist(record,'Missing Quick Sim box score for '+key);
    const playerShots=count(record.shots,'player shots'),playerGoals=count(record.goals,'player goals');
    insist(playerGoals===(scorerCounts.get(key)||0),'Player goals do not match goal ledger: '+key);
    insist(playerShots>=playerGoals,'Player shots lower than goals: '+key);
    playerTotal+=playerShots;
    for(let k=playerGoals;k<playerShots;k++)nonGoalAttempts.push(key);
   }
   insist(playerTotal===shots,'Team shots differ from player box shots');
   insist(nonGoalAttempts.length===shots-goals,'Incomplete non-goal shot pool');
   // Fisher–Yates randomized assignment: non-goal shot events maintain
   // exact shooter shot counts without inventing a second outcome engine.
   for(let i=nonGoalAttempts.length-1;i>0;i--){
    const k=Math.floor(next()*(i+1));
    const temp=nonGoalAttempts[i];nonGoalAttempts[i]=nonGoalAttempts[k];nonGoalAttempts[k]=temp;
   }
   for(let i=0;i<nonGoalAttempts.length;i++){
    const saved=i<saves,minute=next()*MAX_MINUTE;
    staged.push({kind:'shot',outcome:saved?'saved':'off-target',minute,
     teamId:pair.ids[side],playerId:nonGoalAttempts[i],assistId:null,
     goalkeeperId:saved&&keepers[1-side]?String(keepers[1-side].id):null,
     onTarget:saved,source:'derived-from-quick-sim-totals',officialGoalIndex:null});
   }
  }
  // Only goals retain original authoritative timestamps. Other shot moments
  // are plausible replay slots derived from totals, not historical evidence.
  staged.sort((a,b)=>a.minute-b.minute||
    (a.outcome==='goal'?-1:1)-(b.outcome==='goal'?-1:1)||
    a.teamId.localeCompare(b.teamId)||a.playerId.localeCompare(b.playerId));
  const events=staged.map((event,i)=>Object.assign({id:'md-shot-'+String(i+1).padStart(4,'0'),
   minuteLabel:String(Math.floor(event.minute)+1)},event));
  const plan={version:VERSION,authority:'quick-sim',coverage:'shots-and-goals-only',
   durationMinutes:MAX_MINUTE,homeId:pair.ids[0],awayId:pair.ids[1],
   official:{score:result.score.slice(),teams:totals},
   events};
  validate(plan);
  return plan;
 }
 function validate(plan){
  insist(plan&&plan.version===VERSION&&plan.authority==='quick-sim','Unknown event timeline');
  insist(Array.isArray(plan.events)&&Array.isArray(plan.official?.teams),'Missing event ledger');
  const stats=plan.official.teams;
  insist(stats.length===2,'Expected two teams');
  const observed=stats.map(()=>({shots:0,shotsOnTarget:0,goals:0,savesAgainst:0}));
  const ids=stats.map(t=>t.teamId);
  let last=-1;
  for(const event of plan.events){
   insist(Number.isFinite(event.minute)&&event.minute>=last&&event.minute<MAX_MINUTE,'Invalid event ordering');
   last=event.minute;
   const side=ids.indexOf(event.teamId);
   insist(side!==-1&&event.kind==='shot','Unknown shot event');
   insist(['goal','saved','off-target'].includes(event.outcome),'Unknown shot outcome');
   const s=observed[side];s.shots++;
   if(event.outcome!=='off-target')s.shotsOnTarget++;
   if(event.outcome==='goal')s.goals++;
   if(event.outcome==='saved')s.savesAgainst++;
  }
  for(let side=0;side<2;side++){
   insist(count(plan.official.score[side],'official score')===observed[side].goals,'Score drift');
   for(const key of ['shots','shotsOnTarget','goals','savesAgainst'])
    insist(stats[side][key]===observed[side][key],'Event ledger mismatch for '+key+' / '+ids[side]);
  }
  return true;
 }
 function eventsBetween(plan,start,end){
  insist(plan&&Array.isArray(plan.events),'Timeline required');
  insist(Number.isFinite(start)&&Number.isFinite(end)&&start>=0&&end<=MAX_MINUTE&&start<=end,
   'Invalid window');
  return plan.events.filter(e=>e.minute>=start&&e.minute<end);
 }
 function scoreAt(plan,minute){
  insist(plan&&Array.isArray(plan.events)&&Array.isArray(plan.official?.teams),'Timeline required');
  insist(Number.isFinite(minute)&&minute>=0&&minute<=MAX_MINUTE,'Invalid minute');
  const ids=plan.official.teams.map(t=>t.teamId);
  const score=[0,0];
  for(const e of plan.events)if(e.outcome==='goal'&&e.minute<=minute){
   const side=ids.indexOf(e.teamId);
   insist(side!==-1,'Unknown scoring team');
   score[side]++;
  }
  return score;
 }
 root.PFC_MATCH_DIRECTOR={build,validate,eventsBetween,scoreAt,VERSION};
 if(typeof module!=='undefined'&&module.exports)
  module.exports={build,validate,eventsBetween,scoreAt,VERSION};
})(typeof window!=='undefined'?window:globalThis);
