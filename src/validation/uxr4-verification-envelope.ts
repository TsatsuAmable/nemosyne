/** UXR4 governed verification envelope. No automatic thresholds are invented here. */
export const UXR4_EVIDENCE_CLASSES = ['interaction','responsiveness','frame-render','memory-resource','semantic-scale'] as const;
export type Uxr4EvidenceClass = (typeof UXR4_EVIDENCE_CLASSES)[number];
export type Uxr4EvidenceStatus = 'PASS' | 'FAIL' | 'PARTIAL' | 'INVALID_RUN' | 'BLOCKED';
export const UXR4_QUALIFICATION_PROFILES = ['functional-5m','resource-trend-30m','sustained-60m','scale-staircase'] as const;
export type Uxr4QualificationProfile = (typeof UXR4_QUALIFICATION_PROFILES)[number];
export interface Uxr4EvidenceObservation { evidenceClass: Uxr4EvidenceClass; status: Uxr4EvidenceStatus; reasons: string[]; }
export interface Uxr4VerificationEnvelope { schemaVersion: 1; profile: Uxr4QualificationProfile; evidenceClass: 'governed-physical-validation' | 'clean-production-qualification'; observations: Uxr4EvidenceObservation[]; }
export interface Uxr4EnvelopeAdjudication { schemaVersion: 1; profile: Uxr4QualificationProfile; results: Record<Uxr4EvidenceClass,Uxr4EvidenceObservation>; aggregateStatus: Uxr4EvidenceStatus; }
const ORDER: Uxr4EvidenceStatus[] = ['INVALID_RUN','FAIL','BLOCKED','PARTIAL','PASS'];
export function adjudicateUxr4Envelope(input: Uxr4VerificationEnvelope): Uxr4EnvelopeAdjudication {
 const results = Object.fromEntries(UXR4_EVIDENCE_CLASSES.map((evidenceClass) => { const matches=input.observations.filter((item)=>item.evidenceClass===evidenceClass); if(matches.length!==1)return [evidenceClass,{evidenceClass,status:'INVALID_RUN',reasons:['expected exactly one '+evidenceClass+' observation; received '+matches.length]}]; const observation=matches[0]; return [evidenceClass,{...observation,reasons:observation.reasons.slice(0,32)}]; })) as Record<Uxr4EvidenceClass,Uxr4EvidenceObservation>;
 const aggregateStatus=ORDER.find((status)=>UXR4_EVIDENCE_CLASSES.some((kind)=>results[kind].status===status)) ?? 'PARTIAL';
 return {schemaVersion:1,profile:input.profile,results,aggregateStatus};
}
