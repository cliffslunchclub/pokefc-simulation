'use strict';
const assert=require('node:assert/strict');
const {sources,oneImage}=require('../watch/soccerjs/pokemon-load.cjs');
const cases=[1,25,649,650,1025];
for(const n of cases){
 const urls=sources(n);
 assert(urls.length>=1&&urls.length<=2);
 assert(urls.every(url=>url.startsWith('https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/')));
 assert(urls.every(url=>!url.startsWith('./')&&!url.includes('/pokemon/bw/')),
  'Every sprite URL must be distributable with the current embedded viewer');
}
assert(sources(0).length===0);
assert(sources(1026).length===0);
assert(sources('not-a-number').length===0);
assert(sources(25)[0].includes('/versions/generation-v/black-white/25.png'));
assert(sources(650)[0].endsWith('/650.png'));
const fired=[];
function makeImage(){
 let onload=null,onerror=null;
 const o={
  naturalWidth:0,
  get onload(){return onload},set onload(v){onload=v},
  get onerror(){return onerror},set onerror(v){onerror=v},
  set src(value){fired.push(value);this.naturalWidth=fired.length===1?0:80;
    if(fired.length===1)queueMicrotask(()=>onerror?.());
    else queueMicrotask(()=>onload?.());}
 };
 return o;
}
(async()=>{
 const image=await oneImage(25,makeImage);
 assert(image?.naturalWidth===80);
 assert.equal(fired.length,2);
 assert(fired[0].endsWith('/generation-v/black-white/25.png'));
 assert(fired[1].endsWith('/pokemon/25.png'));
 const noImage=await oneImage(99999,makeImage);
 assert.equal(noImage,null);
 console.log('PASS Soccer-JS Pokémon loader: no unshipped local paths; verified Gen I–IX URLs and image fallback');
})().catch(error=>{console.error(error);process.exitCode=1});
