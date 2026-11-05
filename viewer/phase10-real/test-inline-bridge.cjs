'use strict';
// Standalone Node regression: no browser bundle, private Actions, or network.
const assert=require('node:assert/strict');
const fixture=require('../../fixtures/phase10-real-quicksim-v07b.json');
const listeners=new Map(),timers=new Set();
let frame=null,cancels=0,records=0,ready=0,latestProgress=null,lastStatus=null;
const origin='http://127.0.0.1:8765';
global.window={
 location:{origin,href:origin+'/play/?watch=soccerjs'},
 addEventListener:(type,fn)=>listeners.set(type,fn),
 removeEventListener:(type,fn)=>{if(listeners.get(type)===fn)listeners.delete(type)},
 setTimeout:(fn)=>{timers.add(fn);return fn},
 clearTimeout:fn=>timers.delete(fn)
};
global.document={
 createElement:tag=>{
  assert.equal(tag,'iframe');
  frame={
   attrs:{},messages:[],removed:false,
   setAttribute(name,value){this.attrs[name]=value},
   remove(){this.removed=true},
   contentWindow:{postMessage(message,target){frame.messages.push({message,target})}}
  };
  return frame;
 }
};
const bridge=require('./watch-bridge.js');
const result={
 origin:'quick-sim',home:fixture.home.id,away:fixture.away.id,
 score:fixture.score.slice(),stats:fixture.stats,
 events:fixture.events,box:fixture.box
};
const raw=JSON.stringify(result);
const viewport={appendChild(node){assert.equal(node,frame);this.frame=node}};
const callbacks={
 preview:{home:fixture.home,away:fixture.away},result,container:viewport,
 onRecord:({result:official})=>{records++;assert.equal(official,result)},
 onCancel:()=>{cancels++},
 onReady:session=>{ready++;assert(session.play(4));assert(session.setProjection('isometric'))},
 onProgress:x=>{latestProgress=x},
 onStatus:x=>{lastStatus=x}
};
const send=(type,data={},opts={})=>{
 listeners.get('message')({
  origin:opts.origin||origin,source:opts.source||frame.contentWindow,
  data:{type:'pfc-phase10-'+type,...data}
 });
};
const session=bridge.mountInline(callbacks);
assert.equal(bridge.isActive(),true);
assert(viewport.frame.src.includes('embedded=1&inline=1'));
assert.equal(session.getState().ready,false);
assert.equal(session.record(),false,'Cannot save before full time');
send('ready');
assert.equal(frame.messages.at(-1).message.type,'pfc-phase10-fixture');
assert.deepEqual(frame.messages.at(-1).message.fixture.score,[2,1]);
assert.equal(frame.messages.at(-1).target,origin);
send('booted',{projection:'topdown'});
assert.match(session.getState().error,/isometric/,'Reject a non-2.5D viewer');
assert.equal(session.play(),false);
assert(session.cancel());
assert.equal(cancels,1);
assert.equal(frame.removed,true);
assert.equal(bridge.isActive(),false);

const second=bridge.mountInline(callbacks);
send('ready',{},{origin:'https://untrusted.invalid'});
assert.equal(second.getState().ready,false,'Ignore foreign-origin messages');
send('ready',{},{source:{}});
assert.equal(second.getState().ready,false,'Ignore other iframe messages');
send('ready');
send('booted',{projection:'isometric'});
assert.equal(ready,1);
assert.equal(second.getState().ready,true);
assert(frame.messages.some(x=>x.message.type==='pfc-phase10-control'&&x.message.action==='play'));
send('progress',{minute:54,score:[1,0]});
assert.deepEqual(latestProgress.score,[1,0]);
assert.equal(second.getState().minute,54);
assert(second.simToEnd());
assert.equal(second.record(),false,'Cannot save before official final frame is confirmed');
assert(frame.messages.some(x=>x.message.type==='pfc-phase10-control'&&x.message.action==='seek'&&x.message.minute===90));
send('progress',{minute:60,score:[1,0]});
assert.equal(second.getState().minute,54,'Ignore stale progress after handoff');
send('progress',{minute:90,score:[2,1]});
assert.deepEqual(latestProgress.score,[2,1]);
assert.equal(second.getState().finished,true);
assert.equal(second.record(),true);
assert.equal(second.record(),false,'Do not record twice');
assert.equal(second.cancel(),false,'Do not cancel a saved result');
assert.equal(records,1);
assert.equal(JSON.stringify(result),raw,'Do not mutate source Quick Sim result');
second.destroy();
assert.equal(bridge.isActive(),false);
assert.equal(frame.removed,true);
assert.equal(cancels,1);
assert.equal(listeners.has('message'),false,'No leaked message listener');
assert.equal(timers.size,0,'No leaked timeout');
assert.equal(lastStatus.state,'recorded');
console.log('PASS inline 2.5D Watch: isometric boot, source isolation, immutable result, Watch→Sim, one-time record, cancel and cleanup');
