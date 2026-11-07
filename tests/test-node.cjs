const fs=require('fs'),vm=require('vm');
const elements={app:{innerHTML:''},exportBtn:{addEventListener:()=>{}},importFile:{addEventListener:()=>{}}};
const document={querySelectorAll:()=>[],getElementById:(id)=>elements[id]||null,addEventListener:(type,fn)=>{document[type]=fn}};
const kv={};const ctx={window:{},document,localStorage:{getItem:k=>kv[k]||null,setItem:(k,v)=>{kv[k]=v},removeItem:k=>delete kv[k]},console,setTimeout:()=>{},confirm:()=>true,alert:console.log,URL:{createObjectURL:()=>'',revokeObjectURL:()=>{}},Blob:class {},Math};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname+'/../assets/js/species.js','utf8'),ctx);vm.runInContext(fs.readFileSync(__dirname+'/../assets/js/quick-sim.js','utf8'),ctx);vm.runInContext(fs.readFileSync(__dirname+'/../assets/js/career.js','utf8'),ctx);
const x=ctx.window.FXI_TEST,assert=(ok,why)=>{if(!ok)throw Error(why)};
assert(ctx.window.FXI_SPECIES.length===493,'species');
const fixtures=x.makeFixtureList();assert(fixtures.length===22&&fixtures.every(row=>row.length===16),'scheduling rounds');
const hits=Array(32).fill(0);for(const w of fixtures)for(const f of w){hits[f.home]++;hits[f.away]++}assert(hits.every(n=>n===22),'22 matches for each');
const meeting=new Map();for(const round of fixtures)for(const f of round){
 assert(f.home!==f.away,'self matchup');
 const key=[Math.min(f.home,f.away),Math.max(f.home,f.away)].join('-');
 meeting.set(key,[...(meeting.get(key)||[]),f]);
}
for(let i=0;i<32;i++){
 const same=fixtures.flat().filter(f=>(f.home===i||f.away===i)&&Math.floor(f.home/8)===Math.floor(f.away/8));
 const cross=fixtures.flat().filter(f=>(f.home===i||f.away===i)&&Math.floor(f.home/8)!==Math.floor(f.away/8));
 assert(same.length===14&&cross.length===8,'14 regional plus 8 interregional for gym '+i);
 assert(new Set(cross.map(f=>f.home===i?f.away:f.home)).size===8,'distinct cross-region opponents');
 assert(new Set(cross.map(f=>Math.floor((f.home===i?f.away:f.home)/8))).size===3,'crosses all other regions');
 for(let j=0;j<32;j++)if(i!==j&&Math.floor(i/8)===Math.floor(j/8)){
  const pair=meeting.get([Math.min(i,j),Math.max(i,j)].join('-'))||[];
  assert(pair.length===2&&pair.some(f=>f.home===i)&&pair.some(f=>f.away===i),'regional home-away');
 }
}
assert(meeting.size>=112,'sufficient unique fixture opponents');

x.create('classic',0,'SAME','rare');let s=x.state();assert(s.teams.length===32&&Object.keys(s.players).length===960,'30 players each');
assert(s.teams[0].roster.some(id=>s.players[id].species===95),'Onix');assert(!Object.values(s.players).some(p=>ctx.window.FXI_SPECIES[p.species-1].legendary),'legends');
const first=JSON.stringify(s.teams.map(t=>t.roster.map(id=>s.players[id].ivs)));x.create('classic',0,'SAME','rare');s=x.state();const repeat=JSON.stringify(s.teams.map(t=>t.roster.map(id=>s.players[id].ivs)));assert(first===repeat,'seed deterministic');
for(let w=0;w<22;w++)x.simulate();s=x.state();assert(s.phase==='playoffs'&&s.results.length===22,'22 weeks played');for(const t of s.teams)assert(t.w+t.l+t.d===22,'team played 22');
console.log('PASS 493 Gen I-IV; 32 gyms; 960 players; seeded generation; 22-match schedule; 352 games; playoffs ready');
x.create('fantasy',0,'DRAFT','rare');s=x.state();assert(s.phase==='draft','draft started');
document.click({target:{closest:()=>({dataset:{action:'finishDraft'}})}});s=x.state();assert(s.phase==='season','draft ended');assert(s.teams.every(t=>t.roster.length===25&&t.practice.length===5),'25+5 draft squads');assert(!s.teams.some(t=>t.roster.some(id=>ctx.window.FXI_SPECIES[s.players[id].species-1].legendary)),'draft legends');
console.log('PASS 25-round draft 800 selections, Practice Squad generation, no initial Legendary Pokemon.');

// Postseason, season rollover and statistical input invariants.
const teamWinTotals=s.teams.map(t=>t.roster.length);assert(teamWinTotals.every(n=>n===25),'draft all slots');
x.create('random',1,'PLAYOFF-SEED','common');for(let i=0;i<22;i++)x.simulate();
let q=x.state();assert(q.phase==='playoffs','playoff phase');
document.click({target:{closest:()=>({dataset:{action:'playoffs'}})}});q=x.state();assert(q.phase==='complete'&&q.playoffs.roundOf16.length===8&&q.playoffs.quarterfinals.length===4&&q.playoffs.semifinals.length===2,'bracket');
document.click({target:{closest:()=>({dataset:{action:'nextSeason'}})}});q=x.state();assert(q.season===2&&q.week===0&&q.phase==='season','new season');
assert(q.teams.every(t=>t.pts===0&&t.w===0),'standings rollover');
console.log('PASS 16-team playoffs, championship, season rollover, reset standings.');

// v0.6b tactical viewer: previewing does not alter standings or advance the week.
x.create('classic',0,'TACTICAL-SEED','rare');
const preview=x.getTacticalPreview();
assert(preview&&preview.home.lineup.length===11&&preview.away.lineup.length===11,'preview supplies 22 players');
assert(preview.result.score.length===2&&preview.result.stats.length===2,'preview result has scores/stats');
assert(x.state().week===0&&x.state().teams.every(t=>t.pts===0),'preview cannot commit results');
const previewAgain=x.getTacticalPreview();
assert(preview===previewAgain,'reopening viewer reuses seeded result');
x.simulate(preview);
assert(x.state().week===1&&x.state().results[0][preview.fixtureIndex].score.join('-')===preview.result.score.join('-'),'committed result is same as preview');
console.log('PASS tactical preview: 22 starters, seeded result, no premature save, correct matchweek commit.');
