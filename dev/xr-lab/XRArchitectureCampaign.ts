import { createExperimentEvidenceBinding,type XRExperimentArchitecture,type XRExperimentEvidenceBinding } from './XRExperimentEvidenceContract.ts';
const ARMS:readonly XRExperimentArchitecture[]=['SWSE_BASELINE','COUPLED_STAIRCASE','ORTHOGONAL_MATRIX'];
export interface XRArchitectureCampaignInput {protocolId:string;protocolVersion:string;datasetId:string;datasetFingerprint:string;oracleId:string;replayTraceId:string;resourceBudgetId:string;seeds:number[];}
export interface XRArchitectureCampaignRun {blockId:string;order:number;evidence:XRExperimentEvidenceBinding;}
function armOrderForSeed(seed:number):XRExperimentArchitecture[]{const offset=Math.abs(seed)%ARMS.length;return [...ARMS.slice(offset),...ARMS.slice(0,offset)];}
export function buildArchitectureCampaign(input:XRArchitectureCampaignInput):XRArchitectureCampaignRun[]{
 if(new Set(input.seeds).size!==input.seeds.length) throw new Error('duplicate seed in architecture campaign');
 for(const seed of input.seeds) if(!Number.isSafeInteger(seed)) throw new Error('campaign seed must be a safe integer');
 return input.seeds.flatMap(seed=>armOrderForSeed(seed).map((architecture,order)=>({blockId:`${input.protocolId}:${input.datasetFingerprint}:${input.replayTraceId}:${input.resourceBudgetId}:seed-${seed}`,order,evidence:createExperimentEvidenceBinding({architecture,protocolId:input.protocolId,protocolVersion:input.protocolVersion,datasetId:input.datasetId,datasetFingerprint:input.datasetFingerprint,oracleId:input.oracleId,seed,replayTraceId:input.replayTraceId,resourceBudgetId:input.resourceBudgetId})})));
}
