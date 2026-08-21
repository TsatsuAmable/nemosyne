import { describe, expect, it } from 'vitest';
import {
  representationDecisionToGraph,
  validateRepresentationGraph,
  type RepresentationDecision,
} from '../src/moneta/representation/index.ts';

function decision(): RepresentationDecision {
  return {
    id: 'decision-1',
    chosenCandidateId: 'CLUSTER_REGIONS',
    chosenFamily: 'CLUSTER',
    chosenLayout: 'GRID_3D',
    utilityScore: 0.73,
    fitnessModelVersion: 'bootstrap-fitness-v1',
    representationFamily: 'CLUSTER',
    embodiment: {
      primaryLayout: 'GRID_3D',
      primaryGeometry: 'CLUSTER_VOLUME',
      primaryBehavior: 'STATIC',
      primaryInteraction: 'CLUSTER_PROBE',
      spatialStrategy: {} as RepresentationDecision['embodiment']['spatialStrategy'],
    },
    evidence: [],
    rejectedAlternatives: [],
    provenance: {
      generatedAt: 1,
      engine: 'moneta',
      version: '3',
      datasetFingerprint: 'sha256:fixture',
      fitnessModelVersion: 'bootstrap-fitness-v1',
    },
    datasetSignature: {} as RepresentationDecision['datasetSignature'],
  };
}

describe('RepresentationDecision → RepresentationGraph compatibility compiler', () => {
  it('compiles the current single winner into a valid graph without claiming native composition', () => {
    const graph = representationDecisionToGraph(decision());

    expect(validateRepresentationGraph(graph)).toEqual([]);
    expect(graph.provenance.generatedBy).toBe('compatibility-adapter');
    expect(graph.provenance.datasetFingerprint).toBe('sha256:fixture');
    expect(graph.primitives).toHaveLength(1);
    expect(graph.primitives[0]).toMatchObject({ kind: 'CLUSTER' });
    expect(graph.semanticMappings['cluster-partition']).toBe(graph.primitives[0].id);
  });

  it('represents progressive disclosure as an explicit composition node', () => {
    const source = decision();
    source.progressiveDisclosurePolicy = { enabled: true };

    const graph = representationDecisionToGraph(source);
    expect(graph.primitives.map((primitive) => primitive.kind)).toContain('DETAIL_EXPANSION');
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ relation: 'DETAIL_OF' }),
      ]),
    );
  });

  it('fails closed when the legacy decision has no candidate identity', () => {
    const source = decision();
    delete source.chosenCandidateId;
    source.rankedCandidates = [];

    expect(() => representationDecisionToGraph(source)).toThrow(/no chosen candidate/i);
  });
});
