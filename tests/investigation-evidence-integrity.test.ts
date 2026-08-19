// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset } from '../src/data/Dataset.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';

describe('Investigation & Evidence Integrity (Gate 1 & Gate 4 Hardening)', () => {
  let atlas: AtlasCore;
  let mockBridge: any;

  beforeEach(() => {
    mockBridge = makeKernelMockBridge();
    atlas = new AtlasCore({ kernel: mockBridge, sessionId: 'test-session-1' });
  });

  it('enforces total evidence isolation when loading a new dataset (Investigation A -> Investigation B)', () => {
    const datasetA = Dataset.fromJSON({
      name: 'DatasetA',
      columns: [{ name: 'val', type: 'number' }],
      rows: [{ val: 10 }, { val: 20 }],
    });
    atlas.loadDataset(datasetA);

    // Record evidence in Investigation A
    const obsA = atlas.recordObservation('High density cluster detected in Region A');
    const findingA = atlas.recordFinding({
      title: 'Anomaly in A',
      description: 'Variance spike in val column',
      confidence: 'validated',
      observationIds: [obsA.id],
      resultIds: [],
    });
    const annotA = atlas.recordAnnotation({
      text: 'Flagged by Analyst 1',
      position: [1, 2, 3],
    });

    expect(atlas.observations.length).toBe(1);
    expect(atlas.findings.length).toBe(1);
    expect(atlas.annotations.length).toBe(1);
    expect(atlas.evidenceLedger.observations.length).toBe(1);

    // Load Dataset B (New Investigation)
    const datasetB = Dataset.fromJSON({
      name: 'DatasetB',
      columns: [{ name: 'score', type: 'number' }],
      rows: [{ score: 100 }, { score: 200 }],
    });
    atlas.loadDataset(datasetB);

    // INVARIANT: All evidence from Investigation A must be completely absent
    expect(atlas.observations.length).toBe(0);
    expect(atlas.findings.length).toBe(0);
    expect(atlas.annotations.length).toBe(0);
    expect(atlas.evidenceLedger.observations.length).toBe(0);
    expect(atlas.evidenceLedger.findings.length).toBe(0);
    expect(atlas.evidenceLedger.annotations.length).toBe(0);
    expect(atlas.results.length).toBe(0);

    // Recording new evidence in Investigation B starts with clean monotonic counter
    const obsB = atlas.recordObservation('Fresh observation in B');
    expect(obsB.id).toBe('obs:test-session-1:1');
  });

  it('preserves and restores observations, findings, and annotations across state serialization roundtrip', () => {
    const dataset = Dataset.fromJSON({
      name: 'FinancialSeries',
      columns: [{ name: 'x', type: 'number' }, { name: 'y', type: 'number' }],
      rows: [{ x: 1, y: 2 }, { x: 3, y: 4 }],
    });
    atlas.loadDataset(dataset);

    const obs1 = atlas.recordObservation({
      notes: 'Outlier point at x=3',
      rowIndices: [1],
      spatialContext: { position: [0.5, 1.2, -0.8] },
    });
    const finding1 = atlas.recordFinding({
      title: 'Structural Break',
      description: 'Slope changes abruptly at step 2',
      confidence: 'definitive',
      observationIds: [obs1.id],
      resultIds: [],
    });
    const annot1 = atlas.recordAnnotation({
      text: 'Anchor point for verification',
      position: [0.5, 1.2, -0.8],
      targetId: 'node-3',
    });

    const exportedState = atlas.toState();
    expect(exportedState.observations?.length).toBe(1);
    expect(exportedState.findings?.length).toBe(1);
    expect(exportedState.annotations?.length).toBe(1);

    // Reconstitute into a clean AtlasCore instance
    const freshAtlas = new AtlasCore({ kernel: mockBridge, sessionId: 'test-session-1' });
    freshAtlas.restoreState(exportedState);

    expect(freshAtlas.observations.length).toBe(1);
    expect(freshAtlas.observations[0].id).toBe(obs1.id);
    expect(freshAtlas.observations[0].notes).toBe('Outlier point at x=3');
    expect(freshAtlas.findings.length).toBe(1);
    expect(freshAtlas.findings[0].title).toBe('Structural Break');
    expect(freshAtlas.annotations.length).toBe(1);
    expect(freshAtlas.annotations[0].text).toBe('Anchor point for verification');

    // Next recorded observation continues with non-colliding monotonic counter
    const obs2 = freshAtlas.recordObservation('Subsequent observation');
    expect(obs2.id).toBe('obs:test-session-1:2');
  });
});
