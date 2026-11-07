/* PokéFC Sim Engine — Shared knockout rules v1.
 * This module owns deterministic extra time and genuine modeled penalty attempts.
 * It never changes the supplied 90-minute regulation result or existing local saves.
 * Match-result stats remain separate from shootout results.
 */
(function(root){'use strict';
 const qs=(typeof module!=='undefined'&&module.exports)?require('./quick-sim.js'):root.FXI_QUICK;
 const requireValid=(ok,msg)=>{if(!ok)throw Error('PSE Knockout: '+msg)};
 const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,Number(x)||0));
 const value=(p,key,fallback=65)=>Number(p?.detail?.[key]??p?.main?.[key]??fallback)||fallback;
 const positionModel=(typeof module!=='undefined'&&module.exports)?require('./position-effectiveness.js'):root.PFC_POSITION_EFFECTIVENESS;
 function pokemonValue(p,key){
  if(!p?.pokemonStats)return value(p,key);
  if(!positionModel?.preciseFit)throw Error('PSE knockout requires Pokémon positional model');
  const stats=p.pokemonStats;
  if(['finishing','composure'].includes(key))return positionModel.finishingIndex(stats);
  if(['tackling','strength'].includes(key))return positionModel.preciseFit(stats,'CB');
  if(['reflexes','handling','positioning','diving'].includes(key))return positionModel.preciseFit(stats,'GK');
  return positionModel.preciseFit(stats,'CAM');
 }
 const avg=(arr)=>arr.reduce((s,x)=>s+x,0)/Math.max(1,arr.length);
 const choose=(rng,players,weight)=>{
  const weights=players.map(p=>Math.max(1,weight(p))),total=weights.reduce((a,b)=>a+b,0);
  let roll=rng()*total;
  for(let i=0;i<players.length;i++){roll-=weights[i];if(roll<=0)return players[i]}
  return players.at(-1);
 };
 function validatePreview(preview){
  requireValid(preview?.home?.lineup?.length===11&&preview?.away?.lineup?.length===11,'Two full starting XIs required');
  requireValid(preview.home.id!==preview.away.id,'Team IDs must differ');
  const ids=preview.home.lineup.concat(preview.away.lineup).map(p=>String(p.id));
  requireValid(new Set(ids).size===22,'Starting XI player IDs must be unique');
 }
 function validateRegulation(preview,regulation){
  validatePreview(preview);
  requireValid(regulation?.origin==='quick-sim','Only official PSE regulation is accepted');
  requireValid(Array.isArray(regulation.score)&&regulation.score.length===2,'Invalid regulation score');
  requireValid(String(regulation.home)===String(preview.home.id)&&String(regulation.away)===String(preview.away.id),'Regulation team mismatch');
  requireValid(Array.isArray(regulation.events)&&Array.isArray(regulation.stats)&&regulation.stats.length===2,'Regulation event ledger unavailable');
  for(let side=0;side<2;side++){
   const id=String(side?preview.away.id:preview.home.id);
   const n=regulation.events.filter(e=>e.type==='goal'&&String(e.team)===id).length;
   requireValid(n===regulation.score[side]&&regulation.stats[side].goals===n,'Inconsistent regulation goal ledger');
  }
 }
 function extraTime(preview,seed,options={}){
  validatePreview(preview);
  requireValid(typeof seed==='string'&&seed.length>0,'Extra-time seed required');
  const teams=[preview.home,preview.away],rng=qs.randomizer(seed+':pse-et-v1');
  const v2=options.positionEffectiveness==='v2';
  const eff=p=>v2?clamp(p?.positionEfficiency??1,.70,1):
   options.positionEffectiveness==='v1'?clamp(p?.positionEfficiency??1,.88,1):1;
  const skill=(p,k)=>(v2?pokemonValue(p,k):value(p,k))*eff(p);
  const strength=teams.map(t=>({
   attack:avg(t.lineup.filter(p=>p.pos==='FWD').map(p=>v2?(p.positionFit??positionModel.preciseFit(p.pokemonStats,p.exactPosition||'ST'))*eff(p):skill(p,'finishing'))),
   defense:avg(t.lineup.filter(p=>p.pos==='DEF').map(p=>v2?(p.positionFit??positionModel.preciseFit(p.pokemonStats,p.exactPosition||'CB'))*eff(p):skill(p,'tackling'))),
   keeper:avg(['reflexes','handling','positioning','diving'].map(k=>{const p=t.lineup.find(p=>p.pos==='GK')||t.lineup[0];return v2?(p.positionFit??positionModel.preciseFit(p.pokemonStats,'GK'))*eff(p):skill(p,k)}))
  }));
  const stats=teams.map(()=>({shots:0,shotsOnTarget:0,goals:0,saves:0,passes:0,completedPasses:0,tackleAttempts:0,tackles:0}));
  const box=Object.fromEntries(teams.flatMap(t=>t.lineup.map(p=>[p.id,{
   goals:0,assists:0,saves:0,shots:0,shotsOnTarget:0,tackleAttempts:0,tackles:0,minutes:30
  }])));
  const score=[0,0],events=[];let serial=0;
  const incident=(type,side,p,minute,rest={})=>{
   const e={id:'pse-et-'+String(++serial).padStart(5,'0'),minute,
    minuteLabel:String(Math.floor(minute)+1),type,team:teams[side].id,
    player:p.id,origin:'quick-sim',phase:'extra-time',...rest};
   events.push(e);return e;
  };
  for(let m=0;m<30;m++)for(let side=0;side<2;side++){
   const own=teams[side],opponent=teams[1-side],s=stats[side],attackers=own.lineup.filter(p=>p.pos!=='GK');
   const shots=qs.poisson(rng,clamp((qs.DEFAULTS.shotsBase+
    (strength[side].attack-strength[1-side].defense)*qs.DEFAULTS.shotsAttackSlope+
    (side===0?qs.DEFAULTS.shotsHomeBonus:0))/90,.002,.85));
   for(let k=0;k<shots;k++){
    const player=choose(rng,attackers,p=>(p.pos==='FWD'?2:p.pos==='MID'?1:.2)*skill(p,'finishing'));
    const at=90+m+rng()*.98;
    const onTarget=rng()<clamp(.30+.003*skill(player,'finishing'),.1,.85);
    const quality=clamp(.09+.0019*(strength[side].attack-strength[1-side].defense)+rng()*.07,.025,.31);
    const goal=onTarget&&rng()<clamp(quality/.60+.001*(skill(player,'finishing')-strength[1-side].keeper),.025,.85);
    s.shots++;box[player.id].shots++;
    if(onTarget){s.shotsOnTarget++;box[player.id].shotsOnTarget++;}
    const shot=incident('shot',side,player,at,{outcome:goal?'goal':onTarget?'saved':'off-target'});
    if(goal){
     s.goals++;score[side]++;box[player.id].goals++;
     const helper=rng()<qs.DEFAULTS.assistProbability?choose(rng,attackers.filter(p=>p.id!==player.id),
      p=>skill(p,'shortPassing')+skill(p,'vision')):null;
     if(helper)box[helper.id].assists++;
     incident('goal',side,player,at,{assist:helper?.id||null,causedBy:shot.id});
    }else if(onTarget){
     const keeper=opponent.lineup.find(p=>p.pos==='GK')||opponent.lineup[0];
     stats[1-side].saves++;box[keeper.id].saves++;
     incident('save',1-side,keeper,at,{shooter:player.id,causedBy:shot.id});
    }
   }
   const passed=qs.poisson(rng,Math.max(.02,(qs.DEFAULTS.passesBase+qs.DEFAULTS.passesPossessionSlope*50)/90));
   s.passes+=passed;s.completedPasses+=qs.binomial(rng,passed,qs.DEFAULTS.passAccuracy);
   for(const player of attackers){
    const wins=qs.poisson(rng,Math.max(0,qs.DEFAULTS.tacklesPerPlayer/90*(.5+skill(player,'tackling')/130)));
    const attempts=wins+qs.poisson(rng,wins*.65);
    s.tackles+=wins;s.tackleAttempts+=attempts;
    box[player.id].tackles+=wins;box[player.id].tackleAttempts+=attempts;
   }
  }
  events.sort((a,b)=>a.minute-b.minute);
  for(let side=0;side<2;side++){
   requireValid(stats[side].goals===score[side],'Extra-time score mismatch');
   requireValid(stats[side].shotsOnTarget===stats[side].goals+stats[1-side].saves,'Extra-time shots and saves mismatch');
   requireValid(events.filter(e=>e.type==='goal'&&String(e.team)===String(teams[side].id)).length===score[side],'Extra-time goal ledger mismatch');
  }
  return {origin:'quick-sim',ruleset:'pse-extra-time-v1',phase:'extra-time',durationMinutes:30,
   home:teams[0].id,away:teams[1].id,score,events,box,stats};
 }
 function shootout(preview,seed,options={}){
  validatePreview(preview);
  requireValid(typeof seed==='string'&&seed.length>0,'Shootout seed required');
  const rng=qs.randomizer(seed+':pse-shootout-v1'),teams=[preview.home,preview.away];
  const v2=options.positionEffectiveness==='v2';
  const eff=p=>v2?clamp(p?.positionEfficiency??1,.70,1):
   options.positionEffectiveness==='v1'?clamp(p?.positionEfficiency??1,.88,1):1;
  const skill=(p,k)=>(v2?pokemonValue(p,k):value(p,k))*eff(p);
  const order=teams.map(t=>t.lineup.filter(p=>p.pos!=='GK').slice().sort((a,b)=>
   (skill(b,'finishing')+skill(b,'composure'))-(skill(a,'finishing')+skill(a,'composure'))||
   String(a.id).localeCompare(String(b.id))));
  const keepers=teams.map(t=>t.lineup.find(p=>p.pos==='GK')||t.lineup[0]);
  let home=0,away=0,homeTaken=0,awayTaken=0;
  const attempts=[];
  function kick(side,round){
   const taker=order[side][(round-1)%order[side].length],keeper=keepers[1-side];
   const chance=clamp(.72+(skill(taker,'finishing')-65)*.002+
    (skill(taker,'composure')-65)*.001-(skill(keeper,'reflexes')-65)*.0015,.48,.92);
   const scored=rng()<chance;
   const outcome=scored?'goal':rng()<.68?'saved':'off-target';
   const n=attempts.length+1;
   attempts.push({id:'pse-pk-'+String(n).padStart(4,'0'),phase:'shootout',
    round,side:side?'away':'home',kickerId:taker.id,kicker:taker.name||String(taker.id),
    keeperId:keeper.id,scored,outcome});
   if(side){awayTaken++;away+=Number(scored)}else{homeTaken++;home+=Number(scored)}
  }
  let finished=false;
  for(let round=1;round<=500&&!finished;round++){
   kick(0,round);
   if(round<=5&& (home>away+5-awayTaken||away>home+5-homeTaken)){finished=true;break}
   kick(1,round);
   if(round<=5)finished=home>away+5-awayTaken||away>home+5-homeTaken;
   else finished=home!==away;
  }
  requireValid(finished&&home!==away,'Shootout did not reach a valid decision');
  const winner=home>away?'home':'away';
  return {version:'pse-shootout-v1',home,away,winner,attempts,
   recordedAt:'separate-shootout',countsInMatchStats:false};
 }
 function merge(regulation,extra){
  const scores=regulation.score.map((n,side)=>n+extra.score[side]);
  const stats=regulation.stats.map((original,side)=>{
   const combined={...original};
   for(const k of ['goals','shots','shotsOnTarget','saves','passes','completedPasses','tackleAttempts','tackles'])
    if(Number.isFinite(original[k])&&Number.isFinite(extra.stats[side][k]))
     combined[k]=original[k]+extra.stats[side][k];
   return combined;
  });
  const box=Object.fromEntries(Object.entries(regulation.box||{}).map(([id,p])=>{
   const extraPlayer=extra.box[id]||{};
   const combined={...p};
   for(const k of ['goals','assists','saves','shots','shotsOnTarget','tackleAttempts','tackles','minutes'])
    if(Number.isFinite(p[k])&&Number.isFinite(extraPlayer[k]))combined[k]=p[k]+extraPlayer[k];
   return [id,combined];
  }));
  const events=regulation.events.concat(extra.events).slice().sort((a,b)=>a.minute-b.minute);
  return {...regulation,score:scores,stats,box,events,knockoutRules:'pse-knockout-v1',
   durationMinutes:120,regulationScore:regulation.score.slice(),extraTimeScore:extra.score.slice()};
 }
 function resolve(preview,regulation,opts={}){
  validateRegulation(preview,regulation);
  const seed=String(opts.seed||preview.seed||'PSE-KNOCKOUT');
  const old=JSON.stringify(regulation);
  let match=regulation,extra=null,kicks=null,winner,decidedBy='regulation';
  if(regulation.score[0]===regulation.score[1]){
   extra=extraTime(preview,seed,{positionEffectiveness:regulation.positionEffectiveness});match=merge(regulation,extra);decidedBy='extra-time';
   if(match.score[0]===match.score[1]){
    kicks=shootout(preview,seed,{positionEffectiveness:regulation.positionEffectiveness});decidedBy='shootout';
    winner=kicks.winner;
   }
  }
  if(!winner)winner=match.score[0]>match.score[1]?'home':'away';
  requireValid(JSON.stringify(regulation)===old,'Regulation result was mutated');
  return {version:'pse-knockout-v1',winner,decidedBy,regulationScore:regulation.score.slice(),
   match,extraTime:extra,shootout:kicks};
 }
 const api={resolve,extraTime,shootout,merge};
 root.PFC_KNOCKOUT=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
