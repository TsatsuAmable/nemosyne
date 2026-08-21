import { describe, expect, it } from 'vitest';
import {
  REPRESENTATION_GRAPH_SCHEMA_VERSION,
  representationGraphToRuntimeSpec,
  type RepresentationGraph,
} from '../src/moneta/representation/index.ts';

function graph(): RepresentationGraph {
  return {
    schemaVersion: REPRESENTATION_GRAPH_SCHEMA_VERSION,
    graphId: 'graph-runtime-1',
    primitives: [
      {
        id: 'primary:cluster',
        kind: 'CLUSTER',
        semanticInputs: ['cluster-partition'],
        visualEncoding: {
          layout: 'GRID_3D',
          geometry: 'CLUSTER_VOLUME',
          behavior: 'STATIC',
          interaction: 'CLUSTER_PROBE',
        },
        interactionAffordances: ['CLUSTER_PROBE'],
        analyticalDependencies: ['evidence:cluster'],
        parameters: { utilityScore: 0.81 },
        limitations: [],
      },
      {
        id: 'detail:expand',
        kind: 'DETAIL_EXPANSION',
        semanticInputs: ['researcher-detail-request'],
        visualEncoding: { mode: 'progressive-disclosure' },
        interactionAffordances: ['EXPAND_DETAIL'],
        analyticalDependencies: [],
        parameters: {},
        limitations: [],
      },
    ],
    edges: [{ from: 'detail:expand', to: 'primary:cluster', relation: 'DETAIL_OF' }],
    semanticMappings: { 'cluster-partition': 'primary:cluster' },
    layoutPolicy: 'GRID_3D',
    scalePolicy: 'candidate-default-scale',
    interactionPolicy: 'candidate-supported-interactions',
    detailPolicy: 'progressive-disclosure',
    constraints: [],
    provenance: {
      ontologyVersion: 'bootstrap-ontology-v1',
      fitnessModelVersion: 'bootstrap-fitness-v1',
      datasetFingerprint: 'sha256:dataset',
      evidenceSchemaVersion: '1.0.0',
      generatedBy: 'compatibility-adapter',
    },
  };
}

describe('RepresentationGraph Spatial Runtime adapter', () => {
  it('embodies one primary primitive while retaining metadata-only composition nodes', () => {
    const runtime = representationGraphToRuntimeSpec(graph());

    expect(runtime).toEqual({
      primitiveId: 'primary:cluster',
      spec: {
        layout: 'GRID_3D',
        geometry: 'CLUSTER_VOLUME',
        behavior: 'STATIC',
        interaction: 'CLUSTER_PROBE',
      },
      utilityScore: 0.81,
    });
  });

  it('fails closed rather than silently flattening multiple embodied primitives', () => {
    const source = graph();
    const second = {
      ...source.primitives[0],
      id: 'primary:comparison',
      kind: 'COMPARISON' as const,
    };
    source.primitives = [...source.primitives, second];

    expect(() => representationGraphToRuntimeSpec(source)).toThrow(/exactly one embodied/i);
  });

  it('rejects conflicting primitive and graph layout policies', () => {
    const source = graph();
    source.primitives = source.primitives.map((primitive) =>
      primitive.id === 'primary:cluster'
        ? { ...primitive, visualEncoding: { ...primitive.visualEncoding, layout: 'TIME_RIBBON' } }
        : primitive,
    );

    expect(() => representationGraphToRuntimeSpec(source)).toThrow(/conflicts with graph layoutPolicy/i);
  });
});
