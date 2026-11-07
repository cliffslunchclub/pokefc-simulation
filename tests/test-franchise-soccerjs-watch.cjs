'use strict';
// Actual Franchise state machine + Quick Sim, mocked 2.5D iframe communications.
// Checks that a watched fixture advances exactly one week only after Record.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(root+'/franchise/index.html','utf8');
assert(html.includes('assets/js/soccerjs-franchise-viewer.js'),'Franchise loads Soccer-JS adapter');
assert(html.includes('../watch/soccerjs/watch-bridge.js'),'Franchise loads same-origin Watch bridge');
const store=new Map(),els=new Map();
let tactical=false,mounts=0,finished=0,highlightsOpened=0,active=null;
const pitch={classList:{add(){},remove(){}},appendChild(){}};
const canvas={parentElement:pitch,hidden:false,getContext(){return {clearRect(){}}}};
function el(id){
 if(id==='viewerMode'&&!tactical)return null;
 if(id==='tacticalPitch'&&!tactical)return null;
 if(id==='tacticalPitch')return canvas;
 if(!els.has(id))els.set(id,{
  value:id==='viewerMode'?'soccerjs':id==='viewerSpeed'?'1':id==='viewerProjection'?'orthographic':id==='viewerCamera'?'follow':'',
  hidden:id==='viewerSoccerRecord'||id==='viewerSoccerCancel',disabled:false,
  textContent:'',innerHTML:'',onchange:null,onclick:null,oninput:null,
  addEventListener(){},classList:{toggle(){},add(){},remove(){}}
 });
 return els.get(id);
}
const document={
 querySelectorAll:()=>[],
 getElementById:el,
 addEventListener(t,fn){this[t]=fn}
};
const scoreAt=(f,minute)=>f.events.filter(e=>e.type==='goal'&&e.minute<=minute)
 .reduce((score,e)=>{score[String(e.team)===String(f.home.id)?0:1]++;return score},[0,0]);
const bridge={
 isActive:()=>!!active,
 scoreAt,
 mountInline(o){
  assert(!active,'A second viewer was mounted before first was canceled');
  assert.equal(o.autoRecordOnSimToEnd,true,'Franchise handoff must automatically finalize');
  assert.equal(o.result.origin,'quick-sim');
  assert.equal(o.preview.home.lineup.length,11);
  assert.equal(o.preview.away.lineup.length,11);
  assert(o.preview.home.lineup.every(p=>Number.isInteger(p.speciesId)&&p.speciesId>0));
  assert(o.preview.away.lineup.every(p=>Number.isInteger(p.speciesId)&&p.speciesId>0));
  const before=JSON.stringify(o.result);
  const fixture={home:o.preview.home,away:o.preview.away,events:o.result.events};
  const session={
   fixture,ended:false,recorded:false,
   play(){return true},pause(){return true},
   setProjection(){return true},setCamera(){return true},setSpeed(){return true},
   seek(){return true},
   openHighlights(){highlightsOpened++;return true},
   simToEnd(){if(this.ended)return false;this.ended=true;
    o.onProgress({minute:90,score:o.result.score.slice(),finished:true,handedOff:true});
    this.record();return true},
   record(){
    if(!this.ended||this.recorded)return false;
    this.recorded=true;
    o.onRecord({result:o.result,origin:'quick-sim',handoff:'watch-to-quick-sim'});
    assert.equal(JSON.stringify(o.result),before,'Franchise viewer mutated Quick Sim result');
    finished++;
    return true;
   },
   cancel(){this.destroy();o.onCancel();return true},
   destroy(){if(active===session)active=null}
  };
  mounts++;active=session;
  queueMicrotask(()=>o.onReady(session));
  return session;
 }
};
const window={FXI_PHASE10_WATCH:bridge,FXI_VIEWER:{unmount(){},mountQuick(){},mountEngine(){},missing(){}}};
const ctx=vm.createContext({window,document,Math,console,
 localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},
 confirm:()=>true,alert:()=>{},setTimeout:()=>{},
 URL:{createObjectURL:()=>'',revokeObjectURL:()=>{}},Blob:class{},performance:{now:()=>0},queueMicrotask});
