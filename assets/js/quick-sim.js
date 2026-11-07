/* PokéFC Sim Engine (PSE) — statistical match engine (legacy v0.7b contract).
 * Quick Sim is the user-facing action; preserve FXI-prefixed globals, seeded IDs,
 * result schemas, and this filename for backward compatibility.
 * Shared provisional parameters also drive the watched->Quick Sim continuation.
 * Calibrated profiles are only accepted when fitted to verified complete
 * TacticMesh fixtures; no synthetic data is shipped as measured evidence. */
(function(root){'use strict';
 // TM counts a tackle attempt whenever a defender challenges; a tackle won
 // only if the ledger event has success=true. The 0.28 split is a provisional
 // observed win-rate, NOT an accepted full-match calibrated parameter.
 const TACKLE_WIN_RATE=0.28;
 const DEFAULTS=Object.freeze({
  shotsBase:10.2,shotsAttackSlope:.12,shotsHomeBonus:1,
  possessionMidfieldSlope:.33,possessionTacticBonus:4,possessionHomeOffset:0,
  passesBase:215,passesPossessionSlope:4,passAccuracy:.68,
  tacklesPerPlayer:1.45,goalConversionScale:1,
  onTargetBase:.30,onTargetFinishingSlope:.003,assistProbability:.72
 });
 const BOUNDS={shotsBase:[2,30],shotsAttackSlope:[0,.6],shotsHomeBonus:[-3,5],
  possessionMidfieldSlope:[0,1],possessionTacticBonus:[0,10],possessionHomeOffset:[-10,10],
  passesBase:[20,700],passesPossessionSlope:[0,14],passAccuracy:[.2,.99],
  tacklesPerPlayer:[.1,8],goalConversionScale:[.15,3],
  onTargetBase:[.1,.8],onTargetFinishingSlope:[0,.009],assistProbability:[0,1]};
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,Number(v)||0));
 const n=(v)=>Number.isFinite(Number(v))?Number(v):0;
 const hash=(s)=>{let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0};
 function randomizer(seed){let a=hash(seed)||1;return()=>{a=(a+0x6d2b79f5)|0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296}}
 function poisson(next,mu){const limit=Math.exp(-Math.max(0,Math.min(25,mu)));let v=1,k=0;do{k++;v*=next()}while(v>limit&&k<200);return k-1}
 function binomial(next,trials,p){let successes=0;for(let i=0;i<trials;i++)if(next()<p)successes++;return successes}
 function choice(next,arr,score){if(!arr.length)return null;const weights=arr.map(p=>Math.max(.01,n(score(p)))),total=weights.reduce((a,b)=>a+b,0);let x=next()*total;for(let i=0;i<arr.length;i++){x-=weights[i];if(x<=0)return arr[i]}return arr.at(-1)}
 function stat(p,k,alt=50){return Number.isFinite(Number(p?.detail?.[k]))?n(p.detail[k]):Number.isFinite(Number(p?.main?.[k]))?n(p.main[k]):alt}
 function strength(p){const m=p.main||{};switch(p.pos){
  case 'GK':return .3*stat(p,'reflexes')+.25*stat(p,'positioning')+.2*stat(p,'handling')+.15*stat(p,'diving')+.1*stat(p,'kicking');
  case 'DEF':return .51*n(m.tackling)+.17*n(m.sprintSpeed)+.17*stat(p,'strength')+.15*stat(p,'positioning');
  case 'MID':return .33*n(m.shortPassing)+.29*n(m.vision)+.23*n(m.firstTouch)+.15*stat(p,'decisionMaking');
  default:return .43*n(m.finishing)+.25*n(m.sprintSpeed)+.19*n(m.firstTouch)+.13*stat(p,'composure');}}
 function validParams(input){const values={};for(const [key,[lo,hi]] of Object.entries(BOUNDS)){
  const v=Number(input?.[key]);if(!Number.isFinite(v)||v<lo||v>hi)throw Error('Invalid calibration parameter: '+key);values[key]=v;
 }return values}
 function profile(){const p=root.FXI_CAL_PROFILE;
  if(p?.status==='calibrated'&&Number.isInteger(p.referenceMatches)&&p.referenceMatches>=8&&p.engineCommit&&p.parameters){
   return {status:'calibrated',referenceMatches:p.referenceMatches,engineCommit:p.engineCommit,parameters:validParams(p.parameters),version:p.version||'v0.7b'};
  }
  return {status:'provisional',referenceMatches:0,engineCommit:null,parameters:{...DEFAULTS},version:'v0.7b'};
 }
 function possession(home,away,P,eff=()=>1,positionStrength=strength){
  const middle=t=>{const a=t.lineup.filter(x=>x.pos==='MID');return a.length?a.reduce((s,p)=>s+positionStrength(p)*eff(p),0)/a.length:45};
  return clamp(50+P.possessionHomeOffset+(middle(home)-middle(away))*P.possessionMidfieldSlope+(home.tactic==='possession'?P.possessionTacticBonus:0)-(away.tactic==='possession'?P.possessionTacticBonus:0),29,71);
 }
 function simulate(preview,opts={}){
  if(!preview||!preview.home||!preview.away||preview.home.lineup?.length!==11||preview.away.lineup?.length!==11)throw Error('Quick Sim requires two valid starting XIs');
  const current=profile(),P=validParams(opts.parameters||current.parameters),next=randomizer(opts.seed||preview.seed||'FXI'),tackleNext=randomizer(String(opts.seed||preview.seed||'FXI')+':tackle-ledger-v1'),teams=[preview.home,preview.away];
  const usePokemon=opts.positionEffectiveness==='v2';
  const usePosition=opts.positionEffectiveness==='v1'||usePokemon;
  const pokemonModel=usePokemon?(typeof module!=='undefined'&&module.exports?require('./position-effectiveness.js'):root.PFC_POSITION_EFFECTIVENESS):null;
  if(usePokemon&&!pokemonModel?.preciseFit)throw Error('PSE v2 requires Pokémon positional model');
  const eff=p=>usePosition?clamp(p?.positionEfficiency??1,usePokemon ? .70 : .88,1):1;
  if(usePokemon&&teams.some(t=>t.lineup.some(p=>!p.pokemonStats||!p.exactPosition||!Number.isFinite(Number(p.positionFit))||!Number.isFinite(Number(p.positionEfficiency)))))throw Error('PSE v2 requires effective Pokémon stats and precise slot ratings for every player');
  const positionStrength=p=>usePokemon&&p?.pokemonStats?Number(p.positionFit??pokemonModel.preciseFit(p.pokemonStats,p.exactPosition||p.pos)):strength(p);
  const skill=(p,key)=>{
   if(!usePokemon||!p?.pokemonStats)return n(p.main?.[key])*eff(p);
   const stats=p.pokemonStats;
   const ability=key==='finishing'?pokemonModel.finishingIndex(stats):
    key==='tackling'?pokemonModel.preciseFit(stats,'CB'):
    pokemonModel.preciseFit(stats,'CAM');
   return ability*eff(p);
  };
  const perSide=teams.map(t=>({attack:(()=>{let a=t.lineup.filter(p=>p.pos==='FWD');return a.reduce((s,p)=>s+positionStrength(p)*eff(p),0)/Math.max(a.length,1)})(),
   defense:(()=>{let a=t.lineup.filter(p=>p.pos==='DEF');return a.reduce((s,p)=>s+positionStrength(p)*eff(p),0)/Math.max(a.length,1)})(),
   gk:(()=>{const p=t.lineup.find(p=>p.pos==='GK')||t.lineup[0];return positionStrength(p)*eff(p)})()}));
  const possHome=possession(teams[0],teams[1],P,eff,positionStrength),poss=[possHome,100-possHome];
  const box=Object.fromEntries(teams.flatMap(t=>t.lineup.map(p=>[p.id,{goals:0,assists:0,saves:0,shots:0,shotsOnTarget:0,tackleAttempts:0,tackles:0,minutes:90}])));
  const stats=teams.map(()=>({shots:0,shotsOnTarget:0,goals:0,saves:0,passes:0,completedPasses:0,tackleAttempts:0,tackles:0,possession:0})),events=[];
  const score=[0,0];
  for(let minute=0;minute<90;minute++){
   for(let side=0;side<2;side++){
    const attackers=teams[side].lineup.filter(p=>p.pos!=='GK'),challengers=teams[side].lineup.filter(p=>p.pos!=='GK');
    const team=teams[side],atk=perSide[side],opp=perSide[1-side],t=stats[side];
    const tactics=team.tactic==='press'?1.4:team.tactic==='possession'?.8:0;
    const atkStrength=atk.attack+tactics+(side===0?2.5:0);
    const trailing=score[side]<score[1-side]?1.08:score[side]>score[1-side]?.93:1;
    const shots=poisson(next,clamp((P.shotsBase+(atkStrength-opp.defense)*P.shotsAttackSlope+(side===0?P.shotsHomeBonus:0))*trailing/90,.001,.95));
    for(let k=0;k<shots;k++){
     const shooter=choice(next,attackers,p=>p.pos==='FWD'?skill(p,'finishing')*2:p.pos==='MID'?skill(p,'finishing'):Math.max(2,skill(p,'finishing')*.14));if(!shooter)continue;
     t.shots++;box[shooter.id].shots++;
     if(next()>=clamp(P.onTargetBase+P.onTargetFinishingSlope*skill(shooter,'finishing'),.1,.85))continue;
     t.shotsOnTarget++;box[shooter.id].shotsOnTarget++;
     const baseQuality=clamp(.09+.0019*(atkStrength-opp.defense)+next()*.07,.025,.31);
     const goalChance=clamp((baseQuality/.60+.001*(skill(shooter,'finishing')-opp.gk))*P.goalConversionScale,.025,.85);
     if(next()<goalChance){t.goals++;score[side]++;box[shooter.id].goals++;
      const helper=next()<P.assistProbability?choice(next,attackers.filter(p=>p.id!==shooter.id),p=>skill(p,'shortPassing')+skill(p,'vision')):null;
      if(helper)box[helper.id].assists++;
      const when=minute+next();
      events.push({minute:when,minuteLabel:String(Math.floor(when)+1),type:'goal',team:team.id,player:shooter.id,assist:helper?.id||null,origin:'quick-sim'});
     }else{stats[1-side].saves++;const keeper=teams[1-side].lineup.find(p=>p.pos==='GK');if(keeper){box[keeper.id].saves++;
      // This was a real simulated save, not a chance inferred from final stats.
      // Timestamp it within the simulation minute without extra RNG calls.
      events.push({minute:minute+.5,minuteLabel:String(minute+1),type:'save',team:teams[1-side].id,player:keeper.id,shooter:shooter.id,origin:'quick-sim'});
     }
     }
    }
    const passed=poisson(next,Math.max(.05,(P.passesBase+P.passesPossessionSlope*poss[side])/90));t.passes+=passed;t.completedPasses+=binomial(next,passed,P.passAccuracy);
    for(const player of challengers){
     // FWD, MID and DEF can all challenge, as in TM's real event ledger.
     const expectedWins=Math.max(0,P.tacklesPerPlayer/90*(.5+Math.max(0,skill(player,'tackling'))/130));
     // Keep the ORIGINAL Quick Sim RNG calls for defenders and midfielders,
     // so the same seed retains its pre-alignment goals/pass/shots outcomes.
     // Failed attempts and extra forward challenges use a separate seed.
     const legacyRole=player.pos==='DEF'||player.pos==='MID';
     const won=poisson(legacyRole?next:tackleNext,expectedWins);
     const attempts=won+poisson(tackleNext,expectedWins*(1-TACKLE_WIN_RATE)/TACKLE_WIN_RATE);
     t.tackleAttempts+=attempts;t.tackles+=won;
     box[player.id].tackleAttempts+=attempts;box[player.id].tackles+=won;
    }
   }
  }
  stats[0].possession=Math.round(poss[0]*10)/10;stats[1].possession=Math.round((100-stats[0].possession)*10)/10;
  events.sort((a,b)=>a.minute-b.minute);
  for(let side=0;side<2;side++){
   if(stats[side].goals!==score[side])throw Error('Quick Sim score differs from goal events');
   if(events.filter(e=>e.type==='goal'&&String(e.team)===String(teams[side].id)).length!==score[side])throw Error('Quick Sim goal ledger invalid');
   if(stats[side].completedPasses>stats[side].passes)throw Error('Invalid completed pass count');
   if(stats[side].tackles>stats[side].tackleAttempts)throw Error('Won tackles exceed attempts');
  }
  return {home:teams[0].id,away:teams[1].id,score,stats,events,box,
   origin:'quick-sim',...(usePosition?{positionEffectiveness:usePokemon?'v2':'v1'}:{}),
    statsModel:opts.parameters?'calibration-evaluation':current.status+'-v0.7b',
   calibration:current.status==='calibrated'?{referenceMatches:current.referenceMatches,engineCommit:current.engineCommit}:null,
   methodology:{shotStops:'Approximate saves in Quick Sim; not directly comparable to TacticMesh shotStops.',shotsOnTarget:'Estimated; genuine TacticMesh reports this as unavailable.'}};
 }
 root.FXI_QUICK={simulate,profile,DEFAULTS,validParams,randomizer,poisson,binomial,TACKLE_WIN_RATE};
 if(typeof module!=='undefined'&&module.exports)module.exports={simulate,profile,DEFAULTS,validParams,randomizer,poisson,binomial,TACKLE_WIN_RATE};
})(typeof window!=='undefined'?window:globalThis);
