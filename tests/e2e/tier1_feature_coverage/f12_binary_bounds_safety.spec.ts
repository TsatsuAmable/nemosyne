import { describe, it, expect } from 'vitest';
import { datasetToFlatBuffer, flatBufferToDataset } from '../../../src/data/serializers/FlatBuffersSerializer.js';
import { ArrowBinaryParser } from '../../../src/data/ArrowBinaryParser.js';
import { Dataset } from '../../../src/data/Dataset.js';
import { generateCorruptedBinaryArrow } from '../harness/dataset_fixtures.js';

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

  it('F12-TC3: ArrowBinaryParser returns empty dataset when buffer is under 8 bytes', () => {
    const tinyBuffer = new ArrayBuffer(4);
    const ds = ArrowBinaryParser.parseBinaryFloatStream(tinyBuffer);

    expect(ds).toBeDefined();
    expect(ds.rowCount).toBe(0);
  });

  it('F12-TC4: datasetToFlatBuffer and flatBufferToDataset correctly serialize and deserialize valid datasets', () => {
    const original = new Dataset('Roundtrip', [{ name: 'val', type: 'NUMERIC' }], [{ val: 42 }, { val: 99 }]);
    const buffer = datasetToFlatBuffer(original);
    const restored = flatBufferToDataset(buffer);

    expect(restored.rowCount).toBe(2);
    expect(restored.columnCount).toBe(1);
    expect(restored.rows[0].val).toBe(42);
  });

  it('F12-TC5: Corrupted Arrow binary payload handles invalid byte lengths safely by rejecting with error', () => {
    const corrupted = generateCorruptedBinaryArrow();
    expect(() => {
      ArrowBinaryParser.parseBinaryFloatStream(corrupted);
    }).toThrow();
  });
});
