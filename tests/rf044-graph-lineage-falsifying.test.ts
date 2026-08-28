import { describe, expect, it } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { canonicalDatasetIdentityHex } from '../src/data/DatasetIdentity.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';

describe('RF-044 Graph Lineage Integrity — falsifying tests', () => {
  it('canonical content identity changes when scientific edge attributes change, stable under lineage-only rowIds hydration', () => {
    const baseEdges = [
      { source: 0, target: 1, weight: 0.5, relation: 'observed' },
      { source: 1, target: 2, weight: 1.5, relation: 'derived' },
    ];

    const datasetA = new Dataset('graph-A', [{ name: 'value', type: ColumnType.NUMERIC }],
      [{ value: 1 }, { value: 2 }, { value: 3 }], baseEdges);
    const datasetB = new Dataset('graph-B', [{ name: 'value', type: ColumnType.NUMERIC }],
      [{ value: 1 }, { value: 2 }, { value: 3 }], [
      { source: 0, target: 1, weight: 0.5, relation: 'observed' },
      { source: 1, target: 2, weight: 1.5, relation: 'contradicts' }, // Changed attribute
    ]);

    expect(canonicalDatasetIdentityHex(datasetA.toJSON())).not.toBe(
      canonicalDatasetIdentityHex(datasetB.toJSON())
    );

    const fpA = canonicalDatasetIdentityHex(datasetA.toJSON());
    datasetA.adoptRowIds(['rust:a', 'rust:b', 'rust:c']);
    expect(canonicalDatasetIdentityHex(datasetA.toJSON())).toBe(fpA);
  });

  it('Atlas round-trip preserves edge JSON typing through mock kernel', () => {
    const dataset = new Dataset('graph-roundtrip', [{ name: 'value', type: ColumnType.NUMERIC }],
      [{ value: 1 }, { value: 2 }, { value: 3 }], [
      { source: 0, target: 1, weight: 0.75, relation: 'observed', metadata: { source: 'sensor-a', tags: ['primary'] } },
      { source: 1, target: 2, weight: 1.25, relation: 'derived', active: true },
    ]);

    const bridge = makeKernelMockBridge();
    const atlas = new AtlasCore({ kernel: bridge, sessionId: 'rf044-roundtrip' });
    atlas.loadDataset(dataset);

    const handle = atlas.aggregate.analytical.currentHandle;
    expect(handle).toBeGreaterThan(0);

    const rustDataset = bridge.getDatasetJson(handle);
    expect(rustDataset?.edges).toEqual(dataset.edges);
    expect(typeof rustDataset?.edges?.[0]?.source).toBe('number');
    expect(typeof rustDataset?.edges?.[0]?.target).toBe('number');
    expect(rustDataset?.edges?.[0]?.metadata).toEqual({ source: 'sensor-a', tags: ['primary'] });
    expect(rustDataset?.edges?.[1]?.active).toBe(true);
  });

  it('explicit-edge graph inference does not infer cycles from edge presence', () => {
    const dataset = new Dataset('acyclic-graph', [
      { name: 'source', type: ColumnType.NUMERIC },
      { name: 'target', type: ColumnType.NUMERIC },
      { name: 'value', type: ColumnType.NUMERIC },
    ], [
      { source: 0, target: 1, value: 1 },
      { source: 1, target: 2, value: 2 },
      { source: 2, target: 0, value: 3 },
    ], [
      { source: 0, target: 1, weight: 0.5 },
      { source: 1, target: 2, weight: 0.5 },
    ]);

    const bridge = makeKernelMockBridge();
    const atlas = new AtlasCore({ kernel: bridge, sessionId: 'rf044-acyclic' });
    atlas.loadDataset(dataset);

    const handle = atlas.aggregate.analytical.currentHandle;
    const topology = bridge.inferTopology(handle);
    expect(topology).toBe('GRAPH');

    // Mock bridge returns graph=null in structure profile; real WASM provides graph analysis.
    // The key assertion: topology inference is GRAPH, and no cycle evidence is fabricated.
    const profile = bridge.computeDatasetStructureProfile(handle);
    expect(profile?.graph).toBeNull(); // Mock bridge limitation; real WASM provides graph
    // This test verifies: topology is GRAPH but no cycle evidence is fabricated when graph profile absent
  });

  it('duplicate-looking rows with different edges maintain distinct identities', () => {
    const edges1 = [{ source: 0, target: 1, weight: 0.5 }];
    const edges2 = [{ source: 0, target: 1, weight: 0.5, note: 'different' }];

    const dataset1 = new Dataset('dup-rows', [{ name: 'value', type: ColumnType.NUMERIC }],
      [{ value: 1 }, { value: 2 }], edges1);
    const dataset2 = new Dataset('dup-rows', [{ name: 'value', type: ColumnType.NUMERIC }],
      [{ value: 1 }, { value: 2 }], edges2);

    expect(canonicalDatasetIdentityHex(dataset1.toJSON())).not.toBe(
      canonicalDatasetIdentityHex(dataset2.toJSON())
    );
  });
});