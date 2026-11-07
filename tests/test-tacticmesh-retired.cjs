'use strict';
// Guard against reintroducing retired TacticMesh and hybrid runtimes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
for(const p of ['play/index.html','franchise/index.html','play/play.js','assets/js/career.js','assets/js/tactical-viewer.js','assets/js/soccerjs-franchise-viewer.js']){
 assert.doesNotMatch(read(p),/tacticmesh|tm-engine-bridge|tm-worker|hybrid-sim|FXI_TM|FXI_HYBRID/i,p+' must be PSE/Soccer-JS only');
}
for(const p of ['tm-worker.js','tm-engine-bridge.js','hybrid-sim.js','tacticmesh',
 'legacy-v05','legacy-v07c']){
 assert(!fs.existsSync(path.join(root,p)),'retired source still exists: '+p);
}
const dist=path.join(root,'dist');
if(fs.existsSync(dist)){
 for(const p of ['play/tacticmesh','franchise/tacticmesh','play/tm-worker.js','franchise/tm-worker.js',
  'play/tm-engine-bridge.js','franchise/tm-engine-bridge.js','play/hybrid-sim.js','franchise/hybrid-sim.js']){
  assert(!fs.existsSync(path.join(dist,p)),'retired asset in deployed dist: '+p);
 }
}
console.log('PASS: TacticMesh retired; no active TM/Hybrid scripts or packaged assets');
