import { describe, expect, it } from 'vitest';
import { EvidenceLedger } from '../src/atlas/domain/EvidenceLedger.ts';
import { DatasetVersionStore } from '../src/data/DatasetVersionStore.ts';
import type { AnalysisResult, ResearchEvent } from '../src/atlas/types.ts';
import type { DatasetJSON } from '../src/data/types.ts';

function analysisResult(dataset: DatasetJSON): AnalysisResult {
  return {
    resultId: 'fp-out:2:filter:1',
    datasetFingerprint: 'fp-out',
    datasetVersion: 2,
    spec: {
      datasetFingerprint: 'fp-in',
      datasetVersion: 1,
      operation: { op: 'filter' },
      algorithmVersion: 'test-kernel',
    },
    dataset,
    metrics: null,
    provenance: null,
    implementationVersion: 'test-kernel',
    outputHash: 'fp-out',
    evidenceStatus: 'exploratory',
  };
}

describe('RF-035B2B compatibility regressions', () => {
  it('preserves the exact AnalysisResult object across results and analysis events', () => {
    const ledger = new EvidenceLedger();
    const dataset: DatasetJSON = {
      name: 'result',
      columns: [{ name: 'value', type: 'NUMERIC' }],
      rows: [{ value: 2 }],
      rowIds: ['r2'],
    };
    const result = analysisResult(dataset);

    ledger.addResult(result);
    const event = ledger.appendEvent({
      timestamp: 1,
      kind: 'analysis',
      command: result.spec,
      result,
      datasetVersion: result.datasetVersion,
      datasetFingerprint: result.datasetFingerprint,
      stateHash: result.outputHash,
    }, 'session');

    expect(ledger.results[0]).toBe(result);
    expect(event.result).toBe(result);
    expect(result.dataset).toStrictEqual(dataset);
  });

  it('restores the same persisted result snapshot repeatedly without mutating the input objects', () => {
    const ledger = new EvidenceLedger();
    const dataset: DatasetJSON = {
      name: 'persisted',
      columns: [{ name: 'value', type: 'NUMERIC' }],
      rows: [{ value: 2 }],
      rowIds: ['r2'],
    };
    const result = analysisResult(dataset);
    const event: ResearchEvent = {
      eventId: 'event-1',
      sessionId: 'session',
      timestamp: 1,
      kind: 'analysis',
      command: result.spec,
      result,
      datasetVersion: result.datasetVersion,
      datasetFingerprint: result.datasetFingerprint,
      stateHash: result.outputHash,
    };

    ledger.restore([result], [event]);
    expect(ledger.results[0]?.dataset).toStrictEqual(dataset);
    expect(result.dataset).toBe(dataset);

    expect(() => ledger.restore([result], [event])).not.toThrow();
    expect(ledger.results[0]?.dataset).toStrictEqual(dataset);
    expect(result.dataset).toBe(dataset);
  });

  it('deep-clones legacy full snapshots without requiring rows[]', () => {
    const legacy = {
      name: 'legacy-columnar',
      topology: 'TABULAR',
      columns: [{ name: 'value', type: 'float', values: [1, 2, 3] }],
    } as unknown as DatasetJSON;
    const ref = { datasetVersion: 2, datasetFingerprint: 'legacy-fp' };
    const store = new DatasetVersionStore();

    store.register(ref, legacy);

    expect(store.materializeJSON(ref)).toStrictEqual(legacy);
    expect(store.describe(ref)).toMatchObject({ rowCount: 0, columnCount: 1 });
  });
});
