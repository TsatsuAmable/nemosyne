import { beforeAll, describe, expect, it } from 'vitest';
import './setup-wasm.ts';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { ColumnType, Dataset } from '../src/data/Dataset.ts';
import type { DatasetPayload } from '../src/atlas/ports/AnalyticalExecutionPort.ts';
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

describe('RF-051 canonical large worker registration', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
    if (!bridge.isReady()) throw new Error('real WASM runtime unavailable');
  });

  it('uses NTC1 for large numeric datasets and Rust accepts the same canonical identity', () => {
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
    expect(payload.type).toBe('typed');
    const bytes = payload.data instanceof Uint8Array
      ? payload.data
      : new Uint8Array(payload.data as ArrayBuffer);
    expect(new TextDecoder().decode(bytes.subarray(0, 4))).toBe('NTC1');

    const handle = bridge.loadTypedColumns(bytes, payload.name);
    expect(handle).toBeGreaterThan(0);
    try {
      expect(bridge.datasetFingerprint(handle)).toBe(atlas.datasetFingerprint);
      expect(bridge.datasetRowCount(handle)).toBe(50_000);
      expect(bridge.datasetColumnCount(handle)).toBe(2);
    } finally {
      bridge.destroyDataset(handle);
      atlas.setKernel(null);
    }
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
