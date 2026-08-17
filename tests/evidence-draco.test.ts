import { describe, it, expect, beforeEach } from 'vitest';
import { EvidenceStore, EvidenceWeightedScorer } from '../src/draco/evidence/index.ts';
import type { DracoSpec, SolverResult } from '../src/draco/types.ts';
import type { StudySessionExport } from '../src/study/types.ts';

describe('Evidence-Informed Draco Recommender Loop', () => {
  let store: EvidenceStore;
  let scorer: EvidenceWeightedScorer;

  const mockSpecA: DracoSpec = {
    layout: 'FORCE_DIRECTED_3D',
    geometry: 'ICOSA_NODE',
    behavior: 'STATIC',
    interaction: 'INSPECT_CELL',
  };

  const mockSpecB: DracoSpec = {
    layout: 'GRID_3D',
    geometry: 'CUBE_MATRIX',
    behavior: 'STATIC',
    interaction: 'INSPECT_CELL',
  };

  beforeEach(() => {
    store = new EvidenceStore();
    scorer = new EvidenceWeightedScorer(store);
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

  it('adjusts Draco candidate scores based on empirical evidence', () => {
    // Populate store with 10 high-utility trials for Spec A
    for (let i = 0; i < 10; i++) {
      store.recordOutcome({
        trialId: `t-${i}`,
        datasetFingerprint: 'fp-1',
        condition: 'vr_experimental',
        taskType: 'anomaly_identification',
        spec: mockSpecA,
        accuracy: 1.0,
        precision: 1.0,
        recall: 1.0,
        f1: 1.0,
        durationMs: 10_000,
        nasaTlxAverage: 15,
        timestamp: Date.now(),
      });
    }

    const { adjustedScore, empiricalDelta } = scorer.adjustCandidateScore(mockSpecA, 50);

    // High empirical utility (>0.5) should reduce the penalty score
    expect(adjustedScore).toBeLessThan(50);
    expect(empiricalDelta).toBeLessThan(0);
  });

  it('re-ranks candidates placing empirically superior specs first', () => {
    // Populate store with high utility for Spec A and low utility for Spec B
    for (let i = 0; i < 10; i++) {
      store.recordOutcome({
        trialId: `t-a-${i}`,
        datasetFingerprint: 'fp-1',
        condition: 'vr_experimental',
        taskType: 'anomaly',
        spec: mockSpecA,
        accuracy: 1.0,
        precision: 1.0,
        recall: 1.0,
        f1: 1.0,
        durationMs: 10_000,
        nasaTlxAverage: 10,
        timestamp: Date.now(),
      });
      store.recordOutcome({
        trialId: `t-b-${i}`,
        datasetFingerprint: 'fp-1',
        condition: '2d_control',
        taskType: 'anomaly',
        spec: mockSpecB,
        accuracy: 0.2,
        precision: 0.2,
        recall: 0.2,
        f1: 0.2,
        durationMs: 100_000,
        nasaTlxAverage: 90,
        timestamp: Date.now(),
      });
    }

    const candidates: SolverResult[] = [
      { spec: mockSpecB, score: 20, explanation: [] },
      { spec: mockSpecA, score: 25, explanation: [] },
    ];

    const reRanked = scorer.reRankCandidates(candidates);

    // Even though Spec B had a slightly better initial score (20 vs 25),
    // Spec A's overwhelming empirical superiority should rank it first.
    expect(reRanked[0].spec).toEqual(mockSpecA);
  });
});
