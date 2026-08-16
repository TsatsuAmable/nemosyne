import { describe, it, expect } from 'vitest';
import { ArrowBinaryParser } from '../src/data/ArrowBinaryParser.ts';
import { ColumnType } from '../src/data/Dataset.ts';

describe('Sprint 13.2: Apache Arrow IPC & Binary Stream Reader Suite', () => {
  function createTestBinaryStream(numCols: number, rowCount: number): ArrayBuffer {
    const headerBytes = 8;
    const dataFloats = numCols * rowCount;
    const buffer = new ArrayBuffer(headerBytes + dataFloats * 4);
    const view = new DataView(buffer);

    view.setUint32(0, numCols, true);
    view.setUint32(4, rowCount, true);

    const floatView = new Float32Array(buffer, headerBytes);
    for (let i = 0; i < dataFloats; i++) {
      floatView[i] = (i + 1) * 1.5;
    }

    return buffer;
  }

  it('parses binary float streams into valid Nemosyne Datasets', () => {
    const buffer = createTestBinaryStream(3, 5);
    const ds = ArrowBinaryParser.parseBinaryFloatStream(buffer, ['x', 'y', 'z']);

    expect(ds.rowCount).toBe(5);
    expect(ds.columns.length).toBe(3);
    expect(ds.columns[0].type).toBe(ColumnType.NUMERIC);
    expect(ds.rows[0].x).toBe(1.5);
    expect(ds.rows[0].y).toBe(3.0);
    expect(ds.rows[0].z).toBe(4.5);
  });

  it('extracts zero-copy Float32Array position buffers for GPU instancing', () => {
    const buffer = createTestBinaryStream(3, 10);
    const posBuffer = ArrowBinaryParser.extractZeroCopyPositions(buffer);

    expect(posBuffer.length).toBe(30);
    expect(posBuffer[0]).toBe(1.5);
    expect(posBuffer[1]).toBe(3.0);
  });
});
