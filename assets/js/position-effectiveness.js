/* PokéFC positional suitability v1 — browser and Node, no saved-player migration.
 * Compare natural role fits, never apply a flat S-tier bonus.
 */
(function(root){'use strict';
 const WEIGHTS={
  GK:{hp:.20,defense:.30,spDefense:.30,speed:.20},
  DEF:{defense:.35,hp:.20,attack:.20,speed:.25},
  MID:{spAttack:.30,spDefense:.25,attack:.20,speed:.25},
  FWD:{attack:.35,spAttack:.20,speed:.35,hp:.10}
 };
 function role(pos){
  const p=String(pos||'').toUpperCase();
  if(p==='GK')return 'GK';
  if(['LB','RB','CB','LWB','RWB','DEF'].includes(p))return 'DEF';
  if(['ST','LW','RW','FWD'].includes(p))return 'FWD';
  return 'MID';
 }
 function fit(stats,pos){
  const w=WEIGHTS[role(pos)];
  return Math.min(100,20+.55*Object.entries(w).reduce((n,[k,v])=>n+(Number(stats?.[k])||0)*v,0));
 }
 function profile(stats,pos){
  const chosen=role(pos),byRole=Object.fromEntries(Object.keys(WEIGHTS).map(k=>[k,fit(stats,k)]));
  const bestFit=Math.max(...Object.values(byRole)),assignedFit=byRole[chosen];
  const gap=Math.max(0,bestFit-assignedFit);
  // 10 fit points below natural best = 3.5% penalty; maximum penalty 12%.
  const efficiency=Math.round(Math.max(.88,1-.0035*gap)*10000)/10000;
  return {role:chosen,fit:assignedFit,bestFit,gap,efficiency};
 }
 // Competitive v2: positional specialization based solely on Pokemon's six effective stats.
 // v1 APIs above are left untouched for historic match and test compatibility.
 const PRECISE_WEIGHTS=Object.freeze({
  GK:{hp:.20,defense:.30,spDefense:.30,speed:.20},
  CB:{defense:.45,hp:.25,spDefense:.20,attack:.10},
  FB:{speed:.40,defense:.35,hp:.15,spDefense:.10},
  WB:{speed:.40,defense:.25,spAttack:.20,attack:.15},
  CDM:{defense:.35,spDefense:.30,hp:.20,spAttack:.15},
  CM:{hp:.20,attack:.15,defense:.15,spAttack:.15,spDefense:.15,speed:.20},
  CAM:{spAttack:.40,speed:.25,attack:.20,spDefense:.15},
  WING:{speed:.40,attack:.25,spAttack:.25,hp:.10},
  ST:{attack:.45,speed:.25,spAttack:.20,hp:.10}
 });
 const COMPETITIVE_CURVE=Object.freeze([[0,1],[5,.97],[10,.92],[15,.85],[20,.78],[25,.74],[30,.70]]);
 function archetype(pos){
  const p=String(pos||'').toUpperCase();
  if(p==='GK')return 'GK';
  if(['GK','CB','FB','WB','CDM','CM','CAM','WING','ST'].includes(p))return p;
  if(p==='DEF')return 'CB';
  if(['LB','RB'].includes(p))return 'FB';
  if(['LWB','RWB','LM','RM'].includes(p))return 'WB';
  if(p==='CDM')return 'CDM';
  if(p==='CAM')return 'CAM';
  if(p==='CM'||p==='MID')return 'CM';
  if(['LW','RW'].includes(p))return 'WING';
  return 'ST';
 }
 function preciseFit(stats,pos){
  const w=PRECISE_WEIGHTS[archetype(pos)];
  return Math.min(100,20+.55*Object.entries(w).reduce((sum,[k,v])=>sum+(Number(stats?.[k])||0)*v,0));
 }
 function competitiveEfficiency(gap){
  const x=Math.max(0,Number(gap)||0);
  for(let i=1;i<COMPETITIVE_CURVE.length;i++){
   const [end,eEnd]=COMPETITIVE_CURVE[i],[start,eStart]=COMPETITIVE_CURVE[i-1];
   if(x<=end)return Math.round((eStart+(eEnd-eStart)*(x-start)/(end-start))*10000)/10000;
  }
  return .70;
 }
 function finishingIndex(stats){
  const s=stats||{};
  const atk=Number(s.attack)||0,spa=Number(s.spAttack)||0;
  const bst=['hp','attack','defense','spAttack','spDefense','speed'].reduce((sum,k)=>sum+(Number(s[k])||0),0);
  return .45*atk+.25*spa+.30*(bst/6);
 }
 function competitiveProfile(stats,pos){
  const chosen=archetype(pos);
  const byRole=Object.fromEntries(Object.keys(PRECISE_WEIGHTS).map(k=>[k,preciseFit(stats,k)]));
  const bestFit=Math.max(...Object.values(byRole)),assignedFit=byRole[chosen];
  const gap=Math.max(0,bestFit-assignedFit);
  return {version:'v2',role:chosen,fit:assignedFit,bestFit,gap,efficiency:competitiveEfficiency(gap),
   finishingIndex:finishingIndex(stats)};
 }
 const api={version:'v2',weights:WEIGHTS,role,fit,profile,PRECISE_WEIGHTS,COMPETITIVE_CURVE,archetype,preciseFit,competitiveEfficiency,finishingIndex,competitiveProfile};
 root.PFC_POSITION_EFFECTIVENESS=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
