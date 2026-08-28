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

describe('RF-051 AtlasCore row-backed worker payload', () => {
  it('keeps large numeric row-backed datasets on JSON until RF-035 is operation-aware', () => {
    const atlas = new AtlasCore({ kernel: makeKernelMockBridge() });
    const dataset = new Dataset(
      'large-json',
      [{ name: 'value', type: ColumnType.NUMERIC }],
      numericRows(60_000),
    );

    atlas.loadDataset(dataset);

    const payload = (atlas as any)._workerDatasetPayload;
    expect(payload).not.toBeNull();
    expect(payload?.type).toBe('json');
    expect(payload?.name).toBe('large-json');
    expect(payload?.data.rows).toHaveLength(60_000);
    expect(payload?.data.columns).toEqual([{ name: 'value', type: 'NUMERIC' }]);
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

  it('preserves mixed-schema columns in large registration material', () => {
    const dataset = new Dataset(
      'mixed-test',
      [
        { name: 'a', type: ColumnType.NUMERIC },
        { name: 'c', type: ColumnType.CATEGORICAL },
      ],
      Array.from({ length: 60_000 }, (_, index) => ({
        a: index,
        c: index % 2 === 0 ? 'x' : 'y',
      })),
    );

    const atlas = new AtlasCore({ kernel: makeKernelMockBridge() });
    atlas.loadDataset(dataset);
    const payload = (atlas as any)._workerDatasetPayload;

    expect(payload?.type).toBe('json');
    expect(payload?.data.columns).toContainEqual({ name: 'c', type: 'CATEGORICAL' });
    expect(payload?.data.rows[1].c).toBe('y');
  });
});