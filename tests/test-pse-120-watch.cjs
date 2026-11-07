'use strict';
// Native 120-minute Watch bridge: fixture authority, 90'/120' clocks,
// shootout gates, manual penalty stepping, Watch→Sim and one-time record.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const qs=require('../assets/js/quick-sim.js'),KO=require('../assets/js/pse-knockout.js');
const {motionFrame}=require('../watch/soccerjs/phase10-motion.cjs');
const roles=['GK','DEF','DEF','DEF','DEF','MID','MID','MID','FWD','FWD','FWD'];
const preview={seed:'PSE-120',home:{id:'home',name:'Pewter',tactic:'balanced',lineup:[]},
 away:{id:'away',name:'Cerulean',tactic:'balanced',lineup:[]}};
for(const t of [preview.home,preview.away])t.lineup=roles.map((pos,i)=>({
 id:t.id+i,name:t.name+' Pokémon '+i,pos,main:{finishing:67+i,shortPassing:70+i,
 vision:69+i,tackling:70+i,firstTouch:71+i,sprintSpeed:72+i},
 detail:{composure:68+i,reflexes:69+i,handling:70+i,positioning:70+i,diving:70+i}
}));
function locate(kind){
 for(let i=0;i<600;i++){
  const seed='PSE-120-KO-'+i,regulation=qs.simulate(preview,{seed});
  const ko=KO.resolve(preview,regulation,{seed});
  if(ko.decidedBy===kind)return {ko,seed};
 }
 throw Error('No deterministic '+kind+' fixture available');
}
const cases={shootout:locate('shootout'),extra:locate('extra-time'),regulation:locate('regulation')};
const sent=[],listeners=new Map();let frame=null,records=0,cancels=0;
const origin='https://poke.example.test';
global.window={location:{origin,href:origin+'/play/?challenge=1'},
 addEventListener:(kind,cb)=>listeners.set(kind,cb),
 removeEventListener:(kind)=>listeners.delete(kind),
 setTimeout:()=>1,clearTimeout:()=>{}};
global.document={createElement(tag){
 assert.equal(tag,'iframe');
 frame={setAttribute(){},remove(){this.removed=true},
 contentWindow:{postMessage:(message,target)=>sent.push({message,target})}};
 return frame;
}};
const bridge=require('../watch/soccerjs/watch-bridge.js');
const assembled=ko=>({...ko.match,...(ko.shootout?{shootout:ko.shootout}:{})});
for(const {ko} of Object.values(cases)){
 const result=assembled(ko),fixture=bridge.snapshot(preview,result);
 assert.equal(fixture.durationMinutes,ko.extraTime?120:90);
 assert.deepEqual(bridge.scoreAt(fixture,fixture.durationMinutes),result.score);
 if(ko.extraTime){
  assert.deepEqual(bridge.scoreAt(fixture,90),ko.regulationScore);
  assert.equal(fixture.knockoutRules,'pse-knockout-v1');
  for(const event of fixture.events)assert(event.minute>=0&&event.minute<120);
  const etGoal=fixture.events.find(e=>e.type==='goal'&&e.minute>=90);
  if(etGoal){
   const frame=motionFrame(fixture,etGoal.minute+.01,{width:106,height:68});
   assert.equal(frame.officialEvent?.minute,etGoal.minute);
  }
 }
 if(ko.shootout){
  assert.equal(fixture.shootout.attempts.length,ko.shootout.attempts.length);
  for(let index=1;index<=ko.shootout.attempts.length;index++){
   const visual=motionFrame(fixture,120,{width:106,height:68},{kickIndex:index});
   assert.equal(visual.officialEvent?.id,ko.shootout.attempts[index-1].id);
   assert.match(visual.action,/^official-shootout-(goal|saved|off-target)$/);
  }
 }
}
const sample=assembled(cases.shootout.ko),fixture=bridge.snapshot(preview,sample),kickTotal=fixture.shootout.attempts.length;
const body=JSON.stringify(sample),container={appendChild(el){assert.equal(el,frame)}};
const events=[];
const send=(kind,props={})=>listeners.get('message')({
 origin,source:frame.contentWindow,data:{type:'pfc-phase10-'+kind,...props}
});
const session=bridge.mountInline({preview,result:sample,container,
 onRecord:({result})=>{records++;assert.equal(result,sample)},
 onCancel:()=>{cancels++},
 onReady:()=>events.push('ready'),
 onProgress:state=>events.push(state),
 onStatus:()=>{}});
