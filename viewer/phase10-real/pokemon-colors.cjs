'use strict';
function colors(home,away){const a=home?.primaryColor||'#EBC63C',b=away?.primaryColor||'#287FCB';return [a,a.toLowerCase()===b.toLowerCase()?(away?.secondaryColor||'#B44EEB'):b]}
function number(player,index){return player?.jerseyNumber||index+1}
module.exports={colors,number};
