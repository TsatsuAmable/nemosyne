import { describe, expect, it, vi } from 'vitest';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { DatasetVersionStore, type DatasetVersionRef } from '../src/data/DatasetVersionStore.ts';
import { EvidenceLedger } from '../src/atlas/domain/EvidenceLedger.ts';
import type { AnalysisResult, AnalysisSpec } from '../src/atlas/types.ts';
import type { DatasetJSON } from '../src/data/types.ts';

const columns = [{ name: 'value', type: ColumnType.NUMERIC }];

function baseline(): Dataset {
  return new Dataset(
    'base',
    columns,
    [{ value: 1 }, { value: 2 }, { value: 3 }],
    undefined,
    ['r1', 'r2', 'r3'],
  );
}

function ref(datasetVersion: number, datasetFingerprint: string): DatasetVersionRef {
  return { datasetVersion, datasetFingerprint };
}

function resultFor(dataset: DatasetJSON): AnalysisResult {
  const spec: AnalysisSpec = {
    datasetFingerprint: 'fp-base',
    datasetVersion: 1,
    operation: { op: 'sort', column: 'value', direction: 'desc' },
    algorithmVersion: 'kernel-test',
  };
  return {
    resultId: 'result-1',
    datasetFingerprint: 'fp-sorted',
    datasetVersion: 2,
    spec,
    dataset,
    metrics: null,
    provenance: null,
    implementationVersion: 'kernel-test',
    outputHash: 'fp-sorted',
    evidenceStatus: 'exploratory',
  };
}

describe('RF-035B2B reference-backed result storage', () => {
  it('stores chained verified row views without retaining intermediate row payloads', () => {
    const base = baseline();
    const store = new DatasetVersionStore();
    const v1 = ref(1, 'fp-base');
    const v2 = ref(2, 'fp-sorted');
    const v3 = ref(3, 'fp-filtered');

    store.registerBorrowed(v1, base);
    store.registerRowView(v2, v1, {
      name: 'base sorted',
      columns: base.toJSON().columns,
      rowIds: ['r3', 'r1'],
    });
    store.registerRowView(v3, v2, {
      name: 'base filtered',
      columns: base.toJSON().columns,
      rowIds: ['r1'],
    });

    expect(store.storageKind(v1)).toBe('borrowed');
    expect(store.storageKind(v2)).toBe('row-view');
    expect(store.storageKind(v3)).toBe('row-view');
    expect(store.describe(v2)).toMatchObject({ name: 'base sorted', rowCount: 2, columnCount: 1 });
    expect(store.describe(v3)).toMatchObject({ name: 'base filtered', rowCount: 1, columnCount: 1 });

    const materialized = store.materialize(v2);
    expect(materialized?.rows).toEqual([{ value: 3 }, { value: 1 }]);
    expect(materialized?.rowIds).toEqual(['r3', 'r1']);
    expect(store.materialize(v3)?.rows).toEqual([{ value: 1 }]);
  });

  it('keeps live result/event metadata cheap and lazily reconstructs the compatible dataset', () => {
    const base = baseline();
    const ledger = new EvidenceLedger();
    const sourceRef = ref(1, 'fp-base');
    ledger.registerDatasetVersion(sourceRef, base);

    const output: DatasetJSON = {
      name: 'base sorted',
      columns: base.toJSON().columns,
      rows: [{ value: 3 }, { value: 1 }],
      rowIds: ['r3', 'r1'],
      edges: undefined,
    };
    const result = resultFor(output);
    const fromJson = vi.spyOn(Dataset, 'fromJSON');

    ledger.addResult(result, { kind: 'verified-row-view', sourceRef });
    ledger.appendEvent(
      {
        timestamp: 1,
        kind: 'analysis',
        command: result.spec,
        result,
        datasetVersion: result.datasetVersion,
        datasetFingerprint: result.datasetFingerprint,
        stateHash: result.outputHash,
      },
      'session',
    );

    // The supplied full result payload is transient. If the ledger retained it,
    // this mutation would corrupt the durable historical result below.
    output.rows[0].value = 999;

    expect(ledger.results.length).toBe(1);
    expect(ledger.results[0].resultId).toBe('result-1');
    expect(ledger.ledger.length).toBe(1);
    expect(ledger.ledger[0].result).toBe(ledger.results[0]);
    expect(fromJson).not.toHaveBeenCalled();

    expect(ledger.results[0].dataset.rows).toEqual([{ value: 3 }, { value: 1 }]);
    expect(ledger.results[0].dataset.rowIds).toEqual(['r3', 'r1']);
  });

  it('fails closed rather than compacting graph-bearing output behind a row-view hint', () => {
    const base = baseline();
    const ledger = new EvidenceLedger();
    const sourceRef = ref(1, 'fp-base');
    ledger.registerDatasetVersion(sourceRef, base);
    const output = base.toJSON();
    output.name = 'graph result';
    output.edges = [{ source: 0, target: 1 }];
    const result = resultFor(output);

    expect(() =>
      ledger.addResult(result, { kind: 'verified-row-view', sourceRef }),
    ).toThrow(/row-view.*edge|edge.*row-view/i);
  });
});
