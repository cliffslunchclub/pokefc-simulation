'use strict';
// Public PokeAPI sprites are loaded directly; no local /pokemon/ files are
// distributed by the allowlisted SiteGround 2.5D runtime build.
// Avoid a predictable 404 for every player at kickoff.
const URLROOT='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/';
function sources(id){
 const dex=Number(id);
 if(!Number.isInteger(dex)||dex<1||dex>1025)return [];
 const preferred=dex<=649
  ? URLROOT+'versions/generation-v/black-white/'+dex+'.png'
  : URLROOT+dex+'.png';
 return [...new Set([preferred,URLROOT+dex+'.png'])];
}
function oneImage(id,create=()=>new Image()){
 const urls=sources(id);let index=0;
 return new Promise(resolve=>{
  function next(){
   if(index===urls.length)return resolve(null);
   const image=create();image.onload=()=>image.naturalWidth?resolve(image):next();
   image.onerror=next;image.src=urls[index++];
  }
  next();
 });
}
module.exports={oneImage,sources};
