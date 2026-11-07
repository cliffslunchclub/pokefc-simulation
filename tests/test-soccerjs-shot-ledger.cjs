'use strict';
// Official on-target shot and save events must survive the Soccer-JS bridge.
// No synthetic set pieces, fouls, or penalty kicks are introduced by Watch.
const assert=require('node:assert/strict');
const {snapshot,scoreAt}=require('../watch/soccerjs/watch-bridge.js');
const {motionFrame}=require('../watch/soccerjs/phase10-motion.cjs');
const makeTeam=(id)=>({id,name:'Club '+id,lineup:Array.from({length:11},(_,i)=>({
 id:id+'-'+i,name:'Pokémon '+id+'-'+i,pos:i===0?'GK':i>=8?'FWD':'MID',speciesId:i+1
}))});
const preview={home:makeTeam('h'),away:makeTeam('a')};
const players=[...preview.home.lineup,...preview.away.lineup];
const box=Object.fromEntries(players.map(p=>[p.id,{
 goals:0,assists:0,saves:0,shots:0,shotsOnTarget:0,tackleAttempts:0,tackles:0,minutes:90
}]));
box['h-8'].shots=3;box['h-8'].shotsOnTarget=2;box['h-8'].goals=1;
box['a-0'].saves=1;
const stats=[
 {shots:3,shotsOnTarget:2,goals:1,saves:0,passes:400,completedPasses:320,possession:58,tackles:12,tackleAttempts:22},
 {shots:0,shotsOnTarget:0,goals:0,saves:1,passes:300,completedPasses:220,possession:42,tackles:9,tackleAttempts:18}
];
const result={origin:'quick-sim',home:'h',away:'a',score:[1,0],stats,box,
 events:[
  {minute:15.5,type:'save',team:'a',player:'a-0',shooter:'h-8',origin:'quick-sim'},
  {minute:31.2,type:'goal',team:'h',player:'h-8',assist:null,origin:'quick-sim'}
 ]};
const source=JSON.stringify(result);
const f=snapshot(preview,result);
assert.equal(f.events.length,2,'Real goalkeeper save must not be discarded');
assert.deepEqual(f.events.map(e=>e.type),['save','goal']);
assert.equal(f.events[0].shooter,'h-8');
assert.equal(f.box['h-8'].shotsOnTarget,2,'Per-player shots on target survive viewer export');
assert.equal(f.stats[0].shotsOnTarget,2);
assert.deepEqual(scoreAt(f,15.5),[0,0],'Goalkeeper save never increases score');
assert.deepEqual(scoreAt(f,32),[1,0]);
assert.equal(JSON.stringify(result),source,'Replay must not change official Quick Sim result');
const shot=motionFrame(f,31.3,{width:105,height:68});
assert.equal(shot.action,'official-goal');
assert(!f.events.some(e=>['corner','free-kick','penalty'].includes(e.type)),
 'Do not claim unmodeled set pieces happened');
const invalid=JSON.parse(source);invalid.box['h-8'].shotsOnTarget=3;
assert.throws(()=>snapshot(preview,invalid),/shots on target|shots-on-target/);
console.log('PASS 2.5D bridge: original SOT box, saved-shot timeline, goal-only score and immutable result');
