import { describe, expect, it } from 'vitest';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import {
  durableRowId,
  registerDurableRowId,
  rendererRowId,
} from '../src/data/RowIdentity.ts';

describe('renderer row identity', () => {
  it('is stable for a reused row object across derived JS datasets', () => {
    const row = { id: 1, value: 42 };
    expect(rendererRowId(row)).toBe(rendererRowId(row));
  });

  it('does not collapse equal-valued but distinct rows without durable IDs', () => {
    const first = { value: 42 };
    const second = { value: 42 };
    expect(rendererRowId(first)).not.toBe(rendererRowId(second));
  });

  it('is explicitly process-local when no durable dataset identity exists', () => {
    const row = { id: 'alpha' };
    expect(rendererRowId(row)).toMatch(/^row:\d+$/);
  });

  it('prefers a registered durable Rust-owned row ID', () => {
    const row = { id: 'alpha' };
    registerDurableRowId(row, 'abc123:0');
    expect(durableRowId(row)).toBe('abc123:0');
    expect(rendererRowId(row)).toBe('dataset-row:abc123:0');
  });

  it('restores durable identity onto reconstructed Dataset rows', () => {
    const ds = Dataset.fromJSON({
      name: 'roundtrip',
      columns: [{ name: 'value', type: ColumnType.NUMERIC }],
      rows: [{ value: 42 }, { value: 42 }],
      rowIds: ['source:0', 'source:1'],
    });

    expect(rendererRowId(ds.rows[0])).toBe('dataset-row:source:0');
    expect(rendererRowId(ds.rows[1])).toBe('dataset-row:source:1');
    expect(rendererRowId(ds.rows[0])).not.toBe(rendererRowId(ds.rows[1]));
    expect(ds.toJSON().rowIds).toEqual(['source:0', 'source:1']);
  });

  it('rejects a misaligned row ID vector rather than misidentifying rows', () => {
    const ds = Dataset.fromJSON({
      name: 'bad-ids',
      columns: [{ name: 'value', type: ColumnType.NUMERIC }],
      rows: [{ value: 1 }, { value: 2 }],
      rowIds: ['only-one'],
    });

    expect(ds.rowIds).toBeUndefined();
    expect(rendererRowId(ds.rows[0])).toMatch(/^row:\d+$/);
  });
});
