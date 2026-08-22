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

  it('preserves the exact source IDs through filter, including duplicate-valued observations', () => {
    const dataset = {
      name: 'filter-duplicates',
      columns: [
        { name: 'label', type: 'CATEGORICAL' as const },
        { name: 'value', type: 'NUMERIC' as const },
      ],
      rows: [
        { label: 'same', value: 42 },
        { label: 'same', value: 42 },
        { label: 'other', value: 7 },
      ],
      rowIds: ['source:dup:0', 'source:dup:1', 'source:other'],
    };

    const result = bridge.executeOperation(dataset, {
      op: 'filter',
      predicate: { op: 'eq', column: 'value', value: 42 },
    } as OperationSpec);

    expect(result).not.toBeNull();
    expect(result!.rows).toHaveLength(2);
    expect(result!.rowIds).toEqual(['source:dup:0', 'source:dup:1']);
    expect(new Set(result!.rowIds).size).toBe(2);
  });

  it('preserves source IDs through slice/time-slice style row selection', () => {
    const dataset = {
      name: 'slice-lineage',
      columns: [{ name: 'value', type: 'NUMERIC' as const }],
      rows: [{ value: 10 }, { value: 20 }, { value: 30 }, { value: 40 }],
      rowIds: ['source:0', 'source:1', 'source:2', 'source:3'],
    };

    const result = bridge.executeOperation(dataset, {
      op: 'slice',
      start: 1,
      end: 3,
    } as OperationSpec);

    expect(result).not.toBeNull();
    expect(result!.rows.map((row) => row.value)).toEqual([20, 30]);
    expect(result!.rowIds).toEqual(['source:1', 'source:2']);
  });

  it('preserves source IDs when anomaly analysis adds derived marker columns', () => {
    const dataset = {
      name: 'anomaly-lineage',
      columns: [
        { name: 'label', type: 'CATEGORICAL' as const },
        { name: 'value', type: 'NUMERIC' as const },
      ],
      rows: [
        { label: 'a', value: 1 },
        { label: 'b', value: 2 },
        { label: 'c', value: 3 },
        { label: 'd', value: 1000 },
      ],
      rowIds: ['source:a', 'source:b', 'source:c', 'source:d'],
    };

    const result = bridge.executeOperation(dataset, {
      op: 'anomaly_iqr',
      column: 'value',
      sensitivity: 1.5,
    } as OperationSpec);

    expect(result).not.toBeNull();
    expect(result!.rowIds).toEqual(dataset.rowIds);
    expect(result!.rows).toHaveLength(dataset.rows.length);
    expect(result!.rows.some((row) => row._anomaly === true)).toBe(true);
    expect(result!.rows[result!.rows.length - 1]._anomaly).toBe(true);
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
