/* PokeFC Challenge: exact budget-constrained item optimizer.
 * A 0/1 dynamic program over occupied Pokémon slots, spend, and the
 * single Mega/Primal transformation allowance.
 * Every catalog item is considered once (unique held-item rule).
 */
(function(root){'use strict';
 function gcd(a,b){while(b){const t=a%b;a=b;b=t}return a}
 function optimize({roster,items,budget=1000,rate,canEquip,isTransformation}){
  if(!Array.isArray(roster)||!Array.isArray(items)||typeof rate!=='function'||typeof canEquip!=='function')throw Error('Item optimizer setup is incomplete.');
  const size=roster.length;
  if(!size||size>11||!roster.every(p=>p?.pokemon&&p.position))throw Error('A complete 11-player XI is required.');
  if(!Number.isSafeInteger(budget)||budget<0)throw Error('Invalid equipment budget.');
  const base=roster.map(p=>rate(p.pokemon,p.position,null));
  if(base.some(n=>!Number.isFinite(n)))throw Error('Invalid Pokémon fit rating.');
  const baseline=base.reduce((a,b)=>a+b,0);
  const catalog=[];
  const names=new Set();
  for(const item of items){
   const name=item?.[0],cost=Number(item?.[1]);
   if(typeof name!=='string'||names.has(name)||!Number.isSafeInteger(cost)||cost<=0||cost>budget)continue;
   names.add(name);
   const choices=roster.map((p,index)=>{
    if(!canEquip(p.pokemon,name))return null;
    const gain=rate(p.pokemon,p.position,name)-base[index];
    if(!Number.isFinite(gain)||gain<=1e-9)return null;
    return {index,gain,transform:Boolean(isTransformation?.(p.pokemon,name))};
   }).filter(Boolean);
   if(choices.length)catalog.push({name,cost,choices});
  }
  let unit=budget||1;
  for(const it of catalog)unit=gcd(unit,it.cost);
  const steps=Math.floor(budget/unit),maxMask=1<<size,stride=(steps+1)*2,stateCount=maxMask*stride;
  if(stateCount>2_000_000)throw Error('Item optimization exceeds supported size.');
  const dp=new Float64Array(stateCount);dp.fill(Number.NEGATIVE_INFINITY);dp[0]=0;
  const parents=[];
  // Iterate all masks descending: assigning the current item always sets a
  // higher mask. Thus no transition can use the same item twice in one pass.
  for(const item of catalog){
   const decision=new Int8Array(stateCount);
   const costSteps=item.cost/unit;
   for(let mask=maxMask-1;mask>=0;mask--){
    const baseIndex=mask*stride;
    for(let spent=steps-costSteps;spent>=0;spent--){
     for(let mega=0;mega<=1;mega++){
      const idx=baseIndex+spent*2+mega,previous=dp[idx];
      if(previous===Number.NEGATIVE_INFINITY)continue;
      for(const option of item.choices){
       const bit=1<<option.index;
       if((mask&bit)||(mega&&option.transform))continue;
       const nextIdx=(mask|bit)*stride+(spent+costSteps)*2+mega+Number(option.transform);
       const nextScore=previous+option.gain;
       if(nextScore>dp[nextIdx]+1e-9){
        dp[nextIdx]=nextScore;
        decision[nextIdx]=option.index+1;
       }
      }
     }
    }
   }
   parents.push(decision);
  }
  let winner=0,bestGain=0,bestSpent=0;
  for(let mask=0;mask<maxMask;mask++)for(let spent=0;spent<=steps;spent++){
   for(let mega=0;mega<2;mega++){
    const idx=mask*stride+spent*2+mega,gain=dp[idx];
    if(gain>bestGain+1e-9||(Math.abs(gain-bestGain)<=1e-9&&spent<bestSpent)){
     winner=idx;bestGain=gain;bestSpent=spent;
    }
   }
  }
  const assignment=Array(size).fill(null);
  for(let i=catalog.length-1;i>=0;i--){
   const positionCode=parents[i][winner];
   if(!positionCode)continue;
   const position=positionCode-1,item=catalog[i];
   assignment[position]=item.name;
   const costSteps=item.cost/unit;
   const trans=Number(item.choices.find(p=>p.index===position)?.transform);
   const flag=winner%2,spent=Math.floor(winner/2)%(steps+1),mask=Math.floor(winner/stride);
   winner=(mask&~(1<<position))*stride+(spent-costSteps)*2+(flag-trans);
  }
  return {items:assignment,spent:bestSpent*unit,baseScore:baseline/size,
   score:(baseline+bestGain)/size,gain:bestGain/size,optimal:true,
   candidates:catalog.length};
 }
 root.PFC_CHALLENGE_ITEM_OPTIMIZER={optimize};
 if(typeof module!=='undefined'&&module.exports)module.exports={optimize};
})(typeof window!=='undefined'?window:globalThis);
