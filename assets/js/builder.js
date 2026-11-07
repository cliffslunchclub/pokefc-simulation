/* PokéFC public Free Builder — no backend, separate from ranked Challenge/Franchise.
 * Position ratings use the shared Pokemon-stat precise-role formula. */
(()=>{'use strict';
const S=Array.isArray(window.FXI_SPECIES)?window.FXI_SPECIES:[];
const BY=new Map(S.map(s=>[s.id,s]));
const KEY='pokefc-free-builder-v1';
const FORMATIONS={
 '4-3-3':[['GK',50,88],['LB',14,72],['CB',38,73],['CB',62,73],['RB',86,72],['CM',24,52],['CM',50,50],['CM',76,52],['LW',19,25],['ST',50,18],['RW',81,25]],
 '4-2-3-1':[['GK',50,88],['LB',13,73],['CB',37,76],['CB',63,76],['RB',87,73],['CDM',34,56],['CDM',66,56],['LW',15,32],['CAM',50,33],['RW',85,32],['ST',50,15]],
 '4-4-2':[['GK',50,88],['LB',13,74],['CB',37,73],['CB',63,73],['RB',87,74],['LM',14,46],['CM',37,48],['CM',63,48],['RM',86,46],['ST',33,19],['ST',67,19]],
 '3-5-2':[['GK',50,88],['CB',22,73],['CB',50,75],['CB',78,73],['LWB',12,48],['RWB',88,48],['CM',35,50],['CM',65,50],['CAM',50,35],['ST',33,19],['ST',67,19]],
 '5-3-2':[['GK',50,88],['LWB',12,58],['CB',25,75],['CB',50,77],['CB',75,75],['RWB',88,58],['CM',27,44],['CM',50,47],['CM',73,44],['ST',33,20],['ST',67,20]]
};
const ROLES={GK:'Goalkeeper',LB:'Left Back',RB:'Right Back',CB:'Centre Back',LWB:'Left Wing Back',RWB:'Right Wing Back',CDM:'Defensive Midfielder',CM:'Central Midfielder',LM:'Left Midfielder',RM:'Right Midfielder',LW:'Left Winger',RW:'Right Winger',CAM:'Attacking Midfielder',ST:'Striker'};
function rating(s,role){
 if(!s)return 0;
 return window.PFC_POSITION_EFFECTIVENESS.preciseFit(s.baseStats,role);
}
// Shared S/A/B/C/D thresholds with Challenges.
function grade(n){
 if(n==null||!Number.isFinite(n))return '—';
 return n>=85?'S':n>=75?'A':n>=65?'B':n>=55?'C':'D';
}
function gradeFor(s,role){return s?grade(rating(s,role)):'—'}
function efficiencyFor(s,role){return s?Math.round(window.PFC_POSITION_EFFECTIVENESS.competitiveProfile(s.baseStats,role).efficiency*100)+'%':'—'}
function escapeHtml(t){return String(t??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
const $=id=>document.getElementById(id);
// Gen I starting showcase; saved lineups and deliberate clears stay intact.
// Unique species, 4-3-3: GK, LB, CB, CB, RB, CM, CM, CM, LW, ST, RW.
// Only a first-visit showcase; saved lineups and deliberate clears are preserved.
const GEN1_SHOWCASE_XI=[144,91,76,151,112,135,65,145,149,150,142];
const empty=()=>({version:1,name:'Indigo Athletic',formation:'4-3-3',lineup:GEN1_SHOWCASE_XI.map(id=>BY.has(id)?id:null),selected:0,spriteStyle:'pixel'});
function normalize(value){
 const s=empty();
 if(!value||value.version!==1||!FORMATIONS[value.formation]||!Array.isArray(value.lineup)||value.lineup.length!==11)return s;
 s.name=typeof value.name==='string'?value.name.slice(0,38):s.name;
 s.spriteStyle=value.spriteStyle==='art'?'art':'pixel';
 s.formation=value.formation;
 s.selected=Number.isInteger(value.selected)&&value.selected>=0&&value.selected<11?value.selected:0;
 const used=new Set();
 s.lineup=value.lineup.map(id=>{const n=Number(id);if(id===null||!BY.has(n)||used.has(n))return null;used.add(n);return n});
 return s;
}
let state;
try{state=normalize(JSON.parse(localStorage.getItem(KEY)))}catch{state=empty()}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));$('savedStatus').textContent='Saved in this browser'}catch{$('savedStatus').textContent='Local saving is unavailable'}}
function sprite(id){const folder=state.spriteStyle==='art'?'other/official-artwork/':'';return 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/'+folder+id+'.png'}
function normalizeSearch(q){return String(q||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’'.:♀♂-]/g,'').replace(/\s+/g,'')}
function details(s){return 'Gen '+(s.gen||'?')+' · '+s.height+' m · '+s.weight+' kg'}
function average(){const chosen=state.lineup.map((id,i)=>id?rating(BY.get(id),FORMATIONS[state.formation][i][0]):null).filter(v=>v!==null);return chosen.length?chosen.reduce((a,b)=>a+b,0)/chosen.length:null}
function renderPitch(){
 const f=FORMATIONS[state.formation],filled=state.lineup.filter(Boolean).length;
 $('lineupName').textContent=state.name||'Your XI';
 $('lineupFormation').textContent=state.formation+' formation';
 $('formation').value=state.formation;
 $('filledCount').textContent=filled+' / 11 chosen';
 $('teamScore').textContent=grade(average());
 $('pitchSlots').innerHTML=f.map(([role,x,y],i)=>{
  const p=BY.get(state.lineup[i]);
  return '<button type="button" class="pitch-slot '+(i===state.selected?'selected ':'')+(!p?'empty':'')+'" data-slot="'+i+'" style="left:'+x+'%;top:'+y+'%" aria-label="'+escapeHtml(role+' '+(p?p.name:'empty'))+'">'+
    '<span class="role">'+role+'</span>'+
    (p?'<img alt="" loading="lazy" src="'+sprite(p.id)+'"><span class="name">'+escapeHtml(p.name)+'</span><span class="fit-badges"><span class="ovr grade-'+gradeFor(p,role).toLowerCase()+'">'+gradeFor(p,role)+'</span><span class="efficiency" title="Competitive match efficiency">'+efficiencyFor(p,role)+'</span></span>':
     '<span class="slot-plus">+</span><span class="name">OPEN</span>')+'</button>';
 }).join('');
}
const PAGE_SIZE=10;
let limit=PAGE_SIZE;
function renderProspects(){
 const role=FORMATIONS[state.formation][state.selected][0],current=BY.get(state.lineup[state.selected]),q=normalizeSearch($('search').value.trim()),type=$('typeFilter').value,gen=$('genFilter').value;
 $('scoutTitle').textContent=ROLES[role];$('selectedRole').textContent=role;
 $('currentPick').innerHTML=current?
   '<strong>'+escapeHtml(current.name)+'</strong> · '+gradeFor(current,role)+' '+role+' FIT · '+efficiencyFor(current,role)+' EFFICIENCY <button id="removePick" class="btn" type="button" style="float:right;padding:4px 9px;min-height:26px;margin-top:-3px">Remove</button><span class="current-detail">'+escapeHtml(details(current))+'</span>':
   'Select a Pokémon to fill the '+escapeHtml(role)+' position.';
 const used=new Set(state.lineup.filter(Boolean));
 const opts=S.filter(p=>(!q||normalizeSearch(p.name).includes(q)||normalizeSearch(p.slug||'').includes(q)||String(p.id)===q||String(p.id).padStart(4,'0')===q)&&(!gen||String(p.gen)===gen)&&(!type||p.types.includes(type)))
   .sort((a,b)=>rating(b,role)-rating(a,role)||a.id-b.id);
 $('resultsCount').textContent=opts.length+' matching · '+S.length+' total';
 $('prospects').innerHTML=opts.slice(0,limit).map(p=>{
  const chosen=used.has(p.id),here=state.lineup[state.selected]===p.id;
  return '<button type="button" class="prospect '+(chosen?'chosen':'')+'" data-species="'+p.id+'" '+(chosen&&!here?'disabled':'')+'>'+
    '<img src="'+sprite(p.id)+'" alt="" loading="lazy">'+
    '<span class="identity"><strong>'+escapeHtml(p.name)+'</strong><small>#'+String(p.id).padStart(4,'0')+' · '+p.types.map(escapeHtml).join(' / ')+'</small><small>'+escapeHtml(details(p))+'</small></span>'+
    '<span class="overall"><b class="grade-'+gradeFor(p,role).toLowerCase()+'">'+gradeFor(p,role)+'</b><small>'+efficiencyFor(p,role)+' EFF</small></span>'+
    '<span class="select-marker">'+(here?'✓':chosen?'●':'+')+'</span></button>';
 }).join('') || '<p class="empty-results">No Pokémon matched. Try a different search or type.</p>';
 $('prospects').dataset.expanded=limit>PAGE_SIZE?'true':'false';
 $('more').hidden=opts.length<=limit;
 $('more').textContent='Show 10 more Pokémon';
}
function render(){renderPitch();renderProspects()}
function pickSpecies(id){
 if(!BY.has(id))return;
 const already=state.lineup.indexOf(id);
 if(already>=0 && already!==state.selected)return;
 state.lineup[state.selected]=id;
 const nextEmpty=state.lineup.findIndex((v,i)=>v===null&&i!==state.selected);
 if(nextEmpty>=0)state.selected=nextEmpty;
 save();render();
}
function randomize(){
 const ids=S.map(s=>s.id);
 for(let i=ids.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]]}
 state.lineup=ids.slice(0,11);
 state.selected=0;save();render();
}
async function copyXI(){
 const f=FORMATIONS[state.formation];
 const text=['PokéFC · '+(state.name||'Your XI')+' · '+state.formation,...f.map(([role],i)=>role+': '+(BY.get(state.lineup[i])?.name||'Open')),'Current XI grade: '+grade(average())].join('\n');
 try{if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');await navigator.clipboard.writeText(text);$('savedStatus').textContent='XI copied to clipboard'}catch{window.prompt('Copy your XI:',text)}
}
function wire(){
 const types=[...new Set(S.flatMap(p=>p.types))].sort();
 $('typeFilter').innerHTML='<option value="">All types</option>'+types.map(t=>'<option value="'+escapeHtml(t)+'">'+t[0].toUpperCase()+t.slice(1)+'</option>').join('');
 $('clubName').value=state.name;
 $('spriteStyle').value=state.spriteStyle;
 $('spriteStyle').addEventListener('change',e=>{state.spriteStyle=e.target.value==='art'?'art':'pixel';save();render()});
 $('clubName').addEventListener('input',e=>{state.name=e.target.value.slice(0,38);$('lineupName').textContent=state.name||'Your XI';save()});
 $('formation').addEventListener('change',e=>{if(!FORMATIONS[e.target.value])return;state.formation=e.target.value;save();render()});
 const dialog=$('builderConfirm'),title=$('builderConfirmTitle'),message=$('builderConfirmText'),confirmButton=$('builderConfirmOk');
 let pendingAction=null;
 function closeConfirmation(){
  pendingAction=null;
  if(dialog.close)dialog.close();
  else dialog.removeAttribute('open');
 }
 function askConfirmation(heading,body,actionLabel,onConfirm){
  pendingAction=onConfirm;
  title.textContent=heading;
  message.textContent=body;
  confirmButton.textContent=actionLabel;
  if(dialog.showModal)dialog.showModal();
  else dialog.setAttribute('open','');
 }
 $('builderConfirmCancel').addEventListener('click',closeConfirmation);
 confirmButton.addEventListener('click',()=>{
  const action=pendingAction;
  closeConfirmation();
  if(action)action();
 });
 dialog.addEventListener('cancel',()=>{pendingAction=null});
 dialog.addEventListener('close',()=>{pendingAction=null});
 $('loadGen1').addEventListener('click',()=>{
  const load=()=>{
   state.formation='4-3-3';
   state.lineup=GEN1_SHOWCASE_XI.slice();
   state.selected=0;
   save();render();
  };
  if(!state.lineup.some(Boolean)){load();return}
  askConfirmation('LOAD BEST GEN I XI?',
   'Use the highest combined Gen I positional fits in a 4-3-3? Your current team will be replaced.',
   'LOAD GEN I XI',load);
 });
 $('randomize').addEventListener('click',()=>{
  if(!state.lineup.some(Boolean)){randomize();return}
  askConfirmation('RANDOMIZE YOUR XI?',
   'Replace all 11 current picks with random Pokémon from the National Pokédex? Your existing lineup will be overwritten.',
   'RANDOMIZE XI',randomize);
 });
 $('clear').addEventListener('click',()=>{
  if(!state.lineup.some(Boolean))return;
  askConfirmation('CLEAR YOUR XI?',
   'Remove all 11 Pokémon from your formation? You can rebuild your team afterward.',
   'CLEAR ALL 11',()=>{
    state.lineup=Array(11).fill(null);
    state.selected=0;
    save();render();
   });
 });
 $('share').addEventListener('click',copyXI);
 $('pitchSlots').addEventListener('click',e=>{const b=e.target.closest('[data-slot]');if(!b)return;state.selected=Number(b.dataset.slot);save();render()});
 $('prospects').addEventListener('click',e=>{const b=e.target.closest('[data-species]');if(!b||b.disabled)return;pickSpecies(Number(b.dataset.species))});
 $('currentPick').addEventListener('click',e=>{if(e.target.id!=='removePick')return;state.lineup[state.selected]=null;save();render()});
 $('genFilter').value='1';
 for(const id of ['search','typeFilter','genFilter'])$(id).addEventListener(id==='search'?'input':'change',()=>{limit=PAGE_SIZE;renderProspects()});
 $('more').addEventListener('click',()=>{limit+=PAGE_SIZE;renderProspects()});
}
if(!S.length){$('prospects').innerHTML='<p class="empty-results">Pokémon data is unavailable. Reload the page.</p>';return}
wire();render();save();
window.PFC_BUILDER={gradeFor,formations:FORMATIONS,getState:()=>JSON.parse(JSON.stringify(state))};
})();
