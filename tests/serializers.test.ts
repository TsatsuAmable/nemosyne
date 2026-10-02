// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { tableFromArrays, tableToIPC } from 'apache-arrow';
import { encode } from '@msgpack/msgpack';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import {
  datasetToArrowIPC,
  arrowIPCToDataset,
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

  it('handles empty datasets in MessagePack', () => {
    const empty = new Dataset('Empty', [], []);
    const packed = datasetToMessagePack(empty);
    const restored = messagePackToDataset(packed);
    expect(restored.rowCount).toBe(0);
  });
});

// Canonical-serializer robustness. The retired hand-rolled row-buffer
// serializer (CMS-2) carried these bounds/safety properties; they are repinned
// here against the two truthful canonical serialization surfaces. The property
// under test: malformed or hostile untrusted input fails deliberately (a
// thrown, descriptive error) or degrades to an honest empty Dataset — never
// silently producing a Dataset that carries bogus rows.
describe('Canonical serializer robustness', () => {
  describe('MessagePack untrusted input', () => {
    it('throws on a payload truncated mid-envelope', () => {
      // Map header (0x81) claiming one key, followed by 3 of 4 string bytes.
      // Observed: @msgpack/msgpack raises RangeError('Insufficient data')
      // (decoder refusing truncated input), not a silent empty Dataset.
      expect(() => messagePackToDataset(new Uint8Array([0x81, 0xa4, 0xa4]))).toThrow(
        /insufficient data/i
      );
    });

    it('throws on non-payload garbage bytes', () => {
      // 0xc1 is never a valid MessagePack type byte.
      // Observed: DecodeError('Unrecognized type byte: 0xc1'), not a silent
      // empty Dataset.
      expect(() => messagePackToDataset(new Uint8Array([0xc1, 0xc2, 0xc3, 0xc4]))).toThrow(
        /unrecognized type byte/i
      );
    });

    it('throws on an empty buffer', () => {
      // Observed: RangeError from the decoder's DataView read, not a silent
      // empty Dataset — a caller passing zero bytes learns they sent nothing.
      expect(() => messagePackToDataset(new Uint8Array(0))).toThrow();
    });

    it('refuses a __proto__ row key outright', () => {
      // JSON.parse creates a genuine own '__proto__' property. Observed:
      // @msgpack/msgpack refuses such map keys at decode time with
      // DecodeError('The key __proto__ is not allowed'), before our Dataset
      // boundary is ever reached.
      const payload = JSON.parse(
        '{"columns":[{"name":"id"}],"rows":[{"id":1,"__proto__":{"admin":true}}]}'
      );
      expect(() => messagePackToDataset(encode(payload))).toThrow(/not allowed/);
    });

    it('strips constructor/prototype row keys at the Dataset boundary', () => {
      const payload = JSON.parse(
        '{"columns":[{"name":"id"}],' +
          '"rows":[{"id":1,"constructor":{"prototype":{"p":1}}},' +
          '{"id":2,"prototype":{"evil":true}}]}'
      );
      const restored = messagePackToDataset(encode(payload));
      expect(restored.rows[0]).toEqual({ id: 1 });
      expect(restored.rows[1]).toEqual({ id: 2 });
      const canary: Record<string, unknown> = {};
      expect(canary.polluted).toBeUndefined();
      expect(canary.p).toBeUndefined();
    });
  });

  describe('Arrow IPC untrusted input', () => {
    it('throws descriptively on garbage (non-IPC) bytes', () => {
      // Observed: Error('Expected to read 1819043176 metadata bytes, but only
      // read 32.') — the first garbage bytes read as a metadata length field.
      expect(() => arrowIPCToDataset(new TextEncoder().encode('hello world this is not arrow at all'))).toThrow(
        /metadata bytes, but only read/
      );
    });

    it('throws descriptively on a stream truncated mid-metadata', () => {
      const ipc = datasetToArrowIPC(TEST_DATASET);
      // Drop bytes after the continuation marker + metadata-length prefix.
      // Observed: Error('Expected to read 224 metadata bytes, but only read 8.').
      expect(() => arrowIPCToDataset(ipc.slice(0, 16))).toThrow(/metadata bytes, but only read/);
    });

    it('yields an honest empty Dataset — never bogus rows — for an under-header buffer', () => {
      // Observed apache-arrow behaviour (pinned as-is): a buffer that begins a
      // valid IPC sequence (continuation marker + short metadata length) but
      // stops there parses as an empty table, so the surface yields an empty
      // Dataset. It carries zero bogus columns/rows; a data-losing truncation
      // cannot fabricate data. Recorded as an observation, not as a defect.
      const restored = arrowIPCToDataset(new Uint8Array([0xff, 0xff, 0xff, 0xff, 0x10]));
      expect(restored).toBeDefined();
      expect(restored.rowCount).toBe(0);
      expect(restored.columnCount).toBe(0);
    });

    it('strips a hostile constructor-typed column key at the Dataset boundary', () => {
      // Rows built by arrowIPCToDataset flow into the Dataset constructor, so a
      // field named with a dangerous key must be stripped there. ('__proto__'
      // cannot even be manufactured as an Arrow field name — tableFromArrays
      // stack-overflows on the own key — so 'constructor' pins the boundary.)
      const ipc = tableToIPC(tableFromArrays({ ['constructor']: [1, 2], id: [1, 2] }));
      const restored = arrowIPCToDataset(ipc);
      expect(restored.rowCount).toBe(2);
      expect(restored.rows[0]).toEqual({ id: 1 });
      expect(restored.rows[1]).toEqual({ id: 2 });
      const canary: Record<string, unknown> = {};
      expect(canary.polluted).toBeUndefined();
      expect(canary.p).toBeUndefined();
    });
  });
});