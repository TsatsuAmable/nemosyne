/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.js';

function makeDataset(): Dataset {
  return new Dataset(
    'Test',
    [
      { name: 'id', type: ColumnType.NUMERIC },
      { name: 'value', type: ColumnType.NUMERIC },
    ],
    [
      { id: 1, value: 10 },
      { id: 2, value: 20 },
      { id: 3, value: 30 },
      { id: 4, value: 40 },
    ]
  );
}

describe('AtlasCore', () => {
  let atlas: AtlasCore;
  let kernel: any;

  beforeEach(() => {
    kernel = makeKernelMockBridge();
    atlas = new AtlasCore({ kernel });
  });

  it('loadDataset resets ledger/results/history, bumps version, and appends a load event', () => {
    atlas.loadDataset(makeDataset());
    expect(atlas.datasetVersion).toBe(1);
    expect(atlas.results.length).toBe(0);
    expect(atlas.analysisHistory.length).toBe(0);
    expect(atlas.ledger.length).toBe(1);
    expect(atlas.ledger[0].kind).toBe('load');
    expect(atlas.ledger[0].stateHash).toBeTruthy();
  });

  it('applyAnalysis runs the kernel op and records a result + analysis event + history frame', () => {
    const ds = makeDataset();
    atlas.loadDataset(ds);
    const result = atlas.applyAnalysis({
      datasetFingerprint: atlas.datasetFingerprint ?? '',
      datasetVersion: atlas.datasetVersion,
      operation: { op: 'filter', predicate: { op: 'gt', column: 'value', value: 20 } },
      algorithmVersion: atlas.kernelVersion() ?? 'mock',
      label: 'filter',
      seed: null,
      normalization: 'none',
      missingness: 'exclude-non-finite',
    });

    expect(result.resultId).toBeTruthy();
    expect(result.outputHash).toBeTruthy();
    expect(result.provenance).toBeNull(); // mock kernel emits no provenance
    expect(result.evidenceStatus).toBe('exploratory');
    expect(atlas.dataset.rowCount).toBeLessThan(4);
    expect(atlas.results.length).toBe(1);
    expect(atlas.analysisHistory.length).toBe(1);
    expect(atlas.analysisHistory.current()!.operation).toBe('filter');
    expect(atlas.ledger.length).toBe(2);
    expect(atlas.ledger[atlas.ledger.length - 1].kind).toBe('analysis');
    expect(atlas.ledger[atlas.ledger.length - 1].result).toBe(result);
  });

  it('previewAnalysis does NOT mutate results/ledger/history', () => {
    atlas.loadDataset(makeDataset());
    const resultsBefore = atlas.results.length;
    const ledgerBefore = atlas.ledger.length;
    const historyBefore = atlas.analysisHistory.length;
    const rowCountBefore = atlas.dataset.rowCount;

    const result = atlas.previewAnalysis({
      datasetFingerprint: atlas.datasetFingerprint ?? '',
      datasetVersion: atlas.datasetVersion,
      operation: { op: 'filter', predicate: { op: 'gt', column: 'value', value: 20 } },
      algorithmVersion: 'mock',
      label: 'filter',
      seed: null,
      normalization: 'none',
      missingness: 'exclude-non-finite',
    });

    expect(result).toBeTruthy();
    expect(atlas.results.length).toBe(resultsBefore);
    expect(atlas.ledger.length).toBe(ledgerBefore);
    expect(atlas.analysisHistory.length).toBe(historyBefore);
    expect(atlas.dataset.rowCount).toBe(rowCountBefore);
  });

  it('undo/redo/seekHistory move the cursor and append ledger events + restore the current dataset', () => {
    atlas.loadDataset(makeDataset());
    atlas.applyAnalysis({
      datasetFingerprint: atlas.datasetFingerprint ?? '',
      datasetVersion: atlas.datasetVersion,
      operation: { op: 'filter', predicate: { op: 'gt', column: 'value', value: 20 } },
      algorithmVersion: 'mock',
      label: 'filter',
      seed: null,
      normalization: 'none',
      missingness: 'exclude-non-finite',
    });
    const filteredRows = atlas.dataset.rowCount;
    expect(filteredRows).toBeLessThan(4);

    const undoEntry = atlas.undo();
    expect(undoEntry).toBeTruthy();
    expect(undoEntry!.operation).toBe('filter');
    expect(atlas.dataset.rowCount).toBe(4);
    expect(atlas.ledger[atlas.ledger.length - 1].kind).toBe('undo');

    const redoEntry = atlas.redo();
    expect(redoEntry).toBeTruthy();
    expect(redoEntry!.operation).toBe('filter');
    expect(atlas.dataset.rowCount).toBe(filteredRows);
    expect(atlas.ledger[atlas.ledger.length - 1].kind).toBe('redo');

    const seekEntry = atlas.seekHistory(0);
    expect(seekEntry).toBeTruthy();
    expect(atlas.analysisHistory.currentIndex).toBe(0);
    expect(atlas.ledger[atlas.ledger.length - 1].kind).toBe('seek');
  });

  it('facts() and medianFor() return mock kernel statistics', () => {
    atlas.loadDataset(makeDataset());
    const facts = atlas.facts();
    expect(facts).toBeTruthy();
    expect(facts!.numeric.find((c) => c.name === 'value')!.median).toBe(25);
    expect(atlas.medianFor('value')).toBe(25);
    expect(atlas.medianFor('missing')).toBe(0);
  });

  it('datasetFingerprint is stable across identical loads and kernel-derived when ready', () => {
    const ds = makeDataset();
    atlas.loadDataset(ds);
    const fp1 = atlas.datasetFingerprint;
    atlas.loadDataset(ds);
    const fp2 = atlas.datasetFingerprint;
    expect(fp1).toBeTruthy();
    expect(fp1).toBe(fp2);
  });

  it('resetAnalysis restores the original dataset and appends a reset event', () => {
    atlas.loadDataset(makeDataset());
    atlas.applyAnalysis({
      datasetFingerprint: atlas.datasetFingerprint ?? '',
      datasetVersion: atlas.datasetVersion,
      operation: { op: 'filter', predicate: { op: 'gt', column: 'value', value: 20 } },
      algorithmVersion: 'mock',
      label: 'filter',
      seed: null,
      normalization: 'none',
      missingness: 'exclude-non-finite',
    });
    expect(atlas.dataset.rowCount).toBeLessThan(4);

    atlas.resetAnalysis();
    expect(atlas.dataset.rowCount).toBe(4);
    expect(atlas.analysisHistory.current()!.operation).toBe('reset');
    expect(atlas.ledger[atlas.ledger.length - 1].kind).toBe('reset');
  });

  it('dispose destroys the current handle without leaking', () => {
    const destroyed: number[] = [];
    const baseKernel = makeKernelMockBridge();
    const leakyKernel = {
      ...baseKernel,
      destroyDataset: (h: number) => {
        destroyed.push(h);
        baseKernel.destroyDataset(h);
      },
    };
    const atlas2 = new AtlasCore({ kernel: leakyKernel });
    atlas2.loadDataset(makeDataset());
    atlas2.applyAnalysis({
      datasetFingerprint: atlas2.datasetFingerprint ?? '',
      datasetVersion: atlas2.datasetVersion,
      operation: { op: 'filter', predicate: { op: 'gt', column: 'value', value: 20 } },
      algorithmVersion: 'mock',
      label: 'filter',
      seed: null,
      normalization: 'none',
      missingness: 'exclude-non-finite',
    });
    // After apply, the input handle should have been destroyed (adopted the
    // output handle). dispose() destroys the live handle.
    const liveBefore = destroyed.length;
    atlas2.dispose();
    expect(destroyed.length).toBeGreaterThan(liveBefore);
  });

  it('recommendations are recorded against the decision history', () => {
    atlas.setRecommendation({
      targetIds: ['x'],
      action: 'cluster',
      rationale: 'r',
      evidence: 'e',
      confidence: 0.8,
      decision: 'accepted',
    });
    expect(atlas.activeRecommendation).toBeTruthy();
    atlas.recordDecision('rejected');
    expect(atlas.activeRecommendation!.decision).toBe('rejected');
    expect(atlas.decisionHistory.length).toBe(1);
  });
});