/**
 * RepresentationGraphGrammar — Bounded compositional representation grammar for FM7.
 *
 * Defines admissible production rules, primitive compatibility, and valid composition
 * relations for synthesizing representation graphs without producing contradictory or
 * ungrounded structures.
 */

import {
  type RepresentationGraph,
  type RepresentationPrimitive,
  type RepresentationPrimitiveKind,
  type RepresentationCompositionEdge,
  type RepresentationCompositionRelation,
  REPRESENTATION_GRAPH_SCHEMA_VERSION,
  validateRepresentationGraph,
} from '../representation/RepresentationGraph.ts';

export const GRAMMAR_MAX_PRIMITIVES = 16 as const;
export const GRAMMAR_MAX_EDGES = 32 as const;

/**
 * Valid pairwise composition relations between primitive kinds.
 * Maps: fromKind -> allowed toKinds with admissible relations.
 */
export const ADMISSIBLE_COMPOSITION_RULES: Readonly<
  Record<
    RepresentationPrimitiveKind,
    Readonly<Partial<Record<RepresentationPrimitiveKind, readonly RepresentationCompositionRelation[]>>>
  >
> = {
  POINT_IDENTITY: {
    DENSITY: ['OVERLAY', 'DERIVES_FROM'],
    CLUSTER: ['CONTAINS', 'DERIVES_FROM'],
    UNCERTAINTY: ['OVERLAY', 'COORDINATES_WITH'],
    TEMPORAL: ['COORDINATES_WITH', 'DERIVES_FROM'],
    DETAIL_EXPANSION: ['DETAIL_OF'],
  },
  DENSITY: {
    POINT_IDENTITY: ['OVERLAY'],
    CLUSTER: ['COORDINATES_WITH', 'OVERLAY'],
    MANIFOLD: ['OVERLAY', 'DERIVES_FROM'],
    UNCERTAINTY: ['OVERLAY'],
    COMPARISON: ['COMPARES_WITH'],
  },
  CLUSTER: {
    POINT_IDENTITY: ['CONTAINS'],
    DENSITY: ['COORDINATES_WITH', 'OVERLAY'],
    GRAPH: ['COORDINATES_WITH', 'DERIVES_FROM'],
    HIERARCHY: ['DERIVES_FROM', 'COORDINATES_WITH'],
    COMPARISON: ['COMPARES_WITH'],
  },
  FIELD: {
    POINT_IDENTITY: ['OVERLAY'],
    DENSITY: ['COORDINATES_WITH'],
    TRAJECTORY: ['COORDINATES_WITH'],
  },
  TRAJECTORY: {
    TEMPORAL: ['DERIVES_FROM', 'COORDINATES_WITH'],
    POINT_IDENTITY: ['COORDINATES_WITH'],
    MANIFOLD: ['OVERLAY'],
  },
  HIERARCHY: {
    CLUSTER: ['DERIVES_FROM'],
    GRAPH: ['COORDINATES_WITH', 'DERIVES_FROM'],
    DETAIL_EXPANSION: ['DETAIL_OF'],
  },
  GRAPH: {
    CLUSTER: ['COORDINATES_WITH'],
    HIERARCHY: ['COORDINATES_WITH'],
    POINT_IDENTITY: ['CONTAINS'],
    COMPARISON: ['COMPARES_WITH'],
  },
  MATRIX: {
    SPECTRAL: ['DERIVES_FROM'],
    COMPARISON: ['COMPARES_WITH'],
  },
  MANIFOLD: {
    DENSITY: ['OVERLAY'],
    CLUSTER: ['COORDINATES_WITH'],
    POINT_IDENTITY: ['OVERLAY'],
  },
  DISTRIBUTION: {
    UNCERTAINTY: ['OVERLAY', 'COORDINATES_WITH'],
    POINT_IDENTITY: ['DERIVES_FROM'],
    COMPARISON: ['COMPARES_WITH'],
  },
  TEMPORAL: {
    POINT_IDENTITY: ['COORDINATES_WITH'],
    TRAJECTORY: ['DERIVES_FROM', 'COORDINATES_WITH'],
    DISTRIBUTION: ['COORDINATES_WITH'],
    COMPARISON: ['COMPARES_WITH'],
  },
  SPECTRAL: {
    MATRIX: ['COORDINATES_WITH'],
    DENSITY: ['COORDINATES_WITH'],
  },
  UNCERTAINTY: {
    POINT_IDENTITY: ['OVERLAY'],
    DISTRIBUTION: ['OVERLAY', 'COORDINATES_WITH'],
    DENSITY: ['OVERLAY'],
  },
  ANNOTATION: {
    POINT_IDENTITY: ['COORDINATES_WITH'],
    CLUSTER: ['COORDINATES_WITH'],
    DISTRIBUTION: ['COORDINATES_WITH'],
  },
  COMPARISON: {
    POINT_IDENTITY: ['COMPARES_WITH'],
    CLUSTER: ['COMPARES_WITH'],
    DISTRIBUTION: ['COMPARES_WITH'],
    TEMPORAL: ['COMPARES_WITH'],
  },
  AGGREGATION: {
    POINT_IDENTITY: ['DERIVES_FROM'],
    CLUSTER: ['DERIVES_FROM'],
    DENSITY: ['DERIVES_FROM'],
  },
  FILTER: {
    POINT_IDENTITY: ['DERIVES_FROM'],
    CLUSTER: ['DERIVES_FROM'],
    TEMPORAL: ['DERIVES_FROM'],
  },
  DETAIL_EXPANSION: {
    POINT_IDENTITY: ['DETAIL_OF'],
    CLUSTER: ['DETAIL_OF'],
    HIERARCHY: ['DETAIL_OF'],
  },
};

