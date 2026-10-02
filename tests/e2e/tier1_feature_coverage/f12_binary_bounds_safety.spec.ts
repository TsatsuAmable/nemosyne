import { describe, it, expect } from 'vitest';
import {
  arrowIPCToDataset,
  datasetToArrowIPC,
} from '../../../src/data/serializers/ArrowSerializer.ts';
import { messagePackToDataset } from '../../../src/data/serializers/MessagePackSerializer.ts';
import { Dataset, ColumnType } from '../../../src/data/Dataset.ts';

// Wave 3 deleted the JS ArrowBinaryParser: Arrow binary bounds-safety at the
// kernel is covered by the Rust `parse_arrow` path (wasm/src/data/parsers.rs)
// plus wasm-runtime.test.ts. The tier-1 cases that previously pinned the
// retired hand-rolled row-buffer serializer (CMS-2) are migrated here onto the
// truthful TS canonical serializers, pinning the same property: malformed
// untrusted binary input fails deliberately, or degrades to an honest empty
// Dataset — never a silent success carrying bogus rows.
describe('Feature 12: Binary Protocol Bounds Safety', () => {
  it('F12-TC1: arrowIPCToDataset yields an honest empty Dataset for an under-header buffer', () => {
    // A valid IPC sequence prefix (continuation marker + short metadata
    // length) with nothing after it parses as an empty table — pinned as an
    // honest empty Dataset, never bogus rows or columns.
    const underHeader = new Uint8Array([0xff, 0xff, 0xff, 0xff, 0x10]);
    const ds = arrowIPCToDataset(underHeader);

    expect(ds).toBeDefined();
    expect(ds.rowCount).toBe(0);
    expect(ds.columnCount).toBe(0);
  });

  it('F12-TC2: malformed canonical binary payloads throw descriptive Errors instead of succeeding silently', () => {
    // A stream truncated mid-metadata must report the bounds failure, exactly
    // as the retired format reported a bad magic byte.
    const truncated = new Uint8Array([0xff, 0xff, 0xff, 0xff, 0x40, 0x00, 0x07, 0x00, 0x11]);
    expect(() => arrowIPCToDataset(truncated)).toThrow(/metadata bytes, but only read/);

    // A MessagePack payload truncated mid-envelope (map header claims one key,
    // only part of a string byte prefix follows) throws rather than
    // deserializing garbage.
    expect(() => messagePackToDataset(new Uint8Array([0x81, 0xa4, 0xa4]))).toThrow();
  });

  it('F12-TC4: datasetToArrowIPC and arrowIPCToDataset correctly serialize and deserialize valid datasets', () => {
    const original = new Dataset('Roundtrip', [{ name: 'val', type: ColumnType.NUMERIC }], [
      { val: 42 },
      { val: 99 },
    ]);
    const ipc = datasetToArrowIPC(original);
    const restored = arrowIPCToDataset(ipc);

    expect(restored.rowCount).toBe(2);
    expect(restored.columnCount).toBe(1);
    expect(restored.rows[0].val).toBe(42);
  });
});
