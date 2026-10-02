import { describe, it, expect } from 'vitest';
import { arrowIPCToDataset, datasetToArrowIPC } from '../../../src/data/serializers/ArrowSerializer.ts';
import {
  messagePackToDataset,
  datasetToMessagePack,
} from '../../../src/data/serializers/MessagePackSerializer.ts';
import { Dataset } from '../../../src/data/Dataset.ts';

// Wave 3 deleted the JS ArrowBinaryParser: kernel-side bounds safety
// (under-header buffers, zero-copy position extraction, corrupt payloads) is
// covered by the Rust kernel `parse_arrow` path (wasm/src/data/parsers.rs) +
// wasm-runtime.test.ts. The tier-2 boundary cases that previously pinned the
// retired hand-rolled row-buffer serializer (CMS-2) are migrated here onto the
// truthful TS canonical serializers, keeping the same boundary-corner shape:
// truncated input never becomes an opaque or silent success, garbage input
// throws descriptively, and the empty-dataset round-trip still holds.
describe('Tier 2 — Feature 12: Binary Protocol Bounds Safety (Boundary Cases)', () => {
  it('F12-BC1: truncated canonical binary input never masquerades as data', () => {
    // Arrow: a stream cut off mid-metadata reports the bounds failure.
    const truncatedArrow = new Uint8Array([0xff, 0xff, 0xff, 0xff, 0x40, 0x00, 0x07, 0x00, 0x11]);
    expect(() => arrowIPCToDataset(truncatedArrow)).toThrow(/metadata bytes, but only read/);

    // MessagePack: a payload shorter than its own envelope header throws
    // outright — an opaque or silent success is impossible.
    expect(() => messagePackToDataset(new Uint8Array([0x81, 0xa4]))).toThrow();
  });

  it('F12-BC2: non-protocol garbage bytes throw descriptive errors from both canonical parsers', () => {
    // Arrow: garbage bytes read as an inflated metadata length field.
    const garbage = new TextEncoder().encode('not a binary protocol payload at all');
    expect(() => arrowIPCToDataset(garbage)).toThrow(/metadata bytes, but only read/);

    // MessagePack: the type byte 0xc1 is never valid in a MessagePack stream.
    expect(() => messagePackToDataset(new Uint8Array([0xc1, 0xc2, 0xc3, 0xc4]))).toThrow();
  });

  it('F12-BC3: an under-header binary buffer yields an honest empty Dataset, never bogus rows', () => {
    // A valid IPC sequence prefix (continuation marker + short metadata
    // length) with none of the table parses as an empty table — pinned as an
    // honest empty Dataset.
    const underHeader = new Uint8Array([0xff, 0xff, 0xff, 0xff, 0x10]);
    const dataset = arrowIPCToDataset(underHeader);

    expect(dataset).toBeDefined();
    expect(dataset.columnCount).toBe(0);
    expect(dataset.rowCount).toBe(0);
  });

  it('F12-BC5: Round-trip serialization of dataset with 0 rows and 0 columns succeeds', () => {
    const emptyDataset = new Dataset('Empty', [], []);

    const restoredArrow = arrowIPCToDataset(datasetToArrowIPC(emptyDataset));
    expect(restoredArrow.columnCount).toBe(0);
    expect(restoredArrow.rowCount).toBe(0);

    const restoredPacked = messagePackToDataset(datasetToMessagePack(emptyDataset));
    expect(restoredPacked.columnCount).toBe(0);
    expect(restoredPacked.rowCount).toBe(0);
  });
});
