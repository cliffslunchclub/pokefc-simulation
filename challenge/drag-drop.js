/* PokéFC Challenge drag & drop: one rules gateway for mouse, pen and touch.
 * Keyboard/mobile click + dropdown controls remain available in the game UI. */
(function(root){
 'use strict';
 let dispose=null;
 const sourceName=s=>s.type==='item'?'Item: '+s.value:
  s.type==='held-item'?'Held item':s.type==='candidate'?'Pokémon #'+s.value:'Drafted Pokémon';
 function mount(app,options){
  if(dispose)dispose();
  if(!app||!options)return;
  let active=null,target=null,ghost=null;
  const win=typeof window!=='undefined'?window:null;
  const doc=typeof document!=='undefined'?document:null;
  const spots=Array.from(app.querySelectorAll?.('[data-slot-card]')||[]);
  const clearHighlight=()=>{
   spots.forEach(el=>{el.classList?.remove?.('drag-valid','drag-invalid','drag-hover')});
   target=null;
  };
  const release=()=>{
   clearHighlight();
   if(ghost?.remove)ghost.remove();
   ghost=null;active=null;
   win?.removeEventListener?.('pointermove',pointerMove);
   win?.removeEventListener?.('pointerup',pointerUp);
   win?.removeEventListener?.('pointercancel',release);
  };
  const valid=(source,index)=>{
   try{return Boolean(options.canDrop?.(source,index))}catch{return false}
  };
  const showTarget=(el)=>{
   if(target===el)return;
   clearHighlight();
   if(!el||!active)return;
   target=el;
   const index=Number(el.dataset?.slotCard),allowed=valid(active,index);
   el.classList?.add?.('drag-hover',allowed?'drag-valid':'drag-invalid');
  };
  const commit=(el)=>{
   if(!active||!el)return;
   const index=Number(el.dataset?.slotCard),source=active;
   release();
   options.onDrop?.(source,index);
  };
  const sourceOf=(kind,value)=>{
   const type=String(kind);
   if(!['item','held-item','candidate','pokemon'].includes(type))return null;
   return {type,value:String(value)};
  };
  // Use the actual sprite on the card; the native desktop drag image should
  // never be a screenshot of the entire card, stats, or equipment panel.
  const sourceSprite=(el,source)=>{
   const selectors={candidate:'[data-species-id]',pokemon:'[data-slot-card]',item:'[data-shop-pick]','held-item':'[data-held-item-source]'};
   const selector=selectors[source?.type];
   if(!selector)return null;
   const host=el?.closest?.(selector)||el;
   return host?.querySelector?.('img')||null;
  };
  const spriteOffset=image=>{
   const bounds=image?.getBoundingClientRect?.();
   return {
    x:Math.round((bounds?.width||image?.width||48)/2),
    y:Math.round((bounds?.height||image?.height||48)/2)
   };
  };
  const begin=(source,ev)=>{
   if(!source||!options.canDrag?.(source)){ev?.preventDefault?.();return false}
   active=source;return true;
  };
  const pointerAt=(e)=>doc?.elementFromPoint?.(e.clientX,e.clientY)?.closest?.('[data-slot-card]')||null;
  function pointerMove(e){
   if(!active)return;
   if(e.cancelable)e.preventDefault();
   if(ghost?.style){
    const item=ghost.className?.includes?.('challenge-drag-item');
    const size=ghost.className?.includes?.('challenge-drag-sprite')?(item?20:32):-13;
    ghost.style.transform='translate('+(e.clientX-size)+'px,'+(e.clientY-size)+'px)';
   }
   showTarget(pointerAt(e));
   // A short scroll step lets a touch drag reach a pitch outside the viewport.
   if(e.clientY<45)win?.scrollBy?.(0,-15);
   else if(e.clientY>(win?.innerHeight||900)-45)win?.scrollBy?.(0,15);
  }
  function pointerUp(e){
   if(!active)return;
   const el=pointerAt(e);
   if(el)commit(el);else release();
  }
  const startPointer=(el,source,e)=>{
   if(e.pointerType==='mouse'&&e.button!==0)return;
   if(!begin(source,e))return;
   if(e.cancelable)e.preventDefault();
   const sprite=sourceSprite(el,source);
   if(doc?.createElement&&doc?.body){
    ghost=doc.createElement(sprite?'img':'div');
    ghost.className='challenge-drag-ghost'+(sprite?' challenge-drag-sprite':'')+
     (source.type==='item'||source.type==='held-item'?' challenge-drag-item':'');
    if(sprite){ghost.src=sprite.currentSrc||sprite.src;ghost.alt='';ghost.draggable=false}
    else ghost.textContent=sourceName(source);
    doc.body.appendChild(ghost);
    const offset=sprite?(source.type==='item'||source.type==='held-item'?20:32):-13;
    ghost.style.transform='translate('+(e.clientX-offset)+'px,'+(e.clientY-offset)+'px)';
   }
   win?.addEventListener?.('pointermove',pointerMove,{passive:false});
   win?.addEventListener?.('pointerup',pointerUp);
   win?.addEventListener?.('pointercancel',release);
  };
  const native=(el,source)=>{
   if(!el||!source||!options.canDrag?.(source))return;
   el.draggable=true;
   el.ondragstart=e=>{
    if(!begin(source,e))return;
    if(e.dataTransfer){
     e.dataTransfer.effectAllowed=source.type==='item'?'copy':'move';
     e.dataTransfer.setData('text/plain','pokefc-challenge-drag');
     const sprite=sourceSprite(el,source);
     if(sprite&&typeof e.dataTransfer.setDragImage==='function'){
      const offset=spriteOffset(sprite);
      e.dataTransfer.setDragImage(sprite,offset.x,offset.y);
     }
    }
    e.stopPropagation?.();
   };
   el.ondragend=release;
  };
  Array.from(app.querySelectorAll?.('[data-shop-pick]')||[]).forEach(el=>{
   const source=sourceOf('item',el.dataset?.shopPick);
   native(el,source);
   // Button-based shop cards have unreliable HTML5 dragging in some browsers.
   // A pointer-based path also supports dragging by the icon or card surface.
   if(options.canDrag?.(source))el.onpointerdown=e=>{
    if(e.pointerType!=='mouse')return; // Touch scrolling uses the explicit grip.
    startPointer(el,source,e);
   };
  });
  Array.from(app.querySelectorAll?.('[data-species-id]')||[]).forEach(el=>native(el,sourceOf('candidate',el.dataset?.speciesId)));
  spots.forEach(el=>{
   native(el,sourceOf('pokemon',el.dataset?.slotCard));
   el.ondragenter=e=>{if(!active)return;e.preventDefault?.();showTarget(el)};
   el.ondragover=e=>{if(!active)return;e.preventDefault?.();if(e.dataTransfer)e.dataTransfer.dropEffect=valid(active,Number(el.dataset?.slotCard))?'move':'none';showTarget(el)};
   el.ondrop=e=>{if(!active)return;e.preventDefault?.();e.stopPropagation?.();commit(el)};
   el.ondragleave=e=>{if(el===target)clearHighlight()};
  });
  Array.from(app.querySelectorAll?.('[data-held-item-source]')||[]).forEach(el=>native(el,sourceOf('held-item',el.dataset?.heldItemSource)));
  Array.from(app.querySelectorAll?.('[data-drag-grip]')||[]).forEach(grip=>{
   const source=sourceOf(grip.dataset?.dragGrip,grip.dataset?.dragValue);
   if(!source||!options.canDrag?.(source))return;
   grip.onpointerdown=e=>{
    e.stopPropagation?.();
    startPointer(grip,source,e);
   };
  });
  dispose=release;
 }
 root.PFC_CHALLENGE_DND={mount,cancel(){if(dispose)dispose();dispose=null}};
})(typeof window!=='undefined'?window:globalThis);
