'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Zoom=require('./phase10-camera-zoom.cjs');
const root=__dirname;
const viewer=fs.readFileSync(path.join(root,'viewer-entry.cjs'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'viewer.css'),'utf8');
assert.equal(Zoom.MIN,.6);
assert.equal(Zoom.MAX,1.6);
assert.equal(Zoom.STEP,.15);
assert.equal(Zoom.percent(1),'100%');
assert.equal(Zoom.percent(.6),'60%');
assert.equal(Zoom.percent(1.6),'160%');
assert.equal(Zoom.clamp(NaN),1);
let current=1;
for(let i=0;i<10;i++)current=Zoom.step(current,1);
assert.equal(current,1.6,'Zoom in must stop at 160%');
for(let i=0;i<12;i++)current=Zoom.step(current,-1);
assert.equal(current,.6,'Zoom out must stop at 60%');
assert.equal(Zoom.step(1,1),1.15);
assert.equal(Zoom.step(1,-1),.85);
for(const id of ['zoomOut','zoomIn','zoomValue'])
 assert(html.includes('id="'+id+'"'),'Pitch missing '+id);
assert(html.includes('aria-label="Zoom in"')&&html.includes('aria-label="Zoom out"'),
 'Zoom controls must have accessible names');
assert(css.includes('.watch-zoom-controls')&&css.includes('z-index:8'),
 'Pitch zoom overlay must remain visible in embedded/fullscreen Watch');
assert(viewer.includes("const Zoom=require('./phase10-camera-zoom.cjs')"),
 'Watch canvas must use bounded zoom controller');
assert(viewer.includes("*zoomFactor;"),
 'Broadcast, isometric, top-down and follow/wide all need the same camera multiplier');
assert(viewer.includes("$('zoomIn').onclick")&&viewer.includes("$('zoomOut').onclick"),
 'Both buttons must be wired');
assert(viewer.includes("sim.pitch?.invalidateRenderCache?.()"),
 'Camera zoom changes must invalidate render cache');
console.log('PASS pitch zoom: 60–160%, 15% clicks, all camera modes, accessible pitch overlay');
