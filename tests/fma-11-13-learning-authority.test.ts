/**
 * FMA-11 to FMA-13 Adversarial Verification Suite
 *
 * Verifies:
 * - FMA-11: Forma Knowledge Base case qualification requires genuine confirmed evidence;
 *   refuses ungrounded promotion where discoveryOutcomeCount is supplied without confirmed human critique
 *   or meaning judgment records; disallows default accuracyRate of 1.0 when meaning judgments are absent.
 * - FMA-12: Forma Prior Evaluator enforces explicit knownAnswerPassRate and abstentionComplianceRate measurements,
 *   computes group-level holdout metrics without synthetic division, and binds candidate weights and corpus identity
 *   to refuse candidate/dataset substitution during registry promotion.
 * - FMA-13: Forma Curated Learning Corpus excludes records lacking genuine feature snapshots (emitting typed issues
 *   without synthetic fallback features) and generates content-addressed corpusId binding all examples and issues.
 */

import { describe, expect, test } from 'vitest';
import { FormaKnowledgeStore } from '../src/moneta/forma/FormaKnowledgeBase.js';
import {
  recordEmbodimentCritique,
  recordHumanMeaningJudgment,
} from '../src/moneta/forma/FormaHumanFeedback.js';
import { FormaCuratedLearningCorpusBuilder } from '../src/learning/FormaCuratedLearningCorpus.js';
import type { PairwiseCandidateFeatureSnapshot } from '../src/fitness/PairwiseLearning.js';
import {
  FormaPriorEvaluator,
  BASELINE_FORMA_PRIOR_WEIGHTS,
} from '../src/learning/FormaPriorEvaluator.js';
import { FitnessModelRegistry } from '../src/fitness/FitnessModelRegistry.js';

