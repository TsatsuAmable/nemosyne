import { describe, expect, it } from 'vitest';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { rendererRowId } from '../src/data/RowIdentity.ts';
import { AnalyticalState } from '../src/atlas/domain/AnalyticalState.ts';
import { fnv1aHex } from '../src/atlas/DatasetSpace.ts';

function dataset(): Dataset {
  return new Dataset(
    'identity',
    [{ name: 'value', type: ColumnType.NUMERIC }],
    [{ value: 1 }, { value: 1 }, { value: 2 }]
  );
}

describe('AnalyticalState kernel row identity hydration', () => {
  it('adopts the exact Rust first-lineage IDs without bumping dataset version', () => {
    const state = new AnalyticalState();
    state.loadDataset(dataset());
    const versionBefore = state.datasetVersion;
    const jsonBefore = state.current.toJSON();
    const prefix = fnv1aHex(jsonBefore);

    const handle = state.ensureHandle(() => 17);

    expect(handle).toBe(17);
    expect(state.datasetVersion).toBe(versionBefore);
    expect(state.current.rowIds).toEqual([
      `${prefix}:0`,
      `${prefix}:1`,
      `${prefix}:2`,
    ]);
    expect(state.original.rowIds).toEqual(state.current.rowIds);
    expect(rendererRowId(state.current.rows[0])).toBe(`${prefix}:0`);
    expect(rendererRowId(state.current.rows[1])).toBe(`${prefix}:1`);
  });

  it('does not hydrate IDs when the kernel rejects the dataset', () => {
    const state = new AnalyticalState();
    state.loadDataset(dataset());

    expect(state.ensureHandle(() => 0)).toBe(0);
    expect(state.current.rowIds).toBeUndefined();
    expect(state.original.rowIds).toBeUndefined();
  });

  it('does not overwrite an existing valid durable identity vector', () => {
    const ds = new Dataset(
      'known',
      [{ name: 'value', type: ColumnType.NUMERIC }],
      [{ value: 1 }, { value: 2 }],
      undefined,
      ['rust:a', 'rust:b']
    );
    const state = new AnalyticalState();
    state.loadDataset(ds);

    state.ensureHandle(() => 22);

    expect(state.current.rowIds).toEqual(['rust:a', 'rust:b']);
  });
});
