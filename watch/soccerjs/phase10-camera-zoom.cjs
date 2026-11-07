'use strict';
/* Pure, bounded camera zoom; never touches Match Director or PSE state. */
const MIN=.60,MAX=1.60,STEP=.15;
const round=n=>Math.round(n*100)/100;
const clamp=n=>Math.max(MIN,Math.min(MAX,Number.isFinite(n)?n:1));
function step(value,direction){
 const sign=Math.sign(direction);
 return round(clamp(round(clamp(value)+sign*STEP)));
}
const percent=value=>Math.round(clamp(value)*100)+'%';
module.exports={MIN,MAX,STEP,clamp,step,percent};
