'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const ctx=vm.createContext({window:{},Date,console});
vm.runInContext(fs.readFileSync(path.join(root,'challenge/leaderboard.js'),'utf8'),ctx,{filename:'leaderboard.js'});
const board=ctx.window.PFC_CHALLENGE_LEADERBOARD;
assert(board,'Leaderboard API installed');
assert.deepEqual(Array.from(board.CATEGORIES.map(x=>x.id)),['classic-standard','classic-legends','national-standard','national-legends']);
const store=new Map(),storage={getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value)};
const team=[233,6,9,94,25,3,4,5,7,8,10];
function run(pool,legends,rng,{loss=false,score=74,gd=2}={}){
 const matches=[1,2,3,4,5,6].map((round,i)=>({boss:['Lorelei','Bruno','Agatha','Lance','Blue','Red'][i],outcome:loss&&round===6?'Defeat':'Victory',score:loss&&round===6?[1,2]:[gd+1,1],origin:'quick-sim'}));
 if(loss)matches.pop();
 return {phase:'finished',pool,legends,rng,locked:{formation:'4-3-3',score,roster:team,items:Array(11).fill(null),tactic:'balanced'},history:matches};
}
for(const [pool,legends] of [[4,false],[4,true],[9,false],[9,true]]){
 const p=run(pool,legends,'seed-'+pool+'-'+legends,{score:82});
 const item=board.archive(p,storage);
 assert(item&&item.category===board.categoryOf(p));
 assert.equal(board.rankings(item.category,storage).length,1);
 assert.equal(board.archive(p,storage).id,item.id,'idempotent duplicate archive');
 assert.equal(board.rankings(item.category,storage).length,1,'No double count');
 assert.equal(board.stats(item.category,storage).champions,1);
}
const lossy=run(9,true,'lost',{loss:true,score:92});
assert.equal(board.archive(lossy,storage).champion,false);
const runs=board.rankings('national-legends',storage);
assert.equal(runs.length,2);
assert.equal(runs[0].champion,true,'Champion outranks higher team-score failed run');
assert.equal(runs[1].teamScore,92);
assert.equal(board.stats('national-legends',storage).bestScore,92);
assert.equal(board.rankings('national-standard',storage).length,1,'No cross-category merging');
assert.equal(board.archive({...lossy,phase:'locked'},storage),null,'Only completed attempts archived');
assert.equal(board.rankings('invalid-category',storage).length,0);
const saved=JSON.parse(store.get(board.KEY));
assert.deepEqual(Object.keys(saved).sort(),Array.from(board.CATEGORIES,c=>c.id).sort());
assert(saved['national-legends'][0].roster.length===11);
store.set(board.KEY,'{invalid-json');
assert.equal(board.rankings('classic-standard',storage).length,0,'Corrupt storage safely treated as empty');
console.log('PASS Challenges v1.0 four local divisions, champion sorting, personal standings, idempotence, corruption recovery');
