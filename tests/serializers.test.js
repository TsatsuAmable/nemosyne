import { describe, it, expect } from 'vitest';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import {
  datasetToArrowIPC,
  arrowIPCToDataset,
  datasetToFlatBuffer,
  flatBufferToDataset,
  datasetToMessagePack,
  messagePackToDataset,
} from '../src/data/serializers/index.ts';

const TEST_DATASET = new Dataset(
  'Test',
  [
    { name: 'id', type: ColumnType.CATEGORICAL },
    { name: 'value', type: ColumnType.NUMERIC },
    { name: 'time', type: ColumnType.TEMPORAL },
  ],
  [
    { id: 'A', value: 10, time: '2026-07-28T00:00:00' },
    { id: 'B', value: 20, time: '2026-07-28T01:00:00' },
    { id: 'C', value: null, time: '2026-07-28T02:00:00' },
  ]
);

describe('Serializers', () => {
  it('round-trips a dataset through Apache Arrow IPC', () => {
    const ipc = datasetToArrowIPC(TEST_DATASET);
    expect(ipc).toBeInstanceOf(Uint8Array);
    expect(ipc.length).toBeGreaterThan(0);

    const restored = arrowIPCToDataset(ipc, 'Arrow Test');
    expect(restored.name).toBe('Arrow Test');
    expect(restored.rowCount).toBe(3);
    expect(restored.columns.map((c) => c.name)).toEqual(['id', 'value', 'time']);
    expect(restored.rows[0].id).toBe('A');
    expect(restored.rows[0].value).toBe(10);
  });

  it('round-trips a dataset through the hand-rolled FlatBuffer format', () => {
    const buffer = datasetToFlatBuffer(TEST_DATASET);
    expect(buffer).toBeInstanceOf(ArrayBuffer);
    expect(buffer.byteLength).toBeGreaterThan(0);

    const restored = flatBufferToDataset(buffer, 'FlatBuffer Test');
    expect(restored.name).toBe('FlatBuffer Test');
    expect(restored.rowCount).toBe(3);
    expect(restored.columns.map((c) => c.name)).toEqual(['id', 'value', 'time']);
    expect(restored.rows[0].id).toBe('A');
    expect(restored.rows[0].value).toBe(10);
    expect(restored.rows[2].value).toBeNull();
  });

  it('round-trips a dataset through MessagePack', () => {
    const packed = datasetToMessagePack(TEST_DATASET);
    expect(packed).toBeInstanceOf(Uint8Array);
    expect(packed.length).toBeGreaterThan(0);

    const restored = messagePackToDataset(packed);
    expect(restored.name).toBe('Test');
    expect(restored.rowCount).toBe(3);
    expect(restored.columns.map((c) => c.name)).toEqual(['id', 'value', 'time']);
    expect(restored.rows[0].id).toBe('A');
    expect(restored.rows[0].value).toBe(10);
  });

  it('handles empty datasets in Arrow', () => {
    const empty = new Dataset('Empty', [], []);
    const ipc = datasetToArrowIPC(empty);
    const restored = arrowIPCToDataset(ipc);
    expect(restored.rowCount).toBe(0);
  });

  it('handles empty datasets in FlatBuffers', () => {
    const empty = new Dataset('Empty', [], []);
    const buffer = datasetToFlatBuffer(empty);
    const restored = flatBufferToDataset(buffer);
    expect(restored.rowCount).toBe(0);
  });

  it('handles empty datasets in MessagePack', () => {
    const empty = new Dataset('Empty', [], []);
    const packed = datasetToMessagePack(empty);
    const restored = messagePackToDataset(packed);
    expect(restored.rowCount).toBe(0);
  });

  it('rejects FlatBuffers with invalid magic bytes', () => {
    const bad = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(() => flatBufferToDataset(bad)).toThrow('Invalid FlatBuffer magic bytes');
  });
});
