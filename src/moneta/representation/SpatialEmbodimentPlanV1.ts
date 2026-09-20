export const SPATIAL_EMBODIMENT_PLAN_SCHEMA_VERSION = 1 as const;
export const SPATIAL_EMBODIMENT_PLAN_MAX_ELEMENTS = 1024 as const;
export const SPATIAL_EMBODIMENT_ELEMENT_MAX_PARAMETERS = 64 as const;

export type SpatialPrimitiveV1 =
  'POINTS' | 'SURFACE' | 'VOLUME' | 'FIELD' | 'GRAPH' | 'TRAJECTORY' | 'GLYPH' | 'LABEL';

export interface SpatialEmbodimentElementV1 {
  id: string;
  semanticNodeId: string;
  /** Stable RepresentationGraph primitive identity. Required for new compositional producers. */
  representationPrimitiveId?: string;
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

export interface SpatialEmbodimentPlanValidationV1 {
  ok: boolean;
  errors: readonly string[];
}
export function validateSpatialEmbodimentPlanV1(
  plan: SpatialEmbodimentPlanV1
): SpatialEmbodimentPlanValidationV1 {
  const errors: string[] = [];
  if (plan.schemaVersion !== SPATIAL_EMBODIMENT_PLAN_SCHEMA_VERSION)
    errors.push('UNSUPPORTED_SCHEMA_VERSION');
  if (plan.elements.length > SPATIAL_EMBODIMENT_PLAN_MAX_ELEMENTS)
    errors.push('ELEMENT_BOUND_EXCEEDED');
  const ids = new Set<string>();
  for (const element of plan.elements) {
    if (!element.id.trim()) errors.push('MISSING_ELEMENT_ID');
    else if (ids.has(element.id)) errors.push('DUPLICATE_ELEMENT_ID:' + element.id);
    ids.add(element.id);
    if (!element.semanticNodeId.trim()) errors.push('MISSING_SEMANTIC_NODE_ID:' + element.id);
    if (
      element.representationPrimitiveId !== undefined &&
      !element.representationPrimitiveId.trim()
    )
      errors.push('EMPTY_REPRESENTATION_PRIMITIVE_ID:' + element.id);
    if (Object.keys(element.parameters).length > SPATIAL_EMBODIMENT_ELEMENT_MAX_PARAMETERS)
      errors.push('PARAMETER_BOUND_EXCEEDED:' + element.id);
  }
  return { ok: errors.length === 0, errors };
}
