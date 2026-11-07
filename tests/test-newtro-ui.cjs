'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=(name)=>fs.readFileSync(path.join(root,name),'utf8');
const pages=[
 ['index.html','./'],
 ['ratings/index.html','../'],
 ['play/index.html','../'],
 ['challenge/index.html','../'],
 ['franchise/index.html','../']
];
const css=read('assets/css/newtro.css');
for(const [file,prefix] of pages){
 const html=read(file);
 const styles=[...html.matchAll(/<link\s+[^>]*rel="stylesheet"[^>]*>/g)].map(match=>match[0]);
 assert(styles.length>0,'No stylesheets: '+file);
 assert(styles[styles.length-1].includes('href="'+prefix+'assets/css/newtro.css?v=1"'),'Newtro must load last: '+file);
 assert(html.includes('href="'+prefix+'assets/icons/favicon.svg?v=2"'),'Updated favicon link: '+file);
 assert(html.includes('src="'+prefix+'assets/icons/favicon.svg?v=2"'),'Updated masthead logo: '+file);
 assert(html.includes('name="theme-color" content="#0b0d10"'),'Dark theme color: '+file);
 assert(html.includes('class="pfc-header"'),'Shared header: '+file);
}
const ball=read('assets/icons/favicon.svg');
for(const color of ['#0b0d10','#e53935','#f7f7f5'])assert(ball.includes(color),'Ball missing: '+color);
for(const token of ['--pfc-red:#e53935','--pfc-white:#f7f7f5','--pfc-black:#0b0d10',
 '--pfc-panel-radius:12px','--pfc-control-height:42px','--pfc-titlebar-height:52px']){
 assert(css.includes(token),'Missing shared design token: '+token);
}
assert(css.includes('/* Only floating draft and shop windows are matched:'),'Modal width rule missing');
const desktop=css.slice(css.indexOf('@media(min-width:761px)'));
assert.match(desktop,/\.challenge-frame \.challenge-dialog\.challenge-draft-panel\s*\{\s*width:min\(440px,calc\(100vw - 24px\)\)!important;/);
assert.match(desktop,/\.challenge-shop-drawer\s*\{\s*width:min\(440px,calc\(100vw - 24px\)\)!important;/);
assert(css.includes('@media(max-width:760px)'),'Mobile theme missing');
assert(css.includes('@media(prefers-reduced-motion:reduce)'),'Reduced-motion support missing');
assert(css.includes('.field-shell canvas'),'Pitch must keep green playing surface');
const clean=css.replace(/\/\*[\s\S]*?\*\//g,'');
assert.equal((clean.match(/\{/g)||[]).length,(clean.match(/\}/g)||[]).length,'CSS braces unbalanced');
const build=read('scripts/build-siteground.sh');
assert(build.includes('for file in builder.css site.css newtro.css career.css; do') && build.includes('cp "assets/css/$file"') && build.includes('cp assets/icons/favicon.svg'),'Newtro is packaged');
assert(build.includes('Missing final newtro theme'),'Public build validates newtro asset');
assert(build.includes('assets/icons/favicon.svg?v=2'),'Public build checks refreshed favicon');
console.log('PASS Newtro: five pages, final stylesheet, Poké Ball palette, matching 440px floating windows, mobile/a11y and deploy packaging');
