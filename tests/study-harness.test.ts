// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import {
  Counterbalancer,
  ExperimentRunner,
  GROUND_TRUTH_FRAUD_IDS,
  SYNTHETIC_TRANSACTION_FRAUD_DATASET,
  FROZEN_STUDY_TASKS,
  FROZEN_STUDY_CONDITIONS,
  FROZEN_PROTOCOL_VERSION,
} from '../src/study/index.ts';

describe('Atlas 6: Controlled Experiment Harness', () => {
  describe('Counterbalancer & Latin Square Sequencing', () => {
    it('generates balanced 2x2 crossover sequences for 2 conditions', () => {
      const cb = new Counterbalancer(['2d_control', 'vr_experimental']);
      const seqs = cb.sequences;

      expect(seqs).toHaveLength(2);
      expect(seqs[0]).toEqual(['2d_control', 'vr_experimental']);
      expect(seqs[1]).toEqual(['vr_experimental', '2d_control']);
    });

    it('generates balanced Latin Square for 3 conditions (Williams square)', () => {
      const cb = new Counterbalancer(['2d_control', 'vr_experimental', 'vr_guided']);
      const seqs = cb.sequences;

      // For odd N (3), produces 2N = 6 sequences to balance first-order carryover
      expect(seqs).toHaveLength(6);

      // Verify every condition appears exactly once in each row
      for (const row of seqs) {
        expect(new Set(row).size).toBe(3);
      }
    });

    it('deterministically assigns participants to balanced cohorts', () => {
      const cb = new Counterbalancer(['2d_control', 'vr_experimental']);

      const p1 = cb.assignParticipant('participant-01');
      const p2 = cb.assignParticipant('participant-02');
      const p3 = cb.assignParticipant('participant-03');

      expect(p1.order).toEqual(['2d_control', 'vr_experimental']);
      expect(p1.cohort).toBe('Cohort-A');

      expect(p2.order).toEqual(['vr_experimental', '2d_control']);
      expect(p2.cohort).toBe('Cohort-B');

      expect(p3.order).toEqual(['2d_control', 'vr_experimental']);
      expect(p3.cohort).toBe('Cohort-A');
    });
  });

  describe('Seeded Study Datasets & Ground Truth', () => {
    it('provides synthetic transaction dataset matching schema and ground-truth nodes', () => {
      expect(SYNTHETIC_TRANSACTION_FRAUD_DATASET.rows.length).toBeGreaterThanOrEqual(10);
      expect(SYNTHETIC_TRANSACTION_FRAUD_DATASET.edges?.length).toBeGreaterThanOrEqual(5);

      const fraudNodes = SYNTHETIC_TRANSACTION_FRAUD_DATASET.rows.filter((n: any) => n.is_fraud);
      expect(fraudNodes.map((n: any) => n.id)).toEqual(GROUND_TRUTH_FRAUD_IDS);
    });
  });

  describe('ExperimentRunner Trial Lifecycle & Scoring Engine', () => {
    it('drives trial phases and scores perfect ground-truth match', () => {
      const runner = new ExperimentRunner();
      const assignment = runner.startParticipantSession('P-101');

      expect(assignment.participantId).toBe('P-101');
      expect(runner.currentPhase).toBe('idle');

      // Trial 1: Instruction phase
      const trial1 = runner.startNextTrial();
      expect(runner.currentPhase).toBe('instruction');
      expect(trial1.condition).toBe('2d_control');
      expect(trial1.task.id).toBe('task_fraud_detection_1');

      // Exploration phase
      runner.beginExploration();
      expect(runner.currentPhase).toBe('exploration');

      // Record navigation and selections
      runner.updateCameraPosition(0, 1.5, 0);
      runner.updateCameraPosition(2, 1.5, 3); // ~3.6 meters distance
      expect(runner.selectedNodeIds).toHaveLength(0);

      // Select all 3 true ground-truth fraud nodes
      for (const id of GROUND_TRUTH_FRAUD_IDS) {
        runner.selectNode(id);
      }
      expect(runner.selectedNodeIds).toEqual(GROUND_TRUTH_FRAUD_IDS);

      // Submit selections -> Survey phase
      const submitInfo = runner.submitTrialAnswers();
      expect(runner.currentPhase).toBe('survey');
      expect(submitInfo.selectedCount).toBe(3);

      // Finalize trial with Likert confidence (7) and NASA-TLX workload (25)
      const metrics = runner.finalizeTrial(7, 25);
      expect(metrics.accuracy).toBe(1.0);
      expect(metrics.precision).toBe(1.0);
      expect(metrics.recall).toBe(1.0);
      expect(metrics.f1Score).toBe(1.0);
      expect(metrics.confidenceRating).toBe(7);
      expect(metrics.workloadScore).toBe(25);
      expect(metrics.navigationDistanceMeters).toBeCloseTo(3.606, 2);
      expect(metrics.exclusions).toHaveLength(0);
      expect(runner.completedTrials).toHaveLength(1);
    });

    it('accurately calculates precision, recall, and F1 for partial matches', () => {
      const runner = new ExperimentRunner();
      runner.startParticipantSession('P-102');

      runner.startNextTrial();
      runner.beginExploration();

      // Target ground truth has 3 nodes: ['acc_fraud_99', 'acc_fraud_98', 'acc_fraud_97']
      // Participant selects 2 true positives + 1 false positive:
      runner.selectNode('acc_fraud_99'); // TP
      runner.selectNode('acc_fraud_98'); // TP
      runner.selectNode('acc_001');      // FP (acc_fraud_97 is FN)

      runner.submitTrialAnswers();
      const metrics = runner.finalizeTrial(5, 40);

      // TP = 2, FP = 1, FN = 1
      // Precision = 2 / 3 = 0.6667
      // Recall = 2 / 3 = 0.6667
      // F1 = 0.6667
      expect(metrics.precision).toBeCloseTo(0.6667, 3);
      expect(metrics.recall).toBeCloseTo(0.6667, 3);
      expect(metrics.f1Score).toBeCloseTo(0.6667, 3);
      expect(metrics.accuracy).toBeLessThan(1.0);
    });

    it('handles node deselection and interaction counting', () => {
      const runner = new ExperimentRunner();
      runner.startParticipantSession('P-103');

      runner.startNextTrial();
      runner.beginExploration();

      runner.selectNode('acc_001');
      expect(runner.selectedNodeIds).toContain('acc_001');

      runner.deselectNode('acc_001');
      expect(runner.selectedNodeIds).not.toContain('acc_001');

      runner.recordInteraction('filter_applied', { threshold: 0.5 });
      runner.selectNode('acc_fraud_99');

      runner.submitTrialAnswers();
      const metrics = runner.finalizeTrial(6, 30);

      expect(metrics.interactionCount).toBe(4); // 1 select + 1 deselect + 1 filter + 1 select
    });

    it('completes all conditions and tasks in counterbalanced sequence and exports study session', () => {
      const runner = new ExperimentRunner(FROZEN_STUDY_CONDITIONS, FROZEN_STUDY_TASKS);
      const assignment = runner.startParticipantSession('P-200');

      const expectedTotalTrials = FROZEN_STUDY_CONDITIONS.length * FROZEN_STUDY_TASKS.length; // 2 * 2 = 4

      for (let i = 0; i < expectedTotalTrials; i++) {
        expect(runner.isSessionCompleted).toBe(false);
        runner.startNextTrial();
        runner.beginExploration();
        runner.selectNode('acc_fraud_99');
        runner.submitTrialAnswers();
        runner.finalizeTrial(6, 20);
      }

      expect(runner.isSessionCompleted).toBe(true);
      expect(runner.completedTrials).toHaveLength(expectedTotalTrials);

      // Export session
      const studyExport = runner.exportStudySession();
      expect(studyExport.studyName).toBe('Find the Fraud');
      expect(studyExport.protocolVersion).toBe(FROZEN_PROTOCOL_VERSION);
      expect(studyExport.participantId).toBe('P-200');
      expect(studyExport.conditionOrder).toEqual(assignment.order);
      expect(studyExport.trials).toHaveLength(expectedTotalTrials);
      expect(studyExport.provenanceHash).toMatch(/^fnv1a-[0-9a-f]+$/);
    });

    it('rejects invalid participant IDs with invalid characters or excessive length', () => {
      const runner = new ExperimentRunner(FROZEN_STUDY_CONDITIONS, FROZEN_STUDY_TASKS);

      expect(() => runner.startParticipantSession('')).toThrow(/Invalid participantId/);
      expect(() => runner.startParticipantSession('../etc/passwd')).toThrow(/Invalid participantId/);
      expect(() => runner.startParticipantSession('P 01 with spaces')).toThrow(/Invalid participantId/);
      expect(() => runner.startParticipantSession('a'.repeat(65))).toThrow(/Invalid participantId/);
      expect(() => runner.startParticipantSession('valid-P_01')).not.toThrow();
    });
  });
});
