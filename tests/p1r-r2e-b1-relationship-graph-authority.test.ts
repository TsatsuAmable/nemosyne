import { describe, expect, it } from 'vitest';
import { minimalDatasetSignature } from '../src/moneta/representation/DatasetSignature.ts';
import {
  BOOTSTRAP_FITNESS_MODEL_VERSION,
  FITNESS_TREATMENT_ID,
} from '../src/moneta/representation/FitnessModel.ts';
import { MonetaHypothesisEngine } from '../src/moneta/representation/MonetaHypothesisEngine.ts';
import { MONETA_REPRESENTATION_CANDIDATES } from '../src/moneta/representation/RepresentationCandidate.ts';
import {
  createDefaultRequirements,
  validateRepresentationRequirements,
  type RepresentationRequirements,
} from '../src/moneta/representation/RepresentationRequirements.ts';
import {
  SOURCE_RELATIONSHIP_GRAPH_V1_EDGE_ATTRIBUTES,
  SOURCE_RELATIONSHIP_GRAPH_V1_LIMITS,
  assertSourceRelationshipGraphResourceEnvelope,
  createSourceRelationshipGraphAuthority,
  validateSourceGraphEndpoint,
  validateSourceRelationshipGraphAuthority,
} from '../src/moneta/representation/RelationshipGraphAuthority.ts';

function sourceGraphRequirements(): RepresentationRequirements {
  const requirements = createDefaultRequirements('relationship-discovery', 'MEDIUM');
  requirements.graphAuthority = createSourceRelationshipGraphAuthority('DIRECTED');
  return requirements;
}

function graphSignature(nodeCount = 120, edgeCount = 240) {
  const signature = minimalDatasetSignature(nodeCount, 2, 0, 0, 'r2e-b1-graph', 0);
  signature.cardinality.edgeCount = edgeCount;
  signature.topologicalStructure.topology = 'GRAPH';
  return signature;
}

function graphCandidates(decision: ReturnType<typeof MonetaHypothesisEngine.arbitrate>) {
  return (decision.rankedCandidates ?? []).filter(
    (candidate) => candidate.candidateId === 'RELATIONSHIP_GRAPH'
  );
}

