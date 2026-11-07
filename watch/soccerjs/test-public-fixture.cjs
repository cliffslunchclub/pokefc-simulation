'use strict';
// Manual local test; intentionally NOT attached to private GitHub Actions.
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const here=__dirname;
const published=JSON.parse(fs.readFileSync(path.join(here,'fixture.json'),'utf8'));
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'pfc-qs-replay-'));
try{
 const outfile=path.join(tmp,'fixture.json');
 execFileSync(process.execPath,[path.join(here,'export-fixture.cjs'),'--output',outfile],{stdio:'pipe'});
 const regenerated=JSON.parse(fs.readFileSync(outfile,'utf8'));
 assert.equal(regenerated.origin,'quick-sim');
 assert.equal(regenerated.schema,'pokefc-quick-sim-export/v1');
 assert.deepEqual(regenerated.score,published.score,'Default Quick Sim seed changed official score');
 assert.deepEqual(regenerated.stats,published.stats,'Private Quick Sim drifted from published match statistics');
 assert.deepEqual(regenerated.box,published.box,'Private Quick Sim per-player box stats drifted');
 assert.deepEqual(regenerated.events,published.events,'Official goal timings/scorers/assists drifted');
 for(const team of [regenerated.home,regenerated.away]){
  assert.equal(team.lineup.length,11);
  for(const p of team.lineup)assert(Object.hasOwn(regenerated.box,p.id));
 }
 assert(!Object.hasOwn(regenerated,'parameters'),'Private Quick Sim tuning parameters leaked into export');
 const viewer=fs.readFileSync(path.join(here,'viewer-entry.cjs'),'utf8');
 assert(viewer.includes('sim.renderAll(ctx)'),'Expected native Soccer-JS frame renderer');
 assert(!viewer.includes('sim.updateAll('),'Native Soccer-JS outcome simulation must never run');
 console.log('PASS private Quick Sim exporter reproduced public 2–1 fixture, all goals, shots and box stats; viewer only renders');
}finally{
 fs.rmSync(tmp,{recursive:true,force:true});
}