export interface GrammarValidationResult {
  valid: boolean;
  violations: string[];
}

/**
 * Validates a RepresentationGraph against the bounded compositional grammar.
 */
export function validateGraphAgainstGrammar(graph: RepresentationGraph): GrammarValidationResult {
  const violations: string[] = [];

  // Check base schema validation
  const baseIssues = validateRepresentationGraph(graph);
  for (const issue of baseIssues) {
    violations.push(`[Schema] ${issue.path}: ${issue.message}`);
  }

  // Check size bounds
  if (graph.primitives.length > GRAMMAR_MAX_PRIMITIVES) {
    violations.push(
      `[Grammar] Primitives count ${graph.primitives.length} exceeds maximum bound of ${GRAMMAR_MAX_PRIMITIVES}`
    );
  }
  if (graph.edges.length > GRAMMAR_MAX_EDGES) {
    violations.push(
      `[Grammar] Edges count ${graph.edges.length} exceeds maximum bound of ${GRAMMAR_MAX_EDGES}`
    );
  }

  // Build lookup of primitives
  const primitiveMap = new Map<string, RepresentationPrimitive>();
  for (const prim of graph.primitives) {
    primitiveMap.set(prim.id, prim);
  }

  // Validate composition edges against grammar rules
  for (const edge of graph.edges) {
    const fromPrim = primitiveMap.get(edge.from);
    const toPrim = primitiveMap.get(edge.to);

    if (!fromPrim || !toPrim) {
      violations.push(`[Grammar] Edge references non-existent primitive: ${edge.from} -> ${edge.to}`);
      continue;
    }

    const rules = ADMISSIBLE_COMPOSITION_RULES[fromPrim.kind];
    const allowedRelations = rules?.[toPrim.kind];

    if (!allowedRelations || !allowedRelations.includes(edge.relation)) {
      violations.push(
        `[Grammar] Inadmissible relation ${edge.relation} between ${fromPrim.kind} and ${toPrim.kind}`
      );
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Grammar mutation operators for candidate search and synthesis.
 */
export class RepresentationGraphGrammar {
  /**
   * Clones a graph for safe modification.
   */
  public static cloneGraph(graph: RepresentationGraph): RepresentationGraph {
    return {
      schemaVersion: graph.schemaVersion,
      graphId: graph.graphId,
      primitives: graph.primitives.map((p) => ({
        ...p,
        semanticInputs: [...p.semanticInputs],
        visualEncoding: { ...p.visualEncoding },
        interactionAffordances: [...p.interactionAffordances],
        analyticalDependencies: [...p.analyticalDependencies],
        parameters: { ...p.parameters },
        limitations: [...p.limitations],
      })),
      edges: graph.edges.map((e) => ({ ...e })),
      semanticMappings: { ...graph.semanticMappings },
      layoutPolicy: graph.layoutPolicy,
      scalePolicy: graph.scalePolicy,
      interactionPolicy: graph.interactionPolicy,
      detailPolicy: graph.detailPolicy,
      constraints: [...graph.constraints],
      provenance: { ...graph.provenance },
    };
  }

  /**
   * Adds a primitive to the graph if within bounds.
   */
  public static addPrimitive(
    graph: RepresentationGraph,
    primitive: RepresentationPrimitive
  ): RepresentationGraph {
    if (graph.primitives.length >= GRAMMAR_MAX_PRIMITIVES) {
      return graph;
    }
    const cloned = this.cloneGraph(graph);
    return {
      ...cloned,
      primitives: [...cloned.primitives, primitive],
    };
  }

  /**
   * Adds an admissible composition edge between two existing primitives.
   */
  public static addEdge(
    graph: RepresentationGraph,
    edge: RepresentationCompositionEdge
  ): RepresentationGraph {
    if (graph.edges.length >= GRAMMAR_MAX_EDGES) {
      return graph;
    }
    const fromPrim = graph.primitives.find((p) => p.id === edge.from);
    const toPrim = graph.primitives.find((p) => p.id === edge.to);
    if (!fromPrim || !toPrim) return graph;

    const allowed = ADMISSIBLE_COMPOSITION_RULES[fromPrim.kind]?.[toPrim.kind];
    if (!allowed || !allowed.includes(edge.relation)) {
      return graph; // inadmissible relation
    }

    const cloned = this.cloneGraph(graph);
    return {
      ...cloned,
      edges: [...cloned.edges, edge],
    };
  }

  /**
   * Creates an empty valid base graph with specified provenance.
   */
  public static createEmptyGraph(
    graphId: string,
    datasetFingerprint: string,
    generatedBy: 'moneta' | 'researcher' | 'replay' | 'compatibility-adapter' = 'moneta'
  ): RepresentationGraph {
    return {
      schemaVersion: REPRESENTATION_GRAPH_SCHEMA_VERSION,
      graphId,
      primitives: [],
      edges: [],
      semanticMappings: {},
      layoutPolicy: 'COORDINATED_SPATIAL',
      scalePolicy: 'NORMALIZED_BOUNDING_BOX',
      interactionPolicy: 'DIRECT_MANIPULATION',
      detailPolicy: 'PROGRESSIVE_DISCLOSURE',
      constraints: [],
      provenance: {
        ontologyVersion: '2.0.0',
        fitnessModelVersion: 'FM7-Pareto-v1',
        datasetFingerprint,
        evidenceSchemaVersion: '1.0.0',
        generatedBy,
      },
    };
  }
}