describe('P1-R2E B1 source-authoritative relationship graph contract', () => {
  it('requires an explicit source-edge authority with declared directionality', () => {
    expect(validateSourceRelationshipGraphAuthority(
      createSourceRelationshipGraphAuthority('DIRECTED')
    )).toEqual({
      kind: 'SOURCE_EDGES',
      directionality: 'DIRECTED',
      nodeIdentity: 'DATASET_ROW',
      missingEndpointPolicy: 'REFUSE',
      parallelEdgePolicy: 'PRESERVE',
      selfLoopPolicy: 'PRESERVE',
    });

    expect(() => validateSourceRelationshipGraphAuthority({
      kind: 'SOURCE_EDGES',
      directionality: 'INFER',
      nodeIdentity: 'DATASET_ROW',
      missingEndpointPolicy: 'REFUSE',
      parallelEdgePolicy: 'PRESERVE',
      selfLoopPolicy: 'PRESERVE',
    })).toThrow(/directionality/i);
  });

  it('serializes graph authority in RepresentationRequirements and rejects policy widening', () => {
    expect(() => validateRepresentationRequirements(sourceGraphRequirements())).not.toThrow();

    expect(() => validateRepresentationRequirements({
      ...sourceGraphRequirements(),
      graphAuthority: {
        ...createSourceRelationshipGraphAuthority('UNDIRECTED'),
        missingEndpointPolicy: 'DROP',
      },
    })).toThrow();

    expect(() => validateRepresentationRequirements({
      ...sourceGraphRequirements(),
      graphAuthority: {
        ...createSourceRelationshipGraphAuthority('UNDIRECTED'),
        inferMissingEdges: true,
      },
    })).toThrow();
  });

  it('rejects policy widening that could silently change source topology', () => {
    expect(() => validateSourceRelationshipGraphAuthority({
      ...createSourceRelationshipGraphAuthority('UNDIRECTED'),
      missingEndpointPolicy: 'DROP',
    })).toThrow(/missingEndpointPolicy must be REFUSE/i);

    expect(() => validateSourceRelationshipGraphAuthority({
      ...createSourceRelationshipGraphAuthority('UNDIRECTED'),
      parallelEdgePolicy: 'COLLAPSE',
    })).toThrow(/parallelEdgePolicy must be PRESERVE/i);

    expect(() => validateSourceRelationshipGraphAuthority({
      ...createSourceRelationshipGraphAuthority('UNDIRECTED'),
      selfLoopPolicy: 'DROP',
    })).toThrow(/selfLoopPolicy must be PRESERVE/i);
  });

  it('defines numeric endpoints as source-row positions and strings as durable row IDs', () => {
    expect(validateSourceGraphEndpoint(0)).toBe(0);
    expect(validateSourceGraphEndpoint(42)).toBe(42);
    expect(validateSourceGraphEndpoint('row-7f')).toBe('row-7f');

    for (const invalid of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, '', ' padded ', null, {}]) {
      expect(() => validateSourceGraphEndpoint(invalid)).toThrow();
    }
  });

  it('freezes a bounded V1 node, edge and payload envelope', () => {
    expect(SOURCE_RELATIONSHIP_GRAPH_V1_LIMITS).toEqual({
      maxNodes: 4096,
      maxEdges: 16384,
      maxPayloadBytes: 2 * 1024 * 1024,
    });

    expect(() => assertSourceRelationshipGraphResourceEnvelope(4096, 16384, 2 * 1024 * 1024))
      .not.toThrow();
    expect(() => assertSourceRelationshipGraphResourceEnvelope(4097, 1)).toThrow(/node count/i);
    expect(() => assertSourceRelationshipGraphResourceEnvelope(1, 16385)).toThrow(/edge count/i);
    expect(() => assertSourceRelationshipGraphResourceEnvelope(1, 1, 2 * 1024 * 1024 + 1))
      .toThrow(/payload bytes/i);
  });

  it('allows only source weight as a V1 analytical edge attribute', () => {
    expect(SOURCE_RELATIONSHIP_GRAPH_V1_EDGE_ATTRIBUTES).toEqual(['weight']);
  });

  it('narrows the graph ontology to source topology rather than force layout or cluster separation', () => {
    const candidate = MONETA_REPRESENTATION_CANDIDATES.RELATIONSHIP_GRAPH;
    expect(candidate.name).toBe('Source Relationship Graph');
    expect(candidate.description).toMatch(/source-authoritative/i);
    expect(candidate.description).toMatch(/layout.*non-authoritative/i);
    expect(candidate.description).not.toMatch(/force-directed network relaxation/i);
    expect(candidate.preserves).toEqual([
      'relational-edge-connectivity',
      'individual-observation-identity',
    ]);
    expect(candidate.loses).toContain('cluster-separation');
    expect(candidate.scaleCharacteristics.maxN).toBe(SOURCE_RELATIONSHIP_GRAPH_V1_LIMITS.maxNodes);
  });

  it('mints V5 because graph admissibility and information semantics are rank-effective', () => {
    expect(BOOTSTRAP_FITNESS_MODEL_VERSION).toBe('bootstrap-fitness-v5');
    expect(FITNESS_TREATMENT_ID).toBe('fitness-treatment-v5');
  });

  it('does not let GRAPH topology or a positive edge count substitute for explicit source authority', () => {
    const requirements = createDefaultRequirements('relationship-discovery', 'MEDIUM');
    const decision = MonetaHypothesisEngine.arbitrate(graphSignature(), requirements);
    const candidates = graphCandidates(decision);

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((candidate) => candidate.disqualified)).toBe(true);
    expect(
      candidates.every((candidate) => candidate.disqualificationCode === 'graph-authority-required')
    ).toBe(true);
    expect(decision.chosenCandidateId).not.toBe('RELATIONSHIP_GRAPH');
  });

  it('does not let GRAPH topology substitute for actual source edges even with declared authority', () => {
    const decision = MonetaHypothesisEngine.arbitrate(
      graphSignature(120, 0),
      sourceGraphRequirements()
    );
    const candidates = graphCandidates(decision);

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((candidate) => candidate.disqualified)).toBe(true);
    expect(
      candidates.every((candidate) => candidate.disqualificationCode === 'graph-authority-required')
    ).toBe(true);
    expect(decision.chosenCandidateId).not.toBe('RELATIONSHIP_GRAPH');
  });

  it('admits the graph candidate only with explicit source authority and source edges', () => {
    const decision = MonetaHypothesisEngine.arbitrate(
      graphSignature(),
      sourceGraphRequirements()
    );
    const candidates = graphCandidates(decision);

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.some((candidate) => !candidate.disqualified)).toBe(true);
    expect(
      candidates.some((candidate) => candidate.disqualificationCode === 'graph-authority-required')
    ).toBe(false);
    expect(decision.provenance.fitnessTreatmentId).toBe('fitness-treatment-v5');
    expect(decision.provenance.version).toBe('2.1.0-v5-bootstrap');
  });

  it('hard-refuses graph node and edge counts beyond the B1 envelope before ranking', () => {
    const tooManyNodes = MonetaHypothesisEngine.arbitrate(
      graphSignature(SOURCE_RELATIONSHIP_GRAPH_V1_LIMITS.maxNodes + 1, 10),
      sourceGraphRequirements()
    );
    expect(
      graphCandidates(tooManyNodes).every(
        (candidate) => candidate.disqualificationCode === 'graph-resource-envelope'
      )
    ).toBe(true);

    const tooManyEdges = MonetaHypothesisEngine.arbitrate(
      graphSignature(120, SOURCE_RELATIONSHIP_GRAPH_V1_LIMITS.maxEdges + 1),
      sourceGraphRequirements()
    );
    expect(
      graphCandidates(tooManyEdges).every(
        (candidate) => candidate.disqualificationCode === 'graph-resource-envelope'
      )
    ).toBe(true);
  });

  it('rejects unknown authority fields rather than accepting future semantics accidentally', () => {
    expect(() => validateSourceRelationshipGraphAuthority({
      ...createSourceRelationshipGraphAuthority('DIRECTED'),
      inferMissingEdges: true,
    })).toThrow(/unknown authority field inferMissingEdges/i);
  });
});
