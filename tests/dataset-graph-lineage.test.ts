import { describe, expect, it } from 'vitest';
import { AnalyticalState } from '../src/atlas/domain/AnalyticalState.ts';
import { ColumnType, Dataset } from '../src/data/Dataset.ts';
import type { DatasetJSON } from '../src/data/types.ts';

function graphDataset(): Dataset {
  return new Dataset(
    'graph-lineage',
    [{ name: 'value', type: ColumnType.NUMERIC }],
    [{ value: 1 }, { value: 2 }, { value: 3 }],
    [
      {
        source: 0,
        target: 1,
        weight: 0.75,
        relation: 'observed',
        metadata: { source: 'sensor-a' },
      },
      { source: 1, target: 2, weight: 1.25, relation: 'derived' },
    ],
    ['rust:a', 'rust:b', 'rust:c']
  );
}

function expectGraphPreserved(actual: Dataset, expected: Dataset): void {
  expect(actual.edges).toEqual(expected.edges);
  expect(actual.rowIds).toEqual(expected.rowIds);
}

describe('RF-044 graph lineage preservation', () => {
  it('preserves weighted and attributed edges when Dataset is cloned', () => {
    const source = graphDataset();
    const clone = source.clone();

    expectGraphPreserved(clone, source);
    expect(clone.edges).not.toBe(source.edges);
    expect(clone.edges?.[0]).not.toBe(source.edges?.[0]);
    expect(clone.edges?.[0]?.metadata).not.toBe(source.edges?.[0]?.metadata);
  });

  it('preserves graph lineage through every clone-mediated AnalyticalState transition', () => {
    const source = graphDataset();
    const state = new AnalyticalState();

    state.loadDataset(source);
    expectGraphPreserved(state.original, source);
    expectGraphPreserved(state.current, source);

    state.advanceDataset(source);
    expectGraphPreserved(state.current, source);

    state.setCurrentDataset(source);
    expectGraphPreserved(state.current, source);

    state.commitKernelResult({ handle: 17, dataset: source, versionBump: false });
    expectGraphPreserved(state.current, source);
  });

  it('hands the intact graph to the kernel loader after normal Atlas loading', () => {
    const source = graphDataset();
    const state = new AnalyticalState();
    let loaded: DatasetJSON | undefined;

    state.loadDataset(source);
    const handle = state.ensureHandle((json) => {
      loaded = json;
      return 23;
    });

    expect(handle).toBe(23);
    expect(loaded?.edges).toEqual(source.edges);
    expect(loaded?.rowIds).toEqual(source.rowIds);
  });

  it('does not expose live graph state through the serialized DatasetJSON payload', () => {
    const source = graphDataset();
    const json = source.toJSON();

    expect(json.edges).toEqual(source.edges);
    expect(json.edges).not.toBe(source.edges);
    expect(json.edges?.[0]).not.toBe(source.edges?.[0]);
    expect(json.edges?.[0]?.metadata).not.toBe(source.edges?.[0]?.metadata);

    if (json.edges?.[0]) {
      json.edges[0].weight = 99;
      const metadata = json.edges[0].metadata as { source: string };
      metadata.source = 'mutated';
    }

    expect(source.edges?.[0]?.weight).toBe(0.75);
    expect(source.edges?.[0]?.metadata).toEqual({ source: 'sensor-a' });
  });
});
