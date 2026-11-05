'use strict';
const URLROOT='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/';
function sources(id){
 const local=id<=649?'./pokemon/bw/'+id+'.png':'./pokemon/default/'+id+'.png';
 return [...new Set([local,id<=649?URLROOT+'versions/generation-v/black-white/'+id+'.png':URLROOT+id+'.png',URLROOT+id+'.png'])];
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
