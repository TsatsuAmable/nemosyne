import { describe, expect, it } from 'vitest';
import { Dataset } from '../src/data/Dataset.ts';
import { DatasetSpace } from '../src/atlas/DatasetSpace.ts';

function makeDataset(rows = [{ value: 10 }, { value: 20 }]): Dataset {
  return new Dataset('Atlas fixture', [{ name: 'value', type: 'NUMERIC' }], rows);
}

describe('DatasetSpace', () => {
  it('assigns stable content-based datum IDs', () => {
    const first = new DatasetSpace(makeDataset());
    const second = new DatasetSpace(makeDataset());

    expect(first.fingerprint).toBe(second.fingerprint);
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

  it('round-trips the complete renderer-independent space', () => {
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
});
