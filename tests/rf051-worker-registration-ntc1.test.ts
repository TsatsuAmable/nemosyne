import { beforeAll, describe, expect, it } from 'vitest';
import './setup-wasm.ts';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { ColumnType, Dataset } from '../src/data/Dataset.ts';
import type { DatasetPayload } from '../src/atlas/ports/AnalyticalExecutionPort.ts';
import { encodeTypedColumnsPayload } from '../src/wasm/TypedColumnsCodec.ts';
import * as bridge from '../src/wasm/RuntimeBridge.ts';

interface WorkerPayloadAccess {
  _workerRegistrationPayload(): DatasetPayload | undefined;
}

function workerPayload(atlas: AtlasCore): DatasetPayload {
  const payload = (atlas as unknown as WorkerPayloadAccess)._workerRegistrationPayload();
  if (!payload) throw new Error('expected worker registration payload');
  return payload;
}

function numericRows(rowCount = 50_000): Array<Record<string, unknown>> {
  return Array.from({ length: rowCount }, (_, index) => ({
    x: index * 0.25,
    y: (index % 97) - 30,
  }));
}

describe('RF-051 worker registration authority', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
    if (!bridge.isReady()) throw new Error('real WASM runtime unavailable');
  });

  it('keeps large row-backed numeric datasets on the operation-complete JSON registration contract', () => {
    const dataset = new Dataset(
      'large-numeric-worker',
      [
        { name: 'x', type: ColumnType.NUMERIC },
        { name: 'y', type: ColumnType.NUMERIC },
      ],
      numericRows(),
    );
    const atlas = new AtlasCore({ kernel: bridge });
    atlas.loadDataset(dataset);

    const payload = workerPayload(atlas);
    expect(payload.type).toBe('json');
    const json = payload.data as ReturnType<Dataset['toJSON']>;
    expect(json.rows).toHaveLength(50_000);
    expect(json.columns).toEqual([
      { name: 'x', type: 'NUMERIC' },
      { name: 'y', type: 'NUMERIC' },
    ]);
    atlas.setKernel(null);
  });

  it('keeps explicit NTC1 typed sources typed and exposes unified Rust identity and shape metadata', () => {
    const bytes = encodeTypedColumnsPayload({
      rowCount: 3,
      columns: [
        {
          name: 'x',
          type: 'numeric',
          values: new Float64Array([1.5, 2.5, 3.5]),
          validity: new Uint8Array([1, 1, 1]),
        },
        {
          name: 'y',
          type: 'numeric',
          values: new Float64Array([10, 20, 30]),
          validity: new Uint8Array([1, 1, 1]),
        },
      ],
    });
    const atlas = new AtlasCore({ kernel: bridge });
    const handle = atlas.loadTypedDataset(bytes, 'typed-native-worker');

    expect(handle).toBeGreaterThan(0);
    expect(bridge.datasetFingerprint(handle)).toBe(atlas.datasetFingerprint);
    expect(bridge.datasetRowCount(handle)).toBe(3);
    expect(bridge.datasetColumnCount(handle)).toBe(2);

    const payload = workerPayload(atlas);
    expect(payload.type).toBe('typed');
    const workerBytes = payload.data instanceof Uint8Array
      ? payload.data
      : new Uint8Array(payload.data as ArrayBuffer);
    expect(new TextDecoder().decode(workerBytes.subarray(0, 4))).toBe('NTC1');
    expect(workerBytes).toEqual(bytes);
    atlas.setKernel(null);
  });

  it('keeps large mixed datasets on JSON instead of dropping categorical science', () => {
    const dataset = new Dataset(
      'large-mixed-worker',
      [
        { name: 'x', type: ColumnType.NUMERIC },
        { name: 'group', type: ColumnType.CATEGORICAL },
      ],
      Array.from({ length: 50_000 }, (_, index) => ({
        x: index,
        group: index % 2 === 0 ? 'a' : 'b',
      })),
    );
    const atlas = new AtlasCore({ kernel: bridge });
    atlas.loadDataset(dataset);

    const payload = workerPayload(atlas);
    expect(payload.type).toBe('json');
    const json = payload.data as ReturnType<Dataset['toJSON']>;
    expect(json.columns).toContainEqual({ name: 'group', type: 'CATEGORICAL' });
    expect(json.rows[1].group).toBe('b');
    atlas.setKernel(null);
  });

  it('keeps large graph datasets on JSON so explicit edges survive registration material', () => {
    const rows = numericRows();
    const dataset = new Dataset(
      'large-graph-worker',
      [
        { name: 'x', type: ColumnType.NUMERIC },
        { name: 'y', type: ColumnType.NUMERIC },
      ],
      rows,
      [{ source: 0, target: 1, weight: 0.75, relation: 'linked' }],
    );
    const atlas = new AtlasCore({ kernel: bridge });
    atlas.loadDataset(dataset);

    const payload = workerPayload(atlas);
    expect(payload.type).toBe('json');
    const json = payload.data as ReturnType<Dataset['toJSON']>;
    expect(json.edges).toEqual([
      { source: 0, target: 1, weight: 0.75, relation: 'linked' },
    ]);
    atlas.setKernel(null);
  });
});