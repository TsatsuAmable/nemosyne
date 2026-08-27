import { beforeAll, describe, expect, it } from 'vitest';
import type { DatasetJSON } from '../src/data/types.ts';
import { canonicalDatasetIdentityHex } from '../src/data/DatasetIdentity.ts';
import * as bridge from '../src/wasm/RuntimeBridge.ts';

describe('RF-048 Rust/TypeScript canonical dataset identity parity', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) {
      await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
    }
    expect(bridge.isReady()).toBe(true);
  });

  it('matches Rust when rows contain undeclared keys or omit declared values', () => {
    const dataset: DatasetJSON = {
      name: 'rf048-irregular-row-parity',
      columns: [
        { name: 'x', type: 'NUMERIC' },
        { name: 'y', type: 'NUMERIC' },
      ],
      rows: [
        { x: 1, y: 2, ignored: 'not part of declared scientific schema' },
        { x: 3 },
      ],
    };

    const handle = bridge.loadDatasetJson(dataset);
    expect(handle).toBeGreaterThan(0);
    try {
      expect(canonicalDatasetIdentityHex(dataset)).toBe(bridge.datasetFingerprint(handle));
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('matches Rust for graph edges with nested attributes and preserves endpoint types', () => {
    const dataset: DatasetJSON = {
      name: 'rf048-edge-parity',
      columns: [{ name: 'value', type: 'NUMERIC' }],
      rows: [{ value: 1 }, { value: 2 }],
      edges: [
        {
          source: 'node-a',
          target: 'node-b',
          weight: 0.75,
          metadata: { z: 2, a: [true, 'x'] },
        },
      ],
    };

    const handle = bridge.loadDatasetJson(dataset);
    expect(handle).toBeGreaterThan(0);
    try {
      expect(canonicalDatasetIdentityHex(dataset)).toBe(bridge.datasetFingerprint(handle));
    } finally {
      bridge.destroyDataset(handle);
    }
  });
});
