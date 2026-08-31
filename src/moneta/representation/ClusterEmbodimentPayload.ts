import type {
  AnalyticalMethodV1,
  ApproximationV1,
  InformationContractV1,
  ResourceEnvelopeV1,
  SemanticPayloadProvenanceV1,
  SemanticRefusalV1,
} from './SemanticEmbodimentPayload.ts';

export const MAX_CLUSTER_REGIONS_V1 = 256 as const;

/**
 * C2 transport contract for the Rust-owned source-partition builder.
 * This file is intentionally separate from the production semantic-payload
 * union until C3 performs the governed Worker/renderer cutover.
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
