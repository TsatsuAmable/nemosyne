// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { Dataset } from '../src/data/Dataset.ts';
import { DatasetSpace, datasetContentHashHex } from '../src/atlas/DatasetSpace.ts';

function makeDataset(rows = [{ value: 10 }, { value: 20 }]): Dataset {
  return new Dataset('Atlas fixture', [{ name: 'value', type: 'NUMERIC' }], rows);
}

describe('DatasetSpace', () => {
  it('assigns stable SHA-256 content-based datum IDs', () => {
    const first = new DatasetSpace(makeDataset());
    const second = new DatasetSpace(makeDataset());

    expect(first.fingerprint).toBe(second.fingerprint);
    expect(first.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(first.datumIds).toEqual(second.datumIds);
    expect(first.datumIdAt(0)).toContain(':datum-');
  });

  it('keeps duplicate rows distinct', () => {
    const space = new DatasetSpace(makeDataset([{ value: 10 }, { value: 10 }]));
    expect(space.datumIds[0]).not.toBe(space.datumIds[1]);
  });

  it('records numeric normalization ranges and values', () => {
    const space = new DatasetSpace(makeDataset());
    const column = space.dataset.columns[0];
    expect(space.normalization.value).toEqual({ min: 10, max: 20 });
    expect(space.normalize(column, 15)).toBe(0.5);
    expect(space.normalize(column, null)).toBeNull();
  });

  it('uses zero for constant numeric columns', () => {
    const space = new DatasetSpace(makeDataset([{ value: 10 }, { value: 10 }]));
    expect(space.normalize(space.dataset.columns[0], 10)).toBe(0);
  });

  it('round-trips the complete renderer-independent v2 space', () => {
    const original = new DatasetSpace(makeDataset());
    const restored = DatasetSpace.fromJSON(original.toJSON());
    expect(restored.toJSON()).toEqual(original.toJSON());
    expect(restored.dataset.rows).not.toBe(original.dataset.rows);
  });

  it('rejects tampered snapshots', () => {
    const snapshot = new DatasetSpace(makeDataset()).toJSON();
    snapshot.fingerprint = 'tampered';
    expect(() => DatasetSpace.fromJSON(snapshot)).toThrow(/fingerprint mismatch/);
  });

  it('uses the shared locale-independent canonical SHA-256 contract', () => {
    const ds = new Dataset(
      'Case',
      [
        { name: 'B', type: 'NUMERIC' },
        { name: 'a', type: 'NUMERIC' },
      ],
      [{ B: 1, a: 2 }, { B: 3, a: 4 }]
    );
    const space = new DatasetSpace(ds);
    expect(space.fingerprint).toBe(datasetContentHashHex(ds.toJSON()));
  });

  it('does not let durable row identity metadata alter scientific fingerprint', () => {
    const ds = makeDataset();
    const before = new DatasetSpace(ds).fingerprint;
    expect(ds.adoptRowIds(['rust-row-a', 'rust-row-b'])).toBe(true);
    const after = new DatasetSpace(ds).fingerprint;
    expect(after).toBe(before);
  });
});
