'use strict';
const HOME='#E53935',AWAY='#FFFFFF';
function colors(){return [HOME,AWAY]}
function number(p,i){
 const n=Number(p?.jerseyNumber??p?.shirtNumber??p?.number);
 return Number.isInteger(n)&&n>=1&&n<=99?n:i+1;
}
module.exports={colors,number,HOME,AWAY};
