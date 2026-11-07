'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const win={};vm.runInNewContext(fs.readFileSync(path.join(root,'challenge/item-optimizer.js'),'utf8'),{window:win});
const optimize=win.PFC_CHALLENGE_ITEM_OPTIMIZER.optimize;
assert.equal(typeof optimize,'function');
const pokemon=[{id:1},{id:2},{id:3}],roster=pokemon.map((p,i)=>({pokemon:p,position:['ST','MID','GK'][i]}));
const catalog=[['Attack',100],['Defense',100],['Long Shot',200],['Mega Form',200],['Other Mega',200]];
const increments={
 Attack:[5,1,1],Defense:[0,1,9],'Long Shot':[15,3,0],
 'Mega Form':[25,1,1],'Other Mega':[3,14,1]
};
const rate=(p,pos,item)=>50+(item?increments[item][p.id-1]:0);
const canEquip=(p,item)=>item!=='Mega Form'||p.id===1;
const isTransformation=(p,item)=>item.includes('Mega');
const params={roster,items:catalog,budget:400,rate,canEquip,isTransformation};
const result=optimize(params);
function bruteForce(){
 let best=-Infinity,bestSet=null;
 const assignments=Array(roster.length).fill(null);
 function visit(i,cost,used,mega){
  if(i===roster.length){
   const value=assignments.reduce((n,item,j)=>n+(item?increments[item][j]:0),0);
   if(value>best){best=value;bestSet=assignments.slice()}
   return;
  }
  for(const item of [null,...catalog.map(x=>x[0])]){
   if(item&&(!canEquip(pokemon[i],item)||used.has(item)||cost+catalog.find(x=>x[0]===item)[1]>400))continue;
   const megaNext=mega+Number(Boolean(item&&isTransformation(pokemon[i],item)));
   if(megaNext>1)continue;
   assignments[i]=item;
   if(item)used.add(item);
   visit(i+1,cost+(item?catalog.find(x=>x[0]===item)[1]:0),used,megaNext);
   if(item)used.delete(item);
  }
 }
 visit(0,0,new Set(),0);
 return {best,bestSet};
}
const brute=bruteForce();
const assignedGain=result.items.reduce((sum,item,i)=>sum+(item?increments[item][i]:0),0);
assert.equal(assignedGain,brute.best,'DP matches exhaustive optimum');
assert.equal(result.score,(150+brute.best)/3);
assert(result.spent<=400);
assert.equal(new Set(result.items.filter(Boolean)).size,result.items.filter(Boolean).length,'Item uniqueness');
assert(result.items.filter(x=>x?.includes('Mega')).length<=1,'One transformation');
const empty=optimize({...params,budget:0});
assert(empty.items.every(x=>x===null),'No free assignment when budget zero');
assert.equal(empty.gain,0);
const n=11;
const fullRoster=Array.from({length:n},(_,i)=>({pokemon:{id:i+1},position:i===0?'GK':i>=8?'ST':'CM'}));
const fullCatalog=Array.from({length:40},(_,j)=>['Item '+j,j<20?100:j<30?200:j<36?400:700]);
const full=optimize({
 roster:fullRoster,items:fullCatalog,budget:1000,
 rate:(p,pos,name)=>50+(name?Math.max(0,(Number(name.split(' ')[1])*3+p.id*5)%42):0),
 canEquip:()=>true,isTransformation:(p,name)=>Number(name.split(' ')[1])>=36
});
assert(full.spent<=1000);
assert(new Set(full.items.filter(Boolean)).size===full.items.filter(Boolean).length);
assert(full.items.filter(x=>x&&Number(x.split(' ')[1])>=36).length<=1);
assert(full.score>=full.baseScore);
console.log('PASS exact equipment optimizer: brute-force optimum, uniqueness, ₽1000 cap, transformation cap and 11-player scale');
