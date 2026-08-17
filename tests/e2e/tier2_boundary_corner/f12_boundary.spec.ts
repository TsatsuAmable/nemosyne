import { describe, it, expect } from 'vitest';
import { flatBufferToDataset, datasetToFlatBuffer } from '../../../src/data/serializers/FlatBuffersSerializer.ts';
import { Dataset } from '../../../src/data/Dataset.ts';

// Wave 3: the JS ArrowBinaryParser is deleted. Arrow binary bounds-safety
// (under-header buffers, zero-copy position extraction, corrupt payloads) is
// covered by the Rust kernel `parse_arrow` path (wasm/src/data/parsers.rs) +
// wasm-runtime.test.ts. The remaining cases cover the FlatBuffers serializer,
// which stays in TS.
describe('Tier 2 — Feature 12: Binary Protocol Bounds Safety (Boundary Cases)', () => {
  it('F12-BC1: flatBufferToDataset with truncated buffer (< 10 bytes) returns empty Dataset safely', () => {
    const tinyBuffer = new Uint8Array([0x4e, 0x45, 0x4d]);
    const dataset = flatBufferToDataset(tinyBuffer);

    expect(dataset).toBeDefined();
    expect(dataset.columnCount).toBe(0);
    expect(dataset.rowCount).toBe(0);
  });

  it('F12-BC2: flatBufferToDataset with invalid magic bytes throws explicit error', () => {
    const invalidHeader = new Uint8Array([0x00, 0x11, 0x22, 0x33, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01]);

    expect(() => {
      flatBufferToDataset(invalidHeader);
    }).toThrow('Invalid FlatBuffer magic bytes');
  });

  it('F12-BC5: Round-trip serialization of dataset with 0 rows and 0 columns succeeds', () => {
    const emptyDataset = new Dataset('EmptyFB', [], []);
    const buffer = datasetToFlatBuffer(emptyDataset);
    const restored = flatBufferToDataset(buffer);

    expect(restored.columnCount).toBe(0);
    expect(restored.rowCount).toBe(0);
  });
});
