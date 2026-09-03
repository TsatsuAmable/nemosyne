// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import {
  datasetToArrowIPC,
  arrowIPCToDataset,
  datasetToMessagePack,
  messagePackToDataset,
} from '../src/data/serializers/index.ts';
import {
  datasetToFlatBuffer,
  flatBufferToDataset,
} from '../src/data/serializers/FlatBuffersSerializer.ts';

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

// FlatBuffer length-field bounds: the hand-rolled format carries untrusted
// columnCount / rowCount / per-column nameLength / per-cell string-len. A
// malformed payload must fail deliberately and descriptively rather than via an
// incidental DataView RangeError or silent subarray truncation.
describe('FlatBuffer length-field bounds', () => {
  // Minimal valid 10-byte header (magic 0x4E 0x45 0x4D 0x01 + columnCount + rowCount).
  function flatHeader(columnCount, rowCount) {
    const h = new DataView(new ArrayBuffer(10));
    h.setUint8(0, 0x4e);
    h.setUint8(1, 0x45);
    h.setUint8(2, 0x4d);
    h.setUint8(3, 0x01);
    h.setUint16(4, columnCount, true);
    h.setUint32(6, rowCount, true);
    return new Uint8Array(h.buffer);
  }

  // Append a single column descriptor: typeId (u8) + nameLength (u16 LE) + name bytes.
  function withColumn(buf, typeId, name) {
    const nameBytes = new TextEncoder().encode(name);
    const meta = new DataView(new ArrayBuffer(3 + nameBytes.length));
    meta.setUint8(0, typeId);
    meta.setUint16(1, nameBytes.length, true);
    const out = new Uint8Array(buf.length + meta.buffer.byteLength);
    out.set(buf, 0);
    out.set(new Uint8Array(meta.buffer), buf.length);
    out.set(nameBytes, buf.length + 3);
    return out;
  }

  it('returns an empty Dataset when the buffer is shorter than the 10-byte header', () => {
    const restored = flatBufferToDataset(new Uint8Array(4));
    expect(restored.rowCount).toBe(0);
    expect(restored.columnCount).toBe(0);
  });

  it('rejects an inflated columnCount with no column metadata', () => {
    // Declares 1000 columns but carries none.
    const buf = flatHeader(1000, 0);
    expect(() => flatBufferToDataset(buf)).toThrow(/truncated at column 0 header/);
  });

  it('rejects an inflated column nameLength that runs past the buffer', () => {
    // 1 column whose nameLength claims 9999 bytes that are not present.
    const buf = withColumn(flatHeader(1, 0), 1 /* NUMERIC */, '');
    // Overwrite the nameLength field (byte 10 is typeId; bytes 11..12 are nameLength) to 9999.
    const view = new DataView(buf.buffer);
    view.setUint16(11, 9999, true);
    expect(() => flatBufferToDataset(buf)).toThrow(/truncated at column 0 name/);
  });

  it('rejects an inflated rowCount with no row data', () => {
    // 1 valid column "x", but 1_000_000 declared rows with no row bytes.
    const buf = withColumn(flatHeader(1, 1_000_000), 1 /* NUMERIC */, 'x');
    expect(() => flatBufferToDataset(buf)).toThrow(/truncated at row 0 column "x" kind/);
  });

  it('rejects an inflated per-cell string length that runs past the buffer', () => {
    // 1 TEXT column "s", 1 row, cell kind=2 (string) with len=99999 but no bytes.
    const buf = withColumn(flatHeader(1, 1), 4 /* TEXT */, 's');
    // Append kind=2 + len=99999 (0x0001869F LE).
    const cell = new DataView(new ArrayBuffer(5));
    cell.setUint8(0, 2);
    cell.setUint32(1, 99999, true);
    const out = new Uint8Array(buf.length + 5);
    out.set(buf, 0);
    out.set(new Uint8Array(cell.buffer), buf.length);
    expect(() => flatBufferToDataset(out)).toThrow(/truncated at row 0 column "s" string/);
  });

  it('still round-trips a valid dataset after the bounds checks are added', () => {
    const restored = flatBufferToDataset(datasetToFlatBuffer(TEST_DATASET), 'RT');
    expect(restored.name).toBe('RT');
    expect(restored.rowCount).toBe(3);
    expect(restored.columns.map((c) => c.name)).toEqual(['id', 'value', 'time']);
    expect(restored.rows[2].value).toBeNull();
  });
});
