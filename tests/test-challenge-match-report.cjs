'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const ctx=vm.createContext({window:{},console});
vm.runInContext(fs.readFileSync(path.join(root,'challenge/match-report.js'),'utf8'),ctx,{filename:'challenge/match-report.js'});
const report=ctx.window.PFC_MATCH_REPORT;
assert(report);
const fixture={
 home:{id:'challenger',lineup:[{id:'c9-6',name:'Charizard'},{id:'c10-25',name:'Pikachu'},{id:'c4-233',name:'Porygon2'}]},
 away:{id:'e4-lorelei',lineup:[{id:'boss9-131',name:'Lapras'},{id:'boss3-80',name:'Slowbro'}]}
};
const result={
 score:[2,1],origin:'quick-sim',
 box:{'c9-6':{shotsOnTarget:5,tackleAttempts:9,tackles:3},'c10-25':{shotsOnTarget:2,tackleAttempts:5,tackles:2},
  'c4-233':{shotsOnTarget:0,tackleAttempts:7,tackles:4},
  'boss9-131':{shotsOnTarget:3,tackleAttempts:6,tackles:2},
  'boss3-80':{shotsOnTarget:1,tackleAttempts:4,tackles:1}},
 stats:[{shots:14,shotsOnTarget:7,passes:340,completedPasses:275,possession:59.2,tackleAttempts:21,tackles:9,saves:3},
        {shots:9,shotsOnTarget:4,passes:265,completedPasses:205,possession:40.8,tackleAttempts:10,tackles:3,saves:5}],
 events:[
  {type:'goal',team:'e4-lorelei',minute:66.1,minuteLabel:'67',player:'boss9-131',assist:'boss3-80',origin:'quick-sim'},
  {type:'goal',team:'challenger',minute:11.4,minuteLabel:'12',player:'c9-6',assist:'c10-25',origin:'quick-sim'},
  {type:'goal',team:'challenger',minute:87.2,minuteLabel:'88',player:'c10-25',assist:null,origin:'quick-sim'}
 ]
};
let r=report.fromResult(result,fixture);
assert.equal(r.status,'complete');
assert.equal(r.goals.length,3);
assert.equal(r.version,3,'Timeline-capable save format');
assert.equal(r.timeline.length,3,'All existing goal events appear in the chronological timeline');
assert.deepEqual(Array.from(r.timeline.map(e=>e.minuteLabel)),['12','67','88']);
assert.match(report.renderTimeline(r.timeline),/GOAL/);
assert.match(report.renderTimeline(r.timeline),/Assist: Pikachu/);
assert.deepEqual(Array.from(r.goals.map(x=>x.minuteLabel)),['12','67','88']);
assert.deepEqual(Array.from(r.goals.map(x=>x.player)),['Charizard','Lapras','Pikachu']);
assert.equal(r.goals[0].assist,'Pikachu');
assert.equal(r.goals[1].assist,'Slowbro');
assert.equal(r.goals[1].side,1);
assert.equal(r.stats.shotsOnTarget[0],7);
assert.equal(r.playerShotsOnTarget.length,5,'All five lineup players have tracked individual SOG including zero');
assert.deepEqual(Array.from(r.playerShotsOnTarget.filter(p=>p.side===0),p=>[p.player,p.count]),
 [['Charizard',5],['Pikachu',2],['Porygon2',0]],'Shooters reflect exact engine box data');