describe('FMA-11 to FMA-13: Learning Authority & Knowledge Governance', () => {
  // FMA-11
  describe('FMA-11: Forma Knowledge Store Grounded Evidence Authority', () => {
    test('refuses ungrounded promotion where discoveryOutcomeCount alone is supplied without confirmed human testimony', () => {
      const store = new FormaKnowledgeStore('kb0-grounding-test');

      expect(() =>
        store.promoteCase({
          templateId: 'template-automated-discovery',
          bindingId: 'binding-auto-1',
          phenotype: 'SPATIAL_SCATTER_V1',
          discoveryOutcomeCount: 5, // high discovery outcome count, but 0 human testimony
        })
      ).toThrow(/0 confirmed human evidence records provided; count alone cannot substitute for attributable testimony/);
    });

    test('disallows default accuracyRate of 1.0 when meaning judgments are absent', () => {
      const store = new FormaKnowledgeStore('kb0-accuracy-test');

      const promoted = store.promoteCase({
        templateId: 'template-critique-only',
        bindingId: 'binding-critique-1',
        phenotype: 'SPATIAL_SCATTER_V1',
        critiques: [
          recordEmbodimentCritique({
            planId: 'plan-c1',
            sliceId: 'slice-c1',
            contextId: 'ctx-c1',
            semanticNodeId: 'node-c1',
            critiqueText: 'First confirmed critique on visual clarity',
            confirmed: true,
          }),
          recordEmbodimentCritique({
            planId: 'plan-c2',
            sliceId: 'slice-c2',
            contextId: 'ctx-c2',
            semanticNodeId: 'node-c2',
            critiqueText: 'Second confirmed critique on visual clarity',
            confirmed: true,
          }),
        ],
      });

      // accuracyRate must NOT default to 1.0 when meaning judgments are absent
      expect(promoted.evidenceBasis.meaningJudgmentCount).toBe(0);
      expect(promoted.evidenceBasis.accuracyRate).toBe(0.0);
      expect(promoted.status).toBe('QUALIFIED');
    });

    test('sets PROBATIONARY status when meaning judgments exist but accuracyRate is below 0.75', () => {
      const store = new FormaKnowledgeStore('kb0-probationary-test');

      const promoted = store.promoteCase({
        templateId: 'template-low-accuracy',
        bindingId: 'binding-low-1',
        phenotype: 'SPATIAL_SCATTER_V1',
        meaningJudgments: [
          recordHumanMeaningJudgment({
            representationId: 'rep-acc',
            versionIdentity: { kernelVersion: '1.0.0', monetaVersion: '1.0.0' },
            intendedSemanticMeaning: 'Cluster depth',
            perceivedMeaning: 'Cluster depth',
            taskComprehensionOutcome: 'ACCURATE',
            author: { researcherId: 'researcher-1' },
            confirmed: true,
          }),
          recordHumanMeaningJudgment({
            representationId: 'rep-mis1',
            versionIdentity: { kernelVersion: '1.0.0', monetaVersion: '1.0.0' },
            intendedSemanticMeaning: 'Cluster depth',
            perceivedMeaning: 'Unrelated noise',
            taskComprehensionOutcome: 'MISUNDERSTOOD',
            author: { researcherId: 'researcher-2' },
            confirmed: true,
          }),
        ],
      });

      expect(promoted.evidenceBasis.meaningJudgmentCount).toBe(2);
      expect(promoted.evidenceBasis.accuracyRate).toBe(0.5); // 1 / 2 = 50%
      expect(promoted.status).toBe('PROBATIONARY');
    });
  });

  // FMA-12
  describe('FMA-12: Forma Prior Evaluator Identity Binding & Measurement Gates', () => {
    function buildMockCorpus() {
      const builder = new FormaCuratedLearningCorpusBuilder({
        partitionSeed: 'holdout-seed-99',
        trainFraction: 0.20,
        validationFraction: 0.10,
        partitionStrategy: 'by-dataset',
      });

      const meaningJudgments = [];
      const snapshots = new Map<string, PairwiseCandidateFeatureSnapshot>();

      for (let i = 0; i < 15; i++) {
        meaningJudgments.push(
          recordHumanMeaningJudgment({
            representationId: `rep-holdout-${i}`,
            versionIdentity: { kernelVersion: '1.0.0', monetaVersion: '1.0.0' },
            intendedSemanticMeaning: `Semantic pattern ${i}`,
            perceivedMeaning: `Semantic pattern ${i}`,
            taskComprehensionOutcome: 'ACCURATE',
            author: { researcherId: `researcher-${i % 3}` },
            confirmed: true,
          })
        );

        const features =
          i % 2 === 0
            ? [0.3, 0.3, 0.2, 1.0]
            : [0.95, 0.85, 0.80, 0.5];

        snapshots.set(`rep-holdout-${i}`, {
          schemaVersion: '1.0.0',
          featureSchemaVersion: '1.0.0',
          graphId: `rep-holdout-${i}`,
          datasetFingerprint: `dataset-partition-${i}`,
          fitnessModelVersion: '1.0.0',
          features,
          bootstrapUtility: 0.5,
        });
      }

      return builder.build({
        meaningJudgments,
        featureSnapshots: snapshots,
      });
    }

    test('fails closed when knownAnswerPassRate or abstentionComplianceRate is omitted', () => {
      const evaluator = new FormaPriorEvaluator(BASELINE_FORMA_PRIOR_WEIGHTS, 1);
      const corpus = buildMockCorpus();

      const candidate = {
        intentRelevanceWeight: 0.5,
        budgetFitnessWeight: 0.3,
        templateParityWeight: 0.2,
      };

      // Missing knownAnswerPassRate
      const eval1 = evaluator.evaluate(candidate, corpus, {
        modelId: 'cand-1',
        modelVersion: '1.0.0',
        abstentionComplianceRate: 1.0,
      } as any);

      expect(eval1.passedGate).toBe(false);
      expect(eval1.refusalReasons).toContain(
        'Missing required evaluation: knownAnswerPassRate must be explicitly measured'
      );

      // Missing abstentionComplianceRate
      const eval2 = evaluator.evaluate(candidate, corpus, {
        modelId: 'cand-2',
        modelVersion: '1.0.0',
        knownAnswerPassRate: 1.0,
      } as any);

      expect(eval2.passedGate).toBe(false);
      expect(eval2.refusalReasons).toContain(
        'Missing required evaluation: abstentionComplianceRate must be explicitly measured'
      );
    });

    test('computes actual holdoutGroupCount and leaveOneGroupOutImprovementFloor from partition groups', () => {
      const evaluator = new FormaPriorEvaluator(BASELINE_FORMA_PRIOR_WEIGHTS, 1);
      const corpus = buildMockCorpus();

      const candidate = {
        intentRelevanceWeight: 0.6,
        budgetFitnessWeight: 0.2,
        templateParityWeight: 0.2,
      };

      const result = evaluator.evaluate(candidate, corpus, {
        modelId: 'cand-groups',
        modelVersion: '1.0.0',
        knownAnswerPassRate: 1.0,
        abstentionComplianceRate: 1.0,
      });

      // Verify that holdoutGroupCount corresponds to actual unique partitionGroups
      const holdoutGroups = new Set(corpus.examples.filter((e) => e.partition === 'holdout').map((e) => e.partitionGroup));
      expect(result.holdoutGroupCount).toBe(holdoutGroups.size);
      expect(result.holdoutGroupCount).toBeGreaterThan(0);
      expect(typeof result.leaveOneGroupOutImprovementFloor).toBe('number');
    });

    test('refuses promotion when candidate weights are substituted', () => {
      const evaluator = new FormaPriorEvaluator(BASELINE_FORMA_PRIOR_WEIGHTS, 1);
      const corpus = buildMockCorpus();
      const registry = new FitnessModelRegistry();

      const evaluatedCandidate = {
        intentRelevanceWeight: 0.60,
        budgetFitnessWeight: 0.25,
        templateParityWeight: 0.15,
        caseBasedBonusWeight: 0.40,
      };

      const evaluation = evaluator.evaluate(evaluatedCandidate, corpus, {
        modelId: 'cand-sub',
        modelVersion: '1.0.0',
        knownAnswerPassRate: 1.0,
        abstentionComplianceRate: 1.0,
      });

      const substitutedCandidate = {
        intentRelevanceWeight: 0.90, // substituted!
        budgetFitnessWeight: 0.05,
        templateParityWeight: 0.05,
        caseBasedBonusWeight: 0.40,
      };

      expect(() =>
        evaluator.promoteToRegistry(
          substitutedCandidate,
          evaluation,
          registry,
          corpus.corpusId,
          'policy-hash-001'
        )
      ).toThrow(/Candidate weights do not match evaluated weights: candidate substitution refused/);
    });

    test('refuses promotion when training dataset hash does not match evaluated corpus', () => {
      const evaluator = new FormaPriorEvaluator(BASELINE_FORMA_PRIOR_WEIGHTS, 1);
      const corpus = buildMockCorpus();
      const registry = new FitnessModelRegistry();

      const candidate = {
        intentRelevanceWeight: 0.60,
        budgetFitnessWeight: 0.25,
        templateParityWeight: 0.15,
        caseBasedBonusWeight: 0.40,
      };

      const evaluation = evaluator.evaluate(candidate, corpus, {
        modelId: 'cand-valid',
        modelVersion: '1.0.0',
        knownAnswerPassRate: 1.0,
        abstentionComplianceRate: 1.0,
      });

      expect(() =>
        evaluator.promoteToRegistry(
          candidate,
          evaluation,
          registry,
          'substituted-corpus-hash-999',
          'policy-hash-001'
        )
      ).toThrow(/Training dataset hash \(substituted-corpus-hash-999\) does not match evaluated corpus/);
    });
  });

  // FMA-13
  describe('FMA-13: Forma Curated Learning Corpus Feature & Identity Rigor', () => {
    test('excludes judgments lacking feature snapshots and emits MISSING_FEATURE_SNAPSHOT issue', () => {
      const builder = new FormaCuratedLearningCorpusBuilder({
        partitionSeed: 'seed-fma13',
        trainFraction: 0.7,
        validationFraction: 0.15,
        partitionStrategy: 'by-dataset',
      });

      const judgmentWithoutSnapshot = recordHumanMeaningJudgment({
        representationId: 'rep-missing-snapshot',
        versionIdentity: { kernelVersion: '1.0.0', monetaVersion: '1.0.0' },
        intendedSemanticMeaning: 'Cluster significance',
        perceivedMeaning: 'Cluster significance',
        taskComprehensionOutcome: 'ACCURATE',
        author: { researcherId: 'researcher-alpha' },
        confirmed: true,
      });

      // No feature snapshot provided for rep-missing-snapshot
      const corpus = builder.build({
        meaningJudgments: [judgmentWithoutSnapshot],
        featureSnapshots: new Map(),
      });

      // Must NOT include the example with synthetic fallback features
      expect(corpus.examples.length).toBe(0);
      expect(corpus.issues.length).toBe(1);
      expect(corpus.issues[0].reason).toBe('MISSING_FEATURE_SNAPSHOT');
      expect(corpus.issues[0].detail).toContain('rep-missing-snapshot');
    });

    test('corpusId binds all example records and labels (altering a label alters corpusId)', () => {
      const builder = new FormaCuratedLearningCorpusBuilder({
        partitionSeed: 'seed-fma13-hash',
        trainFraction: 0.7,
        validationFraction: 0.15,
        partitionStrategy: 'by-dataset',
      });

      const snapshots = new Map<string, PairwiseCandidateFeatureSnapshot>([
        [
          'rep-alpha',
          {
            schemaVersion: '1.0.0',
            featureSchemaVersion: '1.0.0',
            graphId: 'rep-alpha',
            datasetFingerprint: 'ds-alpha',
            fitnessModelVersion: '1.0.0',
            features: [0.8, 0.7, 0.6, 0.5],
            bootstrapUtility: 0.7,
          },
        ],
      ]);

      const accurateJudgment = recordHumanMeaningJudgment({
        representationId: 'rep-alpha',
        versionIdentity: { kernelVersion: '1.0.0', monetaVersion: '1.0.0' },
        intendedSemanticMeaning: 'Depth map',
        perceivedMeaning: 'Depth map',
        taskComprehensionOutcome: 'ACCURATE',
        author: { researcherId: 'researcher-1' },
        confirmed: true,
      });

      const misunderstoodJudgment = recordHumanMeaningJudgment({
        representationId: 'rep-alpha',
        versionIdentity: { kernelVersion: '1.0.0', monetaVersion: '1.0.0' },
        intendedSemanticMeaning: 'Depth map',
        perceivedMeaning: 'Inverted height',
        taskComprehensionOutcome: 'MISUNDERSTOOD',
        author: { researcherId: 'researcher-1' },
        confirmed: true,
      });

      const corpusAccurate = builder.build({
        meaningJudgments: [accurateJudgment],
        featureSnapshots: snapshots,
      });

      const corpusMisunderstood = builder.build({
        meaningJudgments: [misunderstoodJudgment],
        featureSnapshots: snapshots,
      });

      // Both should have 1 example
      expect(corpusAccurate.examples.length).toBe(1);
      expect(corpusMisunderstood.examples.length).toBe(1);

      // But distinct target labels must produce distinct content-addressed corpusIds
      expect(corpusAccurate.examples[0].targetLabel).toBe(1.0);
      expect(corpusMisunderstood.examples[0].targetLabel).toBe(0.0);
      expect(corpusAccurate.corpusId).not.toBe(corpusMisunderstood.corpusId);
    });
  });
});
