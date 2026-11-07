'use strict';
/* Award engine works only from recorded goal/assist/keeper metrics; fallback is labeled. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const win={};const ctx=vm.createContext({window:win,console});
vm.runInContext(fs.readFileSync(path.join(root,'challenge/performance.js'),'utf8'),ctx);
const model=win.PFC_CHALLENGE_PERFORMANCE;
assert(model?.matchAward&&model?.tournament);
const roster=Array.from({length:11},(_,i)=>({
 id:i+1,name:i===9?'Mega Charizard X':i===0?'Blissey':'Pokémon '+i,
 aliases:i===9?['Charizard']:[],pos:i===0?'GK':i===9?'ST':'CM',
 spriteId:i===9?10034:i+1,fit:i===9?85:60+i
}));
const enemy=Array.from({length:11},(_,i)=>({
 id:100+i,name:i===9?'Gengar':'Enemy '+i,aliases:[],pos:i===0?'GK':'ST',fit:65+i
}));
const first={
 score:[2,1],report:{goals:[
  {side:0,player:'Mega Charizard X',assist:'Pokémon 8'},
  {side:0,player:'Charizard',assist:'Pokémon 7'},
  {side:1,player:'Gengar',assist:null}
 ],stats:{saves:[3,2]},playerShotsOnTarget:[
  {side:0,player:'Mega Charizard X',count:4},{side:0,player:'Pokémon 8',count:0},
  {side:1,player:'Gengar',count:2}
 ],playerTackles:[
  {side:0,player:'Mega Charizard X',attempts:7,won:3},
  {side:0,player:'Pokémon 8',attempts:4,won:0},
  {side:1,player:'Gengar',attempts:5,won:1}
 ]}
};
const award=model.matchAward(first,roster,enemy);
assert.equal(award.name,'Mega Charizard X','Mega aliases are linked to the same player');
assert.equal(award.side,0);
assert.equal(award.id,10);
assert.equal(award.goals,2);
assert.equal(award.shotsOnGoal,4,'Match award includes the Pokémon shot count');
assert.equal(award.method,'recorded-contributions');
assert.equal(award.tacklesWon,3,'Match award carries actual recorded tackle wins');
assert.equal(award.tackleAttempts,7,'Match award carries actual recorded tackle attempts');

const withAward={...first,award};
const tie={score:[0,0],report:{goals:[],stats:{saves:[0,0]}}};
const fallback=model.matchAward(tie,roster,enemy);
assert(fallback,'Every match gets a provisional award');
assert.equal(fallback.method,'position-fit-fallback','No fake scorer created for zero-event match');
const penalties={score:[1,1],report:{goals:[{side:0,player:'Pokémon 8',assist:null}]},shootout:{
 winner:'home',home:2,away:0,attempts:[
  {round:1,side:'home',kicker:'Mega Charizard X',scored:true},
  {round:1,side:'away',kicker:'Gengar',scored:false},
  {round:2,side:'home',kicker:'Pokémon 8',scored:true}
 ]}};
const penaltyAward=model.matchAward(penalties,roster,enemy);
assert(penaltyAward);
const tournament=model.tournament([withAward,penalties],roster);
assert(tournament?.best);
assert.equal(tournament.best.name,'Mega Charizard X');
assert.equal(tournament.best.goals,2,'Shootout conversions are not regulation goals');
assert.equal(tournament.best.penalties,1,'Penalty kicks tracked separately');
assert.equal(tournament.best.appearances,2);
assert.equal(tournament.best.potm,1,'One POTM award tallied in trophy race');
assert.equal(tournament.players.length,11);
assert.equal(tournament.players[0].saves,3,'Dedicated GK receives reported team save total');
assert.equal(tournament.players[9].shotsOnGoal,4,'Mega Charizard SOG from first match');
assert.equal(tournament.players[9].shotGames,1,'Second match missing SOG is not counted as zero');
assert.equal(tournament.players[9].tacklesWon,3,'Tournament tackle wins use saved player ledger');
assert.equal(tournament.players[9].tackleAttempts,7,'Tournament tackle attempts use saved player ledger');
assert.equal(tournament.players[9].tackleGames,1,'Unknown older match tackle data is not zero coverage');
assert.equal(tournament.players[8].tacklesWon,0,'Recorded zero tackle win remains zero');
assert.equal(tournament.players[8].tackleGames,1,'Recorded zero tackle is available data');
assert.equal(tournament.players[6].tackleGames,0,'Absent player tackle data remains unavailable');

assert.equal(tournament.players[8].shotsOnGoal,0,'Recorded zero stays at zero');
assert.equal(tournament.players[8].shotGames,1,'Tracked zero still has data coverage');
assert.equal(tournament.players[6].shotGames,0,'Missing player shot stats remain unknown');
assert(tournament.players.every(p=>p.appearances===2),'Every locked XI Pokémon appears in both games');
assert.equal(tournament.method,'recorded-contributions');
console.log('PASS Challenge performance awards: Mega aliases, two-goal POTM, fallback, penalty distinction, best player and GK saves');