assert.equal(r.playerShotsOnTarget.filter(p=>p.side===1).reduce((n,p)=>n+p.count,0),4,'Opponent shot totals reconcile');
assert.equal(r.stats.possession[1],40.8);
assert.equal(r.stats.tackles[0],9);
assert.equal(r.stats.tackleAttempts[0],21,'Team tackle attempts are retained');
assert.equal(r.playerTackles.length,5,'Actual player-box tackles saved, including zero coverage');
assert.equal(r.playerTackles.filter(p=>p.side===0).reduce((sum,p)=>sum+p.won,0),9);
assert.equal(r.playerTackles.filter(p=>p.side===0).reduce((sum,p)=>sum+p.attempts,0),21);
const hybrid=report.fromResult({...result,origin:'hybrid',handoff:{minute:45},events:result.events.map((e,i)=>({...e,origin:i===0?'quick-continuation':'tacticmesh'}))},fixture);
assert.equal(hybrid.status,'complete');
assert.equal(hybrid.origin,'hybrid');
assert.equal(hybrid.goals[1].origin,'quick-continuation');
assert.equal(hybrid.goals[0].origin,'tacticmesh');
assert.equal(hybrid.handoffMinute,45);
const unavailable=report.fromResult({score:[2,1],stats:[{shots:9},{shots:7}],origin:'quick-sim'},fixture);
assert.equal(unavailable.status,'unavailable');
assert.equal(unavailable.goals.length,0,'Never invent a scorer or time for old saves');
assert.equal(unavailable.playerShotsOnTarget.length,0,'No player SOG invented from team shots');
assert.equal(unavailable.playerTackles.length,0,'No player tackle ledger invented from team totals');
assert.equal(unavailable.timeline.length,0,'No individual events fabricated from summary stats');
assert.doesNotMatch(report.renderTimeline(unavailable.timeline),/GOAL|SAVE|FOUL/,'Missing event log stays empty');
assert.equal(unavailable.stats.possession[0],null,'Missing possession must not become 0%');
const mismatch=report.fromResult({...result,events:result.events.slice(0,1)},fixture);
assert.equal(mismatch.status,'partial');
assert.equal(mismatch.goals[0].player,'Lapras');
const clean=report.fromResult({score:[0,0],stats:[{shots:3},{shots:4}],events:[]},fixture);
assert.equal(clean.status,'complete');
assert.equal(clean.goals.length,0);
const anonymous=report.fromResult({score:[1,0],events:[{type:'goal',minute:33.4,team:'challenger',player:'no-longer-present'}]},fixture);
assert.equal(anonymous.goals[0].player,'Scorer unavailable');
assert.equal(anonymous.goals[0].minuteLabel,'34');
const allEvents=report.timelineFromEvents([
 {type:'substitution',team:'challenger',minute:71.2,playerOff:'c10-25',playerOn:'c4-233',origin:'tacticmesh'},
 {type:'save',team:'challenger',minute:36.2,player:'c4-233',shooter:'boss9-131',origin:'quick-continuation'},
 {type:'goal',team:'e4-lorelei',minute:12.4,player:'boss9-131',origin:'tacticmesh'},
 {type:'card',team:'challenger',minute:44.4,player:'c9-6',card:'yellow',origin:'tacticmesh'},
 {type:'foul',team:'e4-lorelei',minute:25.1,player:'boss3-80',origin:'tacticmesh'},
 {type:'half-time',minute:45,origin:'tacticmesh'},
 {type:'major-chance',team:'challenger',minute:46,player:'c9-6'}, // Unsupported/unrecorded interpretation is rejected.
 {type:'goal',team:'alien-team',minute:48,player:'c9-6'}
],fixture,'tacticmesh');
assert.deepEqual(Array.from(allEvents.map(e=>e.type)),['goal','foul','save','card','half-time','substitution'],
 'Every supported recorded event is chronological and unsupported/unknown events are omitted');
const html=report.renderTimeline(allEvents);
for(const label of ['GOAL','FOUL','SAVE','YELLOW CARD','HALF-TIME','SUBSTITUTION','Lapras','Porygon2'])
 assert(html.includes(label),'Timeline includes '+label);
assert(html.indexOf('GOAL')<html.indexOf('FOUL')&&html.indexOf('FOUL')<html.indexOf('SAVE'),'Chronological timeline displayed');
assert.doesNotMatch(html,/SIM TO END|WATCHED|QUICK SIM|pfc-event-origin/,'Display hides per-event engine tags while saved records retain origin');
const escaped=report.renderTimeline([{type:'foul',side:0,minuteLabel:'3',player:'<script>alert(1)</script>',origin:'tacticmesh'}]);
const grouped=report.renderGroupedTimeline(allEvents);
assert.match(grouped,/data-timeline-group="goals" open/,'Goals expanded by default');
assert.match(grouped,/data-timeline-group="other"/,'Secondary incidents group exists');
assert.doesNotMatch(grouped,/data-timeline-group="other" open/,'Saves and other match incidents are collapsed by default');
assert.match(grouped,/GOALS<\/span><strong>1 RECORDED/,'Only authentic goals counted in goal group');
assert.match(grouped,/SAVES &amp; OTHER EVENTS/);
assert(grouped.indexOf('GOALS')<grouped.indexOf('SAVES &amp; OTHER EVENTS'),'Goal section appears first');
const expanded=report.renderGroupedTimeline(allEvents,{goalsOpen:false,otherOpen:true});
assert.doesNotMatch(expanded,/data-timeline-group="goals" open/);
assert.match(expanded,/data-timeline-group="other" open/);
assert.deepEqual(Array.from(allEvents.map(e=>e.origin)),
 ['tacticmesh','tacticmesh','quick-continuation','tacticmesh','tacticmesh','tacticmesh'],
 'Grouping never alters the underlying event origin metadata');
assert(!escaped.includes('<script>'),'Player names HTML-escaped');
assert(escaped.includes('&lt;script&gt;'),'Escaped player name remains readable');
console.log('PASS Challenge event ledger: goals, saves, fouls, cards, substitutions, origin, chronology, escaped text, no fabricated events');
