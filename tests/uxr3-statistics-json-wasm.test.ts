import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as bridge from '../src/wasm/RuntimeBridge.ts';
import * as state from '../src/wasm/runtime/RuntimeState.ts';
import { encodeTypedColumnsPayload } from '../src/wasm/TypedColumnsCodec.ts';

const call = (name: string, ...args: number[]) => Number(bridge.call(name, ...args)) >>> 0;
const fixture = () =>
  bridge.loadDatasetJson({
    name: 'unicode α',
    columns: [
      { name: 'x', type: 'NUMERIC' },
      { name: 'label', type: 'CATEGORICAL' },
    ],
    rows: [{ x: 0, label: 'α' }, { x: null, label: 'β' }, { x: 8 }],
    rowIds: ['row:a', 'row:b', 'row:c'],
    edges: [{ source: 'row:a', target: 'row:b', weight: 2, metadata: { label: 'edge' } }],
  });

function legacyJson(name: string, handle: number) {
  const length = call(name, handle, 0, 0);
  const output = bridge.allocBuffer(length);
  try {
    expect(call(name, handle, output.ptr, output.len)).toBe(length);
    return JSON.parse(bridge.readString(output.ptr, length));
  } finally {
    bridge.deallocBuffer(output.ptr, output.len);
  }
}

const operations = [
  [3, bridge.statistics, 'data_statistics', 'data_prepare_statistics'],
  [4, bridge.getDatasetJson, 'dataset_to_json', 'dataset_prepare_json'],
] as const;

