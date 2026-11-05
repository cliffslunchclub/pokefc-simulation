'use strict';
const {species}=require('./pokemon-dex.cjs');
const {oneImage}=require('./pokemon-load.cjs');
const {colors,number}=require('./pokemon-colors.cjs');
function prepare(fixture){
 const teams=[fixture.home,fixture.away],colorsByTeam=colors(...teams);
 if(teams.some(t=>t?.lineup?.length!==11))throw Error('Pokémon visuals require 22 players');
 const entries=teams.flatMap((t,side)=>t.lineup.map((p,index)=>({
  id:String(p.id),name:String(p.name||p.species||p.id),side,index,
  color:colorsByTeam[side],number:number(p,index),role:p.pos||'MID',
  dexId:species(p),image:null
 })));
 const images=new Map();
 for(const e of entries)if(e.dexId&&!images.has(e.dexId))images.set(e.dexId,oneImage(e.dexId));
 return {entries,colors:colorsByTeam,load:async()=>{
  await Promise.all(images.values());
  for(const e of entries)e.image=e.dexId?await images.get(e.dexId):null;
  return entries;
 }};
}
module.exports={prepare};
