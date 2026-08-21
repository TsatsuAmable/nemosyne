/**
 * RepresentationGraph — V3 compositional representation contract.
 *
 * A representation is a graph of semantic primitives and mappings rather than
 * a single enum winner. Existing RepresentationFamily/VRLayout values remain
 * compatibility vocabulary while the graph becomes the extensible boundary.
 */

export const REPRESENTATION_GRAPH_SCHEMA_VERSION = '1.0.0' as const;

export type RepresentationPrimitiveKind =
  | 'POINT_IDENTITY'
  | 'DENSITY'
  | 'FIELD'
  | 'CLUSTER'
  | 'TRAJECTORY'
  | 'HIERARCHY'
  | 'GRAPH'
  | 'MATRIX'
  | 'MANIFOLD'
  | 'DISTRIBUTION'
  | 'TEMPORAL'
  | 'SPECTRAL'
  | 'UNCERTAINTY'
  | 'ANNOTATION'
  | 'COMPARISON'
  | 'AGGREGATION'
  | 'FILTER'
  | 'DETAIL_EXPANSION';

export type RepresentationCompositionRelation =
  | 'OVERLAY'
  | 'CONTAINS'
  | 'DERIVES_FROM'
  | 'COORDINATES_WITH'
  | 'DETAIL_OF'
  | 'COMPARES_WITH';

export type RepresentationParameterValue = string | number | boolean | null;

export interface RepresentationPrimitive {
  id: string;
  kind: RepresentationPrimitiveKind;
  semanticInputs: readonly string[];
  visualEncoding: Readonly<Record<string, string>>;
  interactionAffordances: readonly string[];
  analyticalDependencies: readonly string[];
  parameters: Readonly<Record<string, RepresentationParameterValue>>;
  limitations: readonly string[];
}

export interface RepresentationCompositionEdge {
  from: string;
  to: string;
  relation: RepresentationCompositionRelation;
}

export interface RepresentationGraphProvenance {
  ontologyVersion: string;
  fitnessModelVersion: string;
  datasetFingerprint: string;
  evidenceSchemaVersion: string;
  generatedBy: 'moneta' | 'researcher' | 'replay' | 'compatibility-adapter';
}

export interface RepresentationGraph {
  schemaVersion: typeof REPRESENTATION_GRAPH_SCHEMA_VERSION;
  graphId: string;
  primitives: readonly RepresentationPrimitive[];
  edges: readonly RepresentationCompositionEdge[];
  semanticMappings: Readonly<Record<string, string>>;
  layoutPolicy: string;
  scalePolicy: string;
  interactionPolicy: string;
  detailPolicy: string;
  constraints: readonly string[];
  provenance: RepresentationGraphProvenance;
}

export interface RepresentationGraphValidationIssue {
  path: string;
  message: string;
}

function nonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

export function validateRepresentationGraph(
  graph: RepresentationGraph
): RepresentationGraphValidationIssue[] {
  const issues: RepresentationGraphValidationIssue[] = [];

  if (graph.schemaVersion !== REPRESENTATION_GRAPH_SCHEMA_VERSION) {
    issues.push({ path: 'schemaVersion', message: `unsupported schema version: ${graph.schemaVersion}` });
  }
  if (!nonEmpty(graph.graphId)) issues.push({ path: 'graphId', message: 'must be non-empty' });
  if (graph.primitives.length === 0) {
    issues.push({ path: 'primitives', message: 'must contain at least one representation primitive' });
  }

  const primitiveIds = new Set<string>();
  graph.primitives.forEach((primitive, index) => {
    const path = `primitives[${index}]`;
    if (!nonEmpty(primitive.id)) {
      issues.push({ path: `${path}.id`, message: 'must be non-empty' });
    } else if (primitiveIds.has(primitive.id)) {
      issues.push({ path: `${path}.id`, message: `duplicate primitive id: ${primitive.id}` });
    } else {
      primitiveIds.add(primitive.id);
    }

    if (primitive.semanticInputs.some((input) => !nonEmpty(input))) {
      issues.push({ path: `${path}.semanticInputs`, message: 'semantic inputs must be non-empty' });
    }
    if (primitive.analyticalDependencies.some((dependency) => !nonEmpty(dependency))) {
      issues.push({
        path: `${path}.analyticalDependencies`,
        message: 'analytical dependency identifiers must be non-empty',
      });
    }
  });

  graph.edges.forEach((edge, index) => {
    const path = `edges[${index}]`;
    if (!primitiveIds.has(edge.from)) {
      issues.push({ path: `${path}.from`, message: `unknown primitive: ${edge.from}` });
    }
    if (!primitiveIds.has(edge.to)) {
      issues.push({ path: `${path}.to`, message: `unknown primitive: ${edge.to}` });
    }
    if (edge.from === edge.to) {
      issues.push({ path, message: 'self-composition edges are not allowed' });
    }
  });

  for (const [semantic, primitiveId] of Object.entries(graph.semanticMappings)) {
    if (!nonEmpty(semantic)) {
      issues.push({ path: 'semanticMappings', message: 'semantic mapping keys must be non-empty' });
    }
    if (!primitiveIds.has(primitiveId)) {
      issues.push({
        path: `semanticMappings.${semantic}`,
        message: `mapping references unknown primitive: ${primitiveId}`,
      });
    }
  }

  const requiredPolicies: Array<[string, string]> = [
    ['layoutPolicy', graph.layoutPolicy],
    ['scalePolicy', graph.scalePolicy],
    ['interactionPolicy', graph.interactionPolicy],
    ['detailPolicy', graph.detailPolicy],
  ];
  requiredPolicies.forEach(([path, value]) => {
    if (!nonEmpty(value)) issues.push({ path, message: 'must be explicit' });
  });

  const provenance = graph.provenance;
  if (!nonEmpty(provenance.ontologyVersion)) {
    issues.push({ path: 'provenance.ontologyVersion', message: 'must be non-empty' });
  }
  if (!nonEmpty(provenance.fitnessModelVersion)) {
    issues.push({ path: 'provenance.fitnessModelVersion', message: 'must be non-empty' });
  }
  if (!nonEmpty(provenance.datasetFingerprint)) {
    issues.push({ path: 'provenance.datasetFingerprint', message: 'must be non-empty' });
  }
  if (!nonEmpty(provenance.evidenceSchemaVersion)) {
    issues.push({ path: 'provenance.evidenceSchemaVersion', message: 'must be non-empty' });
  }

  return issues;
}

export class InvalidRepresentationGraphError extends Error {
  readonly issues: readonly RepresentationGraphValidationIssue[];

  constructor(issues: readonly RepresentationGraphValidationIssue[]) {
    super(
      `Invalid RepresentationGraph: ${issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join('; ')}`
    );
    this.name = 'InvalidRepresentationGraphError';
    this.issues = issues;
  }
}

export function assertRepresentationGraph(graph: RepresentationGraph): void {
  const issues = validateRepresentationGraph(graph);
  if (issues.length > 0) throw new InvalidRepresentationGraphError(issues);
}
