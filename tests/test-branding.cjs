'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const pages=[
  {file:'index.html',prefix:'./',active:null},
  {file:'ratings/index.html',prefix:'../',active:null},
  {file:'play/index.html',prefix:'../',active:'QUICK PLAY'},
  {file:'challenge/index.html',prefix:'../',active:'CHALLENGES'},
  {file:'franchise/index.html',prefix:'../',active:'FRANCHISE'},
];
const ball=fs.readFileSync(path.join(root,'assets/icons/favicon.svg'),'utf8');
assert.match(ball,/<svg[^>]*viewBox="0 0 64 64"/);
assert.match(ball,/<circle/);
for(const p of pages){
 const html=fs.readFileSync(path.join(root,p.file),'utf8');
 const head=html.match(/<header class="pfc-header">([\s\S]*?)<\/header>/);
 assert(head,'Shared masthead missing: '+p.file);
 const nav=head[1].match(/<nav class="pfc-nav"[^>]*>([\s\S]*?)<\/nav>/);
 assert(nav,'Three-mode nav missing: '+p.file);
 const anchors=Array.from(nav[1].matchAll(/<a\s+[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g));
 assert.equal(anchors.length,3,'Exactly three top navigation links: '+p.file);
 assert.deepEqual(anchors.map(a=>a[2]),['QUICK PLAY','CHALLENGES','FRANCHISE'],'Matching labels: '+p.file);
 assert.deepEqual(anchors.map(a=>a[1]),['play/','challenge/','franchise/'].map(x=>p.prefix+x),'Matching destinations: '+p.file);
 assert.equal((nav[1].match(/aria-current="page"/g)||[]).length,p.active?1:0,'One active mode maximum: '+p.file);
 if(p.active)assert(nav[1].includes('>'+p.active+'</a>'),'Correct active mode: '+p.file);
 assert(head[1].includes('href="'+p.prefix+'"'),'Logo returns to Home: '+p.file);
 assert(head[1].includes('src="'+p.prefix+'assets/icons/favicon.svg?v=2"'),'Shared ball logo: '+p.file);
 assert(html.includes('rel="icon" type="image/svg+xml" href="'+p.prefix+'assets/icons/favicon.svg?v=2"'),'Tab favicon: '+p.file);
 assert(html.includes(p.prefix+'assets/css/site.css?v=3'),'Shared styling: '+p.file);
 assert(head[1].includes('OPEN ALPHA'),'Shared branding: '+p.file);
}
const guide=fs.readFileSync(path.join(root,'ratings/index.html'),'utf8');
for(const pos of ['GK','CB','LWB','CDM','CAM','LW','ST'])assert(guide.includes(pos),'Missing position explanation: '+pos);
assert(!guide.includes('n>=83'),'Grade thresholds must not be shown on guide');
const builder=fs.readFileSync(path.join(root,'assets/js/builder.js'),'utf8');
assert(!builder.includes('statSummary('),'Raw stat breakdown not rendered');
assert(!builder.includes("toFixed(1)+' OVR"),'Numeric OVR not rendered');
assert(!builder.includes('window.PFC_BUILDER={rating,'),'Raw numeric grade not public API');
console.log('PASS all five pages share one nav, branding, Poké Ball favicon; builder grade explainer and privacy checks');
