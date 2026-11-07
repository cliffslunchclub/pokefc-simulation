'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=require('path').resolve(__dirname,'..');
const env={app:{innerHTML:''},exportBtn:{addEventListener(){}},importFile:{addEventListener(){}}};
const document={querySelectorAll:()=>[],getElementById:id=>env[id]||null,addEventListener:(type,fn)=>{document[type]=fn}};
const store=new Map();const ctx={window:{},document,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},console,Math,confirm:()=>true,alert:()=>{},setTimeout:()=>{},URL:{createObjectURL:()=>'',revokeObjectURL:()=>{}},Blob:class{}};
vm.createContext(ctx);
for(const f of ['assets/js/species.js','assets/js/calibration-profile.js','assets/js/quick-sim.js','assets/js/career.js'])vm.runInContext(fs.readFileSync(root+'/'+f,'utf8'),ctx,{filename:f});
const game=ctx.window.FXI_TEST, species=ctx.window.FXI_SPECIES;
assert.equal(species.length,493);
assert.equal(new Set(species.map(s=>s.id)).size,493);
assert.equal(species[251].name,'Treecko');assert.equal(species[391].name,'Infernape');assert.equal(species[492].name,'Arceus');
for(const s of species){assert.equal(Object.keys(s.baseStats).length,6);assert.equal(s.types.length>0,true);}
for(let year=1;year<=3;year++){
 const matches=game.makeFixtureList(year);
 assert.equal(matches.length,22);assert(matches.every(w=>w.length===16));
 const home=Array(32).fill(0),away=Array(32).fill(0);
 for(const w of matches){const seen=new Set();for(const f of w){assert(!seen.has(f.home)&&!seen.has(f.away));seen.add(f.home);seen.add(f.away);home[f.home]++;away[f.away]++}assert.equal(seen.size,32)}
 for(let i=0;i<32;i++){assert.equal(home[i]+away[i],22);assert(Math.abs(home[i]-away[i])<=2,'home-away imbalance club='+i+' year='+year+' '+home[i]+'/'+away[i]);}
}
for(const [club,signature,region] of [[16,299,'Hoenn'],[22,338,'Hoenn'],[24,408,'Sinnoh'],[26,448,'Sinnoh'],[31,405,'Sinnoh']]){
 game.create('classic',club,'SIGN-'+club,'off');const st=game.state();assert.equal(st.teams.length,32);assert.equal(st.teams[club].conference,region);assert(st.teams[club].roster.some(id=>st.players[id].species===signature),'signature '+club);assert.equal(st.players[st.teams[club].roster[0]].ivs.length,6);
}
let start=performance.now();game.create('random',24,'LEAGUE-STRESS-32','off');for(let week=0;week<22;week++)game.simulate();let state=game.state();assert.equal(state.phase,'playoffs');assert.equal(state.results.flat().length,352);for(const t of state.teams)assert.equal(t.w+t.l+t.d,22);
document.click({target:{closest:()=>({dataset:{action:'playoffs'}})}});state=game.state();assert.equal(state.playoffs.roundOf16.length,8);assert.equal(state.phase,'complete');let ms=performance.now()-start;
assert.equal(ctx.window.FXI_QUICK.profile().status,'provisional');
console.log(JSON.stringify({pass:true,species:493,gyms:32,matchweeks:22,regularSeasonMatches:352,playoffMatches:15,initialRosterSize:30,fullSimAndPlayoffsWallMs:Math.round(ms),quickSimCalibration:'provisional'}));
