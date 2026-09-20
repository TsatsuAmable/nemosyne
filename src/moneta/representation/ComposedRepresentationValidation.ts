import type {
  RepresentationCompositionRelation,
  RepresentationGraph,
  RepresentationPrimitiveKind,
} from './RepresentationGraph.ts';
import { validateRepresentationGraph } from './RepresentationGraph.ts';
import type { SemanticAbstractionLevel } from './SemanticAbstraction.ts';
import type {
  SemanticEmbodimentGraphV1,
  SemanticEmbodimentKind,
  SemanticEmbodimentNodeV1,
} from './SemanticEmbodimentGraphV1.ts';
import { validateSemanticEmbodimentGraphV1 } from './SemanticEmbodimentGraphV1.ts';

export interface ComposedRepresentationValidationIssue {
  path: string;
  message: string;
}

const KIND_COMPATIBILITY: Readonly<
  Partial<Record<RepresentationPrimitiveKind, readonly SemanticEmbodimentKind[]>>
> = {
  DENSITY: ['DENSITY'],
  DISTRIBUTION: ['DISTRIBUTION'],
  CLUSTER: ['CLUSTER', 'POPULATION'],
  TRAJECTORY: ['TEMPORAL'],
  HIERARCHY: ['DATASET', 'POPULATION', 'SUBSET'],
  GRAPH: ['RELATIONSHIP', 'TOPOLOGY'],
  FIELD: ['DENSITY', 'TOPOLOGY', 'TEMPORAL'],
  UNCERTAINTY: ['UNCERTAINTY'],
  POINT_IDENTITY: ['OBSERVATION'],
};
const FIRST_SLICE_RELATIONS = new Set<RepresentationCompositionRelation>([
  'OVERLAY',
  'CONTAINS',
  'DETAIL_OF',
  'COMPARES_WITH',
]);
const LEVEL_RANK: Readonly<Record<SemanticAbstractionLevel, number>> = {
  DATASET: 0,
  REGION: 1,
  SUBSTRUCTURE: 2,
  OBSERVATION_SET: 3,
  OBSERVATION: 4,
};

function sharesEvidence(a: SemanticEmbodimentNodeV1, b: SemanticEmbodimentNodeV1): boolean {
  const refs = new Set(a.evidenceRefs);
  return b.evidenceRefs.some((ref) => refs.has(ref));
}

/** Cross-contract MCR1 admission. It validates identity and a deliberately small composition grammar; it performs no analytical inference. */
export function validateComposedRepresentation(
  semanticGraph: SemanticEmbodimentGraphV1,
  representationGraph: RepresentationGraph
): ComposedRepresentationValidationIssue[] {
  const issues: ComposedRepresentationValidationIssue[] = [];
  for (const error of validateSemanticEmbodimentGraphV1(semanticGraph).errors)
    issues.push({ path: 'semanticGraph', message: error });
  for (const issue of validateRepresentationGraph(representationGraph))
    issues.push({ path: `representationGraph.${issue.path}`, message: issue.message });
  if (semanticGraph.datasetFingerprint !== representationGraph.provenance.datasetFingerprint)
    issues.push({
      path: 'provenance.datasetFingerprint',
      message: 'semantic and representation dataset identities differ',
    });
  const semantic = new Map(semanticGraph.nodes.map((node) => [node.id, node]));
  const primitives = new Map(
    representationGraph.primitives.map((primitive) => [primitive.id, primitive])
  );

  const compatibilityGraph = representationGraph.provenance.generatedBy === 'compatibility-adapter';
  representationGraph.primitives.forEach((primitive, index) => {
    if (
      primitive.kind !== 'ANNOTATION' &&
      primitive.kind !== 'FILTER' &&
      primitive.kind !== 'DETAIL_EXPANSION' &&
      primitive.semanticInputs.length === 0
    )
      issues.push({
        path: `primitives[${index}].semanticInputs`,
        message: 'semantic primitive requires governed semantic identity',
      });
    for (const semanticId of primitive.semanticInputs) {
      const node = semantic.get(semanticId);
      if (!node) {
        if (compatibilityGraph) continue;
        issues.push({
          path: `primitives[${index}].semanticInputs`,
          message: `unknown semantic node: ${semanticId}`,
        });
        continue;
      }
      const allowed = KIND_COMPATIBILITY[primitive.kind];
      if (allowed && !allowed.includes(node.kind))
        issues.push({
          path: `primitives[${index}].semanticInputs`,
          message: `${primitive.kind} is incompatible with semantic kind ${node.kind}`,
        });
      if (node.evidenceRefs.length === 0)
        issues.push({
          path: `primitives[${index}].semanticInputs`,
          message: `semantic node has no governed evidence: ${semanticId}`,
        });
    }
  });

  representationGraph.edges.forEach((edge, index) => {
    if (!FIRST_SLICE_RELATIONS.has(edge.relation)) {
      issues.push({
        path: `edges[${index}].relation`,
        message: `unsupported MCR1 composition relation: ${edge.relation}`,
      });
      return;
    }
    const from = primitives.get(edge.from);
    const to = primitives.get(edge.to);
    if (!from || !to) return;
    const fromNodes = from.semanticInputs
      .map((id) => semantic.get(id))
      .filter((n): n is SemanticEmbodimentNodeV1 => !!n);
    const toNodes = to.semanticInputs
      .map((id) => semantic.get(id))
      .filter((n): n is SemanticEmbodimentNodeV1 => !!n);
    if (fromNodes.length === 0 || toNodes.length === 0) return;
    if (
      edge.relation === 'DETAIL_OF' &&
      fromNodes.some((a) =>
        toNodes.some((b) => LEVEL_RANK[a.abstractionLevel] <= LEVEL_RANK[b.abstractionLevel])
      )
    )
      issues.push({
        path: `edges[${index}]`,
        message: 'DETAIL_OF source must be semantically finer than target',
      });
    if (
      (edge.relation === 'OVERLAY' || edge.relation === 'COMPARES_WITH') &&
      !fromNodes.some((a) => toNodes.some((b) => sharesEvidence(a, b)))
    )
      issues.push({
        path: `edges[${index}]`,
        message: `${edge.relation} requires shared governed evidence`,
      });
    if (
      edge.relation === 'CONTAINS' &&
      !fromNodes.some((a) => toNodes.some((b) => b.parentId === a.id || a.childIds.includes(b.id)))
    )
      issues.push({
        path: `edges[${index}]`,
        message: 'CONTAINS requires a governed semantic parent-child relation',
      });
  });
  return issues;
}
