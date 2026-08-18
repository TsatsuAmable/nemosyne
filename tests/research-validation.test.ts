// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { EvidenceHierarchyRegistry } from '../src/types/EvidenceHierarchy.ts';
import { UserJourneyScoreCalculator } from '../src/vr/trace/UserJourneyScore.ts';
import { StudyTrialExecutionHarness } from '../src/study/StudyHarness.ts';

describe('Research Validation & Evidence Framework', () => {
  describe('5-Level Evidence Hierarchy', () => {
    it('enforces hierarchy progression from IMPLEMENTED to SUPERIOR', () => {
      const registry = new EvidenceHierarchyRegistry();

      registry.register({
        featureId: 'draco_recommender',
        name: 'Draco Constraint Solver',
        level: 'TESTED',
        validatedBy: 'unit_tests_golden_pairs',
        lastAuditedTimestamp: Date.now(),
      });

      registry.register({
        featureId: 'find_fraud_crossover',
        name: 'Fraud Detection Crossover Study',
        level: 'SUPERIOR',
        validatedBy: 'controlled_study_n24',
        lastAuditedTimestamp: Date.now(),
      });

      expect(registry.satisfiesLevel('draco_recommender', 'IMPLEMENTED')).toBe(true);
      expect(registry.satisfiesLevel('draco_recommender', 'TESTED')).toBe(true);
      expect(registry.satisfiesLevel('draco_recommender', 'SUPERIOR')).toBe(false);

      expect(registry.satisfiesLevel('find_fraud_crossover', 'SUPERIOR')).toBe(true);
    });
  });

  describe('User Journey Score (UX-Cost Composite)', () => {
    it('computes phase breakdown and identifies dominant friction source', () => {
      const calculator = new UserJourneyScoreCalculator();

      const report = calculator.calculate({
        learningCostMs: 1000,
        navigationCostMs: 8000, // Dominant friction
        interactionCostMs: 2000,
        interpretationCostMs: 5000,
        evidenceCostMs: 4000,
      });

      expect(report.totalCostMs).toBe(20000);
      expect(report.dominantCostPhase).toBe('navigationCostMs');
      expect(report.percentageByPhase.navigationCostMs).toBe(40);
      expect(report.efficiencyIndex).toBeCloseTo(9000 / 11000, 2);
    });
  });

  describe('2D-vs-VR Comparative Study Harness', () => {
    it('executes trial lifecycle and captures outcomes, timer, and workload', () => {
      const harness = new StudyTrialExecutionHarness();

      harness.startTrial(
        {
          trialId: 'TRIAL_001',
          datasetId: 'FRAUD_NETWORK',
          taskType: 'anomaly_detection',
          condition: 'VR_EXPERIMENTAL',
          prompt: 'Identify the primary fraud ring hub node ID',
          groundTruthAnswer: 'NODE_42',
        },
        1000
      );

      expect(harness.activeTrial?.trialId).toBe('TRIAL_001');

      const result = harness.completeTrial(
        {
          participantAnswer: 'node_42', // case-insensitive match
          confidenceScore: 6,
          perceivedWorkloadNASA_TLX: 35,
          interactionEventsCount: 14,
        },
        7500
      );

      expect(result.isCorrect).toBe(true);
      expect(result.durationMs).toBe(6500);
      expect(result.confidenceScore).toBe(6);
      expect(result.workloadScore).toBe(35);
      expect(harness.activeTrial).toBeNull();
    });
  });
});
