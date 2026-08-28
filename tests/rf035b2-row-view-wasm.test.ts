import { beforeAll, describe, expect, it } from 'vitest';
import * as bridge from '../src/wasm/RuntimeBridge.ts';
import type { DatasetJSON, OperationSpec } from '../src/data/types.ts';

const SOURCE: DatasetJSON = {
  name: 'row-view-source',
  columns: [
    { name: 'label', type: 'CATEGORICAL' },
    { name: 'value', type: 'NUMERIC' },
  ],
  rows: [
    { label: 'a', value: 30 },
    { label: 'b', value: 10 },
    { label: 'c', value: 20 },
  ],
  rowIds: ['rid-a', 'rid-b', 'rid-c'],
};

describe('RF-035B2 real WASM row-view ABI', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) {
      await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
    }
    if (!bridge.isReady()) throw new Error('RuntimeBridge failed to initialize WASM');
  });

  it('reads authoritative sort lineage without serializing output rows', () => {
    const input = bridge.loadDatasetJson(SOURCE);
    expect(input).not.toBe(0);
    const output = bridge.runOperation(input, {
      op: 'sort',
      column: 'value',
      ascending: true,
    } as OperationSpec);
    expect(output).not.toBe(0);

    try {
      const view = bridge.datasetRowView(output);
      expect(view).toEqual({
        name: 'row-view-source [sorted: value]',
        rowIds: ['rid-b', 'rid-c', 'rid-a'],
        rowCount: 3,
        columnCount: 2,
        edgesPresent: false,
      });
      expect(bridge.datasetFingerprint(output)).toBeTruthy();
    } finally {
      bridge.destroyDataset(input);
      bridge.destroyDataset(output);
    }
  });

  it('reports graph presence so the Worker cannot compact topology-bearing output', () => {
    const graph: DatasetJSON = {
      ...SOURCE,
      name: 'row-view-graph',
      edges: [{ source: 0, target: 1 }],
    };
    const input = bridge.loadDatasetJson(graph);
    expect(input).not.toBe(0);
    const output = bridge.runOperation(input, {
      op: 'sort',
      column: 'value',
      ascending: true,
    } as OperationSpec);
    expect(output).not.toBe(0);

    try {
      const view = bridge.datasetRowView(output);
      expect(view?.edgesPresent).toBe(true);
      expect(view?.rowIds).toEqual(['rid-b', 'rid-c', 'rid-a']);
    } finally {
      bridge.destroyDataset(input);
      bridge.destroyDataset(output);
    }
  });
});
