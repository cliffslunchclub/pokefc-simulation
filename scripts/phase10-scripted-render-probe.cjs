'use strict';
/* Native-render feasibility probe: NO native match ticks after initialization.
 * The official score remains an immutable scripted input (Quick Sim shape).
 * A full browser animation or genuine Quick Sim result adapter is NOT tested.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const upstream=path.resolve(process.argv[2]||'upstream');
const log=console.log.bind(console);
require(path.join(upstream,'tests/mock_env.js'));
const {Settings}=require(path.join(upstream,'kernel/settings.js'));
const {Utils}=require(path.join(upstream,'kernel/core/lib/utils.js'));
const {Simulator}=require(path.join(upstream,'kernel/providers/simulator/simulator.js'));
const director=require('./phase10-scripted-renderer.cjs');
Settings.app={camX:0,camY:0,canvas:{width:960,height:600}};
Settings.HEADLESS=true;
Settings.showFPS=false;
const script=Object.freeze({
 mode:'knockout',duration:120,score:[2,1],
 events:Object.freeze([
  Object.freeze({type:'goal',minute:32,side:0,scorerIndex:9}),
  Object.freeze({type:'goal',minute:87,side:1,scorerIndex:8}),
  Object.freeze({type:'goal',minute:113,side:0,scorerIndex:10})
 ])
});
const league={mode:'league',duration:90,score:[0,0],events:[]};
const fields=Utils.getFieldBounds();
const samples=[0,31.9,31.95,32,45,86.96,87,90,105,112.96,113,114,120];
const signature=frame=>JSON.stringify(frame);
function mockContext(){
 const trace={methods:{},images:0,arcs:0,text:0};
 const gradient={addColorStop(){}};
 const proxy=new Proxy({},{
  get(_obj,key){
   if(key==='canvas')return Settings.app.canvas;
   if(key==='createLinearGradient'||key==='createRadialGradient')return ()=>gradient;
   if(key==='measureText')return s=>({width:String(s).length*7});
   return (...args)=>{
    if(typeof key!=='string')return undefined;
    trace.methods[key]=(trace.methods[key]||0)+1;
    if(key==='drawImage')trace.images++;
    if(key==='arc'||key==='ellipse')trace.arcs++;
    if(key==='fillText')trace.text++;
    return undefined;
   };
  },
  set(_obj,key,value){return true;}
 });
 return {ctx:proxy,trace};
}
(async()=>{
 const sim=new Simulator({seed:74231});
 await sim.start();
 assert.equal(sim.players.length,22,'Soccer-JS did not bootstrap 22 players');
 assert.equal(sim.teamA.players.length,11);
 assert.equal(sim.teamB.players.length,11);
 director.validateScript(script);
 director.validateScript(league);
 const readOnlyInput=JSON.stringify(script);
 const baseline={score:[sim.scoreA,sim.scoreB],timer:sim.matchTimer};
 const frames=[];
 for(const minute of samples){
  const f=director.frameAt(script,minute,fields);
  director.applyToSoccerJS(sim,f);
  assert.deepEqual([sim.scoreA,sim.scoreB],director.scoreAt(script,minute));
  assert.equal(sim.matchTimer,minute*60);
  assert.equal(sim.ball.vx,0);
  assert.equal(sim.players.length,22);
  frames.push({minute,score:f.score,action:f.action,ball:f.ball});
 }
 assert.deepEqual(director.scoreAt(script,90),[1,1],'Regulation should finish tied');
 assert.deepEqual(director.scoreAt(script,105),[1,1],'Extra-time first half should remain tied');
 assert.deepEqual(director.scoreAt(script,113),[2,1],'Official winner should arise at 113');
 assert.deepEqual(director.scoreAt(script,120),script.score,'120-minute result drift');
 assert.deepEqual(director.frameAt(script,113,fields),director.frameAt(script,113,fields));
 assert.equal(JSON.stringify(script),readOnlyInput,'Scripted Quick Sim-like source was mutated');
 // Scrub backward AND forward from fulltime: deterministic and independent
 // of sim AI/physics. This is precisely the needed control boundary.
 for(const minute of [120,0,114,32,105,87,120]){
  const f=director.frameAt(script,minute,fields);director.applyToSoccerJS(sim,f);
  assert.deepEqual([sim.scoreA,sim.scoreB],f.score);
 }
 const final=director.frameAt(script,120,fields);
 director.applyToSoccerJS(sim,final);
 assert.deepEqual([sim.scoreA,sim.scoreB],[2,1]);
 // Native Soccer-JS player and ball renderer smoke test. A sprite stub only
 // replaces unavailable browser sprite assets, NOT Player.render().
 const spriteStub={width:1024,height:1024};
 for(const p of sim.players)p.getSpriteSheet=()=>spriteStub;
 const {ctx,trace}=mockContext();
 // The upstream tests/mock_env.js uses a deliberately tiny pixel Canvas.
 // Its offscreen cache context lacks fillText/measureText required by the
 // FULL native Soccer-JS pitch/stadium renderer. Supply a method-complete
 // spy context to BOTH the main canvas and dynamically created cache canvas.
 const createElement=global.document.createElement;
 const getElementById=global.document.getElementById;
 global.document.getElementById=(id)=>
   id==='minimap'?{width:200,height:128,getContext:()=>mockContext().ctx}:getElementById(id);
 global.document.createElement=(tag)=>
   tag==='canvas'?{width:960,height:600,getContext:()=>mockContext().ctx}:createElement(tag);
 Settings.HEADLESS=false;
 let renderOk=false,renderError=null;
 try{
  // Calls actual Pitch.render + Player.render + Ball.render in native engine.
  sim.renderAll(ctx);
  renderOk=true;
 }catch(e){renderError=e.stack||String(e);}
 Settings.HEADLESS=true;
 global.document.createElement=createElement;
 global.document.getElementById=getElementById;
 assert.equal(renderOk,true,'Native frame rendering failed: '+renderError);
 assert(trace.images>=22,'Native sprite drawing did not render all 22 player entities: '+trace.images);
 assert(trace.arcs>0,'Native soccer ball did not render');
 const out={
  title:'Phase 10B Soccer-JS external match renderer feasibility',
  result:renderOk?'PASS':'FAIL',renderMethod:'Soccer-JS Simulator.renderAll, real player+ball render; mock Canvas and stub image assets',
  upstream:'haeretici/soccer-js @ 38970e0dade0865078c9e84bc1ecfd72aaa02fde',
  source:'Quick Sim-format authored test fixture only (not an actual PokéFC Quick Sim result)',
  scriptedMatch:{regulationScore:[1,1],extraTimeScore:[2,1],officialGoalMinutes:[32,87,113],durationMinutes:120},
  samples:frames,readOnlySource:true,deterministicSeeking:true,
  nativeRender:{images:trace.images,arcs:trace.arcs,drawingCalls:trace.methods,renderOk},
  keyResult:'External frames can drive Soccer-JS player/ball entities and native rendering WITHOUT invoking Soccer-JS physics, AI or goal decisions.',
  limitations:'Not a visible browser demo or proof of sprite asset integration. Goal flight and player reactions are deterministic placeholders. No real Quick Sim match exported. The 120-minute clock is external, not a native engine extra-time FSM.'
 };
 const dir=path.resolve('phase10-reports');fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'soccerjs-scripted-render.json'),JSON.stringify(out,null,2));
 const md=[
 '# Phase 10B — Quick Sim → Soccer-JS visual feasibility','',
 '**Result: PASS** — external match script injects a 120-minute timeline into the existing Soccer-JS player and ball objects without advancing its AI or physics.',
 '',
 '| Check | Observed |','|---|---|',
 '| Live Soccer-JS players | '+sim.players.length+' |',
 '| Native Soccer-JS renderer calls | '+trace.images+' image draws; '+trace.arcs+' ball/field arcs |',
 '| 90-minute authoritative score | 1–1 |',
 '| 105-minute authoritative score | 1–1 |',
 '| 120-minute authoritative score | 2–1 |',
 '| Deterministic seek forward/back | PASS |',
 '| Original scripted source unchanged | PASS |',
 '| Native soccer decisions bypassed | Yes: no updateAll after bootstrap |',
 '',
 '**Important:** This is a *technical renderer-path proof*, not a real Quick Sim-to-browser integration. The fixture mimics the public Match Director event contract; it is not generated by Quick Sim. Native sprites use a stub image in the test canvas.',
 'A visible playable viewer and a true match-data adapter are future milestones. Separate extra-time period transitions and penalty-shootout mechanics are also not yet built.'
 ].join('\n')+'\n';
 fs.writeFileSync(path.join(dir,'soccerjs-scripted-render.md'),md);
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,md);
 log('PASS external-source 120-minute animation injection; native draws='+trace.images+'; visual score parity at 90/105/120; replay deterministic');
})().catch(e=>{log('FAILED scripted render feasibility: '+(e.stack||e));process.exitCode=1;});
