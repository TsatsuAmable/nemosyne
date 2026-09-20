import { describe, expect, it } from 'vitest';
import { validateComposedRepresentation } from '../src/moneta/representation/ComposedRepresentationValidation.ts';
import type { RepresentationGraph } from '../src/moneta/representation/RepresentationGraph.ts';
import type { SemanticEmbodimentGraphV1 } from '../src/moneta/representation/SemanticEmbodimentGraphV1.ts';

const semantic = (): SemanticEmbodimentGraphV1 => ({
  schemaVersion: 1,
  graphId: 'sg',
  datasetFingerprint: 'dataset',
  decisionId: 'decision',
  provenanceRef: 'evidence',
  rootNodeIds: ['dataset'],
  nodes: [
    {
      id: 'dataset',
      kind: 'DATASET',
      abstractionLevel: 'DATASET',
      childIds: ['clusters'],
      refinementTargetIds: ['clusters'],
      preserves: ['cluster-separation'],
      loses: [],
      evidenceRefs: ['ev:cluster'],
    },
    {
      id: 'clusters',
      kind: 'CLUSTER',
      abstractionLevel: 'REGION',
      parentId: 'dataset',
      childIds: ['density'],
      refinementTargetIds: ['density'],
      preserves: ['cluster-separation'],
      loses: [],
      evidenceRefs: ['ev:cluster'],
    },
    {
      id: 'density',
      kind: 'DENSITY',
      abstractionLevel: 'SUBSTRUCTURE',
      parentId: 'clusters',
      childIds: [],
      refinementTargetIds: [],
      preserves: ['density'],
      loses: [],
      evidenceRefs: ['ev:density'],
    },
  ],
});
const graph = (): RepresentationGraph => ({
  schemaVersion: '1.0.0',
  graphId: 'rg',
  primitives: [
    {
      id: 'cluster',
      kind: 'CLUSTER',
      semanticInputs: ['clusters'],
      visualEncoding: {},
      interactionAffordances: [],
      analyticalDependencies: [],
      parameters: {},
      limitations: [],
    },
    {
      id: 'density',
      kind: 'DENSITY',
      semanticInputs: ['density'],
      visualEncoding: {},
      interactionAffordances: [],
      analyticalDependencies: [],
      parameters: {},
      limitations: [],
    },
  ],
  edges: [{ from: 'density', to: 'cluster', relation: 'DETAIL_OF' }],
  semanticMappings: { clusters: 'cluster', density: 'density' },
  layoutPolicy: 'bounded',
  scalePolicy: 'bounded',
  interactionPolicy: 'bounded',
  detailPolicy: 'bounded',
  constraints: [],
  provenance: {
    ontologyVersion: 'v',
    fitnessModelVersion: 'v',
    datasetFingerprint: 'dataset',
    evidenceSchemaVersion: 'v',
    generatedBy: 'researcher',
  },
});

describe('MCR1 composed representation admission', () => {
  it('admits a governed finer-grained detail relation', () =>
    expect(validateComposedRepresentation(semantic(), graph())).toEqual([]));
  it('rejects dangling semantic identities', () => {
    const g = graph();
    g.primitives[0].semanticInputs = ['missing'];
    expect(
      validateComposedRepresentation(semantic(), g).some((i) =>
        i.message.includes('unknown semantic node')
      )
    ).toBe(true);
  });
  it('rejects evidence-free semantic inputs', () => {
    const s = semantic();
    s.nodes[1].evidenceRefs = [];
    expect(
      validateComposedRepresentation(s, graph()).some((i) =>
        i.message.includes('no governed evidence')
      )
    ).toBe(true);
  });
  it('rejects abstraction-illegal detail direction', () => {
    const g = graph();
    g.edges = [{ from: 'cluster', to: 'density', relation: 'DETAIL_OF' }];
    expect(
      validateComposedRepresentation(semantic(), g).some((i) =>
        i.message.includes('semantically finer')
      )
    ).toBe(true);
  });
  it('rejects unsupported composition relations', () => {
    const g = graph();
    g.edges = [{ from: 'density', to: 'cluster', relation: 'DERIVES_FROM' }];
    expect(
      validateComposedRepresentation(semantic(), g).some((i) =>
        i.message.includes('unsupported MCR1')
      )
    ).toBe(true);
  });
  it('rejects incompatible primitive/semantic kinds', () => {
    const g = graph();
    g.primitives[0].kind = 'DISTRIBUTION';
    expect(
      validateComposedRepresentation(semantic(), g).some((i) => i.message.includes('incompatible'))
    ).toBe(true);
  });
  it('rejects cross-dataset composition', () => {
    const g = graph();
    g.provenance = { ...g.provenance, datasetFingerprint: 'other' };
    expect(
      validateComposedRepresentation(semantic(), g).some((i) =>
        i.message.includes('dataset identities differ')
      )
    ).toBe(true);
  });
});

it('rejects OVERLAY without shared governed evidence or preserved information', () => {
  const g = graph();
  g.edges = [{ from: 'density', to: 'cluster', relation: 'OVERLAY' }];
  expect(
    validateComposedRepresentation(semantic(), g).some((i) =>
      i.message.includes('shared governed evidence')
    )
  ).toBe(true);
});

it('rejects CONTAINS when semantic nodes are not a governed parent-child pair', () => {
  const g = graph();
  g.edges = [{ from: 'density', to: 'cluster', relation: 'CONTAINS' }];
  expect(
    validateComposedRepresentation(semantic(), g).some((i) => i.message.includes('parent-child'))
  ).toBe(true);
});

it('accepts compatibility graphs without pretending legacy capability labels are semantic-node ids', () => {
  const g = graph();
  g.provenance = { ...g.provenance, generatedBy: 'compatibility-adapter' };
  g.primitives[0].semanticInputs = ['cluster-partition'];
  g.primitives[1].semanticInputs = ['continuous-density'];
  expect(
    validateComposedRepresentation(semantic(), g).some((i) =>
      i.message.includes('unknown semantic node')
    )
  ).toBe(false);
});
