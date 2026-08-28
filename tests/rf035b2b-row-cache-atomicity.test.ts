import { describe, expect, it } from 'vitest';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { DatasetVersionStore } from '../src/data/DatasetVersionStore.ts';

describe('RF-035B2B row-cache failure atomicity', () => {
  it('does not retain new row values from a row-view registration that later fails validation', () => {
    const base = new Dataset(
      'base',
      [{ name: 'value', type: ColumnType.NUMERIC }],
      [{ value: 1 }, { value: 2 }, { value: 3 }],
      undefined,
      ['r1', 'r2', 'r3'],
    );
    const columns = base.toJSON().columns;
    const store = new DatasetVersionStore();
    const v1 = { datasetVersion: 1, datasetFingerprint: 'fp-base' };
    const v2 = { datasetVersion: 2, datasetFingerprint: 'fp-first' };
    store.registerBorrowed(v1, base);
    store.registerRowView(v2, v1, {
      name: 'first',
      columns,
      rows: [{ value: 1 }],
      rowIds: ['r1'],
    });

    // r2 is new and intentionally corrupt. r1 then conflicts with the already
    // verified cache entry, so the entire attempted registration must roll back.
    expect(() =>
      store.registerRowView(
        { datasetVersion: 3, datasetFingerprint: 'fp-rejected' },
        v1,
        {
          name: 'rejected',
          columns,
          rows: [{ value: 999 }, { value: 999 }],
          rowIds: ['r2', 'r1'],
        },
      ),
    ).toThrow(/changed value/i);

    // If the failed attempt leaked r2=999 into the cache, this authoritative
    // later registration would fail. It must instead succeed with r2=2.
    expect(() =>
      store.registerRowView(
        { datasetVersion: 4, datasetFingerprint: 'fp-legit' },
        v1,
        {
          name: 'legit',
          columns,
          rows: [{ value: 2 }],
          rowIds: ['r2'],
        },
      ),
    ).not.toThrow();
    expect(
      store.materialize({ datasetVersion: 4, datasetFingerprint: 'fp-legit' })?.rows,
    ).toEqual([{ value: 2 }]);
  });
});
