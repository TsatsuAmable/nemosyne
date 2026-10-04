import { describe, test, expect } from 'vitest';
import {
  FormaKnowledgeStore,
} from '../src/moneta/forma/FormaKnowledgeBase.ts';
import {
  recordEmbodimentCritique,
  recordHumanMeaningJudgment,
} from '../src/moneta/forma/FormaHumanFeedback.ts';
import {
  FormaCuratedLearningCorpusBuilder,
} from '../src/learning/FormaCuratedLearningCorpus.ts';
import {
  FormaPriorEvaluator,
  BASELINE_FORMA_PRIOR_WEIGHTS,
} from '../src/learning/FormaPriorEvaluator.ts';
import { FitnessModelRegistry } from '../src/fitness/FitnessModelRegistry.ts';
import { FormaSystem1Proposer } from '../src/moneta/forma/FormaSystem1Proposer.ts';
import { DESKTOP_EXPANSIVE_BUDGET } from '../src/moneta/forma/FormaResolutionBroker.ts';
import { createKB0Manifest } from '../src/moneta/forma/KB0Manifest.ts';
import { normalizeEnvelopeToSnapshot } from '../src/moneta/representation/SemanticSnapshotV1.ts';
import type { SemanticEmbodimentEnvelopeV1 } from '../src/moneta/representation/SemanticEmbodimentPayload.ts';
import { canonicalizeCommittedInvestigationContext } from '../src/atlas/domain/CommittedInvestigationContext.ts';

