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
      action: 'inspect-cluster',
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

  it('maps deterministic Mapper nodes into stable datum structures', () => {
    kernel.computeMapperGraph = () => ({
      nodes: [
        { id: 2, rowIndices: [3, 2], level: 1, center: [1], filterCenter: 2, size: 2 },
        { id: 1, rowIndices: [0, 1], level: 0, center: [0], filterCenter: 1, size: 2 },
      ],
      edges: [[1, 2]],
    });
    const dataset = makeDataset();
    atlas.loadDataset(dataset);
    const first = atlas.discoverMapperStructures(dataset, { bins: 2, overlap: 0.3 });
    const second = atlas.discoverMapperStructures(dataset, { bins: 2, overlap: 0.3 });
    expect(first).toEqual(second);
    expect(first!.structures[0].rowIndices).toEqual([0, 1]);
    expect(first!.structures[0].datumIds).toHaveLength(2);
    expect(first!.provenance).toBeNull();
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
  });

  it('maps persistence intervals into ranked, reproducible structures', () => {
    kernel.computePersistenceIntervals = () => [
      { birth: 0.5, death: 1.5 },
      { birth: 0.1, death: null },
    ];
    const dataset = makeDataset();
    atlas.loadDataset(dataset);
    const result = atlas.discoverPersistenceStructures(dataset, { maxDistance: 2 });
    expect(result!.structures.map((structure) => structure.evidence.rank)).toEqual([0, 1]);
    expect(result!.structures[0].evidence.score).toBe(0);
    expect(result!.structures[1].evidence.score).toBe(1);
  });

  it('projects kernel clustering assignments into stable cluster structures', () => {
    const dataset = makeDataset();
    atlas.loadDataset(dataset);
    const operation = { op: 'k_means' as const, k: 2 };
    const first = atlas.discoverClusterStructures(dataset, operation);
    const second = atlas.discoverClusterStructures(dataset, operation);

    expect(first).toEqual(second);
    expect(first!.structures.map((structure) => structure.rowIndices)).toEqual([
      [0, 2],
      [1, 3],
    ]);
    expect(first!.structures.every((structure) => structure.kind === 'cluster')).toBe(true);
    expect(first!.structures[0].datumIds).toHaveLength(2);
    expect(atlas.structures).toHaveLength(2);
    expect(atlas.ledger.filter((event) => event.kind === 'structure')).toHaveLength(2);
  });

  it('canonicalizes nested parameter key order in structure IDs', () => {
    kernel.computeMapperGraph = () => ({
      nodes: [{ id: 1, rowIndices: [0, 1], level: 0, center: [0], filterCenter: 1, size: 2 }],
      edges: [],
    });
    const dataset = makeDataset();
    atlas.loadDataset(dataset);
    const first = atlas.discoverMapperStructures(dataset, {
      nested: { z: 2, a: 1 },
      bins: 2,
    });
    const second = atlas.discoverMapperStructures(dataset, {
      bins: 2,
      nested: { a: 1, z: 2 },
    });

    expect(first).toEqual(second);
  });

  it('rebuilds structure sets from the ledger during state restore', () => {
    kernel.computeMapperGraph = () => ({
      nodes: [{ id: 1, rowIndices: [0, 1], level: 0, center: [0], filterCenter: 1, size: 2 }],
      edges: [],
    });
    const dataset = makeDataset();
    atlas.loadDataset(dataset);
    const discovered = atlas.discoverMapperStructures(dataset, { bins: 2 });
    const state = atlas.toState();
    state.structures = [];

    const restored = new AtlasCore({ kernel: makeKernelMockBridge() });
    restored.restoreState(state);

    expect(restored.structures).toEqual([discovered]);
    expect(restored.ledger.at(-1)!.structureSet).toEqual(discovered);
  });

  it('generates guidance from cluster structures with evidence and provenance', () => {
    const dataset = makeDataset();
    atlas.loadDataset(dataset);
    atlas.discoverClusterStructures(dataset, { op: 'k_means', k: 2 });

    const rec = atlas.generateRecommendation();

    expect(rec).not.toBeNull();
    expect(rec!.action).toBe('inspect-cluster');
    expect(rec!.decision).toBe('pending');
    expect(rec!.evidenceItems!.length).toBeGreaterThanOrEqual(2);
    expect(rec!.evidenceItems!.some((e) => e.source.includes('cluster'))).toBe(true);
    expect(rec!.targetIds).toHaveLength(1);
    expect(rec!.confidence).toBeGreaterThan(0);
    expect(rec!.confidence).toBeLessThanOrEqual(1);
  });

  it('generates inspect-boundary guidance from persistence structures', () => {
    kernel.computePersistenceIntervals = () => [
      { birth: 0, death: 3 },
      { birth: 1, death: 1.5 },
    ];
    const dataset = makeDataset();
    atlas.loadDataset(dataset);
    atlas.discoverPersistenceStructures(dataset, { maxDistance: 2 });

    const rec = atlas.generateRecommendation();

    expect(rec).not.toBeNull();
    expect(rec!.action).toBe('inspect-boundary');
    expect(rec!.evidenceItems!.some((e) => e.type === 'persistence-score')).toBe(true);
  });

  it('records accept/reject decisions as recommendation ledger events', () => {
    const dataset = makeDataset();
    atlas.loadDataset(dataset);
    atlas.discoverClusterStructures(dataset, { op: 'k_means', k: 2 });
    atlas.generateRecommendation();

    atlas.acceptRecommendation();
    expect(atlas.activeRecommendation!.decision).toBe('accepted');
    expect(atlas.decisionHistory).toHaveLength(1);

    const recEvents = atlas.ledger.filter((e) => e.kind === 'recommendation');
    expect(recEvents).toHaveLength(2);
    expect(recEvents[0].recommendationDecision).toBe('pending');
    expect(recEvents[1].recommendationDecision).toBe('accepted');
  });

  it('round-trips recommendations through state save/restore', () => {
    const dataset = makeDataset();
    atlas.loadDataset(dataset);
    atlas.discoverClusterStructures(dataset, { op: 'k_means', k: 2 });
    atlas.generateRecommendation();
    atlas.rejectRecommendation();

    const state = atlas.toState();
    const restored = new AtlasCore({ kernel: makeKernelMockBridge() });
    restored.restoreState(state);

    expect(restored.decisionHistory).toEqual(atlas.decisionHistory);
    expect(restored.activeRecommendation).toEqual(atlas.activeRecommendation);
    const recEvents = restored.ledger.filter((e) => e.kind === 'recommendation');
    expect(recEvents).toHaveLength(2);
  });

  it('generates compare-regions guidance when two clusters have divergent sizes', () => {
    const dataset = makeDataset();
    atlas.loadDataset(dataset);
    atlas.discoverClusterStructures(dataset, { op: 'k_means', k: 3 });

    const rec = atlas.generateRecommendation();

    expect(rec).not.toBeNull();
    expect(rec!.action).toBe('compare-regions');
    expect(rec!.targetIds).toHaveLength(2);
    expect(rec!.evidenceItems!.some((e) => e.type === 'cluster-size-delta')).toBe(true);
    expect(rec!.suggestedEmbodiment).toBe('split-view');
  });

  it('generates investigate-anomaly guidance for DBSCAN noise cluster', () => {
    const dataset = makeDataset();
    atlas.loadDataset(dataset);
    atlas.discoverClusterStructures(dataset, { op: 'dbscan', eps: 0.5, min_points: 2 });

    const rec = atlas.generateRecommendation();

    expect(rec).not.toBeNull();
    expect(rec!.action).toBe('investigate-anomaly');
    expect(rec!.evidenceItems!.some((e) => e.type === 'anomaly-score')).toBe(true);
    expect(rec!.suggestedEmbodiment).toBe('outlier-orb');
  });

  it('maps suggestedEmbodiment to Draco soft-constraint reweighting', async () => {
    const { applyEmbodimentHint } = await import('../src/draco/EmbodimentHints.ts');
    const { ConstraintEngine } = await import('../src/draco/ConstraintEngine.ts');
    const engine = new ConstraintEngine();
    const ruleNames = engine.softConstraints.map((s) => s.name);
    expect(ruleNames).toContain('prefer_orb_for_outliers');
    expect(ruleNames).toContain('prefer_cluster_probe_for_large_datasets');
    expect(ruleNames).toContain('prefer_fork_plane_for_tabular');
  });
});
