'use strict';
const assert=require('node:assert/strict');
const {badge}=require('../watch/soccerjs/pokemon-badge.cjs');
const {draw}=require('../watch/soccerjs/pokemon-draw.cjs');
const {number}=require('../watch/soccerjs/pokemon-colors.cjs');

function mockCanvas(){
 const labels=[];
 const g={
  save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},
  arc(){},ellipse(){},fill(){},stroke(){},drawImage(){},
  fillText(text,x,y){labels.push({text:String(text),x,y,align:this.textAlign,
   baseline:this.textBaseline,font:this.font,color:this.fillStyle});}
 };
 return {g,labels};
}
for(const keeper of [false,true]){
 for(const fill of ['#E53935','#FFFFFF']){
  for(const [shirt,expected] of [[1,'1'],[9,'9'],[10,'10'],[99,'99'],['01','1'],['09','9']]){
   const {g,labels}=mockCanvas();
   badge(g,110,40,shirt,fill,keeper);
   assert.equal(labels.length,1,'Exactly one player number expected');
   assert.equal(labels[0].text,expected,'Badge must omit shirt-number leading zeros');
   assert.equal(labels[0].x,110,'Badge number must remain horizontally centered');
   assert.equal(labels[0].y,41,'Badge number must remain vertically centered');
   assert.equal(labels[0].align,'center');
   assert.equal(labels[0].baseline,'middle');
   assert.equal(labels[0].color,fill==='#FFFFFF'?'#E53935':'#FFFFFF');
  }
 }
}
// Both regular and goalkeeper Pokémon use this one shared renderer in
// Quick Play, Challenges and Franchise: verify the draw path itself too.
for(const [role,fill,shirt] of [['GK','#FFFFFF',1],['DEF','#E53935',7],['FWD','#FFFFFF',10]]){
 const {g,labels}=mockCanvas();
 const entry={name:'Pokémon',role,color:fill,number:number({jerseyNumber:shirt},shirt-1),
  image:{naturalWidth:80}};
 draw(g,{x:3,y:8},entry,()=>({x:170,y:170}),true,false);
 assert.equal(labels.length,1,'One shirt number per Pokémon sprite');
 assert.equal(labels[0].text,String(shirt));
 assert.equal(labels[0].x,170);
 assert.equal(labels[0].align,'center');
 assert.equal(labels[0].baseline,'middle');
}
console.log('PASS PokéFC Watch shirt badges: 1–99 unpadded, home/away/GK centered in shared renderer');
