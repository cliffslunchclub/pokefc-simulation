'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const Commentary=require('./phase10-commentary.cjs');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixture.json'),'utf8'));
const pristine=JSON.stringify(fixture),field={width:106,height:68};
const feed=Commentary.build(fixture,field);
const replay=Commentary.build(JSON.parse(pristine),field);
assert.deepEqual(feed.entries,replay.entries,'Same seed must narrate identically');
assert.equal(JSON.stringify(fixture),pristine,'Commentary must not alter PSE fixture');
assert(feed.entries.length>450,'Expected natural broadcast play-by-play throughout match');
assert.equal(Commentary.latest(feed,0).type,'intro','Opening call at kickoff');
const visuals=feed.entries.filter(x=>x.kind==='visual');
const officials=feed.entries.filter(x=>x.kind==='official');
assert.equal(officials.length,fixture.events.length,'Only PSE goals should be official');
assert(visuals.every(x=>!['goal','save','corner','free-kick','penalty-kick'].includes(x.type)),
 'Illustrative captions must never claim an official event');
for(let i=1;i<visuals.length;i++)
 assert(visuals[i].seconds-visuals[i-1].seconds>=3,
  'Narration is too frequent even before high-speed display throttling');
assert(visuals.some(x=>/through ball|through|run/.test(x.text.toLowerCase())));
assert(visuals.some(x=>/across|triangle|other side/.test(x.text.toLowerCase())));
assert(visuals.some(x=>/challenge|contest|pressure/.test(x.text.toLowerCase())));
assert(visuals.some(x=>/wall|boards/.test(x.text.toLowerCase())));
for(const e of fixture.events){
 const second=e.minute*60;
 const before=Commentary.visible(feed,second-.0002);
 assert(!before.some(x=>x.type==='goal'&&Math.abs(x.seconds-second)<.0001),
  'Future goal leaked into commentary');
 const after=Commentary.visible(feed,second+.001);
 assert(after.some(x=>x.type==='goal'&&Math.abs(x.seconds-second)<.0001),
  'PSE confirmed goal was not narrated');
}
const rewind=Commentary.visible(feed,60*12);
assert(rewind.every(x=>x.seconds<=60*12+1e-8));
assert(!rewind.some(x=>x.kind==='official'),'Goals must not appear before the event');
const h=Commentary.history(feed,60*80,0,25);
assert.equal(h.length,25);
assert(h.every((x,i)=>i===0||x.seconds<=h[i-1].seconds),
 'Expandable history must list the newest events first');
const extra=JSON.parse(pristine);
extra.events=[
 {type:'save',minute:4,team:fixture.home.id,player:fixture.home.lineup[0].id,origin:'quick-sim'},
 {type:'corner',minute:7,team:fixture.away.id,source:'quick-sim'},
 {type:'free-kick',minute:8,team:fixture.home.id,source:'quick-sim'},
 {type:'penalty-kick',minute:9,team:fixture.home.id,origin:'quick-sim'},
 {type:'shot',minute:10,team:fixture.home.id,outcome:'off-target',origin:'quick-sim'},
 {type:'goal',minute:11,team:fixture.away.id,player:fixture.away.lineup[8].id,source:'watch'},
 {type:'save',minute:12,team:fixture.away.id,player:fixture.away.lineup[0].id,source:'watch'}
];
const incidentFeed=Commentary.build(extra,field);
const types=incidentFeed.entries.filter(x=>x.kind==='official').map(x=>x.type);
assert.deepEqual(types,['save','corner','free-kick','penalty-kick','shot'],
 'Only authenticated PSE incident types should produce official narration');
assert(incidentFeed.entries.some(x=>x.text.includes(fixture.home.lineup[0].name)
  &&x.type==='save'),'Official keeper should be named');
const penalties=JSON.parse(pristine);
penalties.durationMinutes=120;
penalties.shootout={version:'pse-shootout-v1',attempts:[
 {side:'home',kickerId:penalties.home.lineup[1].id,outcome:'goal',scored:true},
 {side:'away',kickerId:penalties.away.lineup[1].id,outcome:'saved',scored:false}
]};
const kickFeed=Commentary.build(penalties,field);
assert(!Commentary.visible(kickFeed,120*60,0).some(x=>x.type==='shootout'),
 'Shootout must not be spoiled before the kick is recorded');
assert.equal(Commentary.visible(kickFeed,120*60,1).filter(x=>x.type==='shootout').length,1);
const kickLines=Commentary.visible(kickFeed,120*60,2).filter(x=>x.type==='shootout');
assert.equal(kickLines.length,2);
assert(/SAVED/.test(kickLines[1].text));
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'viewer.css'),'utf8');
const viewer=fs.readFileSync(path.join(__dirname,'viewer-entry.cjs'),'utf8');
for(const id of ['commentaryPanel','commentaryLine','commentaryMinute',
  'commentaryToggle','commentaryHistory'])
 assert(html.includes('id="'+id+'"'),'Missing accessible commentary element '+id);
assert(html.includes('aria-live="polite"')&&html.includes('aria-expanded="false"'));
assert(css.includes('.watch-commentary')&&css.includes('pfc-watch-fullscreen'),
 'Commentary should fit fullscreen');
assert(css.includes('position:absolute;z-index:7;bottom:8px')&&
 css.includes('.highlight-replay:not([hidden])'),
 'Commentary must remain below interactive instant-replay and fullscreen controls');
assert(css.includes('pointer-events:none')&&
 css.includes('.watch-commentary-head button{\n pointer-events:auto;')&&
 css.includes('.watch-commentary-history:not([hidden]){\n pointer-events:auto;'),
 'Passive captions must not obstruct instant replay or shootout controls');
assert(viewer.includes('Commentary.build(match,field)')&&viewer.includes('renderCommentary(t,script,isReplay)'));
assert(viewer.includes('row.append(clock,words);fragment.append(row)'),
 'History must be populated as text, not untrusted markup');
console.log('PASS text broadcast commentary: '+feed.entries.length+
 ' deterministic captions, PSE-only goals/saves/sets, rewind-safe history, all-mode lower third');
