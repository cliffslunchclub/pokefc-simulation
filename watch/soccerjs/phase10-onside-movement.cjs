'use strict';
// Watch movement only. Distances are metres; PSE events remain untouched.
const BUFFER=.5;
const ease=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v)};
const depth=(side,x,field)=>side===0?x:field.width-x;
function line(actors,field,side,ball){
 const opponents=actors.filter(p=>p.side!==side)
  .map(p=>depth(side,p.x,field)).sort((a,b)=>b-a);
 return Math.max(field.width/2,Math.max(opponents[1],depth(side,ball.x,field))-BUFFER);
}
function apply(actors,field,ball,side,{carrier=-1,runner=-1,run=0,strength=1}={}){
 // Snapshot the second-last opponent INCLUDING a rushing goalkeeper.
 const boundary=line(actors,field,side,ball);
 for(let id=side*11+1;id<side*11+11;id++){
  if(id===carrier)continue;
  const p=actors[id],x=depth(side,p.x,field);
  // Continuous min/max preserves motion when a defender steps up. The
  // released receiver eases out of the limit rather than jumping forward.
  const freedom=id===runner?ease(run):0;
  const next=x-Math.max(0,x-boundary)*strength*(1-freedom);
  p.x=side===0?next:field.width-next;
 }
 return boundary;
}
module.exports={BUFFER,line,apply};
