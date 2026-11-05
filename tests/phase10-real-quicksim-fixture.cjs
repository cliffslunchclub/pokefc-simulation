'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const file='fixtures/phase10-real-quicksim-v07b.json';
const match=JSON.parse(fs.readFileSync(file,'utf8'));
assert.equal(match.schema,'pokefc-quick-sim-export/v1');
assert.equal(match.origin,'quick-sim');
assert.equal(match.durationMinutes,90);
assert.equal(match.score.length,2);
assert.equal(match.home.lineup.length,11);
assert.equal(match.away.lineup.length,11);
assert.equal(match.events.length,match.score[0]+match.score[1]);
const teams=[match.home,match.away];
for(let side=0;side<2;side++){
 const team=teams[side],score=match.score[side],stats=match.stats[side];
 assert.equal(match.events.filter(e=>e.team===team.id&&e.type==='goal').length,score);
 assert.equal(stats.goals,score);
 assert.equal(team.lineup.reduce((s,p)=>s+match.box[p.id].shots,0),stats.shots);
 assert.equal(team.lineup.reduce((s,p)=>s+match.box[p.id].goals,0),score);
 assert(stats.shotsOnTarget>=score);
 assert(stats.shots>=stats.shotsOnTarget);
}
for(const event of match.events){
 assert.equal(event.source,'quick-sim');
 assert(event.minute>=0&&event.minute<90);
 const t=teams.find(team=>team.id===event.team);
 assert(t&&t.lineup.some(p=>p.id===event.player));
 if(event.assist!==null)assert(t.lineup.some(p=>p.id===event.assist));
}
assert.equal(match.score.join('-'),'2-1');
assert.deepEqual(match.events.map(e=>Math.floor(e.minute)+1),[54,69,80]);
assert(!Object.hasOwn(match,'parameters'),'Private simulator parameters must not leak');
const viewer=fs.readFileSync('viewer/phase10-real/viewer-entry.cjs','utf8');
for(const token of ['sim.renderAll(ctx)','await sim.start()','ImageDB.get(','fixture.json','scoreAt(','sim.scoreA=s[0]'])assert(viewer.includes(token),'Missing real-render contract '+token);
assert(!viewer.includes('sim.updateAll('),'Do not trigger independent Soccer-JS outcomes');
console.log('PASS genuine Quick Sim 2-1 match: 22 players, 30 official shots, 3 scored goals; no private source; renderer remains outcome-independent');