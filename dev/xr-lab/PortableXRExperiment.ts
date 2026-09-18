import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { buildArchitectureCampaign, type XRArchitectureCampaignRun } from './XRArchitectureCampaign.ts';
import type { XRExperimentArchitecture } from './XRExperimentEvidenceContract.ts';

const REQUIRED_ARMS:readonly XRExperimentArchitecture[]=['SWSE_BASELINE','COUPLED_STAIRCASE','ORTHOGONAL_MATRIX'];
export interface PortableXRExperimentConfig {schemaVersion:1;protocolId:string;protocolVersion:string;architectures:XRExperimentArchitecture[];dataset:{id:string;fingerprint:string;oracleId:string};replayTraceId:string;seeds:number[];resourceBudgetId:string;evidence:{rawDirectory:string;derivedDirectory:string;allowHumanClaimsFromSimulator:false;allowDeviceQualificationFromSimulator:false};}
export interface PortableXRExperimentBundle {schemaVersion:1;config:PortableXRExperimentConfig;buildHash:string;runs:XRArchitectureCampaignRun[];bundleHash:string;}
function stable(value:unknown):string {if(Array.isArray(value))return '['+value.map(stable).join(',')+']';if(value&&typeof value==='object')return '{'+Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+stable(v)).join(',')+'}';return JSON.stringify(value);}
function digest(value:unknown):string{return 'sha256:'+bytesToHex(sha256(new TextEncoder().encode(stable(value))));}
export function parsePortableExperimentConfig(value:unknown):PortableXRExperimentConfig {
 if(!value||typeof value!=='object')throw new Error('experiment config must be an object');
 const c=value as Partial<PortableXRExperimentConfig>;
 if(c.schemaVersion!==1)throw new Error('unsupported experiment config schema');
 for(const field of ['protocolId','protocolVersion','replayTraceId','resourceBudgetId'] as const)if(typeof c[field]!=='string'||!c[field]!.trim())throw new Error(`experiment config requires ${field}`);
 if(!c.dataset||!c.dataset.id?.trim()||!c.dataset.fingerprint?.trim()||!c.dataset.oracleId?.trim())throw new Error('experiment config requires dataset identity and oracle');
 if(!Array.isArray(c.architectures)||c.architectures.length!==3||REQUIRED_ARMS.some(a=>!c.architectures!.includes(a)))throw new Error('experiment config requires exactly the three registered architecture arms');
 if(!Array.isArray(c.seeds)||c.seeds.length===0)throw new Error('experiment config requires seeds');
 if(!c.evidence||c.evidence.allowHumanClaimsFromSimulator!==false||c.evidence.allowDeviceQualificationFromSimulator!==false)throw new Error('simulator evidence cannot qualify human or device claims');
 if(!c.evidence.rawDirectory?.trim()||!c.evidence.derivedDirectory?.trim())throw new Error('experiment config requires evidence directories');
 return c as PortableXRExperimentConfig;
}
export function buildPortableExperimentBundle(config:PortableXRExperimentConfig,buildHash:string):PortableXRExperimentBundle {
 if(!buildHash.trim())throw new Error('build hash is required');
 const runs=buildArchitectureCampaign({protocolId:config.protocolId,protocolVersion:config.protocolVersion,datasetId:config.dataset.id,datasetFingerprint:config.dataset.fingerprint,oracleId:config.dataset.oracleId,replayTraceId:config.replayTraceId,resourceBudgetId:config.resourceBudgetId,seeds:config.seeds});
 const unsigned={schemaVersion:1 as const,config,buildHash,runs}; return {...unsigned,bundleHash:digest(unsigned)};
}
export function verifyPortableExperimentBundle(bundle:PortableXRExperimentBundle):true {
 const {bundleHash,...unsigned}=bundle; if(digest(unsigned)!==bundleHash)throw new Error('experiment bundle hash mismatch'); parsePortableExperimentConfig(bundle.config); return true;
}
