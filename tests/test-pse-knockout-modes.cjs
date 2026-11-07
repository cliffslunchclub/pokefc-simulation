'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
function load(ctx,files){for(const file of files)vm.runInContext(read(file),ctx,{filename:file,timeout:30000})}
function franchise(){
 const app={innerHTML:''},elements={app,exportBtn:{addEventListener(){}},importFile:{addEventListener(){}}};
 const doc={querySelectorAll:()=>[],getElementById:id=>elements[id]||null,addEventListener:(type,fn)=>doc[type]=fn};
 const store=new Map(),ctx=vm.createContext({window:{},document:doc,
  localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},
  console,Math,performance,confirm:()=>true,alert:()=>{},setTimeout:()=>{},
  URL:{createObjectURL:()=>'',revokeObjectURL:()=>{}},Blob:class{}});
 load(ctx,['assets/js/species.js','assets/js/calibration-profile.js','assets/js/quick-sim.js','assets/js/pse-knockout.js','assets/js/career.js']);
 const game=ctx.window.FXI_TEST;assert(game);assert(ctx.window.PFC_KNOCKOUT);
 game.create('random',24,'PSE-KO-CAREER','off');
 for(let i=0;i<22;i++)game.simulate();
 assert.equal(game.state().phase,'playoffs');
 doc.click({target:{closest:()=>({dataset:{action:'playoffs'}})}});
 const state=game.state();assert.equal(state.phase,'complete');
 const games=[...state.playoffs.roundOf16,...state.playoffs.quarterfinals,
  ...state.playoffs.semifinals,state.playoffs.final];
 assert.equal(games.length,15);
 const all=games.map(x=>JSON.parse(JSON.stringify(x)));
 for(const r of all){
  assert.equal(r.knockoutRules,'pse-knockout-v1');
  assert(['regulation','extra-time','shootout'].includes(r.decidedBy));
  assert.equal(r.events.filter(e=>e.type==='goal').length,r.score[0]+r.score[1]);
  assert(Number.isInteger(r.winner)&&r.winner>=0&&r.winner<32);
  if(r.extraTime){assert.equal(r.durationMinutes,120);assert(r.extraTime.events.every(e=>e.minute>=90&&e.minute<120));}
  if(r.penalties){assert(r.shootout?.attempts?.length>=6);assert.notEqual(r.shootout.home,r.shootout.away)}
 }
 return {all:games.length,extra:games.filter(g=>g.extraTime).length,shootouts:games.filter(g=>g.penalties).length};
}
function challenge(){
 const roster=[233,6,3,9,149,94,131,143,68,135,196];let seed=1091,completed=0,extras=0;
 for(let i=0;i<16;i++){
  seed=1091+i*37;
  let saved=JSON.stringify({version:1,phase:'locked',pool:4,legends:false,formation:'4-3-3',
   tactic:'balanced',roster,items:Array(11).fill(null),roll:null,selected:0,rng:seed,
   rerollType:1,rerollGen:1,moves:1,formationChanges:1,round:0,result:null,history:[],locked:{
    roster,items:Array(11).fill(null),formation:'4-3-3',tactic:'balanced',score:71}});
  const app={innerHTML:'',querySelectorAll(){return []}},els={},doc={getElementById(id){
   if(id==='app')return app;
   return els[id]??={id,open:false,hidden:false,textContent:'',value:'',
    setAttribute(k,v){this[k]=v},removeAttribute(k){delete this[k]},onclick:null};
  }};
  const context=vm.createContext({window:{},document:doc,
   localStorage:{getItem:k=>k==='pokefc-challenge-alpha-1'?saved:null,
    setItem(k,v){if(k==='pokefc-challenge-alpha-1')saved=v}},
   crypto:{getRandomValues(a){a[0]=seed;return a}},console,confirm:()=>true,alert:e=>{throw Error(e)}});
  load(context,['assets/js/position-effectiveness.js','assets/js/national-species.js','assets/js/quick-sim.js','assets/js/pse-knockout.js','challenge/special-items-data.js',
   'challenge/tiers.js','challenge/match-report.js','challenge/performance.js','play/opponents.js']);
  const html=read('challenge/index.html');
  vm.runInContext(html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>')),context,
   {filename:'challenge-inline',timeout:30000});
  assert(els.play?.onclick,'Challenge play action missing');
  els.play.onclick();
  const state=JSON.parse(saved),m=state.result;
  assert(m,'Challenge result was not saved');
  assert.equal(m.knockoutRules,'pse-knockout-v1');
  assert.equal(m.report.goals.length,m.score[0]+m.score[1]);
  assert(['Victory','Defeat'].includes(m.outcome));
  if(m.extraTime){extras++;assert.equal(m.report.goals.filter(g=>g.minute>=90).length,
   m.extraTime.events.filter(e=>e.type==='goal').length);}
  if(m.shootout)assert.equal(m.shootout.version,'pse-shootout-v1');
  completed++;
 }
 return {completed,extras};
}
const f=franchise(),c=challenge();
assert.equal(f.all,15);
assert.equal(c.completed,16);
console.log('PASS PSE modes: Franchise',f.all,'playoff fixtures with',f.extra,
 'extra times and',f.shootouts,'shootouts; Challenges',c.completed,'real stored boss results,',c.extras,'extra times');
