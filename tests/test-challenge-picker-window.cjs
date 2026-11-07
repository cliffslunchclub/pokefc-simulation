'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
let desktop=true,listener=null,px=580,py=90,disposals=0,pointer=null;
const styles=new Map(),callbacks=new Map(),windowEvents=new Map(),moved=[];
const root={
 innerWidth:1000,innerHeight:700,
 matchMedia:()=>({matches:desktop}),
 addEventListener(name,fn){windowEvents.set(name,fn)},
 removeEventListener(name,fn){if(windowEvents.get(name)===fn)windowEvents.delete(name)}
};
const dialog={
 open:true,
 style:{
  setProperty(name,value,priority){
   assert.equal(priority,'important','Inline position overrides existing important CSS');
   styles.set(name,value);
   if(name==='left')px=Number.parseFloat(value);
   if(name==='top')py=Number.parseFloat(value);
  },
  removeProperty(name){styles.delete(name)}
 },
 getBoundingClientRect:()=>({left:px,top:py,width:400,height:500})
};
const grip={
 addEventListener(name,fn){callbacks.set(name,fn)},
 removeEventListener(name,fn){if(callbacks.get(name)===fn)callbacks.delete(name)},
 setPointerCapture(id){pointer=id},
 hasPointerCapture(id){return pointer===id},
 releasePointerCapture(id){if(id===pointer)pointer=null}
};
const ctx=vm.createContext({window:root,console});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../challenge/picker-window.js'),'utf8'),ctx);
const api=root.PFC_CHALLENGE_PICKER_WINDOW;
assert(api,'Picker window helper exported');
assert.deepEqual({...api.clampPosition({left:900,top:-30},{width:400,height:500},{width:1000,height:700})},
 {left:592,top:8},'Coordinates are clamped inside available viewport');
let remembered=null;
const unmount=api.mount(dialog,grip,{onMove:p=>{remembered={...p};moved.push({...p})},
 currentPosition:()=>remembered});
assert(callbacks.has('pointerdown')&&callbacks.has('keydown'),'Pointer and keyboard controls bound');
const down={pointerId:7,button:0,clientX:100,clientY:100,preventDefault(){this.stopped=true}};
callbacks.get('pointerdown')(down);
assert.equal(down.stopped,true,'Dragging prevents text selection');
assert.equal(pointer,7,'Grip captures pointer');
callbacks.get('pointermove')({pointerId:7,clientX:740,clientY:810});
assert.equal(remembered.left,592,'Drag moves horizontally up to viewport edge');
assert.equal(remembered.top,192,'Drag moves vertically up to viewport edge');
assert.equal(styles.get('right'),'auto','Moved window stops obeying original right CSS');
callbacks.get('pointerup')({pointerId:7});
assert.equal(pointer,null,'Pointer capture released');
const closeTarget={closest:selector=>selector.includes('button')?{tagName:'BUTTON'}:null};
let closePrevented=false;
callbacks.get('pointerdown')({pointerId:18,button:0,clientX:100,clientY:100,target:closeTarget,
 preventDefault(){closePrevented=true}});
assert.equal(pointer,null,'Close/Hide button never starts a title-bar drag');
assert.equal(closePrevented,false,'Close/Hide button retains its click behavior');
callbacks.get('pointerdown')({pointerId:19,button:0,clientX:100,clientY:100,target:{closest:()=>null}});
assert.equal(pointer,19,'Clicking any non-button title-bar child starts dragging');
callbacks.get('pointerup')({pointerId:19});
callbacks.get('pointerdown')({pointerId:8,button:2,clientX:100,clientY:100});
assert.equal(pointer,null,'Right click does not start drag');
let keyboardStopped=false;
callbacks.get('keydown')({key:'ArrowLeft',shiftKey:true,preventDefault(){keyboardStopped=true}});
assert.equal(remembered.left,528,'Shift arrow adjusts window by 64 pixels');
assert.equal(keyboardStopped,true,'Keyboard arrows prevent page scrolling');
callbacks.get('keydown')({key:'ArrowRight',target:{id:'closeDraftPicker'},preventDefault(){throw Error('Close button must not move window')}});
assert.equal(remembered.left,528,'Arrow keys on Close button do not move the window');
root.innerWidth=650;
windowEvents.get('resize')();
assert.equal(remembered.left,242,'Window re-clamps on desktop resize');
desktop=false;
windowEvents.get('resize')();
assert.equal(styles.has('left'),false,'Mobile clears desktop inline positioning');
callbacks.get('pointerdown')({pointerId:9,button:0,clientX:30,clientY:30});
assert.equal(pointer,null,'Mobile precision dragging disabled');
callbacks.get('keydown')({key:'ArrowRight'});
assert.equal(remembered.left,242,'Mobile keyboard does not move window');
desktop=true;
windowEvents.get('resize')();
assert.equal(styles.get('left'),'242px','Desktop position restores after returning from mobile');
unmount();
disposals++;
assert.equal(windowEvents.has('resize'),false,'Unmount frees viewport handler');
assert.equal(callbacks.has('pointermove'),false,'Unmount removes old pointer listeners');
assert(disposals===1&&moved.length>=3,'Movements reported without creating a second window');
console.log('PASS movable scouting window: captured pointer drag, keyboard nudge, resize clamping, mobile disable and cleanup');
