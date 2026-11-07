'use strict';
// Locked Challenge → native 2.5D Quick Sim Watch → Record a single official result.
// Uses real Challenge, Quick Sim, reports, leaderboard and Play controller;
// only the graphical iframe protocol is mocked (public browser CI tests graphics).
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const challengePage=fs.readFileSync(root+'/challenge/index.html','utf8');
assert.match(challengePage,/\.\.\/play\/\?challenge=1&amp;watch=soccerjs/,'Challenge Watch launches 2.5D route');
const ids=[25,6,3,9,149,94,131,143,68,135,196];
const history=['Lorelei','Bruno','Agatha','Lance','Blue'].map((boss,i)=>({
 boss,round:i+1,score:[2,1],shots:[12,7],passes:[360,275],outcome:'Victory'
}));
const challenge={version:1,phase:'locked',pool:9,legends:true,
 formation:'4-3-3',tactic:'press',roster:ids.slice(),items:Array(11).fill(null),
 selected:0,rng:191121,locked:{roster:ids.slice(),items:Array(11).fill(null),
 formation:'4-3-3',tactic:'press',score:85.7},round:5,history,result:null};
const store=new Map([['pokefc-challenge-alpha-1',JSON.stringify(challenge)]]);
const els=new Map(),sessions=[];let destination=null;
const drawing={clearRect(){},fillRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){},fillText(){},
 set fillStyle(v){},set strokeStyle(v){},set lineWidth(v){},set font(v){},set textAlign(v){}};
function el(id){
 if(!els.has(id)){
  const classes=new Set();
  els.set(id,{value:id==='region'?'all':id==='watchSpeed'?'4':id==='tactic'?'press':'',
   innerHTML:'',textContent:'',disabled:false,hidden:id==='soccerWatchActions',
   events:{},classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)},
   addEventListener(type,fn){this.events[type]=fn},
   getContext(){return drawing},appendChild(){}});
 }
 return els.get(id);
}
let active=false;
const bridge={
 isActive:()=>active,
 mountInline(o){
  assert.equal(active,false);
  assert.equal(o.autoRecordOnSimToEnd,true,'Sim to End auto-record enabled for Challenges');
  assert.equal(o.preview.home.tactic,'press');
  assert.equal(o.preview.challengeRound,5);
  assert.equal(o.preview.opponent.leader,'Red');
  assert(o.preview.home.lineup.every((p,i)=>p.speciesId===ids[i]));
  const source=JSON.stringify(o.result);
  active=true;let closed=false,recorded=false,ended=false;
  const session={
   play(){},pause(){},setSpeed(){},setProjection(){},setCamera(){},
   simToEnd(){ended=true;o.onProgress({minute:90,score:o.result.score,finished:true,handedOff:true});
    this.record();return true},
   record(){
    if(recorded||closed||!ended)return false;
    recorded=true;o.onRecord({result:o.result,handoff:'watch-to-quick-sim'});
    assert.equal(JSON.stringify(o.result),source,'Official outcome must remain immutable');
    return true;
   },
   destroy(){closed=true;active=false},
   cancel(){if(recorded||closed)return false;this.destroy();o.onCancel();return true}
  };
  sessions.push(session);o.onReady(session);return session;
 }
};
const document={
 getElementById:el,
 querySelector(selector){assert.equal(selector,'.field-shell');return el('field-shell')},
 createElement(tag){assert.equal(tag,'script');return {src:'',onload:null,onerror:null}},
 head:{append(s){assert.match(s.src,/watch-bridge\.js(?:\?v=\d+)?$/);s.onload()}}
};
const context=vm.createContext({
 window:{location:{search:'?challenge=1&watch=soccerjs',assign(url){destination=url}},addEventListener(){},FXI_PHASE10_WATCH:bridge},
 document,URLSearchParams,console,Date,Math,
 localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)}
});
for(const file of ['assets/js/national-species.js','assets/js/calibration-profile.js','assets/js/position-effectiveness.js','assets/js/quick-sim.js',
 'play/opponents.js','challenge/special-items-data.js','challenge/leaderboard.js','challenge/match-report.js'])
 vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file,timeout:20000});
vm.runInContext(fs.readFileSync(root+'/play/play.js','utf8'),context,{filename:'play/play.js',timeout:20000});
assert.equal(el('watch').disabled,false);
const before=store.get('pokefc-challenge-alpha-1');
el('watch').events.click();
assert.equal(sessions.length,1);
assert.equal(store.get('pokefc-challenge-alpha-1'),before,'Entering Watch must never write Challenge');
sessions[0].cancel();
assert.equal(store.get('pokefc-challenge-alpha-1'),before,'Cancel leaves locked Challenge unchanged');
el('watch').events.click();
assert.equal(sessions.length,2);
sessions[1].simToEnd();
assert.match(el('matchResult').innerHTML,/SHOTS ON TARGET/,'Final official shot stats visible automatically');
assert.equal(el('soccerRecord').disabled,true,'Sim to End requires no second Record click');
assert.equal(destination,'../challenge/','Auto-return to Challenge result dialog');
const final=JSON.parse(store.get('pokefc-challenge-alpha-1'));
assert.equal(final.phase,'finished','Red final boss ends gauntlet');
assert.equal(final.result.boss,'Red');
assert.equal(final.result.origin,'quick-sim');
assert.equal(final.result.report.status,'complete');
assert.equal(final.history.length,6);
assert.equal(final.locked.score,85.7);
assert.equal(el('matchClock').textContent,'FULL TIME');
assert.equal(el('returnChallenge').hidden,false);
const count=store.get('pokefc-challenge-alpha-1');
el('soccerRecord').events.click();
assert.equal(store.get('pokefc-challenge-alpha-1'),count,'Record again must not duplicate the boss result');
assert.equal(context.window.PFC_PLAY.getXI(),null,'Finished run cannot be replayed as locked XI');
assert.equal(context.window.PFC_CHALLENGE_LEADERBOARD.rankings('national-legends',{
 getItem:key=>store.get(key)||null}).length,1,'Leaderboard archives exactly one completed run');
console.log('PASS Challenges 2.5D: locked boss/items, cancel, no pre-save writes, full-time official result, single archive');
