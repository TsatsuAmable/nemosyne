import { beforeAll, describe, expect, it } from 'vitest';
import * as bridge from '../src/wasm/RuntimeBridge.ts';
import type { OperationSpec } from '../src/data/types.ts';

describe('Rust/WASM durable row identity', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) {
      await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
    }
    if (!bridge.isReady()) {
      throw new Error('RuntimeBridge failed to initialize WASM');
    }
  });

  it('emits one unique durable ID per source observation', () => {
    const handle = bridge.loadSample('fraud-graph');
    const json = bridge.getDatasetJson(handle);
    expect(json).not.toBeNull();
    expect(json!.rowIds).toHaveLength(json!.rows.length);
    expect(new Set(json!.rowIds).size).toBe(json!.rows.length);
    bridge.destroyDataset(handle);
  });

  it('preserves IDs through a row-preserving sort across the JSON boundary', () => {
    const dataset = {
      name: 'duplicate-values',
      columns: [
        { name: 'label', type: 'CATEGORICAL' as const },
        { name: 'value', type: 'NUMERIC' as const },
      ],
      rows: [
        { label: 'a', value: 2 },
        { label: 'b', value: 1 },
        { label: 'c', value: 2 },
      ],
      rowIds: ['source:a', 'source:b', 'source:c'],
    };

    const result = bridge.executeOperation(dataset, {
      op: 'sort',
      column: 'value',
      ascending: true,
    } as OperationSpec);

    expect(result).not.toBeNull();
    expect(result!.rows.map((row) => row.label)).toEqual(['b', 'a', 'c']);
    expect(result!.rowIds).toEqual(['source:b', 'source:a', 'source:c']);
  });

  it('keeps row IDs out of scientific row objects', () => {
    const dataset = {
      name: 'clean-observations',
      columns: [{ name: 'value', type: 'NUMERIC' as const }],
      rows: [{ value: 1 }, { value: 2 }],
    };
    const result = bridge.executeOperation(dataset, {
      op: 'sort',
      column: 'value',
      ascending: true,
    } as OperationSpec);

    expect(result).not.toBeNull();
    expect(result!.rowIds).toHaveLength(2);
    for (const row of result!.rows) {
      expect(Object.keys(row)).toEqual(['value']);
    }
  });
});
