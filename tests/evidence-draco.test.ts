// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { EvidenceStore } from '../src/moneta/evidence/index.ts';
import type { DracoSpec } from '../src/moneta/types.ts';
import type { StudySessionExport } from '../src/study/types.ts';

// The EvidenceWeightedScorer TypeScript re-ranking implementation was removed
// (TEC2): the sample-count cost adjustment is owned solely by the Rust kernel
// (`draco_adjust_evidence`), reached through the RuntimeBridge. The tests here
// cover EvidenceStore itself, which aggregates investigator study outcomes into
// the empirical input (`sampleCount`, `compositeUtility`) that the Rust
// authority consumes. No TypeScript cost-adjustment or candidate-ranking
// formula may be reintroduced; `tests/moneta-evidence-scorer-authority.test.ts`
// fails if one reappears.

describe('Evidence-Informed Draco Recommender Loop', () => {
  let store: EvidenceStore;

  const mockSpecA: DracoSpec = {
    layout: 'FORCE_DIRECTED_3D',
    geometry: 'ICOSA_NODE',
    behavior: 'STATIC',
    interaction: 'INSPECT_CELL',
  };

  beforeEach(() => {
    store = new EvidenceStore();
  });

  it('records individual empirical outcomes and computes composite utility', () => {
    store.recordOutcome({
      trialId: 't1',
      datasetFingerprint: 'fp-1',
      condition: 'vr_experimental',
      taskType: 'anomaly_identification',
      spec: mockSpecA,
      accuracy: 1.0,
      precision: 1.0,
      recall: 1.0,
      f1: 1.0,
      durationMs: 15_000,
      nasaTlxAverage: 20,
      timestamp: Date.now(),
    });

    const utilities = store.computeUtilityScores();
    const key = store.getSpecKey(mockSpecA);
    const score = utilities.get(key);

    expect(score).toBeDefined();
    expect(score?.meanAccuracy).toBe(1.0);
    expect(score?.meanF1).toBe(1.0);
    expect(score?.compositeUtility).toBeGreaterThan(0.8);
    // Sample count is carried as bounded support for the empirical input; it is
    // never labelled or treated as statistical confidence.
    expect(score?.sampleCount).toBe(1);
  });

  it('ingests a full StudySessionExport bundle', () => {
    const mockExport: StudySessionExport = {
      studyName: 'Find the Fraud',
      protocolVersion: '1.0.0-frozen',
      configHash: 'sha256-config-hash',
      participantId: 'P01',
      conditionOrder: ['vr_experimental'],
      sessionStartTime: Date.now() - 60_000,
      sessionEndTime: Date.now(),
      trials: [
        {
          trialId: 'tr-1',
          participantId: 'P01',
          condition: 'vr_experimental',
          taskId: 'task_fraud_detection_1',
          startTime: Date.now() - 30_000,
          endTime: Date.now() - 10_000,
          durationMs: 20_000,
          selectedNodeIds: ['acc_fraud_99'],
          groundTruthNodeIds: ['acc_fraud_99'],
          accuracy: 1.0,
          precision: 1.0,
          recall: 1.0,
          f1Score: 1.0,
          interactionCount: 5,
          navigationDistanceMeters: 2.5,
          confidenceRating: 7,
          workloadScore: 20,
          completed: true,
          exclusions: [],
        },
      ],
      events: [],
      provenanceHash: 'prov-hash-abc',
    };

    store.ingestStudySession(mockExport);
    expect(store.totalOutcomes).toBe(1);

    const utilities = store.computeUtilityScores();
    const condScore = utilities.get('condition:vr_experimental');
    expect(condScore).toBeDefined();
    expect(condScore?.meanF1).toBe(1.0);
    expect(condScore?.meanNasaTlx).toBe(20);
  });
});
