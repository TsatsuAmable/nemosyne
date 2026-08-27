/**
 * Tests for Gate 4 Evidence Entities (Observation, Finding, Annotation)
 * and in-VR Mark Moment workflow.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { AtlasCore, type WasmRuntimeBridgeFull } from '../src/atlas/AtlasCore.ts';
import { EvidenceLedger } from '../src/atlas/domain/EvidenceLedger.ts';
import { MarkMomentAction } from '../src/vr/interactions/MarkMomentAction.ts';
import { Dataset } from '../src/data/Dataset.ts';

function createMockBridge(): WasmRuntimeBridgeFull {
  return {
    isReady: () => true,
    capabilities: () => 0xff,
    loadDatasetJson: vi.fn().mockReturnValue(1),
    loadCsv: vi.fn().mockReturnValue(1),
    loadJson: vi.fn().mockReturnValue(1),
    loadSample: vi.fn().mockReturnValue(1),
    sampleKeys: () => [],
    destroyDataset: vi.fn(),
    runOperation: vi.fn().mockReturnValue(2),
    executeOperation: vi.fn().mockReturnValue({
      name: 'test-dataset',
      topology: 'TABULAR',
      columns: [{ name: 'x', type: 'float', values: [1, 2, 3] }],
    }),
    getDatasetJson: vi.fn().mockReturnValue({
      name: 'test-dataset',
      topology: 'TABULAR',
      columns: [{ name: 'x', type: 'float', values: [1, 2, 3] }],
    }),
    statistics: vi.fn().mockReturnValue({
      rowCount: 0,
      columnCount: 0,
      numeric: [],
      correlation: [],
      categorical: [],
      temporal: [],
      temporalStats: [],
    }),
    inferTopology: vi.fn().mockReturnValue('TABULAR'),
    inferEncodings: vi.fn().mockReturnValue({}),
    parseDatasetBytes: vi.fn().mockReturnValue({
      name: 'test-dataset',
      topology: 'TABULAR',
      columns: [{ name: 'x', type: 'float', values: [1, 2, 3] }],
    }),
    kernelProvenance: vi.fn().mockReturnValue({
      kernelVersion: '0.2.0',
      datasetFingerprint: 'mock-fp',
      timestamp: Date.now(),
    }),
  };
}

describe('Gate 4 Evidence Entities & Ledger', () => {
  let ledger: EvidenceLedger;

  beforeEach(() => {
    ledger = new EvidenceLedger();
  });

  it('records and queries observations with spatial context', () => {
    const obs = ledger.recordObservation(
      {
        notes: 'Outlier cluster isolated in quadrant 3',
        spatialContext: {
          position: [1.2, 1.6, -2.4],
          rotation: [0, 0.707, 0, 0.707],
          fov: 90,
        },
        targetIds: ['cluster-3', 'node-42'],
        datasetFingerprint: 'fp-1234',
        datasetVersion: 1,
        tags: ['anomaly', 'high-priority'],
      },
      'session-abc',
      'state-hash-1',
    );

    expect(obs.id).toBe('obs:session-abc:1');
    expect(obs.notes).toBe('Outlier cluster isolated in quadrant 3');
    expect(obs.spatialContext?.position).toEqual([1.2, 1.6, -2.4]);
    expect(ledger.observations.length).toBe(1);
    expect(ledger.observations[0]).toEqual(obs);

    // Verify corresponding event in the ledger
    const event = ledger.ledger.find((e) => e.kind === 'observation');
    expect(event).toBeDefined();
    expect(event?.observationEntity).toEqual(obs);
  });

  it('records findings and links supporting observations', () => {
    const obs1 = ledger.recordObservation(
      {
        notes: 'Bimodal distribution detected in revenue column',
        datasetFingerprint: 'fp-1234',
        datasetVersion: 1,
      },
      'session-abc',
    );
    const obs2 = ledger.recordObservation(
      {
        notes: 'Separate cluster in PCA projection',
        datasetFingerprint: 'fp-1234',
        datasetVersion: 1,
      },
      'session-abc',
    );

    const finding = ledger.recordFinding(
      {
        title: 'Customer Segmentation Distinctness',
        description: 'Dataset contains two distinct customer cohorts with differing purchasing power.',
        confidence: 'validated',
        observationIds: [obs1.id, obs2.id],
        resultIds: ['res-1'],
        datasetFingerprint: 'fp-1234',
        datasetVersion: 1,
      },
      'session-abc',
    );

    expect(finding.id).toBe('finding:session-abc:1');
    expect(finding.confidence).toBe('validated');
    expect(ledger.findings.length).toBe(1);

    const linkedObs = ledger.findObservationsForFinding(finding.id);
    expect(linkedObs.length).toBe(2);
    expect(linkedObs.map((o) => o.id)).toEqual([obs1.id, obs2.id]);
  });

  it('records annotations with 3D positions', () => {
    const annot = ledger.recordAnnotation(
      {
        text: 'Review outlier data integrity with domain expert',
        position: [0.5, 1.2, -1.0],
        targetId: 'node-99',
      },
      'session-abc',
      1,
      'fp-1234',
    );

    expect(annot.id).toBe('annot:session-abc:1');
    expect(annot.text).toBe('Review outlier data integrity with domain expert');
    expect(annot.position).toEqual([0.5, 1.2, -1.0]);
    expect(ledger.annotations.length).toBe(1);
  });
});

describe('AtlasCore Evidence API Integration', () => {
  it('records rich observations and findings through AtlasCore', () => {
    const bridge = createMockBridge();
    const atlas = new AtlasCore({ kernel: bridge });

    const ds = Dataset.fromJSON({
      name: 'finance-demo',
      topology: 'TABULAR',
      columns: [{ name: 'revenue', type: 'float', values: [100, 200, 300] }],
    });
    atlas.loadDataset(ds);

    const obs = atlas.recordObservation({
      notes: 'Cluster anomaly observed',
      spatialContext: { position: [0, 1.5, -2] },
    });

    expect(obs.id).toContain('obs:');
    expect(obs.datasetFingerprint).toBe(atlas.datasetFingerprint);
    expect(obs.datasetVersion).toBe(atlas.datasetVersion);

    const finding = atlas.recordFinding({
      title: 'High Variance Anomaly',
      description: 'Confirmed high variance in quadrant 2',
      confidence: 'preliminary',
      observationIds: [obs.id],
      resultIds: [],
    });

    expect(finding.id).toContain('finding:');
    expect(finding.observationIds).toContain(obs.id);
  });
});

describe('MarkMomentAction in VR', () => {
  it('captures spatial pose, triggers haptics, and logs to console', () => {
    const bridge = createMockBridge();
    const atlas = new AtlasCore({ kernel: bridge });

    const ds = Dataset.fromJSON({
      name: 'spatial-demo',
      topology: 'TABULAR',
      columns: [{ name: 'val', type: 'float', values: [10, 20] }],
    });
    atlas.loadDataset(ds);

    const camera = new THREE.PerspectiveCamera();
    camera.position.set(2.0, 1.6, -1.5);
    camera.quaternion.set(0, 0.382, 0, 0.924);

    const scene = new THREE.Scene();
    const feedback = {
      playHaptic: vi.fn(),
      playSelect: vi.fn(),
    };
    const logSpy = vi.fn();

    const obs = MarkMomentAction.execute({
      atlas,
      camera,
      scene,
      feedback,
      notes: 'Investigating high-density cluster at apex',
      targetIds: ['node-1', 'node-2'],
      onLogged: logSpy,
    });

    expect(obs.notes).toBe('Investigating high-density cluster at apex');
    expect(obs.spatialContext?.position).toEqual([2.0, 1.6, -1.5]);
    expect(feedback.playHaptic).toHaveBeenCalledWith(0.7, 80);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[Mark Moment] Recorded observation'));
  });
});
