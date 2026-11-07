'use strict';
/* Visual attacking-third shape and official defender/midfielder scorers.
 * No animation can change the PSE ledger or create an additional goal. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {motionFrame,base}=require('./phase10-motion.cjs');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixture.json'),'utf8'));
const pristine=JSON.stringify(fixture),field={width:106,height:68};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const attackingProgress=(p,side)=>(side===0?p.x:field.width-p.x)/field.width;
let waves=0,midShift=0,backShift=0,cover=0,opponentStill=0;
for(let second=0;second<12*60;second+=.25){
 const frame=motionFrame(fixture,second/60,field);
 if(frame.action!=='illustrative-carry'||frame.ownerIndex<0)continue;
 const side=Math.floor(frame.ownerIndex/11);
 if(attackingProgress(frame.ball,side)<.665)continue;
 const mid=frame.actors[side*11+6],wide=frame.actors[side*11+1],
  cb1=frame.actors[side*11+2],cb2=frame.actors[side*11+3];
 const midAhead=attackingProgress(mid,side)-attackingProgress(base(side,6,field),side);
 const wideAhead=attackingProgress(wide,side)-attackingProgress(base(side,1,field),side);
 if(midAhead>.09){waves++;midShift+=midAhead;}
 if(wideAhead>.045)backShift++;
 // A minimum of one central back must stay behind the attacking half.
 if(Math.min(attackingProgress(cb1,side),attackingProgress(cb2,side))<.5)cover++;
 const enemy=1-side;
 if(attackingProgress(frame.actors[enemy*11+6],enemy)<.54)opponentStill++;
 assert(attackingProgress(frame.actors[side*11],side)<.12,
  'Goalkeeper joined attack instead of staying behind the defensive line');
}
assert(waves>35,'Midfield never pushes toward the final-third attack');
assert(backShift>25,'Wide defenders never overlap the attacking side');
assert(cover>30,'No covering central defender remains behind advancing runs');
assert(opponentStill>35,'Defending team advances as though it owns the attack');
assert(midShift/waves>.10,'Midfield advance is too small to be visible');

// Gradual team-shape transitions across every short possession cycle.
// Huge instantaneous jumps would reintroduce the old ball/camera whipping.
let maxTransition=0;
for(let cycle=1;cycle<Math.floor(90*60/8);cycle++){
 const a=motionFrame(fixture,(cycle*8-.00006)/60,field);
 const b=motionFrame(fixture,(cycle*8+.00006)/60,field);
 maxTransition=Math.max(maxTransition,dist(a.ball,b.ball),
  ...a.actors.map((p,i)=>dist(p,b.actors[i])));
}
assert(maxTransition<.05,'A supporting player teleported at a possession boundary '+maxTransition);

// Manufacture a legitimate-looking fixture with scorers in defense/midfield.
// PSE—not Watch—supplies their identities, so test both home and away roles.
const synthetic=JSON.parse(pristine);
const h=synthetic.events.find(e=>e.type==='goal'&&e.team===synthetic.home.id);
const a=synthetic.events.find(e=>e.type==='goal'&&e.team===synthetic.away.id);
assert(h&&a,'Fixture must contain home and away goals');
h.player=synthetic.home.lineup[2].id; // center back
a.player=synthetic.away.lineup[6].id; // midfielder
const originalSynthetic=JSON.stringify(synthetic);
for(const goal of [h,a]){
 const side=goal.team===synthetic.home.id?0:1;
 const team=side===0?synthetic.home:synthetic.away;
 const idx=team.lineup.findIndex(p=>p.id===goal.player);
 const entry=motionFrame(synthetic,goal.minute-.7000001,field);
 const start=motionFrame(synthetic,goal.minute-.7,field);
 assert(dist(entry.actors[side*11+idx],start.actors[side*11+idx])<.10,
  'Official non-forward scorer teleported at goal buildup entrance');
 const build=motionFrame(synthetic,goal.minute-.13,field);
 assert(attackingProgress(build.actors[side*11+idx],side)>.67,
  'Scoring defender/midfielder did not arrive in attacking third');
 const goalFrame=motionFrame(synthetic,goal.minute,field);
 assert.equal(goalFrame.action,'official-goal');
 assert.equal(goalFrame.officialEvent?.player,goal.player,
  'Defender/midfielder scoring credit changed');
 assert.equal(goalFrame.actors[side*11+idx].frame,3,'Official scorer not seen shooting');
 assert(attackingProgress(goalFrame.ball,side)>1,'Official goal did not enter net');
 for(const teammate of goalFrame.actors)
  assert(Number.isFinite(teammate.x)&&Number.isFinite(teammate.y));
}
assert.equal(JSON.stringify(synthetic),originalSynthetic,'Fixture altered by goal visual');
assert.equal(JSON.stringify(fixture),pristine,'Authoritative fixture changed');
console.log('PASS attacking-third supporting runs: '+waves+' midfield waves, '+
 backShift+' overlapping defender frames, '+cover+' cover frames, '+
 opponentStill+' defensive-shape frames, '+maxTransition.toFixed(5)+
 'm max boundary motion, official CB and midfielder goals');
