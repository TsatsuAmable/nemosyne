import { describe, expect, it } from 'vitest';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { InvestigationAggregate } from '../src/atlas/domain/InvestigationAggregate.ts';
import type { AnalysisResult, AnalysisSpec, AtlasCoreState, ResearchEvent } from '../src/atlas/types.ts';

function dataset(): Dataset {
  return new Dataset(
    'base',
    [{ name: 'value', type: ColumnType.NUMERIC }],
    [{ value: 1 }, { value: 2 }],
    undefined,
    ['r1', 'r2'],
  );
}

describe('RF-035B2B restored baseline registration', () => {
  it('allows the first verified row-view result after a zero-result schema-v2 restore', () => {
    const base = dataset();
    const json = base.toJSON();
    const loadEvent: ResearchEvent = {
      eventId: 'session:1',
      sessionId: 'session',
      timestamp: 1,
      kind: 'load',
      command: { op: 'load' },
      datasetVersion: 1,
      datasetFingerprint: 'fp-base',
      stateHash: 'fp-base',
    };
    const state: AtlasCoreState = {
      datasetVersion: 1,
      datasetFingerprint: 'fp-base',
      originalDataset: json,
      currentDataset: json,
      datasetSpace: null,
      analysisResults: [],
      eventLedger: [loadEvent],
      analysisHistory: { index: -1, maxFrames: 50, frames: [] },
      activeRecommendation: null,
      decisionHistory: [],
      structures: [],
      observations: [],
      findings: [],
      annotations: [],
    };

    const aggregate = new InvestigationAggregate({ sessionId: 'session' });
    aggregate.restoreState(state);

    const spec: AnalysisSpec = {
      datasetFingerprint: 'fp-base',
      datasetVersion: 1,
      operation: { op: 'slice', start: 0, end: 1 },
      algorithmVersion: 'kernel-test',
    };
    const result: AnalysisResult = {
      resultId: 'result-after-restore',
      datasetFingerprint: 'fp-slice',
      datasetVersion: 2,
      spec,
      dataset: {
        name: 'base slice',
        columns: json.columns,
        rows: [{ value: 1 }],
        rowIds: ['r1'],
      },
      metrics: null,
      provenance: null,
      implementationVersion: 'kernel-test',
      outputHash: 'fp-slice',
      evidenceStatus: 'exploratory',
    };

    expect(() =>
      aggregate.ledger.addResult(result, {
        kind: 'verified-row-view',
        sourceRef: { datasetVersion: 1, datasetFingerprint: 'fp-base' },
      }),
    ).not.toThrow();
    expect(aggregate.ledger.results[0].dataset.rows).toEqual([{ value: 1 }]);
  });
});
