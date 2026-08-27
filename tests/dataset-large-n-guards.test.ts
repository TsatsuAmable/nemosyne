import { describe, expect, it } from 'vitest';
import { ColumnType, Dataset } from '../src/data/Dataset.ts';

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
});
