/* Movable, non-modal Challenge scouting picker.
 * Only desktop windows can be dragged. Mobile gets a dedicated full-screen
 * drafting UI and never needs precision pointer positioning. */
(function(root){
 'use strict';
 const EDGE=8;
 const number=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
 function clampPosition(position,box,viewport,pad=EDGE){
  const edge=Math.max(0,number(pad,EDGE));
  const vw=Math.max(0,number(viewport.width)),vh=Math.max(0,number(viewport.height));
  const width=Math.max(0,number(box.width)),height=Math.max(0,number(box.height));
  const maxX=Math.max(edge,vw-width-edge),maxY=Math.max(edge,vh-height-edge);
  return {
   left:Math.min(maxX,Math.max(edge,number(position.left,edge))),
   top:Math.min(maxY,Math.max(edge,number(position.top,edge)))
  };
 }
 function mount(dialog,handle,options={}){
  if(!dialog||!handle||typeof handle.addEventListener!=='function')return ()=>{};
  const isDesktop=()=>!root.matchMedia||root.matchMedia('(min-width: 761px)').matches;
  const view=()=>({width:root.innerWidth||root.document?.documentElement?.clientWidth||1024,
   height:root.innerHeight||root.document?.documentElement?.clientHeight||768});
  const position=()=>dialog.getBoundingClientRect?.()||{left:0,top:0,width:0,height:0};
  let drag=null,disposed=false;
  function place(left,top){
   if(disposed||!isDesktop()||!dialog.style?.setProperty)return null;
   const next=clampPosition({left,top},position(),view());
   dialog.style.setProperty('left',next.left+'px','important');
   dialog.style.setProperty('top',next.top+'px','important');
   dialog.style.setProperty('right','auto','important');
   dialog.style.setProperty('bottom','auto','important');
   options.onMove?.(next);
   return next;
  }
  function down(e){
   if(disposed||!isDesktop()||dialog.hidden||(dialog.tagName==='DIALOG'&&dialog.open===false)||e.button!==0||drag)return;
   // The full title bar is the handle, but its Close/Hide button must click normally.
   if(e.target?.closest?.('button, a, input, select, textarea, [data-no-window-drag]'))return;
   const box=position();
   drag={pointerId:e.pointerId,x:number(e.clientX),y:number(e.clientY),left:box.left,top:box.top};
   handle.setPointerCapture?.(e.pointerId);
   e.preventDefault?.();
  }
  function move(e){
   if(!drag||drag.pointerId!==e.pointerId)return;
   place(drag.left+number(e.clientX)-drag.x,drag.top+number(e.clientY)-drag.y);
  }
  function up(e){
   if(!drag||drag.pointerId!==e.pointerId)return;
   drag=null;
   if(handle.hasPointerCapture?.(e.pointerId))handle.releasePointerCapture?.(e.pointerId);
  }
  function keydown(e){
   if(disposed||!isDesktop()||(e.target&&e.target!==handle))return;
   const offsets={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
   const amount=offsets[e.key];if(!amount)return;
   const box=position(),step=e.shiftKey?64:20;
   place(box.left+step*amount[0],box.top+step*amount[1]);
   e.preventDefault?.();
  }
  function resized(){
   if(disposed)return;
   if(!isDesktop()){
    drag=null;
    for(const prop of ['left','right','top','bottom'])dialog.style?.removeProperty?.(prop);
   }else if(options.currentPosition?.()){
    const saved=options.currentPosition();
    place(saved.left,saved.top);
   }
  }
  handle.addEventListener('pointerdown',down);
  handle.addEventListener('pointermove',move);
  handle.addEventListener('pointerup',up);
  handle.addEventListener('pointercancel',up);
  handle.addEventListener('keydown',keydown);
  root.addEventListener?.('resize',resized);
  resized();
  return ()=>{
   if(disposed)return;
   disposed=true;drag=null;
   handle.removeEventListener?.('pointerdown',down);
   handle.removeEventListener?.('pointermove',move);
   handle.removeEventListener?.('pointerup',up);
   handle.removeEventListener?.('pointercancel',up);
   handle.removeEventListener?.('keydown',keydown);
   root.removeEventListener?.('resize',resized);
  };
 }
 root.PFC_CHALLENGE_PICKER_WINDOW={mount,clampPosition};
})(typeof window!=='undefined'?window:globalThis);