assert.equal(session.getState().durationMinutes,120);
assert.equal(session.record(),false);
send('ready');send('booted',{projection:'orthographic'});
assert(events.includes('ready'));
assert.equal(session.openHighlights(),true,'Every Watch mode can open official highlights');
assert.equal(sent.at(-1).message.action,'highlights');
assert.equal(session.replayHighlight('goal-0'),true);
assert.deepEqual({action:sent.at(-1).message.action,id:sent.at(-1).message.id},
 {action:'replay',id:'goal-0'});
assert.equal(session.replayHighlight('goal-0;alert(1)'),false,'Rejected non-incident replay key');
assert.equal(JSON.stringify(sample),body,'Highlight controls cannot alter the official result');
send('progress',{minute:90,score:bridge.scoreAt(fixture,90),kickIndex:0});
assert.equal(session.getState().finished,false,'90 is halftime of an extended match');
send('progress',{minute:119,score:bridge.scoreAt(fixture,119),kickIndex:0});
assert.equal(session.getState().finished,false);
send('progress',{minute:120,score:sample.score,kickIndex:0});
assert.equal(session.record(),false,'120-min tie cannot record before shootout finishes');
assert.equal(session.nextKick(),true);
assert.equal(sent.at(-1).message.action,'next-kick');
send('progress',{minute:120,score:sample.score,kickIndex:1});
assert.equal(session.getState().kickIndex,1);
assert.equal(session.record(),false);
send('progress',{minute:120,score:sample.score,kickIndex:kickTotal});
assert.equal(session.getState().finished,true);
assert.equal(session.record(),true);
assert.equal(session.record(),false,'Results are recorded exactly once');
assert.equal(records,1);
assert.equal(JSON.stringify(sample),body,'Watch must not mutate locked result');
session.destroy();
assert.equal(bridge.isActive(),false);
const skip=bridge.mountInline({preview,result:sample,container,autoRecordOnSimToEnd:true,
 onRecord:()=>records++,onCancel:()=>cancels++});
send('ready');send('booted',{projection:'orthographic'});
send('progress',{minute:65,score:bridge.scoreAt(fixture,65)});
assert.equal(skip.simToEnd(),true);
assert.equal(sent.at(-1).message.action,'finish');
assert.equal(skip.seek(15),false,'Watch → Sim forbids returning to Watch');
send('progress',{minute:120,score:sample.score,kickIndex:0});
assert.equal(records,1,'Sim to End cannot auto-record before final penalty');
send('progress',{minute:120,score:sample.score,kickIndex:kickTotal});
assert.equal(records,2,'Full verified shootout automatically records without clicking');
assert.equal(skip.record(),false,'Auto-recorded handoff cannot record twice');
assert.equal(skip.cancel(),false,'Completed official result cannot be discarded');
skip.destroy();
const cancel=bridge.mountInline({preview,result:sample,container,
 onRecord:()=>records++,onCancel:()=>cancels++});
assert.equal(cancel.cancel(),true);
assert.equal(cancels,1);
assert.equal(records,2,'Cancel never records progress');
const tampered=JSON.parse(JSON.stringify(sample));
tampered.shootout.attempts[0].scored=!tampered.shootout.attempts[0].scored;
assert.throws(()=>bridge.snapshot(preview,tampered),/penalty outcome/);
const tamperedGoal=JSON.parse(JSON.stringify(sample));tamperedGoal.regulationScore[0]++;
assert.throws(()=>bridge.snapshot(preview,tamperedGoal),/Regulation score/);
const html=fs.readFileSync(path.join(__dirname,'../watch/soccerjs/index.html'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../watch/soccerjs/viewer.css'),'utf8');
for(const id of ['shootoutOverlay','shootoutScore','shootoutAdvance','nextKick','seekEnd'])
 assert(html.includes('id="'+id+'"'),'Mobile shootout DOM missing '+id);
assert.match(css,/min-height:44px/,'Touch target has accessible 44px height');
console.log('PASS PSE 120 Watch: 90→120 score, extra-time goals, '+kickTotal+
 ' official kicks, automatic Sim-to-End result, manual normal full time, cancel and no duplicate saves');
