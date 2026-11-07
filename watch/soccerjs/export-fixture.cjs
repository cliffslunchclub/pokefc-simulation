#!/usr/bin/env node
'use strict';
// Local only: private Quick Sim outcome -> safe, data-only Soccer-JS replay JSON.
const fs=require('node:fs'),path=require('node:path');
const quick=require('../../assets/js/quick-sim.js');
function option(name,defaultValue){
 const i=process.argv.indexOf('--'+name);
 if(i<0)return defaultValue;
 if(i===process.argv.length-1)throw Error('Missing --'+name+' value');
 return process.argv[i+1];
}
const seed=option('seed','phase10-real-fixture-2');
const output=path.resolve(option('output',path.join(__dirname,'fixture.json')));
const src=option('preview',null);
const roles=['GK','DEF','DEF','DEF','DEF','MID','MID','MID','FWD','FWD','FWD'];
const names=[
 ['Blastoise','Onix','Golem','Snorlax','Machamp','Alakazam','Raichu','Gengar','Charizard','Arcanine','Pikachu'],
 ['Venusaur','Nidoqueen','Rhydon','Lapras','Dragonite','Kadabra','Vileplume','Hypno','Ninetales','Electabuzz','Jolteon']
];
function demoTeam(side){
 const tag=side===0?'p':'c';
 return {id:side===0?'pewter':'cerulean',name:side===0?'Pewter City FC':'Cerulean City FC',tactic:'balanced',
  lineup:roles.map((pos,i)=>{
   const quality=(i*7+side*11)%20-7;
   const n=k=>Math.min(95,Math.max(45,k+quality));
   return {id:tag+(i+1),name:names[side][i],pos,
    main:{shortPassing:n(70),firstTouch:n(74),vision:n(70),sprintSpeed:n(72),
     tackling:n(68),finishing:n(73),shooting:n(75),composure:n(71)},
    detail:{positioning:n(70),strength:n(70),reflexes:n(69),handling:n(69),
     diving:n(69),kicking:n(68),decisionMaking:n(70)}};
  })};
}
const preview=src?JSON.parse(fs.readFileSync(path.resolve(src),'utf8')):
 {seed:'phase10-real-v07b',home:demoTeam(0),away:demoTeam(1)};
const ids=new Set();
for(const team of [preview.home,preview.away]){
 if(!team||!team.id||!Array.isArray(team.lineup)||team.lineup.length!==11)throw Error('Expected two starting XIs');
 for(const p of team.lineup){
  if(p.id==null||ids.has(String(p.id)))throw Error('Invalid or duplicate player ID');
  ids.add(String(p.id));
 }
}
const result=quick.simulate(preview,{seed});
const slimTeam=t=>({id:String(t.id),name:String(t.name||t.id),
 lineup:t.lineup.map(p=>({id:String(p.id),name:String(p.name||p.id),pos:String(p.pos)}))});
const official={
 schema:'pokefc-quick-sim-export/v1',source:'PokeFC private Quick Sim v0.7b',
 origin:'quick-sim',seed,exportedAs:'result data only; no private simulation source',
 competition:'league',durationMinutes:90,
 home:slimTeam(preview.home),away:slimTeam(preview.away),
 score:result.score.map(Number),
 stats:result.stats.map(st=>Object.fromEntries(
  ['shots','shotsOnTarget','goals','saves','passes','completedPasses','tackleAttempts','tackles','possession']
   .map(key=>[key,Number(st[key])]))),
 events:result.events.filter(e=>e.type==='goal').map(e=>({
  type:'goal',minute:Number(e.minute),team:String(e.team),player:String(e.player),
  assist:e.assist==null?null:String(e.assist),source:'quick-sim'})),
 box:Object.fromEntries([preview.home,preview.away].flatMap(t=>t.lineup.map(p=>[
  String(p.id),Object.fromEntries(
   ['goals','assists','saves','shots','tackleAttempts','tackles','minutes']
    .map(key=>[key,Number(result.box[p.id][key])]))
 ])))
};
for(let s=0;s<2;s++){
 const team=s===0?official.home:official.away;
 if(official.events.filter(e=>e.team===team.id).length!==official.score[s]||
    official.stats[s].goals!==official.score[s])throw Error('Official goals do not reconcile');
 if(team.lineup.reduce((n,p)=>n+official.box[p.id].shots,0)!==official.stats[s].shots)
  throw Error('Official player shots do not reconcile');
}
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(official,null,2)+'\n');
console.log('Quick Sim export '+official.score.join('-')+', '+official.events.length+
 ' official goals; seed='+seed+'; '+output);
