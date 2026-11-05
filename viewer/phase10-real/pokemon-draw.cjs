'use strict';
const {badge}=require('./pokemon-badge.cjs');
function draw(g,player,entry,screen,showNumbers,selected){
 const q=screen(player.x,player.y,0),x=q.x,y=q.y,size=72;
 g.save();
 g.beginPath();g.ellipse(x,y-2,22,9,0,0,Math.PI*2);
 g.fillStyle=entry.color+'55';g.strokeStyle=entry.side===1?'#E53935':entry.color;
 g.lineWidth=selected?4:2.5;g.fill();g.stroke();
 const loaded=entry.image?.naturalWidth>0;
 if(loaded){g.imageSmoothingEnabled=false;g.drawImage(entry.image,x-size/2,y-size-4,size,size)}
 else{g.fillStyle='#31465C';g.beginPath();g.arc(x,y-26,17,0,Math.PI*2);g.fill();
  g.fillStyle='#FFF';g.font='bold 13px system-ui';g.textAlign='center';g.fillText('?',x,y-22)}
 if(showNumbers)badge(g,x,y-size-15,entry.number,entry.color,entry.role==='GK');
 if(selected){
  const name=entry.name.slice(0,16),labelY=y-size-(showNumbers?44:22);
  g.font='bold 12px system-ui';const w=g.measureText(name).width+18;
  g.fillStyle='#0C1C2DEB';g.fillRect(x-w/2,labelY-12,w,24);
  g.fillStyle='#FFF';g.textBaseline='middle';g.textAlign='center';g.fillText(name,x,labelY);
 }
 g.restore();return !!loaded;
}
module.exports={draw};
