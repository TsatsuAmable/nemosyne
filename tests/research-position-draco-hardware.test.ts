// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { PositionSemanticClassifier } from '../src/data/PositionSemanticClassifier.ts';
import { EvidenceInformedRecommender } from '../src/draco/EvidenceInformedRecommender.ts';
import { HardwareValidationMatrixRegistry } from '../src/types/HardwareValidationMatrix.ts';

describe('Position Semantics, Evidence-Informed Draco & Hardware Matrix', () => {
  describe('Position Semantic Discipline', () => {
    it('correctly categorizes position nature and metric similarity guarantees', () => {
      const classifier = new PositionSemanticClassifier();

      const timeRibbon = classifier.getContract('time_ribbon');
      expect(timeRibbon.nature).toBe('SEMANTIC');
      expect(classifier.isMetricSimilarityValid('time_ribbon')).toBe(true);

      const forceDirected = classifier.getContract('force_directed');
      expect(forceDirected.nature).toBe('LAYOUT');
      expect(classifier.isMetricSimilarityValid('force_directed')).toBe(false);

      const tdaMapper = classifier.getContract('tda_mapper');
      expect(tdaMapper.nature).toBe('STRUCTURAL');
    });
  });

  describe('Evidence-Informed Draco Loop', () => {
    it('adjusts recommendation weight based on empirical human outcome trials', () => {
      const recommender = new EvidenceInformedRecommender();

      // Before evidence
      const initial = recommender.computePreference('force_directed', 'GRAPH');
      expect(initial.empiricalAdjustment).toBe(0);
      expect(initial.finalWeight).toBe(1.0);

      // Record successful user trials
      for (let i = 0; i < 8; i++) {
        recommender.recordTrialEvidence({
          datasetTopology: 'GRAPH',
          recommendedLayout: 'force_directed',
          taskType: 'community_detection',
          isSuccessful: true,
          completionTimeMs: 4500,
          workloadScore: 25,
        });
      }

      // After evidence: weight increases
      const updated = recommender.computePreference('force_directed', 'GRAPH');
      expect(updated.empiricalAdjustment).toBeGreaterThan(0);
      expect(updated.finalWeight).toBeGreaterThan(1.0);
      expect(updated.trialCount).toBe(8);
    });
  });

  describe('Hardware Validation Matrix', () => {
    it('records and audits headset test suites', () => {
      const matrix = new HardwareValidationMatrixRegistry();

      matrix.recordRun({
        runId: 'RUN_Q3S_01',
        headset: 'META_QUEST_3S',
        suite: 'startup_lifecycle',
        firmwareVersion: 'v68.0',
        browserVersion: 'Chromium 128',
        passed: true,
        frameRateP50Fps: 90,
        frameRateP99Fps: 88,
        memoryUsedMb: 420,
        testedAt: Date.now(),
      });

      matrix.recordRun({
        runId: 'RUN_Q3S_02',
        headset: 'META_QUEST_3S',
        suite: 'scale_65k_nodes',
        firmwareVersion: 'v68.0',
        browserVersion: 'Chromium 128',
        passed: true,
        frameRateP50Fps: 72,
        frameRateP99Fps: 65,
        memoryUsedMb: 610,
        testedAt: Date.now(),
      });

      expect(matrix.isSuitePassingOnHeadset('META_QUEST_3S', 'startup_lifecycle')).toBe(true);
      expect(matrix.isSuitePassingOnHeadset('META_QUEST_3S', 'text_readability_contrast')).toBe(false);
      expect(matrix.getHeadsetCoverage('META_QUEST_3S')).toBe(0.2);
    });
  });
});
