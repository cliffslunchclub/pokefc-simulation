'use strict';
// PokéFC adapter boundary: no Quick Sim implementation is implied.
const crypto=require('node:crypto');
const SCHEMA=1;
const clone=x=>JSON.parse(JSON.stringify(x));
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function prepareHandoff(engine,handle){
  if(!engine||typeof engine.saveCheckpoint!=='function')throw new TypeError('TacticMesh engine facade required');
  if(!handle||!handle.match||handle.match.state.finished)throw new Error('Only an active match can be handed off');
  if(handle.status==='cancelled'||handle.status==='error')throw new Error('Cannot hand off an invalid match');
  const checkpoint=engine.saveCheckpoint(handle);
  if(checkpoint.format!=='tacticmesh-engine-checkpoint'||checkpoint.schemaVersion!==1)throw new Error('Unsupported checkpoint');
  const core=checkpoint.core;
  if(!core||!Number.isInteger(core.tick)||!core.score||!core.clock||!core.state||!Array.isArray(core.players)||!Array.isArray(core.teams)||!core.matchRngState&&core.matchRngState!==0)throw new Error('Incomplete checkpoint');
  const payload={schemaVersion:SCHEMA,sourceEngine:'tacticmesh',matchId:checkpoint.config.matchId,seed:checkpoint.config.seed,engineBuild:checkpoint.engineBuild,rulesVersion:checkpoint.rulesVersion,checkpointHash:digest(checkpoint),at:{tick:core.tick,clock:clone(core.clock),score:clone(core.score),period:core.state.period,matchRngState:core.matchRngState},checkpoint:clone(checkpoint)};
  return payload;
}
function verifyHandoff(payload,engine){
  if(!payload||payload.schemaVersion!==SCHEMA||payload.sourceEngine!=='tacticmesh')throw new Error('Unsupported handoff envelope');
  if(digest(payload.checkpoint)!==payload.checkpointHash)throw new Error('Handoff checkpoint integrity mismatch');
  const cp=payload.checkpoint;
  if(cp.engineBuild!==payload.engineBuild||cp.rulesVersion!==payload.rulesVersion||cp.config.matchId!==payload.matchId||cp.config.seed!==payload.seed)throw new Error('Handoff identity mismatch');
  if(cp.core.tick!==payload.at.tick||JSON.stringify(cp.core.score)!==JSON.stringify(payload.at.score)||JSON.stringify(cp.core.clock)!==JSON.stringify(payload.at.clock)||cp.core.matchRngState!==payload.at.matchRngState)throw new Error('Handoff boundary mismatch');
  if(engine){const caps=engine.getCapabilities();if(caps.engineBuild!==payload.engineBuild||caps.rulesVersion!==payload.rulesVersion)throw new Error('Incompatible TacticMesh build or rules');}
  return true;
}
function restoreWatched(engine,payload){verifyHandoff(payload,engine);return engine.restoreCheckpoint(clone(payload.checkpoint));}
function requireQuickSimAdapter(adapter){
  if(!adapter||typeof adapter.acceptTacticMeshHandoff!=='function'||typeof adapter.finishMatch!=='function')throw new Error('Quick Sim adapter not implemented: cannot hand off safely');
  return adapter;
}
module.exports={prepareHandoff,verifyHandoff,restoreWatched,requireQuickSimAdapter};
