'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),win={};
const ctx=vm.createContext({window:win,console});
for(const file of ['assets/js/quick-sim.js','challenge/match-report.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
const XI=(prefix)=>Array.from({length:11},(_,i)=>({
 id:prefix+i,name:prefix==='h'?'Home Pokémon '+i:'Opponent '+i,
 pos:i===0?'GK':i<=4?'DEF':i<=7?'MID':'FWD',
 main:{finishing:72+i,sprintSpeed:80,firstTouch:74,vision:73,shortPassing:76,tackling:71},
 detail:{reflexes:75,handling:73,positioning:72,diving:74,kicking:71,
  strength:73,composure:73,decisionMaking:70}
}));
const fixture={home:{id:'home',tactic:'balanced',lineup:XI('h')},
 away:{id:'away',tactic:'balanced',lineup:XI('a')},seed:'record-player-shots'};
const result=win.FXI_QUICK.simulate(fixture,{seed:'record-player-shots'});
assert(Array.isArray(result.stats)&&result.stats.length===2);
assert(result.box);
for(let side=0;side<2;side++){
 const lineup=side===0?fixture.home.lineup:fixture.away.lineup;
 const recorded=lineup.map(p=>result.box[p.id]?.shotsOnTarget);
 assert(recorded.every(n=>Number.isInteger(n)&&n>=0),'Every player gets explicit SOG count, including zero');
 assert.equal(recorded.reduce((a,b)=>a+b,0),result.stats[side].shotsOnTarget,'Player SOG reconcile with the actual engine side total');
}
const report=win.PFC_MATCH_REPORT.fromResult(result,fixture);
assert.equal(report.playerShotsOnTarget.length,22,'11 individual shot records per team');
assert.equal(report.playerTackles.length,22,'Each XI includes actual player tackle wins and attempts');
for(let side=0;side<2;side++){
 const tackles=report.playerTackles.filter(p=>p.side===side);
 assert.equal(tackles.reduce((n,p)=>n+p.won,0),result.stats[side].tackles,
  'Individual tackle wins reconcile with actual Quick Sim team totals');
 assert.equal(tackles.reduce((n,p)=>n+p.attempts,0),result.stats[side].tackleAttempts,
  'Individual tackle attempts reconcile with actual Quick Sim team totals');
}

assert.equal(report.version,3);
assert.equal(report.timeline.filter(e=>e.type==='save').length,result.events.filter(e=>e.type==='save').length,'Saved shot events match Quick Sim ledger');
assert.equal(result.events.filter(e=>e.type==='save').length,result.stats.reduce((n,s)=>n+s.saves,0),'Every Quick Sim keeper save has a corresponding real recorded event');
for(let side=0;side<2;side++){
 const players=report.playerShotsOnTarget.filter(x=>x.side===side);
 assert.equal(players.length,11);
 assert.equal(players.reduce((n,p)=>n+p.count,0),result.stats[side].shotsOnTarget,'Saved report reconciles shots');
}
const legacy=win.PFC_MATCH_REPORT.fromResult({score:[0,0],stats:[{shotsOnTarget:5},{shotsOnTarget:3}]},fixture);
assert.equal(legacy.playerShotsOnTarget.length,0,'No per-Pokémon shots are invented from team totals');
assert.equal(legacy.playerTackles.length,0,'Legacy without player box never invents tackles');

console.log('PASS real Quick Sim player shots on goal: player box -> saved report, sum matches team engine totals, legacy unavailable');
