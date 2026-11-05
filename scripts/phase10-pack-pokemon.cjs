'use strict';
const fs=require('node:fs'),path=require('node:path');
const {species}=require('../viewer/phase10-real/pokemon-dex.cjs');
const fixture=JSON.parse(fs.readFileSync('fixtures/phase10-real-quicksim-v07b.json','utf8'));
const ids=[...new Set([fixture.home,fixture.away].flatMap(t=>t.lineup.map(p=>species(p))))];
if(ids.length!==22||ids.some(id=>!id||id>649))throw Error('Pilot expects 22 original BW species');
const root='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/';
(async()=>{
 for(const id of ids){
  const response=await fetch(root+id+'.png');
  if(!response.ok)throw Error('Sprite '+id+' unavailable: '+response.status);
  const data=Buffer.from(await response.arrayBuffer());
  if(data.subarray(1,4).toString()!=='PNG')throw Error('Not a PNG: '+id);
  const out=path.join('dist/pokemon/bw',id+'.png');
  fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,data);
 }
 console.log('Packaged '+ids.length+' original game sprites for public visual test');
})().catch(e=>{console.error(e);process.exitCode=1});
