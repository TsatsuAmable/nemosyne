import type { InformationType, SemanticRepresentationId } from './RepresentationCandidate.ts';

export const SEMANTIC_EMBODIMENT_SCHEMA_VERSION = 1 as const;
export const MAX_AGGREGATE_GROUPS_V1 = 4096 as const;
export const MAX_DISTRIBUTION_BINS_V1 = 256 as const;
export const MAX_DISTRIBUTION_ECDF_KNOTS_V1 = 256 as const;
export const MAX_DISTRIBUTION_QUANTILES_V1 = 32 as const;
export const MAX_DISTRIBUTION_ELEMENTS_V1 =
  MAX_DISTRIBUTION_BINS_V1 +
  MAX_DISTRIBUTION_ECDF_KNOTS_V1 +
  MAX_DISTRIBUTION_QUANTILES_V1;

/**
 * Payload-family identity is deliberately distinct from layout family identity.
 * A semantic aggregate is still an aggregate if its presentation later uses a
 * grid, radial, geo or other layout.
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

/**
 * A4 request contract. Grouping and measure are explicit inputs; callers may
 * not silently scan rows or substitute a different measure in TypeScript.
 */
export interface AggregateEmbodimentRequestV1 {
  schemaVersion: typeof SEMANTIC_EMBODIMENT_SCHEMA_VERSION;
  candidateId: 'AGGREGATE_VOLUME';
  groupingField: string;
  measure: AggregateMeasureV1;
  decisionId?: string;
  decisionModelVersion?: string;
  decisionModelArtifactHash?: string;
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

/**
 * M1 request contract. The measure is explicit so no presentation or transport
 * layer can silently choose a numeric column on the investigator's behalf.
 */
export interface DistributionEmbodimentRequestV1 {
  schemaVersion: typeof SEMANTIC_EMBODIMENT_SCHEMA_VERSION;
  candidateId: 'DISTRIBUTION_FIELD';
  measureField: string;
  histogramBinCount: number;
  ecdfKnotCount: number;
  quantileProbabilities: number[];
  decisionId?: string;
  decisionModelVersion?: string;
  decisionModelArtifactHash?: string;
}

export interface DistributionObservationCountsV1 {
  sourceCount: number;
  validCount: number;
  missingCount: number;
  nonFiniteCount: number;
}

export interface DistributionDomainV1 {
  min: number;
  max: number;
}

export interface DistributionHistogramBinV1 {
  semanticId: string;
  lowerBound: number;
  upperBound: number;
  count: number;
  upperInclusive: boolean;
}

export interface DistributionEcdfKnotV1 {
  semanticId: string;
  value: number;
  cumulativeCount: number;
  cumulativeProbability: number;
}

export interface DistributionQuantileV1 {
  semanticId: string;
  probability: number;
  value: number;
}

export interface EmpiricalDistributionPayloadV1 {
  measureField: string;
  domain: DistributionDomainV1;
  counts: DistributionObservationCountsV1;
  histogram: DistributionHistogramBinV1[];
  ecdf: DistributionEcdfKnotV1[];
  quantiles: DistributionQuantileV1[];
}

export type RepresentationPayloadV1 =
  | {
      kind: 'AGGREGATE_VOLUME';
      data: AggregateVolumePayloadV1;
    }
  | {
      kind: 'EMPIRICAL_DISTRIBUTION';
      data: EmpiricalDistributionPayloadV1;
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
 * but does not validate or repair it; the Rust/WASM authority validates every
 * envelope before it crosses the boundary.
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
