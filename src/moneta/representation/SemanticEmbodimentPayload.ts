import type { InformationType, SemanticRepresentationId } from './RepresentationCandidate.ts';

export const SEMANTIC_EMBODIMENT_SCHEMA_VERSION = 1 as const;
export const MAX_AGGREGATE_GROUPS_V1 = 4096 as const;

/**
 * Payload-family identity is deliberately distinct from layout family identity.
 * A semantic aggregate is still an aggregate if its presentation later uses a
 * grid, radial, geo or other layout. A4 may connect this family to Moneta search
 * only after the Rust aggregate builder exists.
 */
export type SemanticEmbodimentFamilyV1 =
  | 'OBSERVATION'
  | 'DISTRIBUTION'
  | 'CLUSTER'
  | 'AGGREGATE'
  | 'GRAPH'
  | 'FIELD'
  | 'TOPOLOGY'
  | 'TEMPORAL'
  | 'HIERARCHICAL'
  | 'FREQUENCY';

export type ApproximationModeV1 = 'EXACT' | 'BINNED' | 'SAMPLED' | 'ESTIMATED' | 'BOUNDED';

export type AggregateFunctionV1 = 'COUNT' | 'SUM' | 'MEAN' | 'MIN' | 'MAX';

export type SemanticRefusalCodeV1 =
  | 'UNSUPPORTED_CANDIDATE'
  | 'RESOURCE_LIMIT'
  | 'MISSING_EVIDENCE'
  | 'INVALID_PARAMETERS';

export interface AnalyticalMethodV1 {
  name: string;
  version: string;
  parameters: unknown;
}

export interface ApproximationV1 {
  mode: ApproximationModeV1;
  representedRowCount: number;
  description?: string;
}

export interface InformationContractV1 {
  preserves: InformationType[];
  loses: InformationType[];
}

export interface ResourceEnvelopeV1 {
  sourceRowCount: number;
  elementCount: number;
  maxElementCount: number;
}

export interface SemanticPayloadProvenanceV1 {
  kernelVersion: string;
  algorithmVersion: string;
  decisionId?: string;
  decisionModelVersion?: string;
  decisionModelArtifactHash?: string;
}

export interface AggregateMeasureV1 {
  field?: string;
  function: AggregateFunctionV1;
}

export interface AggregateGroupV1 {
  semanticId: string;
  /** A grouping key is intentionally scalar; nested row fragments are forbidden. */
  key: string | number | boolean | null;
  count: number;
  aggregateValue?: number;
}

export interface AggregateVolumePayloadV1 {
  groupingFields: string[];
  measure: AggregateMeasureV1;
  groups: AggregateGroupV1[];
}

export type RepresentationPayloadV1 = {
  kind: 'AGGREGATE_VOLUME';
  data: AggregateVolumePayloadV1;
};

export interface SemanticRefusalV1 {
  code: SemanticRefusalCodeV1;
  message: string;
  estimatedElements?: number;
}

export type SemanticEmbodimentResultV1 =
  | { status: 'READY'; payload: RepresentationPayloadV1 }
  | { status: 'REFUSED'; refusal: SemanticRefusalV1 };

/**
 * Rust-owned semantic embodiment envelope. TypeScript mirrors the wire shape
 * but does not validate or repair it; `roundTripSemanticEmbodimentPayloadV1`
 * delegates strict validation/normalisation to the Rust/WASM authority.
 */
export interface SemanticEmbodimentEnvelopeV1 {
  schemaVersion: typeof SEMANTIC_EMBODIMENT_SCHEMA_VERSION;
  datasetFingerprint: string;
  candidateId: SemanticRepresentationId;
  representationFamily: SemanticEmbodimentFamilyV1;
  analyticalMethod: AnalyticalMethodV1;
  approximation: ApproximationV1;
  informationContract: InformationContractV1;
  resource: ResourceEnvelopeV1;
  provenance: SemanticPayloadProvenanceV1;
  result: SemanticEmbodimentResultV1;
}
