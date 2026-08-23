import { beforeAll, describe, expect, it } from 'vitest';
import type { DatasetJSON, Facts, OperationSpec } from '../src/data/types.ts';
import * as bridge from '../src/wasm/RuntimeBridge.ts';

function normaliseFacts(facts: Facts): unknown {
  return {
    rowCount: facts.rowCount,
    columnCount: facts.columnCount,
    numeric: [...facts.numeric]
      .map((entry) => ({ ...entry }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    correlation: [...facts.correlation]
      .map((entry) => ({ ...entry }))
      .sort((a, b) => `${a.a}:${a.b}`.localeCompare(`${b.a}:${b.b}`)),
    categorical: [...facts.categorical]
      .map((entry) => ({
        ...entry,
        top: [...entry.top].sort((a, b) => a.value.localeCompare(b.value)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    temporal: [...facts.temporal].sort(),
    temporalStats: [...facts.temporalStats]
      .map((entry) => ({ ...entry }))
      .sort((a, b) => `${a.column}:${a.valueColumn}`.localeCompare(`${b.column}:${b.valueColumn}`)),
  };
}

function statisticsFor(dataset: DatasetJSON): Facts {
  const handle = bridge.loadDatasetJson(dataset);
  expect(handle).toBeGreaterThan(0);
  try {
    const facts = bridge.statistics(handle);
    expect(facts).not.toBeNull();
    return facts!;
  } finally {
    bridge.destroyDataset(handle);
  }
}

function renameFacts(facts: Facts, from: string, to: string): unknown {
  const rename = (name: string) => (name === from ? to : name);
  return {
    rowCount: facts.rowCount,
    columnCount: facts.columnCount,
    numeric: facts.numeric
      .map((entry) => ({ ...entry, name: rename(entry.name) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    correlation: facts.correlation
      .map((entry) => ({ ...entry, a: rename(entry.a), b: rename(entry.b) }))
      .sort((a, b) => `${a.a}:${a.b}`.localeCompare(`${b.a}:${b.b}`)),
    categorical: facts.categorical
      .map((entry) => ({
        ...entry,
        name: rename(entry.name),
        top: [...entry.top].sort((a, b) => a.value.localeCompare(b.value)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    temporal: facts.temporal.map(rename).sort(),
    temporalStats: facts.temporalStats
      .map((entry) => ({
        ...entry,
        column: rename(entry.column),
        valueColumn: rename(entry.valueColumn),
      }))
      .sort((a, b) => `${a.column}:${a.valueColumn}`.localeCompare(`${b.column}:${b.valueColumn}`)),
  };
}

const baseDataset: DatasetJSON = {
  name: 'metamorphic',
  columns: [
    { name: 'group', type: 'CATEGORICAL' },
    { name: 'x', type: 'NUMERIC' },
    { name: 'y', type: 'NUMERIC' },
  ],
  rows: [
    { group: 'A', x: 1, y: 2 },
    { group: 'B', x: 2, y: 4 },
    { group: 'A', x: 3, y: 6 },
    { group: 'B', x: 4, y: 8 },
  ],
};

describe('Moneta authoritative provenance and metamorphic correctness', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) {
      await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
    }
    expect(bridge.isReady()).toBe(true);
  });

  it('is invariant to row ordering for order-independent statistics', () => {
    const shuffled: DatasetJSON = {
      ...baseDataset,
      rows: [baseDataset.rows[2], baseDataset.rows[0], baseDataset.rows[3], baseDataset.rows[1]],
    };

    expect(normaliseFacts(statisticsFor(shuffled))).toEqual(normaliseFacts(statisticsFor(baseDataset)));
  });

  it('is equivariant under a valid semantic column rename', () => {
    const renamed: DatasetJSON = {
      name: baseDataset.name,
      columns: baseDataset.columns.map((column) =>
        column.name === 'x' ? { ...column, name: 'measure_x' } : column,
      ),
      rows: baseDataset.rows.map((row) => ({
        group: row.group,
        measure_x: row.x,
        y: row.y,
      })),
    };

    expect(normaliseFacts(statisticsFor(renamed))).toEqual(renameFacts(statisticsFor(baseDataset), 'x', 'measure_x'));
  });

  it('declares duplication scaling explicitly: intensive statistics stay fixed while counts scale', () => {
    const original = statisticsFor(baseDataset);
    const duplicated = statisticsFor({
      ...baseDataset,
      rows: [...baseDataset.rows, ...baseDataset.rows.map((row) => ({ ...row }))],
    });

    expect(duplicated.rowCount).toBe(original.rowCount * 2);
    for (const originalColumn of original.numeric) {
      const duplicateColumn = duplicated.numeric.find((column) => column.name === originalColumn.name);
      expect(duplicateColumn).toBeDefined();
      expect(duplicateColumn!.count).toBe(originalColumn.count * 2);
      expect(duplicateColumn!.sum).toBeCloseTo(originalColumn.sum * 2, 10);
      expect(duplicateColumn!.mean).toBeCloseTo(originalColumn.mean, 10);
      expect(duplicateColumn!.median).toBeCloseTo(originalColumn.median, 10);
      expect(duplicateColumn!.min).toBeCloseTo(originalColumn.min, 10);
      expect(duplicateColumn!.max).toBeCloseTo(originalColumn.max, 10);
      expect(duplicateColumn!.std).toBeCloseTo(originalColumn.std, 10);
      expect(duplicateColumn!.var).toBeCloseTo(originalColumn.var, 10);
    }
  });

  it('binds operation provenance to the exact authoritative input and output fingerprints', () => {
    const input = bridge.loadDatasetJson(baseDataset);
    expect(input).toBeGreaterThan(0);
    const inputFingerprint = bridge.datasetFingerprint(input);
    const operation = { op: 'sort', column: 'x', ascending: false } as OperationSpec;
    const output = bridge.runOperation(input, operation);
    expect(output).toBeGreaterThan(0);

    try {
      const outputFingerprint = bridge.datasetFingerprint(output);
      const provenance = bridge.kernelProvenance();
      expect(provenance).not.toBeNull();
      expect(provenance!.kernel).toBe('nemosyne-wasm');
      expect(provenance!.kernelVersion).toBe(bridge.kernelVersion());
      expect(provenance!.operation).toBe('sort');
      expect(provenance!.parameters).toMatchObject({ column: 'x', ascending: false });
      expect(provenance!.inputFingerprint).toBe(inputFingerprint);
      expect(provenance!.outputFingerprint).toBe(outputFingerprint);
      expect(provenance!.timestamp).toBeGreaterThan(0);
    } finally {
      bridge.destroyDataset(input);
      bridge.destroyDataset(output);
    }
  });
});
