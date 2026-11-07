'use strict';
// Test native fullscreen + rejected/unsupported mobile theater fallback.
// No Quick Sim mutation, iframe simulation or browser-specific global needed.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../watch/soccerjs/watch-bridge.js'),'utf8');
const collection=()=>{const set=new Set();return {add:k=>set.add(k),remove:k=>set.delete(k),contains:k=>set.has(k)}};
const button={textContent:'⛶ FULLSCREEN',attrs:{},setAttribute(k,v){this.attrs[k]=v}};
const body={classList:collection()},listeners={};
const fullscreenMessages=[];
const iframe={contentWindow:{postMessage(message,origin){fullscreenMessages.push({message,origin})}}};
const document={
 body,fullscreenElement:null,
 addEventListener(k,fn){listeners[k]=fn},
 async exitFullscreen(){this.fullscreenElement=null;listeners.fullscreenchange?.()}
};
const window={location:{href:'http://localhost/play/',origin:'http://localhost'}};
const context=vm.createContext({window,document,console,URL,Math});
vm.runInContext(source,context,{filename:'watch/soccerjs/watch-bridge.js'});
const watch=window.FXI_PHASE10_WATCH;
assert.equal(typeof watch.toggleFullscreen,'function');
assert.equal(typeof watch.leaveFullscreen,'function');
function pitch(native){
 const el={
  classList:collection(),
  querySelector:s=>s==='[data-pfc-fullscreen]'?button:s==='iframe.soccerjs-inline-frame'?iframe:null
 };
 if(native)el.requestFullscreen=async()=>{document.fullscreenElement=el;listeners.fullscreenchange?.()};
 else el.requestFullscreen=async()=>{throw Error('Unsupported iPhone element fullscreen')};
 return el;
}
(async()=>{
 const mobile=pitch(false);
 assert.equal(await watch.toggleFullscreen(mobile),true);
 assert(mobile.classList.contains('pfc-watch-theater'),'Mobile fullscreen fallback is not expanded');
 assert(body.classList.contains('pfc-watch-no-scroll'),'Mobile background still scrolls');
 assert.equal(button.attrs['aria-pressed'],'true');
 assert.match(button.textContent,/EXIT FULLSCREEN/);
 assert.equal(fullscreenMessages.at(-1).message.action,'fullscreen');
 assert.equal(fullscreenMessages.at(-1).message.active,true);
 assert.equal(await watch.toggleFullscreen(mobile),false,'Mobile exit failed');
 assert(!mobile.classList.contains('pfc-watch-theater'));
 assert(!body.classList.contains('pfc-watch-no-scroll'));
 assert.equal(button.attrs['aria-pressed'],'false');
 assert.equal(fullscreenMessages.at(-1).message.active,false,
  'Fullscreen exit must hide iframe playback bar');
 await watch.toggleFullscreen(mobile);
 listeners.keydown({key:'Escape'});
 assert(!mobile.classList.contains('pfc-watch-theater'),'Escape must exit mobile theater');
 const desktop=pitch(true);
 assert.equal(await watch.toggleFullscreen(desktop),true);
 assert.equal(document.fullscreenElement,desktop,'Desktop did not request native fullscreen');
 assert(watch.fullscreenActive(desktop));
 assert.equal(await watch.leaveFullscreen(desktop),true);
 assert.equal(document.fullscreenElement,null);
 assert(!desktop.classList.contains('pfc-watch-theater'));
 assert.equal(button.attrs['aria-pressed'],'false');
 console.log('PASS Watch fullscreen: native desktop, iPhone fallback, exit button, Escape and cleanup');
})().catch(err=>{console.error(err);process.exitCode=1});
