export const SPATIAL_EMBODIMENT_PLAN_SCHEMA_VERSION = 1 as const;

export type SpatialPrimitiveV1 =
  | 'POINTS'
  | 'SURFACE'
  | 'VOLUME'
  | 'FIELD'
  | 'GRAPH'
  | 'TRAJECTORY'
  | 'GLYPH'
  | 'LABEL';

export interface SpatialEmbodimentElementV1 {
  id: string;
  semanticNodeId: string;
  primitive: SpatialPrimitiveV1;
  parameters: Readonly<Record<string, string | number | boolean>>;
}

export interface SpatialEmbodimentPlanV1 {
  schemaVersion: typeof SPATIAL_EMBODIMENT_PLAN_SCHEMA_VERSION;
  planId: string;
  semanticGraphId: string;
  datasetFingerprint: string;
  decisionId: string;
  elements: readonly SpatialEmbodimentElementV1[];
}
