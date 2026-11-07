'use strict';
function badge(g,x,y,text,fill,keeper){
 g.save();g.lineWidth=2.5;g.strokeStyle='#102032';g.fillStyle=fill;
 g.beginPath();
 if(keeper){g.moveTo(x-12,y-12);g.lineTo(x+12,y-12);g.lineTo(x+11,y+6);g.lineTo(x,y+15);g.lineTo(x-11,y+6);g.closePath()}
 else g.arc(x,y,13,0,Math.PI*2);
 g.fill();g.stroke();
 g.font='900 13px system-ui';g.textAlign='center';g.textBaseline='middle';
 g.fillStyle=fill.toUpperCase()==='#FFFFFF'?'#E53935':'#FFFFFF';
 // Keep one- and two-digit shirts geometrically centered; no leading 0.
 g.fillText(String(text).replace(/^0+(?=\d)/,''),x,y+1);
 g.restore();
}
module.exports={badge};
