'use strict';
function colors(home,away){return [home?.primaryColor||'#EBC63C',away?.primaryColor||'#287FCB']}
function number(player,index){return player?.jerseyNumber||index+1}
module.exports={colors,number};
