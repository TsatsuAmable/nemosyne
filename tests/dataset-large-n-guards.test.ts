import { describe, expect, it } from 'vitest';
import { ColumnType, Dataset } from '../src/data/Dataset.ts';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';

const LARGE_N = 200_000;

function numericRows(count: number): Array<Record<string, unknown>> {
  const rows = new Array<Record<string, unknown>>(count);
  for (let i = 0; i < count; i++) rows[i] = { value: i };
  return rows;
}

describe('RF-051 Dataset large-N guards', () => {
  it('computes numeric ranges without argument-count-sensitive spread and excludes non-finite values', () => {
    const rows = numericRows(LARGE_N);
    rows[10] = { value: Number.NaN };
    rows[11] = { value: Number.POSITIVE_INFINITY };
    rows[12] = { value: Number.NEGATIVE_INFINITY };

    const dataset = new Dataset(
      'large-range',
      [{ name: 'value', type: ColumnType.NUMERIC }],
      rows,
    );

    expect(dataset.rangeOf('value')).toEqual({ min: 0, max: LARGE_N - 1 });
  });

  it('appends a large streaming batch without spreading it into Array.push arguments', () => {
    const dataset = new Dataset(
      'large-append',
      [{ name: 'value', type: ColumnType.NUMERIC }],
      [],
    );

    expect(() => dataset.updateRows(numericRows(LARGE_N), 'append')).not.toThrow();
    expect(dataset.rowCount).toBe(LARGE_N);
    expect(dataset.rows[0]?.value).toBe(0);
    expect(dataset.rows[LARGE_N - 1]?.value).toBe(LARGE_N - 1);
  });

  it('keeps rolling-window prefix eviction correct for a large append batch', () => {
    const dataset = new Dataset(
      'large-window',
      [{ name: 'value', type: ColumnType.NUMERIC }],
      [{ value: -1 }],
    );

    dataset.updateRows(numericRows(LARGE_N), 'append', 3);

    expect(dataset.rows).toEqual([
      { value: LARGE_N - 3 },
      { value: LARGE_N - 2 },
      { value: LARGE_N - 1 },
    ]);
  });

  it('snapshots an aliased source array before iterative append', () => {
    const dataset = new Dataset(
      'self-append',
      [{ name: 'value', type: ColumnType.NUMERIC }],
      [{ value: 1 }, { value: 2 }],
    );

    dataset.updateRows(dataset.rows, 'append');

    expect(dataset.rows).toEqual([
      { value: 1 },
      { value: 2 },
      { value: 1 },
      { value: 2 },
    ]);
  });
});

describe('RF-051 AtlasCore large dataset typed payload', () => {
  it('uses typed column payload for large datasets in worker registration', () => {
    const atlas = new AtlasCore({ kernel: makeKernelMockBridge() });
    const dataset = new Dataset(
      'large-typed',
      [{ name: 'value', type: ColumnType.NUMERIC }],
      numericRows(60000), // Over LARGE_DATASET_ROW_THRESHOLD (50000)
    );
    
    atlas.loadDataset(dataset);
    
    // Access private method via type assertion for testing
    const payload = (atlas as any)._workerDatasetPayload;
    expect(payload).not.toBeNull();
    expect(payload?.type).toBe('typed');
    expect(payload?.data).toBeInstanceOf(ArrayBuffer);
    expect(payload?.name).toBe('large-typed');
  });

  it('uses JSON payload for small datasets', () => {
    const atlas = new AtlasCore({ kernel: makeKernelMockBridge() });
    const dataset = new Dataset(
      'small-json',
      [{ name: 'value', type: ColumnType.NUMERIC }],
      [{ value: 1 }, { value: 2 }],
    );
    
    atlas.loadDataset(dataset);
    
    const payload = (atlas as any)._workerDatasetPayload;
    expect(payload).not.toBeNull();
    expect(payload?.type).toBe('json');
    expect(payload?.data).toBeDefined();
    expect(payload?.name).toBe('small-json');
  });

  it('builds typed payload with correct column data', () => {
    const dataset = new Dataset(
      'typed-test',
      [
        { name: 'a', type: 'NUMERIC' },
        { name: 'b', type: 'NUMERIC' },
        { name: 'c', type: 'CATEGORICAL' },
      ],
      [
        { a: 1, b: 10, c: 'x' },
        { a: 2, b: 20, c: 'y' },
        { a: 3, b: 30, c: 'z' },
      ],
    );
    
    const atlas = new AtlasCore({ kernel: makeKernelMockBridge() });
    // Manually trigger typed payload for testing (bypass threshold)
    const payload = (atlas as any)._buildTypedPayloadFromDataset(dataset);
    
    expect(payload.type).toBe('typed');
    expect(payload.data).toBeInstanceOf(ArrayBuffer);
    
    // Verify we can parse the buffer back
    const view = new DataView(payload.data);
    const decoder = new TextDecoder();
    
    let offset = 0;
    const colCount = view.getUint32(offset, true); offset += 4;
    expect(colCount).toBe(2); // Only numeric columns 'a' and 'b'
    
    for (let i = 0; i < colCount; i++) {
      const nameLen = view.getUint32(offset, true); offset += 4;
      const name = decoder.decode(new Uint8Array(payload.data, offset, nameLen)); offset += nameLen;
      expect(['a', 'b']).toContain(name);
      const arrLen = view.getUint32(offset, true); offset += 4;
      expect(arrLen).toBe(3);
      // Align offset to 8 bytes for Float64Array
      offset = (offset + 7) & ~7;
      const arr = new Float64Array(payload.data, offset, arrLen);
      offset += arr.byteLength;
      if (name === 'a') {
        expect(Array.from(arr)).toEqual([1, 2, 3]);
      } else if (name === 'b') {
        expect(Array.from(arr)).toEqual([10, 20, 30]);
      }
    }
  });
});
