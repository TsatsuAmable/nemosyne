import { describe, expect, it } from 'vitest';
import {
  REPRESENTATION_GRAPH_SCHEMA_VERSION,
  InvalidRepresentationGraphError,
  assertRepresentationGraph,
  validateRepresentationGraph,
  type RepresentationGraph,
} from '../src/moneta/representation/RepresentationGraph.ts';

function graphFixture(): RepresentationGraph {
  return {
    schemaVersion: REPRESENTATION_GRAPH_SCHEMA_VERSION,
    graphId: 'representation:cluster-density',
    primitives: [
      {
        id: 'clusters',
        kind: 'CLUSTER',
        semanticInputs: ['cluster-membership'],
        visualEncoding: { region: 'cluster-id' },
        interactionAffordances: ['SELECT', 'ISOLATE'],
        analyticalDependencies: ['cluster:kmeans:membership'],
        parameters: {},
        limitations: [],
      },
      {
        id: 'density',
        kind: 'DENSITY',
        semanticInputs: ['local-density'],
        visualEncoding: { opacity: 'density' },
        interactionAffordances: ['FILTER'],
        analyticalDependencies: ['density:knn'],
        parameters: { smoothing: 0.25 },
        limitations: ['occlusion at extreme density'],
      },
    ],
    edges: [{ from: 'density', to: 'clusters', relation: 'OVERLAY' }],
    semanticMappings: { cluster: 'clusters', density: 'density' },
    layoutPolicy: 'spatial-cluster-regions',
    scalePolicy: 'adaptive',
    interactionPolicy: 'nil-v1',
    detailPolicy: 'progressive-disclosure',
    constraints: [],
    provenance: {
      ontologyVersion: 'representation-ontology-1',
      fitnessModelVersion: 'bootstrap-fitness-1',
      datasetFingerprint: 'sha256:dataset-001',
      evidenceSchemaVersion: '1.0.0',
      generatedBy: 'moneta',
    },
  };
}

describe('RepresentationGraph V3 contract', () => {
  it('accepts compositional graphs with explicit policies and provenance', () => {
    expect(validateRepresentationGraph(graphFixture())).toEqual([]);
  });

  it('rejects duplicate primitive identities', () => {
    const graph = graphFixture();
    graph.primitives = [graph.primitives[0], { ...graph.primitives[1], id: 'clusters' }];
    expect(validateRepresentationGraph(graph)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'primitives[1].id', message: expect.stringContaining('duplicate') }),
      ])
    );
  });

  it('rejects edges that reference primitives outside the graph', () => {
    const graph = graphFixture();
    graph.edges = [{ from: 'density', to: 'missing', relation: 'OVERLAY' }];
    expect(() => assertRepresentationGraph(graph)).toThrow(InvalidRepresentationGraphError);
  });

  it('rejects semantic mappings to unknown primitives', () => {
    const graph = graphFixture();
    graph.semanticMappings = { cluster: 'not-present' };
    expect(validateRepresentationGraph(graph)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'semanticMappings.cluster',
          message: expect.stringContaining('unknown primitive'),
        }),
      ])
    );
  });

  it('requires explicit policies instead of renderer defaults', () => {
    const graph = graphFixture();
    graph.layoutPolicy = '';
    expect(validateRepresentationGraph(graph)).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'layoutPolicy' })])
    );
  });
});
