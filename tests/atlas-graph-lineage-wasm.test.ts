import { beforeAll, describe, expect, it } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { datasetContentHashHex } from '../src/atlas/DatasetSpace.ts';
import { ColumnType, Dataset } from '../src/data/Dataset.ts';
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

  it('preserves explicit edges, arbitrary JSON attributes, and canonical content identity through Atlas loading', () => {
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
      expect(bridge.datasetFingerprint(handle)).toBe(datasetContentHashHex(source.toJSON()));
    } finally {
      bridge.destroyDataset(handle);
    }
  });
});
