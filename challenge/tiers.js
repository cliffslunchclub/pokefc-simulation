/* Visible Challenge scouting tiers. Internal OVR remains unchanged for matches.
 * Provisional cutoffs; tune them after distribution/balance playtests.
 * S 85+, A 75+, B 65+, C 55+, D below 55. */
(function(root){'use strict';
 const bands=[{tier:'S',min:85,label:'Exceptional fit'},{tier:'A',min:75,label:'Elite fit'},{tier:'B',min:65,label:'Strong fit'},{tier:'C',min:55,label:'Usable fit'},{tier:'D',min:0,label:'Limited fit'}];
 function tier(value){
  const n=Number(value);
  if(!Number.isFinite(n))return 'D';
  return bands.find(b=>n>=b.min)?.tier||'D';
 }
 function info(value){const letter=tier(value);return bands.find(b=>b.tier===letter)}
 root.PFC_CHALLENGE_TIERS={bands,tier,info};
})(typeof window!=='undefined'?window:globalThis);
