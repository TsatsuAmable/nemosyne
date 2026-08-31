import type {
  AnalyticalMethodV1,
  ApproximationV1,
  InformationContractV1,
  ResourceEnvelopeV1,
  SemanticEmbodimentEnvelopeV1,
  SemanticPayloadProvenanceV1,
  SemanticRefusalV1,
} from './SemanticEmbodimentPayload.ts';

export const MAX_CLUSTER_REGIONS_V1 = 256 as const;
/** Maximum UTF-8 bytes across distinct source labels retained in a READY payload. */
export const MAX_CLUSTER_PARTITION_LABEL_BYTES_V1 = 65_536 as const;

/**
 * R2D source-partition request contract. The production path transports only
 * explicit authority/coordinate field names and decision provenance. Rust owns
 * all validation and analytical reduction against the resident dataset handle.
 */
export interface ClusterEmbodimentRequestV1 {
  schemaVersion: 1;
  candidateId: 'CLUSTER_REGIONS';
  partitionField: string;
  coordinateFields: string[];
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

export interface ClusterAxisSummaryV1 {
  field: string;
  centroid: number;
  min: number;
  max: number;
}

export interface ClusterSpatialSummaryV1 {
  axes: ClusterAxisSummaryV1[];
}

export interface ClusterRegionV1 {
  semanticId: string;
  sourcePartitionValue: string;
  assignedCount: number;
  coordinateValidCount: number;
  coordinateExcludedCount: number;
  spatialSummary: ClusterSpatialSummaryV1 | null;
}

export interface ClusterRegionsPayloadV1 {
  partitionField: string;
  coordinateFields: string[];
  counts: ClusterObservationCountsV1;
  regions: ClusterRegionV1[];
}

export type ClusterEmbodimentResultV1 =
  | {
      status: 'READY';
      payload: { kind: 'CLUSTER_REGIONS'; data: ClusterRegionsPayloadV1 };
    }
  | { status: 'REFUSED'; refusal: SemanticRefusalV1 };

export interface ClusterEmbodimentEnvelopeV1 {
  schemaVersion: 1;
  datasetFingerprint: string;
  candidateId: 'CLUSTER_REGIONS';
  representationFamily: 'CLUSTER';
  analyticalMethod: AnalyticalMethodV1;
  approximation: ApproximationV1;
  informationContract: InformationContractV1;
  resource: ResourceEnvelopeV1;
  provenance: SemanticPayloadProvenanceV1;
  result: ClusterEmbodimentResultV1;
}

/**
 * C3 production transport union. Existing aggregate/distribution/density
 * envelopes remain unchanged; CLUSTER_REGIONS joins them without weakening the
 * narrower Rust/WASM cluster contract above.
 */
export type ProductionSemanticEmbodimentEnvelopeV1 =
  | SemanticEmbodimentEnvelopeV1
  | ClusterEmbodimentEnvelopeV1;