for(const filename of ['assets/js/species.js','assets/js/calibration-profile.js','assets/js/quick-sim.js','assets/js/soccerjs-franchise-viewer.js','assets/js/career.js'])
 vm.runInContext(fs.readFileSync(path.join(root,filename),'utf8'),ctx,{filename,timeout:25000});
const game=window.FXI_TEST;
assert(game,'Franchise state API available');
const navTactical=()=>{tactical=true;document.click({target:{closest:()=>({dataset:{view:'tactical'}})}})};
(async()=>{
 game.create('classic',16,'SOCCERJS-FRANCHISE-TEST','off');
 const before=JSON.stringify(game.state());
 const preview=game.getTacticalPreview(),expected=preview.result;
 assert(preview.fixtureIndex>=0);
 assert(preview.home.lineup.every(p=>p.speciesId>=1));
 navTactical();
 await Promise.resolve();
 assert.equal(mounts,1);
 assert.equal(active?.ended,false);
 assert.equal(el('viewerSoccerRecord').disabled,true);
 assert.equal(el('viewerProjection').value,'orthographic','Broadcast default in Franchise');
 assert.equal(el('viewerCamera').value,'follow','Follow Ball default in Franchise');
 assert.equal(el('viewerMode').disabled,true,'Cannot change engines mid-replay');
 assert.equal(el('viewerHighlights').hidden,false,'Franchise Watch Highlights must be visible');
 assert.equal(el('viewerHighlights').disabled,false,'Highlights must be usable once Watch is ready');
 el('viewerHighlights').onclick();
 assert.equal(highlightsOpened,1,'Franchise mode must open official goal replay gallery');
 assert.equal(JSON.stringify(game.state()),before,'Opening Franchise replays must not mutate career');
 assert.equal(JSON.stringify(game.state()),before,'Opening Watch must not mutate career save');
 assert.equal(active.record(),false,'Cannot record prior to official full time');
 el('viewerComplete').onclick();
 const saved=game.state();
 assert.equal(saved.week,1,'Sim to End advances Franchise automatically, no Record click');
 assert.equal(finished,1,'Exactly one automatic Record callback');
 assert.equal(el('viewerMode').disabled,false,'Viewer releases engine controls after transitioning to results');
 assert.equal(saved.week,1,'Recording advances exactly one week');
 assert.equal(saved.results.length,1,'Exactly one matchweek recorded');
 assert.match(el('app').innerHTML,/id="franchiseWeekResults"/,'Sim to End transitions to matchweek results card');
 assert.equal(saved.results[0].length,16,'16 same-week fixtures saved');
 assert.deepEqual(Array.from(saved.results[0][preview.fixtureIndex].score),Array.from(expected.score),'Recorded match is exact locked Quick Sim result');
 assert.equal(finished,1);
 assert.equal(active,null,'Franchise dashboard dismounts 2.5D renderer after recording');
 assert.equal(active,null,'No active Watch remains after the automatic dashboard transition');
 assert.equal(game.state().week,1,'No double save after handoff');
 // Unrecorded cancel must never modify the new saved week.
 navTactical();
 await Promise.resolve();
 assert.equal(mounts,2);
 const beforeCancel=JSON.stringify(game.state());
 el('viewerSoccerCancel').onclick();
 assert.equal(active,null,'Canceled view is cleaned up');
 assert.equal(game.state().week,1);
 assert.equal(JSON.stringify(game.state()),beforeCancel,'Cancel leaves all career state identical');
 assert.equal(finished,1);
 assert.equal(el('viewerMode').disabled,false);
 console.log('PASS Franchise native 2.5D: goal Highlights accessible, Sim to End records once, cancel unchanged');
})().catch(e=>{console.error(e);process.exitCode=1});
