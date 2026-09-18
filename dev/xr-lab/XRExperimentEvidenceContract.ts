export type XRExperimentArchitecture = 'SWSE_BASELINE' | 'COUPLED_STAIRCASE' | 'ORTHOGONAL_MATRIX';
export interface XRExperimentEvidenceBinding { architecture:XRExperimentArchitecture; protocolId:string; protocolVersion:string; datasetId:string; datasetFingerprint:string; oracleId:string; seed:number; replayTraceId:string; resourceBudgetId:string; }
const REQUIRED_TEXT_FIELDS=['protocolId','protocolVersion','datasetId','datasetFingerprint','oracleId','replayTraceId','resourceBudgetId'] as const;
export function createExperimentEvidenceBinding(input:XRExperimentEvidenceBinding):XRExperimentEvidenceBinding {
 const architectures:readonly XRExperimentArchitecture[]=['SWSE_BASELINE','COUPLED_STAIRCASE','ORTHOGONAL_MATRIX'];
 if(!architectures.includes(input.architecture)) throw new Error('unknown experiment architecture');
 for(const field of REQUIRED_TEXT_FIELDS) if(typeof input[field]!=='string'||input[field].trim().length===0) throw new Error(`experiment evidence requires ${field}`);
 if(!Number.isSafeInteger(input.seed)) throw new Error('experiment evidence seed must be a safe integer');
 return {...input};
}
const COMPARABILITY_FIELDS=['protocolId','protocolVersion','datasetId','datasetFingerprint','oracleId','seed','replayTraceId','resourceBudgetId'] as const;
export function assertComparableExperimentEvidence(left:XRExperimentEvidenceBinding,right:XRExperimentEvidenceBinding):void {
 for(const field of COMPARABILITY_FIELDS) if(left[field]!==right[field]) throw new Error(`experiment evidence is not comparable: ${field} differs`);
}
