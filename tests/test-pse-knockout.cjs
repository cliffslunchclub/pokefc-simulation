'use strict';
const assert=require('node:assert/strict'),qs=require('../assets/js/quick-sim.js');
const KO=require('../assets/js/pse-knockout.js');
const positions=['GK','DEF','DEF','DEF','DEF','MID','MID','MID','FWD','FWD','FWD'];
const build=id=>({id,name:id+' City FC',tactic:'press',
 lineup:positions.map((pos,i)=>({id:id+'-'+i,name:id+' Pokemon '+i,pos,
 main:{finishing:67+i,shortPassing:68+i,vision:67+i,tackling:70+i,sprintSpeed:70+i},
 detail:{reflexes:67+i,handling:67+i,positioning:67+i,diving:67+i,
  composure:67+i,strength:67+i}}))});
const preview={home:build('home'),away:build('away'),seed:'KNOCKOUT'};
let resolved=0,extraMatches=0,shootouts=0,shootoutAttempts=0;
for(let i=0;i<300;i++){
 const seed='KO-TEST-'+i;
 const regular=qs.simulate(preview,{seed});
 const source=JSON.stringify(regular);
 const result=KO.resolve(preview,regular,{seed});
 assert.deepEqual(KO.resolve(preview,regular,{seed}),result,'Same seed must yield same knockout');
 assert.equal(JSON.stringify(regular),source,'Never mutate regulation');
 assert.equal(result.version,'pse-knockout-v1');
 assert(['home','away'].includes(result.winner));
 assert.equal(result.match.events.filter(e=>e.type==='goal').length,
  result.match.score[0]+result.match.score[1]);
 if(regular.score[0]!==regular.score[1]){
  assert.equal(result.decidedBy,'regulation');
  assert.equal(result.extraTime,null);assert.equal(result.shootout,null);
  assert.strictEqual(result.match,regular);
 }else{
  extraMatches++;
  assert(result.extraTime,'Tied regulation enters extra time');
  const et=result.extraTime;
  assert.equal(et.durationMinutes,30);
  assert.deepEqual(result.match.score,regular.score.map((n,k)=>n+et.score[k]));
  assert.equal(result.match.durationMinutes,120);
  assert(et.events.every(e=>e.minute>=90&&e.minute<120),'Extra-time clock must stay 90–120');
  for(let side=0;side<2;side++){
   const team=side?preview.away:preview.home,s=et.stats[side];
   assert.equal(et.events.filter(e=>e.type==='goal'&&e.team===team.id).length,s.goals);
   assert.equal(et.events.filter(e=>e.type==='shot'&&e.team===team.id).length,s.shots);
   assert.equal(s.shotsOnTarget,s.goals+et.stats[1-side].saves);
   assert.equal(team.lineup.reduce((n,p)=>n+et.box[p.id].shots,0),s.shots);
   assert.equal(team.lineup.reduce((n,p)=>n+et.box[p.id].saves,0),s.saves);
  }
  if(result.match.score[0]===result.match.score[1]){
   shootouts++;assert.equal(result.decidedBy,'shootout');
   const p=result.shootout;assert.equal(p.version,'pse-shootout-v1');
   assert.equal(p.winner,result.winner);
   assert.notEqual(p.home,p.away);
   assert.equal(p.home,p.attempts.filter(e=>e.side==='home'&&e.scored).length);
   assert.equal(p.away,p.attempts.filter(e=>e.side==='away'&&e.scored).length);
   assert(p.attempts.length>=6);
   assert(p.attempts.every(e=>e.phase==='shootout'&&e.kickerId&&e.keeperId&&
    ['goal','saved','off-target'].includes(e.outcome)&&e.scored===(e.outcome==='goal')));
   assert(!result.match.events.some(e=>e.phase==='shootout'),'Shootout never adds match goals');
   assert.equal(p.countsInMatchStats,false);
   shootoutAttempts+=p.attempts.length;
  }else{
   assert.equal(result.decidedBy,'extra-time');
   assert.equal(result.shootout,null);
  }
 }
 resolved++;
}
assert(extraMatches>40,'Too few tied regulation games');
assert(shootouts>5,'Too few shootouts to verify integration');
for(let i=0;i<120;i++){
 const p=KO.shootout(preview,'SUDDEN-DEATH-'+i);
 assert.deepEqual(KO.shootout(preview,'SUDDEN-DEATH-'+i),p);
 assert.notEqual(p.home,p.away,'Shootouts never use a coin toss');
 assert(p.attempts.every((e,j)=>e.id==='pse-pk-'+String(j+1).padStart(4,'0')));
}
const invalid=qs.simulate(preview,{seed:'BAD'});
assert.throws(()=>KO.resolve({...preview,home:{...preview.home,id:'fake'}},invalid),/mismatch/);
console.log('PASS shared PSE knockout:',resolved,'regulation games,',extraMatches,
 'extra times,',shootouts,'per-kick shootouts,',shootoutAttempts,'recorded attempts');
