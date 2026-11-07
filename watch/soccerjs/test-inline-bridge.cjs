'use strict';
// Standalone Node regression: no browser bundle, private Actions, or network.
const assert=require('node:assert/strict');
const fixture=require('./fixture.json');
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
 onReady:session=>{ready++;assert(session.play(4));assert(session.setProjection('orthographic'))},
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
send('booted',{projection:'isometric'});
assert.match(session.getState().error,/Broadcast/,'Reject a non-default camera at boot');
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
send('booted',{projection:'orthographic'});
assert.equal(ready,1);
assert.equal(second.getState().ready,true);
assert(frame.messages.some(x=>x.message.type==='pfc-phase10-control'&&x.message.action==='play'));
send('progress',{minute:54,score:[1,0]});
assert.deepEqual(latestProgress.score,[1,0]);
assert.equal(second.getState().minute,54);
assert.equal(second.seek(20),true,'Visual seeking before handoff is allowed');
assert(second.simToEnd());
assert.equal(second.seek(40),false,'No Sim → Watch after handoff');
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
// Explicitly opted-in Sim to End finalizes automatically, but regular Watch
// full-time (tested above) still requires manual Record.
const third=bridge.mountInline({...callbacks,autoRecordOnSimToEnd:true});
send('ready');send('booted',{projection:'orthographic'});
send('progress',{minute:54,score:[1,0]});
assert.equal(records,1,'No pre-full-time mutation before Sim to End');
assert.equal(third.simToEnd(),true);
assert.equal(records,1,'Handoff request alone is not enough to save');
send('progress',{minute:90,score:[2,1]});
assert.equal(records,2,'Verified Sim to End automatically invokes Record');
assert.equal(third.record(),false,'Automatic result cannot be recorded again');
assert.equal(third.cancel(),false,'Saved handoff result cannot be cancelled');
assert.equal(third.getState().recorded,true);
assert.equal(JSON.stringify(result),raw,'Auto-finalization never mutates source PSE result');
third.destroy();
assert.equal(bridge.isActive(),false);
const invalid=bridge.mountInline({...callbacks,autoRecordOnSimToEnd:true});
send('ready');send('booted',{projection:'orthographic'});
assert.equal(invalid.simToEnd(),true);
send('progress',{minute:90,score:[999,999]});
assert.match(invalid.getState().error,/score differs/i,'Tampered final frame cannot auto-record');
assert.equal(records,2,'Invalid full-time result leaves saved record count unchanged');
assert.equal(invalid.cancel(),true,'Failed watch can be canceled without saving');
assert.equal(cancels,2);
console.log('PASS inline 2.5D Watch: manual full-time, auto Sim-to-End, official score validation, once-only Record and cancel safety');
