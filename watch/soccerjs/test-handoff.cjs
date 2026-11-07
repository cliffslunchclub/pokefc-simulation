'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'pfc-watch-'));
try{
 const outfile=path.join(tmp,'match.json');
 execFileSync(process.execPath,[path.join(__dirname,'export-fixture.cjs'),'--output',outfile]);
 const sample=JSON.parse(fs.readFileSync(outfile,'utf8'));
 const api=require('./watch-bridge.js');
 const preview={home:sample.home,away:sample.away};
 const result={origin:'quick-sim',home:sample.home.id,away:sample.away.id,
   score:sample.score,stats:sample.stats,events:sample.events,box:sample.box};
 const before=JSON.stringify(result);
 const f=api.snapshot(preview,result);
 assert.deepEqual(f.score,[2,1]);
 assert.equal(f.events.length,3);
 for(const [minute,score] of [[0,[0,0]],[54,[1,0]],[69,[2,0]],[80,[2,1]],[90,[2,1]]])
   assert.deepEqual(api.scoreAt(f,minute),score);
 assert.equal(JSON.stringify(result),before);
 assert.throws(()=>api.snapshot(preview,{...result,score:[5,0]}),/goal tally mismatch/);
 assert.throws(()=>api.snapshot(preview,{...result,origin:'tacticmesh'}),/Quick Sim result/);
 console.log('PASS phase10 Watch input: authentic Quick Sim 2–1, goals, assists, stats and immutable replay scores');
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
