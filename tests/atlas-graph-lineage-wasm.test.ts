import { beforeAll, describe, expect, it } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { datasetContentHashHex } from '../src/atlas/DatasetSpace.ts';
import { assertRustDatasetStructureProfile } from '../src/atlas/MonetaEvidenceAuthority.ts';
import { ColumnType, Dataset } from '../src/data/Dataset.ts';
import { structureProfileToDatasetEvidence } from '../src/data/evidence/index.ts';
import { datasetEvidenceToSignature } from '../src/moneta/representation/index.ts';
import * as bridge from '../src/wasm/RuntimeBridge.ts';

function graphDataset(): Dataset {
  return new Dataset(
    'atlas-wasm-graph',
    [{ name: 'value', type: ColumnType.NUMERIC }],
    [{ value: 10 }, { value: 20 }, { value: 30 }],
    [
      {
        source: 0,
        target: 1,
        weight: 0.5,
        relation: 'observed',
        active: true,
        metadata: { source: 'sensor-a', tags: ['primary', 'reviewed'] },
      },
      { source: 1, target: 2, weight: 1.5, relation: 'derived' },
    ]
  );
}

function stringEndpointGraphDataset(): Dataset {
  return new Dataset(
    'atlas-wasm-string-edge-graph',
    [
      { name: 'id', type: ColumnType.CATEGORICAL },
      { name: 'value', type: ColumnType.NUMERIC },
    ],
    [
      { id: 'A', value: 10 },
      { id: 'B', value: 20 },
    ],
    [
      {
        source: 'A',
        target: 'B',
        weight: 0.75,
        relation: 'observed',
      },
    ]
  );
}

function expectCanonicalMonetaGraph(profile: unknown, expectedEdgeCount: number): void {
  assertRustDatasetStructureProfile(profile);
  const evidence = structureProfileToDatasetEvidence(profile);
  const signature = datasetEvidenceToSignature(evidence);
  expect(signature.cardinality.edgeCount).toBe(expectedEdgeCount);
  expect(signature.topologicalStructure).toEqual({
    topology: 'GRAPH',
    hasCycles: false,
  });
}

describe('RF-044 Atlas to real WASM graph lineage', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) {
      await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
    }
    if (!bridge.isReady()) {
      throw new Error(
        'RuntimeBridge failed to initialize WASM. Run npm run wasm:dev before this integration test.'
      );
    }
  });

  it('preserves explicit edges, arbitrary JSON attributes, canonical content identity, and graph semantics through Atlas loading', () => {
    const source = graphDataset();
    const atlas = new AtlasCore({ kernel: bridge });

    atlas.loadDataset(source);
    expect(atlas.facts()).not.toBeNull();

    const handle = atlas.aggregate.analytical.currentHandle;
    expect(handle).toBeGreaterThan(0);

    try {
      const rustDataset = bridge.getDatasetJson(handle);
      expect(rustDataset).not.toBeNull();
      expect(rustDataset?.edges).toEqual(source.edges);
      expect(typeof rustDataset?.edges?.[0]?.source).toBe('number');
      expect(typeof rustDataset?.edges?.[0]?.target).toBe('number');
      expect(bridge.datasetFingerprint(handle)).toBe(datasetContentHashHex(source.toJSON()));
      expect(bridge.inferTopology(handle)).toBe('GRAPH');

      const profile = bridge.computeDatasetStructureProfile(handle);
      expect(profile).not.toBeNull();
      expect(profile?.graph).toMatchObject({
        isGraph: true,
        nodeCount: 3,
        edgeCount: 2,
        hasCycles: false,
        isConnected: true,
      });
      expect(profile?.hierarchy).toBeNull();
      expectCanonicalMonetaGraph(profile, 2);
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('preserves stable string endpoints and keeps a one-edge acyclic dataset a graph rather than manufacturing hierarchy/cycle evidence', () => {
    const source = stringEndpointGraphDataset();
    const atlas = new AtlasCore({ kernel: bridge });

    atlas.loadDataset(source);
    expect(atlas.facts()).not.toBeNull();

    const handle = atlas.aggregate.analytical.currentHandle;
    expect(handle).toBeGreaterThan(0);

    try {
      const rustDataset = bridge.getDatasetJson(handle);
      expect(rustDataset?.edges).toEqual(source.edges);
      expect(typeof rustDataset?.edges?.[0]?.source).toBe('string');
      expect(typeof rustDataset?.edges?.[0]?.target).toBe('string');
      expect(rustDataset?.edges?.[0]?.source).toBe('A');
      expect(rustDataset?.edges?.[0]?.target).toBe('B');
      expect(bridge.datasetFingerprint(handle)).toBe(datasetContentHashHex(source.toJSON()));
      expect(bridge.inferTopology(handle)).toBe('GRAPH');

      const profile = bridge.computeDatasetStructureProfile(handle);
      expect(profile).not.toBeNull();
      expect(profile?.graph).toMatchObject({
        isGraph: true,
        nodeCount: 2,
        edgeCount: 1,
        hasCycles: false,
        isConnected: true,
      });
      expect(profile?.hierarchy).toBeNull();
      expectCanonicalMonetaGraph(profile, 1);
    } finally {
      bridge.destroyDataset(handle);
    }
  });
});
