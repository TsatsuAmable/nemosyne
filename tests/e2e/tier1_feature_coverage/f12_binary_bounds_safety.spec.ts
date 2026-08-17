import { describe, it, expect } from 'vitest';
import { datasetToFlatBuffer, flatBufferToDataset } from '../../../src/data/serializers/FlatBuffersSerializer.js';
import { Dataset } from '../../../src/data/Dataset.js';

// Wave 3: the JS ArrowBinaryParser is deleted. Arrow binary bounds-safety
// (under-header, corrupt-magic, truncated payloads) is covered by the Rust
// kernel `parse_arrow` path (wasm/src/data/parsers.rs) + wasm-runtime.test.ts.
// The remaining cases cover the FlatBuffers serializer, which stays in TS.
describe('Feature 12: Binary Protocol Bounds Safety', () => {
  it('F12-TC1: flatBufferToDataset returns empty dataset for buffers smaller than header size', () => {
    const smallBuffer = new ArrayBuffer(5);
    const ds = flatBufferToDataset(smallBuffer);

    expect(ds).toBeDefined();
    expect(ds.rowCount).toBe(0);
    expect(ds.columnCount).toBe(0);
  });

  it('F12-TC2: flatBufferToDataset throws descriptive Error on invalid magic bytes', () => {
    const badMagic = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00]);
    expect(() => flatBufferToDataset(badMagic.buffer)).toThrow('Invalid FlatBuffer magic bytes');
  });

  it('F12-TC4: datasetToFlatBuffer and flatBufferToDataset correctly serialize and deserialize valid datasets', () => {
    const original = new Dataset('Roundtrip', [{ name: 'val', type: 'NUMERIC' }], [{ val: 42 }, { val: 99 }]);
    const buffer = datasetToFlatBuffer(original);
    const restored = flatBufferToDataset(buffer);

    expect(restored.rowCount).toBe(2);
    expect(restored.columnCount).toBe(1);
    expect(restored.rows[0].val).toBe(42);
  });
});
