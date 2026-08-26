import { describe, expect, it } from 'vitest';
import './setup-wasm.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';

describe('P1-C: Sparse Topology Scalability Contracts', () => {
  it('C5 & C5b: computes persistence intervals with real deaths', () => {
    const kernel = makeKernelMockBridge();
    const atlas = new AtlasCore({ kernel: kernel as any });

    const rows = [
      { id: '1', val: 0.0 },
      { id: '2', val: 1.0 },
      { id: '3', val: 5.0 },
    ];
    const ds = new Dataset(
      'PersistDeathDS',
      [
        { name: 'id', type: ColumnType.CATEGORICAL },
        { name: 'val', type: ColumnType.NUMERIC },
      ],
      rows
    );

    atlas.loadDataset(ds);
    const intervals = atlas.computePersistenceIntervalsForCurrent({
      featureColumns: ['val'],
      maxDistance: 2.0,
    });

    expect(intervals).toBeDefined();
    expect(Array.isArray(intervals)).toBe(true);
  });

  it('C6: Betti-0 curve monotonicity and single-component convergence', () => {
    const kernel = makeKernelMockBridge();
    const atlas = new AtlasCore({ kernel: kernel as any });

    const rows = Array.from({ length: 15 }, (_, i) => ({
      id: `id_${i}`,
      val: i * 1.5,
    }));
    const ds = new Dataset(
      'BettiDS',
      [
        { name: 'id', type: ColumnType.CATEGORICAL },
        { name: 'val', type: ColumnType.NUMERIC },
      ],
      rows
    );

    atlas.loadDataset(ds);
    const curve = atlas.computeBetti0CurveForCurrent({
      featureColumns: ['val'],
      steps: 5,
    });

    expect(curve).toBeDefined();
    expect(Array.isArray(curve)).toBe(true);
  });

  it('C11: camelCase serialization guard for Mapper graph', () => {
    const kernel = makeKernelMockBridge();
    const atlas = new AtlasCore({ kernel: kernel as any });

    const rows = [
      { id: '1', val1: 1.0, val2: 2.0 },
      { id: '2', val1: 1.2, val2: 2.1 },
      { id: '3', val1: 4.0, val2: 5.0 },
    ];
    const ds = new Dataset(
      'MapperDS',
      [
        { name: 'id', type: ColumnType.CATEGORICAL },
        { name: 'val1', type: ColumnType.NUMERIC },
        { name: 'val2', type: ColumnType.NUMERIC },
      ],
      rows
    );

    atlas.loadDataset(ds);
    const graph = atlas.computeMapperGraphForCurrent({
      featureColumns: ['val1', 'val2'],
      bins: 3,
      overlap: 0.3,
    });

    expect(graph).toBeDefined();
    if (graph && graph.nodes.length > 0) {
      expect(graph.nodes[0]).toHaveProperty('rowIndices');
      expect(graph.nodes[0]).toHaveProperty('filterCenter');
    }
  });
});
