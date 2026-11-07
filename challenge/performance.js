/* PokéFC Challenges: transparent player-of-the-match and tournament contributions.
 * No invented individual match events: use recorded scorers, assists and team GK saves.
 * In matches without contributions, select a clearly labeled positional-fit fallback. */
(function(root){'use strict';
 const number=v=>Number.isFinite(Number(v))?Number(v):0;
 const eq=(a,b)=>String(a||'').toLocaleLowerCase()===String(b||'').toLocaleLowerCase();
 function empty(p,side){
  return {id:p.id,name:p.name,side,pos:p.pos,spriteId:p.spriteId||p.id,
   goals:0,assists:0,saves:0,shotsOnGoal:0,shotGames:0,tacklesWon:0,tackleAttempts:0,tackleGames:0,penalties:0,cleanSheets:0,appearances:1,
   fit:number(p.fit),score:0};
 }
 function fill(match,home,away){
  const teams=[home,away];
  const all=teams.map((team,side)=>team.map(p=>empty(p,side)));
  const find=(side,name)=>{
   if(!name||side<0||side>1)return null;
   return all[side].find(p=>eq(p.name,name)||teams[side].find(a=>a.id===p.id)?.aliases?.some(alias=>eq(alias,name)))||null;
  };
  const goals=Array.isArray(match?.report?.goals)?match.report.goals:[];
  for(const goal of goals){
   const side=Number(goal.side);
   const scorer=find(side,goal.player);
   if(scorer)scorer.goals++;
   const assister=find(side,goal.assist);
   if(assister)assister.assists++;
  }
  // Each recorded Pokémon line has its own real match-box shots on target.
  // Older watched/legacy games may not provide this detail; unknown != zero.
  const shots=Array.isArray(match?.report?.playerShotsOnTarget)?match.report.playerShotsOnTarget:[];
  for(const shot of shots){
   const side=Number(shot.side),count=Number(shot.count);
   if(!Number.isInteger(count)||count<0)continue;
   const player=find(side,shot.player);
   if(player){player.shotsOnGoal+=count;player.shotGames++}
  }
  // Only per-player entries persisted by the match engine count as recorded tackles.
  const tackles=Array.isArray(match?.report?.playerTackles)?match.report.playerTackles:[];
  for(const tackle of tackles){
   const side=Number(tackle.side),attempts=Number(tackle.attempts),won=Number(tackle.won);
   if(!Number.isInteger(attempts)||!Number.isInteger(won)||attempts<0||won<0||won>attempts)continue;
   const player=find(side,tackle.player);
   if(player){player.tacklesWon+=won;player.tackleAttempts+=attempts;player.tackleGames++}
  }
  const attempts=match?.shootout?.attempts||[];
  for(const kick of attempts){
   if(!kick?.scored)continue;
   const side=kick.side==='home'?0:1;
   const kicker=find(side,kick.kicker);
   if(kicker)kicker.penalties++;
  }
  const saves=match?.report?.stats?.saves;
  const score=match?.score||[0,0];
  for(let side=0;side<2;side++){
   const keeper=all[side].find(p=>p.pos==='GK');
   if(keeper&&Array.isArray(saves)&&saves[side]!=null)keeper.saves=Math.max(0,number(saves[side]));
   if(keeper&&Number(score[1-side])===0)keeper.cleanSheets++;
  }
  for(const team of all)for(const p of team){
   p.score=p.goals*4+p.assists*2.5+p.saves*.35+p.penalties*.65+p.cleanSheets*.5;
  }
  return all;
 }
 function matchAward(match,home,away){
  if(!Array.isArray(home)||!Array.isArray(away)||home.length!==11||away.length!==11)return null;
  const teams=fill(match,home,away),players=teams.flat();
  const tracked=players.some(p=>p.goals||p.assists||p.saves||p.penalties);
  const top=players.slice().sort((a,b)=>b.score-a.score||b.fit-a.fit||a.name.localeCompare(b.name))[0];
  if(!top)return null;
  return {id:top.id,name:top.name,side:top.side,pos:top.pos,spriteId:top.spriteId,
   goals:top.goals,assists:top.assists,saves:top.saves,shotsOnGoal:top.shotsOnGoal,shotGames:top.shotGames,
   tacklesWon:top.tacklesWon,tackleAttempts:top.tackleAttempts,tackleGames:top.tackleGames,
   penalties:top.penalties,cleanSheets:top.cleanSheets,
   method:tracked?'recorded-contributions':'position-fit-fallback',provisional:true,score:Math.round(top.score*10)/10};
 }
 function tournament(matches,home){
  if(!Array.isArray(home)||home.length!==11)return null;
  const rows=home.map(p=>({...empty(p,0),appearances:0,potm:0}));
  const byId=new Map(rows.map(p=>[p.id,p]));
  for(const match of matches||[]){
   const played=fill(match,home,[])[0];
   for(const p of played){
    const row=byId.get(p.id);
    if(!row)continue;
    row.appearances++;row.goals+=p.goals;row.assists+=p.assists;
    row.saves+=p.saves;row.shotsOnGoal+=p.shotsOnGoal;row.shotGames+=p.shotGames;
    row.tacklesWon+=p.tacklesWon;row.tackleAttempts+=p.tackleAttempts;row.tackleGames+=p.tackleGames;
    row.penalties+=p.penalties;row.cleanSheets+=p.cleanSheets;
   }
   const award=match?.award;
   if(award?.side===0&&byId.has(award.id))byId.get(award.id).potm++;
  }
  for(const p of rows)p.score=Math.round((p.goals*4+p.assists*2.5+p.saves*.35+
    p.penalties*.65+p.cleanSheets*.5+p.potm*1.5)*10)/10;
  const ordered=rows.slice().sort((a,b)=>b.score-a.score||b.goals-a.goals||
   b.assists-a.assists||b.fit-a.fit||a.name.localeCompare(b.name));
  const best=ordered[0]||null;
  return {best,players:rows,method:rows.some(p=>p.goals||p.assists||p.saves||p.penalties)?
   'recorded-contributions':'position-fit-fallback'};
 }
 root.PFC_CHALLENGE_PERFORMANCE={matchAward,tournament,fill};
})(typeof window!=='undefined'?window:globalThis);