describe('FM6-R6: Learned-Prior Product Qualification Battery', () => {
  function makeTestEnvelope(id: string): SemanticEmbodimentEnvelopeV1 {
    return {
      schemaVersion: 1,
      datasetFingerprint: `sha256-dataset-${id}`,
      candidateId: 'AGGREGATE_VOLUME',
      representationFamily: 'AGGREGATE',
      analyticalMethod: {
        name: 'aggregateVolume',
        version: '1.0.0',
        parameters: { groupingFields: ['region'], measure: 'COUNT' },
      },
      approximation: { mode: 'EXACT', representedRowCount: 1000 },
      informationContract: {
        preserves: ['exact-metric-values'],
        loses: ['individual-observation-identity'],
      },
      resource: { sourceRowCount: 1000, elementCount: 2, maxElementCount: 4096 },
      provenance: {
        kernelVersion: '1.0.0',
        algorithmVersion: '1.0.0',
        decisionId: `decision-${id}`,
        decisionModelVersion: 'onnx-v2',
        decisionModelArtifactHash: `hash-${id}`,
      },
      result: {
        status: 'READY',
        payload: {
          kind: 'AGGREGATE_VOLUME',
          data: {
            groupingFields: ['region'],
            measure: { function: 'COUNT' },
            groups: [
              { semanticId: 'group-north', key: 'North', count: 600 },
              { semanticId: 'group-south', key: 'South', count: 400 },
            ],
          },
        },
      },
    };
  }

  test('1. Evaluation Gate: regressed candidates fail closed while superior candidates pass', () => {
    const evaluator = new FormaPriorEvaluator(BASELINE_FORMA_PRIOR_WEIGHTS, 3);
    const registry = new FitnessModelRegistry();

    const builder = new FormaCuratedLearningCorpusBuilder({
      partitionSeed: 'fm6-qual-seed-01',
      trainFraction: 0.2,
      validationFraction: 0.1,
      partitionStrategy: 'by-dataset',
    });

    const meaningJudgments = [];
    const snapshots = new Map();

    for (let i = 0; i < 12; i++) {
      const repId = `rep-eval-${i}`;
      meaningJudgments.push(
        recordHumanMeaningJudgment({
          representationId: repId,
          versionIdentity: { kernelVersion: '1.0.0', monetaVersion: '1.0.0' },
          intendedSemanticMeaning: `Semantic pattern ${i}`,
          perceivedMeaning: `Semantic pattern ${i}`,
          taskComprehensionOutcome: 'ACCURATE',
          author: { researcherId: `researcher-${i % 2}` },
          confirmed: true,
        })
      );

      snapshots.set(repId, {
        schemaVersion: '1.0.0' as const,
        featureSchemaVersion: '1.0.0' as const,
        graphId: repId,
        datasetFingerprint: `dataset-partition-${i}`,
        fitnessModelVersion: '1.0.0',
        features: i % 2 === 0 ? [0.3, 0.3, 0.2, 1.0] : [0.95, 0.85, 0.8, 0.5],
        bootstrapUtility: 0.8,
      });
    }

    const corpus = builder.build({ meaningJudgments, featureSnapshots: snapshots });
    expect(corpus.counts.holdout).toBeGreaterThanOrEqual(3);

    // Regressed candidate (low weights, knownAnswerPassRate < threshold)
    const regressedCandidate = {
      intentRelevanceWeight: 0.05,
      budgetFitnessWeight: 0.05,
      templateParityWeight: 0.05,
    };
    const failedEval = evaluator.evaluate(regressedCandidate, corpus, {
      modelId: 'regressed-prior-v1',
      modelVersion: '1.0.0-regressed',
      knownAnswerPassRate: 0.7, // regressed below gate threshold
    });

    expect(failedEval.passedGate).toBe(false);
    expect(() =>
      evaluator.promoteToRegistry(
        regressedCandidate,
        failedEval,
        registry,
        corpus.corpusId,
        'policy-hash-01'
      )
    ).toThrow(/failed evaluation gate/);

    // Valid superior candidate
    const superiorCandidate = {
      intentRelevanceWeight: 0.55,
      budgetFitnessWeight: 0.3,
      templateParityWeight: 0.15,
      caseBasedBonusWeight: 0.35,
    };
    const passEval = evaluator.evaluate(superiorCandidate, corpus, {
      modelId: 'superior-prior-v1',
      modelVersion: '1.0.0-superior',
      knownAnswerPassRate: 1.0,
      abstentionComplianceRate: 1.0,
    });

    expect(passEval.passedGate).toBe(true);
    const artifact = evaluator.promoteToRegistry(
      superiorCandidate,
      passEval,
      registry,
      corpus.corpusId,
      'policy-hash-01'
    );
    expect(registry.active?.artifactHash).toBe(artifact.artifactHash);
  });

  test('2. Product Influence: promoted knowledge base priors reproducibly influence System-1 proposal scoring', () => {
    const store = new FormaKnowledgeStore('kb0-qual-store');

    // Promote a qualified case for expansive surface
    const c1 = recordEmbodimentCritique({
      planId: 'p1',
      sliceId: 's1',
      contextId: 'c1',
      semanticNodeId: 'n1',
      critiqueText: 'Volumetric surface clear on desktop',
      confirmed: true,
    });
    const c2 = recordEmbodimentCritique({
      planId: 'p2',
      sliceId: 's2',
      contextId: 'c2',
      semanticNodeId: 'n2',
      critiqueText: 'Volumetric surface density confirmed',
      confirmed: true,
    });

    store.promoteCase({
      templateId: 'template-expansive-surface-v1',
      bindingId: 'binding-voxel-surface',
      phenotype: 'SPATIAL_SCATTER_V1',
      scope: { task: 'find-outliers' },
      critiques: [c1, c2],
    });

    const context = canonicalizeCommittedInvestigationContext({
      schemaVersion: 2,
      nodeId: 'node-qual-01',
      datasetFingerprint: 'sha256-dataset-qual-01',
      epistemicPurpose: 'EXPLORATORY_ABDUCTION',
      intent: { schemaVersion: 1, currentTask: 'find-outliers' },
    });

    const snapshot = normalizeEnvelopeToSnapshot(makeTestEnvelope('qual-01'), []);
    const manifest = createKB0Manifest();

    // Baseline proposer without knowledge store
    const baselineProposer = new FormaSystem1Proposer(BASELINE_FORMA_PRIOR_WEIGHTS);
    const baselineSet = baselineProposer.generateProposals(
      snapshot,
      context,
      manifest,
      DESKTOP_EXPANSIVE_BUDGET
    );

    // Knowledge-aware proposer
    const priorProposer = new FormaSystem1Proposer(BASELINE_FORMA_PRIOR_WEIGHTS, store);
    const priorSet = priorProposer.generateProposals(
      snapshot,
      context,
      manifest,
      DESKTOP_EXPANSIVE_BUDGET
    );

    expect(baselineSet.status).toBe('PROPOSED');
    expect(priorSet.status).toBe('PROPOSED');

    if (baselineSet.status === 'PROPOSED' && priorSet.status === 'PROPOSED') {
      const baseCand = baselineSet.candidates.find(
        (c) => c.templateId === 'template-expansive-surface-v1'
      );
      const priorCand = priorSet.candidates.find(
        (c) => c.templateId === 'template-expansive-surface-v1'
      );

      expect(baseCand).toBeDefined();
      expect(priorCand).toBeDefined();
      if (baseCand && priorCand) {
        expect(priorCand.score).toBeGreaterThan(baseCand.score);
        expect(priorCand.formaKnowledgeCaseId).toBeDefined();
      }
    }
  });

  test('3. Frozen Research Mode & Rollback: research mode freezes priors and rollback restores baseline', () => {
    const store = new FormaKnowledgeStore('kb0-freeze-rollback-store');

    const c1 = recordEmbodimentCritique({
      planId: 'p1',
      sliceId: 's1',
      contextId: 'c1',
      semanticNodeId: 'n1',
      critiqueText: 'Volumetric surface is clear on desktop',
      confirmed: true,
    });
    const c2 = recordEmbodimentCritique({
      planId: 'p2',
      sliceId: 's2',
      contextId: 'c2',
      semanticNodeId: 'n2',
      critiqueText: 'Confirmed volumetric surface density',
      confirmed: true,
    });

    store.promoteCase({
      templateId: 'template-expansive-surface-v1',
      bindingId: 'binding-voxel-surface',
      phenotype: 'SPATIAL_SCATTER_V1',
      critiques: [c1, c2],
    });

    // Freeze store for Research Mode
    store.freeze();
    expect(store.isStoreFrozen).toBe(true);

    // Attempting to promote new case when frozen fails closed
    expect(() =>
      store.promoteCase({
        templateId: 'template-late',
        bindingId: 'binding-late',
        phenotype: 'SPATIAL_SCATTER_V1',
        critiques: [c1, c2],
      })
    ).toThrow(/frozen in Research Mode/);

    // Rollback test: registry disable
    const registry = new FitnessModelRegistry();
    const evaluator = new FormaPriorEvaluator(BASELINE_FORMA_PRIOR_WEIGHTS, 1);
    const corpusBuilder = new FormaCuratedLearningCorpusBuilder({
      partitionSeed: 'rb-seed-01',
      trainFraction: 0.2,
      validationFraction: 0.1,
      partitionStrategy: 'by-dataset',
    });

    const meaningJudgments = [];
    const snapshots = new Map();
    for (let i = 0; i < 6; i++) {
      const repId = `rep-rb-${i}`;
      meaningJudgments.push(
        recordHumanMeaningJudgment({
          representationId: repId,
          versionIdentity: { kernelVersion: '1.0.0', monetaVersion: '1.0.0' },
          intendedSemanticMeaning: `Meaning RB ${i}`,
          perceivedMeaning: `Meaning RB ${i}`,
          taskComprehensionOutcome: 'ACCURATE',
          author: { researcherId: `r-rb-${i}` },
          confirmed: true,
        })
      );
      snapshots.set(repId, {
        schemaVersion: '1.0.0' as const,
        featureSchemaVersion: '1.0.0' as const,
        graphId: repId,
        datasetFingerprint: `dataset-rb-${i}`,
        fitnessModelVersion: '1.0.0',
        features: [0.6, 0.1, 0.1, 0.0],
        bootstrapUtility: 0.8,
      });
    }

    const corpus = corpusBuilder.build({
      meaningJudgments,
      featureSnapshots: snapshots,
    });
    expect(corpus.counts.holdout).toBeGreaterThanOrEqual(1);

    const candWeights = {
      intentRelevanceWeight: 0.85,
      budgetFitnessWeight: 0.10,
      templateParityWeight: 0.05,
    };

    const passEval = evaluator.evaluate(
      candWeights,
      corpus,
      { modelId: 'rb-prior-v1', modelVersion: '1.0.0-rb', knownAnswerPassRate: 1.0, abstentionComplianceRate: 1.0 }
    );

    evaluator.promoteToRegistry(
      candWeights,
      passEval,
      registry,
      corpus.corpusId,
      'policy-hash-rb'
    );
    expect(registry.active).toBeDefined();

    // Rollback active model
    registry.disable(Date.now());
    expect(registry.active?.artifactHash ?? null).toBeNull();
  });
});