describe('R1 statistics and dataset JSON production transfer', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
  });

  it.each(operations)(
    'operation %s computes once and preserves legacy output',
    (index, compute, legacy) => {
      const handle = fixture();
      try {
        const before = call('prepared_computation_count', index);
        const result = compute(handle);
        expect(result).not.toBeNull();
        expect(call('prepared_computation_count', index) - before).toBe(1);
        const provenance = bridge.kernelProvenance();
        expect(result).toEqual(legacyJson(legacy, handle));
        if (index === 3) {
          expect(provenance).toMatchObject({
            kernel: 'nemosyne-wasm',
            operation: 'statistics',
            inputFingerprint: bridge.datasetFingerprint(handle),
          });
          expect(provenance?.outputFingerprint).toBeTruthy();
          expect(bridge.kernelProvenance()?.outputFingerprint).toBe(provenance?.outputFingerprint);
        }
        expect(call('prepared_result_count')).toBe(0);
        expect(call('prepared_result_bytes')).toBe(0);
      } finally {
        bridge.destroyDataset(handle);
      }
    }
  );

  it('keeps JSON export provenance-neutral and round-trips row and graph identity', () => {
    const handle = fixture();
    let reloaded = 0;
    try {
      bridge.statistics(handle);
      const provenance = bridge.kernelProvenance();
      const json = bridge.getDatasetJson(handle)!;
      expect(bridge.kernelProvenance()).toEqual(provenance);
      expect(json.rowIds).toEqual(['row:a', 'row:b', 'row:c']);
      expect(json.rows[0].x).toBe(0);
      expect(json.rows[1].x).toBeNull();
      expect(json.edges).toHaveLength(1);
      reloaded = bridge.loadDatasetJson(json);
      expect(bridge.datasetFingerprint(reloaded)).toBe(bridge.datasetFingerprint(handle));
    } finally {
      bridge.destroyDataset(handle);
      bridge.destroyDataset(reloaded);
    }
  });

  it.each([{ edges: undefined }, { edges: [] }, { edges: [{ source: 0, target: 1 }] }])(
    'preserves graph-presence variant %j',
    ({ edges }) => {
      const handle = bridge.loadDatasetJson({
        name: 'graph-presence',
        columns: [{ name: 'x', type: 'NUMERIC' }],
        rows: [{ x: 0 }, { x: null }],
        rowIds: ['a', 'b'],
        ...(edges === undefined ? {} : { edges }),
      });
      try {
        const result = bridge.getDatasetJson(handle);
        expect(result).toEqual(legacyJson('dataset_to_json', handle));
        if (edges !== undefined) expect(result?.edges).toHaveLength(edges.length);
        else expect(result).not.toHaveProperty('edges');
      } finally {
        bridge.destroyDataset(handle);
      }
    }
  );

  it('preserves empty-dataset statistics and serialization', () => {
    const handle = bridge.loadDatasetJson({
      name: 'empty',
      columns: [{ name: 'x', type: 'NUMERIC' }],
      rows: [],
    });
    try {
      expect(bridge.statistics(handle)).toEqual(legacyJson('data_statistics', handle));
      expect(bridge.getDatasetJson(handle)).toEqual(legacyJson('dataset_to_json', handle));
      expect(call('prepared_result_count')).toBe(0);
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it.each(operations)(
    'operation %s rejects capacity before work and releases on dataset destruction',
    (index, compute, _legacy, prepare) => {
      const handle = fixture();
      const columnar = bridge.loadTypedColumns(
        encodeTypedColumnsPayload({
          rowCount: 1,
          columns: [{ name: 'x', type: 'numeric', values: [1] }],
        }),
        'unsupported-columnar'
      );
      try {
        for (let i = 0; i < 4; i++) expect(call(prepare, handle)).not.toBe(0);
        const before = call('prepared_computation_count', index);
        expect(() => compute(handle)).toThrow('resource limit');
        expect(compute(columnar)).toBeNull();
        expect(compute(0)).toBeNull();
        expect(call('prepared_computation_count', index)).toBe(before);
        expect(call('prepared_result_count')).toBe(4);
      } finally {
        bridge.destroyDataset(handle);
        bridge.destroyDataset(columnar);
      }
      expect(call('prepared_result_count')).toBe(0);
    }
  );

  it.each(operations)(
    'operation %s preserves invalid and columnar-only null without materialising',
    (index, compute) => {
      const handle = bridge.loadTypedColumns(
        encodeTypedColumnsPayload({
          rowCount: 2,
          columns: [{ name: 'x', type: 'numeric', values: [1, 2] }],
        }),
        'columnar'
      );
      const before = call('prepared_computation_count', index);
      try {
        expect(compute(0)).toBeNull();
        expect(compute(handle)).toBeNull();
        expect(call('prepared_computation_count', index)).toBe(before);
        expect(call('prepared_result_count')).toBe(0);
      } finally {
        bridge.destroyDataset(handle);
      }
    }
  );

  it.each(operations)(
    'operation %s releases real results after host failures',
    (_index, compute) => {
      const handle = fixture();
      const owner = state.getRawRuntimeExports();
      const baseline = bridge.hostBufferAllocationCount();
      try {
        for (const failure of ['allocation', 'read']) {
          const spy = vi.spyOn(state, 'getRawRuntimeExports').mockReturnValue({
            ...owner,
            memory: owner.memory,
            host_buffer_alloc: failure === 'allocation' ? () => 0 : owner.host_buffer_alloc,
            prepared_result_read: (token, ptr, len) =>
              failure === 'read' && ptr ? 0 : owner.prepared_result_read(token, ptr, len),
          });
          try {
            if (failure === 'allocation') expect(() => compute(handle)).toThrow();
            else expect(compute(handle)).toBeNull();
          } finally {
            spy.mockRestore();
          }
          expect(call('prepared_result_count')).toBe(0);
          expect(call('prepared_result_bytes')).toBe(0);
          expect(bridge.hostBufferAllocationCount()).toBe(baseline);
        }
      } finally {
        bridge.destroyDataset(handle);
      }
    }
  );

  it('exports admitted JSON larger than 16 MiB without retaining the transfer', () => {
    const value = 'x'.repeat(17 * 1024 * 1024);
    const handle = bridge.loadDatasetJson({
      name: 'large-json',
      columns: [{ name: 'text', type: 'CATEGORICAL' }],
      rows: [{ text: value }],
    });
    try {
      const before = call('prepared_computation_count', 4);
      expect(bridge.getDatasetJson(handle)?.rows[0].text).toBe(value);
      expect(call('prepared_computation_count', 4) - before).toBe(1);
      expect(call('prepared_result_count')).toBe(0);
    } finally {
      bridge.destroyDataset(handle);
    }
  });
});
