import type {
  AnalyticalMethodV1,
  ApproximationV1,
  InformationContractV1,
  ResourceEnvelopeV1,
  SemanticPayloadProvenanceV1,
  SemanticRefusalV1,
} from './SemanticEmbodimentPayload.ts';
import { SEMANTIC_EMBODIMENT_SCHEMA_VERSION } from './SemanticEmbodimentPayload.ts';

/** RFC 0001 hard V1 output bound. Over-bound partitions refuse; they are never coarsened. */
export const MAX_CLUSTER_REGIONS_V1 = 256 as const;

export interface SourcePartitionAuthorityV1 {
  kind: 'SOURCE_PARTITION';
  field: string;
}

/**
 * C2 request contract. The partition authority and 2D/3D coordinates are
 * explicit so neither transport nor presentation may infer them from colour,
 * convenient field names, density shape, or layout positions.
 */
export interface ClusterEmbodimentRequestV1 {
  schemaVersion: typeof SEMANTIC_EMBODIMENT_SCHEMA_VERSION;
  candidateId: 'CLUSTER_REGIONS';
  authority: SourcePartitionAuthorityV1;
  coordinateFields: [string, string] | [string, string, string];
  decisionId?: string;
  decisionModelVersion?: string;
  decisionModelArtifactHash?: string;
}

export interface ClusterObservationCountsV1 {
  sourceCount: number;
  assignedCount: number;
  unassignedCount: number;
  coordinateValidCount: number;
  coordinateExcludedCount: number;
}

/**
 * Descriptive complete-case coordinate summary only. These extrema are not a
 * support hull, confidence region, separation margin, or inferred boundary.
 */
export interface ClusterSpatialSummaryV1 {
  centroid: number[];
  min: number[];
  max: number[];
}

export interface ClusterRegionV1 {
  semanticId: string;
  /** Exact non-empty canonical source label; C2 does not trim or rewrite it. */
  partitionValue: string;
  assignedCount: number;
  coordinateValidCount: number;
  coordinateExcludedCount: number;
  /** Null when this assigned source group has no complete-case coordinate tuple. */
  spatialSummary: ClusterSpatialSummaryV1 | null;
}

export interface ClusterRegionsPayloadV1 {
  partitionField: string;
  coordinateFields: string[];
  counts: ClusterObservationCountsV1;
  regions: ClusterRegionV1[];
}

export type ClusterRepresentationPayloadV1 = {
  kind: 'CLUSTER_REGIONS';
  data: ClusterRegionsPayloadV1;
};

export type ClusterSemanticEmbodimentResultV1 =
  | { status: 'READY'; payload: ClusterRepresentationPayloadV1 }
  | { status: 'REFUSED'; refusal: SemanticRefusalV1 };

/**
 * C2-only mirror of the Rust cluster envelope. It is intentionally not added
 * to the production `SemanticEmbodimentEnvelopeV1` union until the C3 cutover.
 */
export interface ClusterSemanticEmbodimentEnvelopeV1 {
  schemaVersion: typeof SEMANTIC_EMBODIMENT_SCHEMA_VERSION;
  datasetFingerprint: string;
  candidateId: 'CLUSTER_REGIONS';
  representationFamily: 'CLUSTER';
  analyticalMethod: AnalyticalMethodV1;
  approximation: ApproximationV1;
  informationContract: InformationContractV1;
  resource: ResourceEnvelopeV1;
  provenance: SemanticPayloadProvenanceV1;
  result: ClusterSemanticEmbodimentResultV1;
}
