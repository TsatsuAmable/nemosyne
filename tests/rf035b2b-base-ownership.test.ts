import { describe, expect, it } from 'vitest';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { EvidenceLedger } from '../src/atlas/domain/EvidenceLedger.ts';
import type { AnalysisResult, AnalysisSpec } from '../src/atlas/types.ts';

describe('RF-035B2B compact history ownership', () => {
  it('does not let later base-dataset mutation rewrite a verified historical row view', () => {
    const base = new Dataset(
      'base',
      [{ name: 'value', type: ColumnType.NUMERIC }],
      [{ value: 1 }, { value: 2 }, { value: 3 }],
      undefined,
      ['r1', 'r2', 'r3'],
    );
    const sourceRef = { datasetVersion: 1, datasetFingerprint: 'fp-base' };
    const ledger = new EvidenceLedger();
    ledger.registerDatasetVersion(sourceRef, base);

    const spec: AnalysisSpec = {
      datasetFingerprint: 'fp-base',
      datasetVersion: 1,
      operation: { op: 'sort', column: 'value', direction: 'desc' },
      algorithmVersion: 'kernel-test',
    };
    const result: AnalysisResult = {
      resultId: 'result-ownership',
      datasetFingerprint: 'fp-sorted',
      datasetVersion: 2,
      spec,
      dataset: {
        name: 'base sorted',
        columns: base.toJSON().columns,
        rows: [{ value: 3 }, { value: 1 }],
        rowIds: ['r3', 'r1'],
      },
      metrics: null,
      provenance: null,
      implementationVersion: 'kernel-test',
      outputHash: 'fp-sorted',
      evidenceStatus: 'exploratory',
    };

    ledger.addResult(result, { kind: 'verified-row-view', sourceRef });

    // `originalDataset` is publicly reachable today. B2B must not turn that
    // mutability into the backing store for historical result values.
    base.rows[2].value = 777;
    result.dataset.rows[1].value = 888;

    expect(ledger.results[0].dataset.rows).toEqual([{ value: 3 }, { value: 1 }]);
    expect(ledger.results[0].dataset.rowIds).toEqual(['r3', 'r1']);
  });
});
