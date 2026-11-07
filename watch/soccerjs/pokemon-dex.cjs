'use strict';
const dex={blastoise:9,onix:95,golem:76,snorlax:143,machamp:68,alakazam:65,raichu:26,gengar:94,charizard:6,arcanine:59,pikachu:25,venusaur:3,nidoqueen:31,rhydon:112,lapras:131,dragonite:149,kadabra:64,vileplume:45,hypno:97,ninetales:38,electabuzz:125,jolteon:135};
const species=p=>Number(p?.speciesId||p?.pokemonId||p?.dexId||p?.nationalDex||0)||dex[String(p?.species||p?.name||'').toLowerCase().replace(/[^a-z0-9]/g,'')]||null;
module.exports={dex,species};
