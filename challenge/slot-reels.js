/* PokéFC Challenges draft-roll animation.
 * Purely visual: result is decided and saved by Challenge rules before reel starts.
 * Never calls the game RNG or mutates lineup, reroll credits, or eligibility.
 * Respect reduced motion, let players skip, cancel old timers on rerender. */
(function(root){
 'use strict';
 const REGIONS=['KANTO','JOHTO','HOENN','SINNOH','UNOVA','KALOS','ALOLA','GALAR','PALDEA'];
 const TYPES=['NORMAL','FIRE','WATER','GRASS','ELECTRIC','ICE','FIGHTING','POISON','GROUND','FLYING','PSYCHIC','BUG','ROCK','GHOST','DRAGON','DARK','STEEL','FAIRY'];
 let active=null;
 function cancel(){
  if(!active)return;
  active.cancelled=true;
  for(const id of active.timers)clearInterval(id);
  for(const id of active.timeouts)clearTimeout(id);
  active=null;
 }
 function setText(node,value){if(node)node.textContent=value}
 function setAnimationClass(node,animate){if(!node?.classList)return;node.classList.toggle('is-spinning',animate)}
 function finish(slot){
  if(!slot||slot.cancelled)return;
  slot.cancelled=true;
  for(const id of slot.timers)clearInterval(id);
  for(const id of slot.timeouts)clearTimeout(id);
  const {root:el,result,onDone}=slot;
  setText(el.querySelector('[data-reel-value="region"]'),result.region);
  setText(el.querySelector('[data-reel-value="type"]'),result.type);
  el.querySelectorAll('.slot-reel').forEach(x=>setAnimationClass(x,false));
  if(el.classList)el.classList.remove('slot-machine-spinning');
  const skip=el.querySelector('[data-reel-skip]');if(skip)skip.hidden=true;
  const live=el.querySelector('[data-reel-live]');
  setText(live,'Scouting complete. Pokémon choices are available.');
  active=null;
  if(typeof onDone==='function')onDone();
 }
 function mount(el,result,opts={}){
  cancel();
  if(!el||typeof el.querySelector!=='function'){if(typeof opts.onDone==='function')opts.onDone();return}
  const onDone=typeof opts.onDone==='function'?opts.onDone:()=>{};
  const region=REGIONS[(Math.max(1,Number(result.gen)||1)-1)%REGIONS.length];
  const data={region,type:String(result.type||'NORMAL').toUpperCase()};
  const reels={region:el.querySelector('[data-reel-value="region"]'),type:el.querySelector('[data-reel-value="type"]')};
  if(!Object.values(reels).every(Boolean)){onDone();return}
  const willSpin=Boolean(opts.animate)&&typeof setInterval==='function'&&typeof setTimeout==='function'&&!(root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  const slot={root:el,result:data,timers:[],timeouts:[],cancelled:false,onDone};
  active=slot;
  if(!willSpin){finish(slot);return}
  if(el.classList)el.classList.add('slot-machine-spinning');
  const skip=el.querySelector('[data-reel-skip]');if(skip){skip.hidden=false;skip.onclick=()=>finish(slot)}
  const live=el.querySelector('[data-reel-live]');setText(live,'Drawing your next Pokémon scouting pool…');
  // Uniform visual cycling only. The final region and type are already saved.
  const animationFields=[
   {name:'region',sequence:REGIONS.slice(0,Math.max(1,Math.min(9,Number(opts.pool)||4))),delay:850},
   {name:'type',sequence:TYPES,delay:1200}
  ];
  for(const field of animationFields){
   const node=reels[field.name];
   setAnimationClass(node?.closest('.slot-reel'),true);
   let tick=(data.region.charCodeAt(0)+field.name.length)%field.sequence.length;
   setText(node,field.sequence[tick]);
   const timer=setInterval(()=>{
    if(slot.cancelled)return;
    tick=(tick+1)%field.sequence.length;
    setText(node,field.sequence[tick]);
   },75);
   slot.timers.push(timer);
   // Staggered reel stops create the arcade feel.
   slot.timeouts.push(setTimeout(()=>{
    if(slot.cancelled)return;
    clearInterval(timer);
    setText(node,data[field.name]);
    setAnimationClass(node?.closest('.slot-reel'),false);
   },field.delay));
  }
  slot.timeouts.push(setTimeout(()=>finish(slot),1320));
 }
 root.PFC_CHALLENGE_SLOT_REELS={mount,cancel,regions:REGIONS,types:TYPES};
})(typeof window!=='undefined'?window:globalThis);
