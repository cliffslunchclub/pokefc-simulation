/* PokéFC Challenges v1.0 — standalone PNG result card, no image libraries.
 * Sprites are loaded from the existing PokéAPI sprite repository with CORS.
 * If an image fails, the PNG still contains the species name and Dex number. */
(function(root){
 'use strict';
 const W=1200,H=1600;
 const SPRITE='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/';
 const roles={
  '4-3-3':['GK','LB','CB','CB','RB','CM','CM','CM','LW','ST','RW'],
  '4-2-3-1':['GK','LB','CB','CB','RB','CDM','CDM','LW','CAM','RW','ST'],
  '4-4-2':['GK','LB','CB','CB','RB','LM','CM','CM','RM','ST','ST'],
  '3-5-2':['GK','CB','CB','CB','LWB','RWB','CM','CM','CAM','ST','ST'],
  '5-3-2':['GK','LWB','CB','CB','CB','RWB','CM','CM','CM','ST','ST']
 };
 const opponentNames=['LORELEI','BRUNO','AGATHA','LANCE','BLUE','RED'];
 function summary(st,byId){
  if(!st||st.phase!=='finished'||!st.locked||!Array.isArray(st.history))throw new Error('Complete a Challenge run first.');
  const line=st.locked.roster,formation=st.locked.formation||st.formation;
  if(!Array.isArray(line)||line.length!==11)throw new Error('Invalid locked lineup.');
  const positions=roles[formation]||roles['4-3-3'];
  const played=st.history.length,wins=st.history.filter(m=>m.outcome==='Victory').length;
  return {
   category:(st.pool===4?'CLASSIC · GEN I–IV':'NATIONAL · GEN I–IX')+' / LEGENDS '+(st.legends?'ON':'OFF'),
   champions:played===6&&wins===6,teamScore:Number(st.locked.score)||0,
   formation,tactic:st.locked.tactic||st.tactic||'balanced',wins,losses:played-wins,played,
   players:line.map((id,i)=>{
    const item=String(st.locked.items?.[i]||''),base=String(byId.get(id)?.name||'Unknown');
    const mega=(root.PFC_CHALLENGE_SPECIAL?.megas?.[id]||[]).find(x=>x.stone===item),suffix=mega?.form?.split('-mega')[1]||'';
    return {id,role:positions[i],name:mega?(mega.primal?'Primal '+base:'Mega '+base+(suffix?' '+suffix.replace(/^-/, '').toUpperCase():'')):base,
     spriteId:mega?root.PFC_CHALLENGE_MEGA_SPRITES?.[mega.form]||id:id,item};
   }),
   results:st.history.map(m=>({boss:String(m.boss||''),score:Array.isArray(m.score)?m.score.slice(0,2):[0,0],outcome:String(m.outcome||'Defeat'),shootout:m.shootout?{home:Number(m.shootout.home)||0,away:Number(m.shootout.away)||0}:null})),
   createdAt:new Date().toISOString().slice(0,10)
  };
 }
 function rect(ctx,x,y,w,h,color){
  ctx.fillStyle=color;ctx.fillRect(x,y,w,h);
 }
 function line(ctx,text,x,y,size=20,color='#f3fbff',weight=700,maxWidth){
  ctx.fillStyle=color;ctx.textAlign='left';ctx.font=weight+' '+size+'px system-ui, Arial, sans-serif';
  if(maxWidth)ctx.fillText(String(text),x,y,maxWidth);else ctx.fillText(String(text),x,y);
 }
 function round(ctx,x,y,w,h,r,fill,stroke){
  ctx.beginPath();
  if(ctx.roundRect)ctx.roundRect(x,y,w,h,r);
  else{ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath()}
  ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke()}
 }
 function render(canvas,data,sprites={}){
  if(!canvas||!canvas.getContext)throw new Error('Canvas is not supported.');
  canvas.width=W;canvas.height=H;
  const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('Canvas context unavailable.');
  const bg=ctx.createLinearGradient(0,0,W,H);bg.addColorStop(0,'#122a3b');bg.addColorStop(.55,'#071521');bg.addColorStop(1,'#132e2b');
  rect(ctx,0,0,W,H,bg);
  rect(ctx,0,0,W,12,'#aaf6bd');
  for(let i=0;i<9;i++)rect(ctx,-60+i*180,250,3,710,'#193d43');
  line(ctx,'⚽  POKÉFC',65,102,43,'#f8fafc',950);
  line(ctx,'INDIGO CHALLENGE · RUN REPORT',66,155,18,'#a3e8bb',900);
  round(ctx,66,200,1068,157,15,'#1c3745','#426078');
  line(ctx,data.champions?'CHAMPION RUN':'RUN COMPLETE',95,256,49,data.champions?'#f7d784':'#f2f7f8',950);
  line(ctx,data.category,98,309,18,'#b8d5df',850);
  const metrics=[
   ['TEAM SCORE',data.teamScore.toFixed(1)],
   ['RECORD',data.wins+'W · '+data.losses+'L'],
   ['MATCHES',data.played+' / 6'],
   ['FORMATION',data.formation]
  ];
  metrics.forEach(([label,value],i)=>{
   const x=66+i*271;
   round(ctx,x,388,255,115,10,'#182f40','#35566a');
   line(ctx,label,x+15,421,17,'#b1c8d2',850);
   line(ctx,value,x+15,476,32,i===0?'#aaf6bd':'#f9fbf8',950,225);
  });
  line(ctx,'FINAL ELEVEN',66,566,29,'#ffffff',950);
  line(ctx,'YOUR LOCKED SQUAD · '+data.tactic.toUpperCase()+' TACTICS',66,597,17,'#a7becb',750);
  // Six starters on top row; five starters on bottom row.
  data.players.forEach((player,i)=>{
   const first=i<6,n=first?6:5,col=first?i:i-6;
   const width=first?170:205,gap=first?9:10,x=66+col*(width+gap);
   const y=625+(first?0:238),h=224;
   round(ctx,x,y,width,h,11,'#183642','#456477');
   round(ctx,x+11,y+11,43,29,5,'#304f5d');
   line(ctx,player.role,x+20,y+32,15,'#f2d689',900);
   const img=sprites[player.id];
   if(img){
    try{ctx.drawImage(img,x+(width-106)/2,y+34,106,106)}catch{ /* invalid sprite: fallback marker below */ }
   }else{
    ctx.beginPath();ctx.arc(x+width/2,y+93,38,0,Math.PI*2);ctx.fillStyle='#2e6353';ctx.fill();
    line(ctx,'#'+player.id,x+width/2-25,y+102,20,'#e8f5e7',900);
   }
   line(ctx,player.name,x+12,y+168,17,'#ffffff',900,width-22);
   line(ctx,player.item||'NO ITEM',x+12,y+194,12,player.item?'#f1d486':'#8da7b1',850,width-22);
  });
  line(ctx,'THE GAUNTLET',66,1156,29,'#ffffff',950);
  line(ctx,'SIX MATCHES · ELITE FOUR / CHAMPIONS',66,1184,17,'#a9c4cf',750);
  opponentNames.forEach((name,i)=>{
   const col=i%3,row=Math.floor(i/3),x=66+col*362,y=1208+row*110;
   const game=data.results[i];
   round(ctx,x,y,346,97,10,game?(game.outcome==='Victory'?'#1e473a':'#473037'):'#152c39','#3a5965');
   line(ctx,'0'+(i+1)+'  '+name,x+14,y+31,18,'#eaf9f5',900,300);
   line(ctx,game?game.score.join(' – '):'NOT PLAYED',x+14,y+(game?.shootout?60:73),27,game?'#f5f7f8':'#91a8b3',950);
   if(game?.shootout)line(ctx,'PENS '+game.shootout.home+'–'+game.shootout.away,x+14,y+87,13,'#f5d893',900);
   if(game)line(ctx,game.outcome.toUpperCase(),x+240,y+73,14,game.outcome==='Victory'?'#a5f5b8':'#ffb6ae',900,95);
  });
  rect(ctx,66,1468,1068,2,'#45606b');
  line(ctx,'POKEFC.CLIFFSLUNCHCLUB.COM/CHALLENGE/',66,1513,18,'#bdf2c6',850);
  line(ctx,'UNRANKED ALPHA · LOCAL BROWSER RUN · NOT A VERIFIED LEADERBOARD ENTRY',66,1549,14,'#a5b8c5',750);
  return canvas;
 }
 async function fetchSprite(id,ImageCtor){
  if(!ImageCtor)return null;
  return await new Promise(resolve=>{
   const img=new ImageCtor();let done=false;
   const finish=v=>{if(done)return;done=true;clearTimeout(timer);img.onload=null;img.onerror=null;resolve(v)};
   const timer=setTimeout(()=>finish(null),4500);
   img.crossOrigin='anonymous';
   img.onload=()=>finish(img);
   img.onerror=()=>finish(null);
   img.src=SPRITE+encodeURIComponent(id)+'.png';
  });
 }
 async function loadSprites(data,ImageCtor){
  const ids=[...new Set(data.players.map(p=>p.id))];
  const images=await Promise.all(ids.map(async id=>{
   const player=data.players.find(p=>p.id===id);
   return await fetchSprite(player.spriteId||id,ImageCtor||root.Image)||await fetchSprite(id,ImageCtor||root.Image);
  }));
  const map={};ids.forEach((id,i)=>{if(images[i])map[id]=images[i]});
  return map;
 }
 async function preview(canvas,data,opts={}){
  const images=opts.sprites||await loadSprites(data,opts.Image||root.Image);
  return render(canvas,data,images);
 }
 function pngBlob(canvas){
  return new Promise((resolve,reject)=>{
   if(!canvas.toBlob)return reject(new Error('PNG export not supported in this browser.'));
   try{canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Unable to encode PNG.')), 'image/png')}catch(e){reject(e)}
  });
 }
 async function download(data,opts={}){
  const doc=opts.document||root.document,URLApi=opts.URL||root.URL;
  if(!doc||!URLApi?.createObjectURL)throw new Error('Download API unavailable.');
  const canvas=opts.canvas||doc.createElement('canvas');
  await preview(canvas,data,opts);
  const blob=await pngBlob(canvas),url=URLApi.createObjectURL(blob);
  const link=doc.createElement('a');
  link.href=url;link.download='PokeFC-Challenge-'+(data.champions?'Champion':'Run')+'-'+data.createdAt+'.png';
  try{doc.body.appendChild(link);link.click()}finally{
   if(typeof link.remove==='function')link.remove();
   else if(link.parentNode)link.parentNode.removeChild(link);
   if(typeof setTimeout==='function')setTimeout(()=>URLApi.revokeObjectURL(url),1000);
   else URLApi.revokeObjectURL(url);
  }
  return link.download;
 }
 root.PFC_CHALLENGE_RUN_CARD={WIDTH:W,HEIGHT:H,summary,render,loadSprites,preview,download};
})(typeof window!=='undefined'?window:globalThis);
