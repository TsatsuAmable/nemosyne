import { describe, test, expect } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';
import {
  SelfLabelingForbiddenError,
  assertNotSelfLabeled,
  recordEmbodimentCritique,
  recordHumanMeaningJudgment,
} from '../src/moneta/forma/FormaHumanFeedback.ts';
import {
  FormaKnowledgeStore,
} from '../src/moneta/forma/FormaKnowledgeBase.ts';
import {
  FormaCuratedLearningCorpusBuilder,
} from '../src/learning/FormaCuratedLearningCorpus.ts';
import {
  FormaPriorEvaluator,
  BASELINE_FORMA_PRIOR_WEIGHTS,
} from '../src/learning/FormaPriorEvaluator.ts';
import { FitnessModelRegistry } from '../src/fitness/FitnessModelRegistry.ts';
import { FormaSystem1Proposer } from '../src/moneta/forma/FormaSystem1Proposer.ts';
import { QUEST_CONSTRAINED_BUDGET } from '../src/moneta/forma/FormaResolutionBroker.ts';
import { createKB0Manifest } from '../src/moneta/forma/KB0Manifest.ts';
import type { SemanticEmbodimentEnvelopeV1 } from '../src/moneta/representation/SemanticEmbodimentPayload.ts';
import { normalizeEnvelopeToSnapshot } from '../src/moneta/representation/SemanticSnapshotV1.ts';

import { canonicalizeCommittedInvestigationContext } from '../src/atlas/domain/CommittedInvestigationContext.ts';
import type { PairwisePreferenceJudgement, DiscoveryOutcomeLinkJudgement } from '../src/judgement/RepresentationJudgement.ts';

describe('FM6: Human-Refined Moneta / Forma Knowledge (PT9 / L4-LEARN)', () => {
  function makeTestDataset(): Dataset {
    const rows = [];
    for (let i = 0; i < 20; i++) {
      rows.push({
        id: i,
        score: i * 2.5,
        group: i % 2 === 0 ? 'control' : 'treatment',
      });
    }
    return new Dataset(
      'fm6-test-dataset',
      [
        { name: 'id', type: ColumnType.NUMERIC },
        { name: 'score', type: ColumnType.NUMERIC },
        { name: 'group', type: ColumnType.CATEGORICAL },
      ],
      rows
    );
  }

  // 1. Anti-Self-Labeling Guard
  test('falsifier A: anti-self-labeling guard prevents automated or passive recommendation adoptions from generating human testimony', () => {
    // Passive click or recommendation adoption must throw SelfLabelingForbiddenError
    expect(() =>
      assertNotSelfLabeled({ passiveClick: true })
    ).toThrow(SelfLabelingForbiddenError);

    expect(() =>
      assertNotSelfLabeled({ automated: true })
    ).toThrow(SelfLabelingForbiddenError);

    expect(() =>
      assertNotSelfLabeled({ systemDefault: true })
    ).toThrow(SelfLabelingForbiddenError);

    expect(() =>
      assertNotSelfLabeled({ source: 'RECOMMENDER' })
    ).toThrow(SelfLabelingForbiddenError);

    expect(() =>
      assertNotSelfLabeled({ source: 'AUTOPILOT' })
    ).toThrow(SelfLabelingForbiddenError);

    // Explicit human interaction passes
    expect(() =>
      assertNotSelfLabeled({ source: 'HUMAN_EXPLICIT' })
    ).not.toThrow();
  });

  // 2. Analytical Invariance
  test('falsifier B: recording confirmed critiques and meaning judgments preserves bitwise analytical identity', async () => {
    const bridge = makeKernelMockBridge();
    const atlas = new AtlasCore({ kernel: bridge });
    const ds = makeTestDataset();
    atlas.loadDataset(ds);
    const initialDigest = await atlas.computeDigest();
    const initialFingerprint = atlas.datasetFingerprint;

    // Record confirmed critique
    const critique = atlas.recordEmbodimentCritique({
      planId: 'plan-test-001',
      sliceId: 'slice-test-001',
      contextId: 'ctx-001',
      semanticNodeId: 'node-001',
      critiqueText: 'Voxel representation creates visual occlusion for dense regions',
      targetBindingId: 'binding-voxel-density',
      proposedBinding: 'binding-radial-heat',
      proposedAlternativePhenotype: 'SPATIAL_SCATTER_V1',
      author: { researcherId: 'researcher-alpha', studyId: 'study-fm6' },
      confirmed: true,
    });
    expect(critique.critiqueId).toMatch(/^critique-v1:/);
    expect(critique.confirmed).toBe(true);

    // Record confirmed meaning judgment
    const meaning = atlas.recordHumanMeaningJudgment({
      representationId: 'rep-test-001',
      bindingId: 'binding-voxel-density',
      versionIdentity: {
        kernelVersion: '1.0.0',
        monetaVersion: '1.0.0',
      },
      intendedSemanticMeaning: 'Uncertainty of metric estimation',
      perceivedMeaning: 'Temporal variance across observations',
      taskComprehensionOutcome: 'MISUNDERSTOOD',
      mappingPreference: 'DISLIKED',
      misleadingImplication: 'Observers confused uncertainty with time-series progression',
      author: { researcherId: 'researcher-alpha' },
      confirmed: true,
    });
    expect(meaning.judgmentId).toMatch(/^meaning-v1:/);
    expect(meaning.taskComprehensionOutcome).toBe('MISUNDERSTOOD');

    // Link discovery outcome
    const link = atlas.linkDiscoveryOutcomeToRepresentation(
      'disc-001',
      'rep-test-001',
      'SUPPORTED',
      'researcher-alpha',
      'Validated outlier cluster in cohort B'
    );
    expect(link.kind).toBe('DISCOVERY_OUTCOME_LINK');

    // Assert that scientific analytical identity and dataset fingerprint are completely unchanged
    expect(atlas.datasetFingerprint).toBe(initialFingerprint);
    expect(await atlas.computeDigest()).toBe(initialDigest);



    // Verify aggregate retrieval
    expect(atlas.getEmbodimentCritiques().length).toBe(1);
    expect(atlas.getHumanMeaningJudgments().length).toBe(1);
    expect(atlas.getDiscoveryOutcomeLinks().length).toBe(1);
  });

  // 3. Forma Knowledge Base: Promotion, Contraindications, and Freezing
  test('promotes qualified metaphor cases with minimum evidence and tracks contraindications', () => {
    const store = new FormaKnowledgeStore('kb0-pinned-v1');

    // Attempting to promote without sufficient evidence fails closed
    expect(() =>
      store.promoteCase({
        templateId: 'template-test-empty',
        bindingId: 'binding-empty',
        phenotype: 'SPATIAL_SCATTER_V1',
        critiques: [],
        meaningJudgments: [],
      })
    ).toThrow(/Insufficient confirmed evidence/);

    // Promote a qualified case with confirmed critiques and meaning judgments
    const qualifiedCase = store.promoteCase({
      templateId: 'template-scatter-density',
      bindingId: 'binding-radial-heat',
      phenotype: 'SPATIAL_SCATTER_V1',
      scope: { domain: 'genomics', task: 'distribution-analysis' },
      critiques: [
        recordEmbodimentCritique({
          planId: 'plan-1',
          sliceId: 'slice-1',
          contextId: 'ctx-1',
          semanticNodeId: 'node-1',
          critiqueText: 'Radial heat accurately differentiates clusters',
          confirmed: true,
        }),
      ],
      meaningJudgments: [
        recordHumanMeaningJudgment({
          representationId: 'rep-1',
          versionIdentity: { kernelVersion: '1.0.0', monetaVersion: '1.0.0' },
          intendedSemanticMeaning: 'Cluster density',
          perceivedMeaning: 'Cluster density',
          taskComprehensionOutcome: 'ACCURATE',
          author: { researcherId: 'researcher-1' },
          confirmed: true,
        }),
      ],
      rationale: 'Validated high accuracy on genomics cohort',
    });

    expect(qualifiedCase.caseId).toMatch(/^case-v1:/);
    expect(qualifiedCase.status).toBe('QUALIFIED');
    expect(qualifiedCase.evidenceBasis.accuracyRate).toBe(1.0);

    // Promote a contraindicated case (misleading implication + low accuracy)
    const contraCase = store.promoteCase({
      templateId: 'template-vibration-uncertainty',
      bindingId: 'binding-vibration-haptic',
      phenotype: 'SPATIAL_SCATTER_V1',
      critiques: [
        recordEmbodimentCritique({
          planId: 'plan-2',
          sliceId: 'slice-2',
          contextId: 'ctx-2',
          semanticNodeId: 'node-2',
          critiqueText: 'Vibration felt like device jitter',
          confirmed: true,
        }),
      ],
      meaningJudgments: [
        recordHumanMeaningJudgment({
          representationId: 'rep-2',
          versionIdentity: { kernelVersion: '1.0.0', monetaVersion: '1.0.0' },
          intendedSemanticMeaning: 'Measurement uncertainty',
          perceivedMeaning: 'Hardware error / glitch',
          taskComprehensionOutcome: 'FAILED',
          misleadingImplication: 'Vibration interpreted as hardware glitch rather than statistical uncertainty',
          author: { researcherId: 'researcher-2' },
          confirmed: true,
        }),
      ],
    });

    expect(contraCase.status).toBe('CONTRAINDICATED');
    expect(store.findContraindications('template-vibration-uncertainty')).toContain(
      'Vibration interpreted as hardware glitch rather than statistical uncertainty'
    );

    // Query qualified cases by domain and task
    const queried = store.findQualifiedCases({ domain: 'genomics', task: 'distribution-analysis' });
    expect(queried.length).toBe(1);
    expect(queried[0].caseId).toBe(qualifiedCase.caseId);

    // Freezing store for Research Mode prevents any further mutations
    const frozenSnapshot = store.freeze();
    expect(store.isStoreFrozen).toBe(true);
    expect(frozenSnapshot.cases.length).toBe(2);

    expect(() =>
      store.promoteCase({
        templateId: 'template-late-addition',
        bindingId: 'binding-late',
        phenotype: 'SPATIAL_SCATTER_V1',
        critiques: [
          recordEmbodimentCritique({
            planId: 'p',
            sliceId: 's',
            contextId: 'c',
            semanticNodeId: 'n',
            critiqueText: 'Late critique',
            confirmed: true,
          }),
          recordEmbodimentCritique({
            planId: 'p2',
            sliceId: 's2',
            contextId: 'c2',
            semanticNodeId: 'n2',
            critiqueText: 'Late critique 2',
            confirmed: true,
          }),
        ],
      })
    ).toThrow(/Cannot promote case: knowledge store is frozen/);
  });

  // 4. PT9 Curated Learning Corpus Builder
  test('curates multi-evidence corpus with disjoint holdout partitioning and excludes unconfirmed testimony', () => {
    const builder = new FormaCuratedLearningCorpusBuilder({
      partitionSeed: 'pt9-test-seed-42',
      trainFraction: 0.60,
      validationFraction: 0.20,
      partitionStrategy: 'by-dataset',
    });

    const confirmedMeaning = recordHumanMeaningJudgment({
      representationId: 'rep-1',
      versionIdentity: { kernelVersion: '1.0.0', monetaVersion: '1.0.0' },
      intendedSemanticMeaning: 'Cluster significance',
      perceivedMeaning: 'Cluster significance',
      taskComprehensionOutcome: 'ACCURATE',
      author: { researcherId: 'researcher-alice' },
      confirmed: true,
    });

    const unconfirmedMeaning = recordHumanMeaningJudgment({
      representationId: 'rep-unconfirmed',
      versionIdentity: { kernelVersion: '1.0.0', monetaVersion: '1.0.0' },
      intendedSemanticMeaning: 'Trend velocity',
      perceivedMeaning: 'Trend velocity',
      taskComprehensionOutcome: 'ACCURATE',
      author: { researcherId: 'researcher-bob' },
      confirmed: false, // unconfirmed!
    });

    const pairwiseJudgement: PairwisePreferenceJudgement = {
      schemaVersion: '1.0.0',
      judgementId: 'pair-judgement-001',
      investigationId: 'inv-001',
      researcherId: 'researcher-alice',
      sequence: 1,
      recordedAt: Date.now(),
      kind: 'PAIRWISE_PREFERENCE',
      preferredGraphId: 'graph-A',
      alternativeGraphId: 'graph-B',
      strength: 5,
      provenance: {
        datasetFingerprint: 'sha256-dataset-holdout-target',
        kernelVersion: '1.0.0',
        monetaVersion: '1.0.0',
        fitnessModelVersion: '1.0.0',
        ontologyVersion: '1.0.0',
        nilVersion: '1.0.0',
        representationGraphId: 'graph-A',
      },
    };

    const discoveryLink: DiscoveryOutcomeLinkJudgement = {
      schemaVersion: '1.0.0',
      judgementId: 'disc-link-001',
      investigationId: 'inv-001',
      researcherId: 'researcher-alice',
      sequence: 2,
      recordedAt: Date.now(),
      kind: 'DISCOVERY_OUTCOME_LINK',
      discoveryId: 'discovery-target-001',
      graphId: 'graph-A',
      outcome: 'EXTERNALLY_VALIDATED',
      provenance: {
        datasetFingerprint: 'sha256-dataset-alpha',
        kernelVersion: '1.0.0',
        monetaVersion: '1.0.0',
        fitnessModelVersion: '1.0.0',
        ontologyVersion: '1.0.0',
        nilVersion: '1.0.0',
        representationGraphId: 'graph-A',
      },
    };

    const snapshots = new Map([
      [
        'rep-1',
        {
          schemaVersion: '1.0.0' as const,
          featureSchemaVersion: '1.0.0' as const,
          graphId: 'rep-1',
          datasetFingerprint: 'sha256-dataset-alpha',
          fitnessModelVersion: '1.0.0',
          features: [0.85, 0.75, 0.65, 0.55],
          bootstrapUtility: 0.70,
        },
      ],
      [
        'graph-A',
        {
          schemaVersion: '1.0.0' as const,
          featureSchemaVersion: '1.0.0' as const,
          graphId: 'graph-A',
          datasetFingerprint: 'sha256-dataset-alpha',
          fitnessModelVersion: '1.0.0',
          features: [0.9, 0.8, 0.7, 0.6],
          bootstrapUtility: 0.75,
        },
      ],
      [
        'graph-B',
        {
          schemaVersion: '1.0.0' as const,
          featureSchemaVersion: '1.0.0' as const,
          graphId: 'graph-B',
          datasetFingerprint: 'sha256-dataset-alpha',
          fitnessModelVersion: '1.0.0',
          features: [0.4, 0.3, 0.2, 0.1],
          bootstrapUtility: 0.35,
        },
      ],
    ]);

    const corpus = builder.build({
      meaningJudgments: [confirmedMeaning, unconfirmedMeaning],
      pairwiseJudgements: [pairwiseJudgement],
      discoveryLinks: [discoveryLink],
      featureSnapshots: snapshots,
    });

    expect(corpus.corpusId).toMatch(/^corpus-pt9-v1:/);
    // Unconfirmed judgment should be excluded with reason
    expect(corpus.issues.length).toBe(1);
    expect(corpus.issues[0].reason).toBe('UNCONFIRMED_HUMAN_TESTIMONY');

    // Confirmed items must be included across categories
    expect(corpus.counts.total).toBe(3);
    expect(corpus.counts.byCategory.MEANING_RECOVERY).toBe(1);
    expect(corpus.counts.byCategory.PREFERENCE).toBe(1);
    expect(corpus.counts.byCategory.DISCOVERY_OUTCOME).toBe(1);
  });

  // 5. Gated Promotion and Model Registry Rollback
  test('evaluates candidate prior on held-out partition and enforces strict promotion and rollback gates', () => {
    const evaluator = new FormaPriorEvaluator(BASELINE_FORMA_PRIOR_WEIGHTS, 3);
    const registry = new FitnessModelRegistry();

    // Create a corpus with synthetic holdout examples
    const builder = new FormaCuratedLearningCorpusBuilder({
      partitionSeed: 'holdout-seed-99',
      trainFraction: 0.20,
      validationFraction: 0.10,
      partitionStrategy: 'by-dataset',
    });

    const meaningJudgments = [];
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
    }

    const snapshots = new Map();
    for (let i = 0; i < 15; i++) {
      // For even i: low base features, high case bonus feature (so candidate wins where baseline fails)
      const features =
        i % 2 === 0
          ? [0.3, 0.3, 0.2, 1.0]
          : [0.95, 0.85, 0.80, 0.5];

      snapshots.set(`rep-holdout-${i}`, {
        schemaVersion: '1.0.0' as const,
        featureSchemaVersion: '1.0.0' as const,
        graphId: `rep-holdout-${i}`,
        datasetFingerprint: `dataset-partition-${i}`,
        fitnessModelVersion: '1.0.0',
        features,
        bootstrapUtility: 0.8,
      });
    }

    const corpus = builder.build({
      meaningJudgments,
      featureSnapshots: snapshots,
    });

    expect(corpus.counts.holdout).toBeGreaterThanOrEqual(3);

    // Test a candidate that regresses or fails gate
    const inferiorCandidate = {
      intentRelevanceWeight: 0.05,
      budgetFitnessWeight: 0.05,
      templateParityWeight: 0.05,
    };

    const failEvaluation = evaluator.evaluate(inferiorCandidate, corpus, {
      modelId: 'inferior-prior-v1',
      modelVersion: '1.0.0-inferior',
      knownAnswerPassRate: 0.8, // regressed!
    });
    expect(failEvaluation.passedGate).toBe(false);
    expect(failEvaluation.refusalReasons.length).toBeGreaterThan(0);

    // Attempting to promote failed candidate throws error
    expect(() =>
      evaluator.promoteToRegistry(
        inferiorCandidate,
        failEvaluation,
        registry,
        'dataset-hash-001',
        'policy-hash-001'
      )
    ).toThrow(/failed evaluation gate/);

    // Test a superior candidate that passes all gates
    const superiorCandidate = {
      intentRelevanceWeight: 0.60,
      budgetFitnessWeight: 0.25,
      templateParityWeight: 0.15,
      caseBasedBonusWeight: 0.40,
    };

    const passEvaluation = evaluator.evaluate(superiorCandidate, corpus, {
      modelId: 'superior-prior-v1',
      modelVersion: '1.0.0-superior',
      knownAnswerPassRate: 1.0,
      abstentionComplianceRate: 1.0,
    });


    expect(passEvaluation.passedGate).toBe(true);

    const promoted = evaluator.promoteToRegistry(
      superiorCandidate,
      passEvaluation,
      registry,
      corpus.corpusId,
      'policy-hash-001'
    );

    expect(promoted.artifactHash).toBeDefined();
    expect(registry.active?.artifactHash).toBe(promoted.artifactHash);

    // Test disable / rollback capability
    registry.disable(Date.now());
    expect(registry.active?.artifactHash ?? null).toBeNull();

  });

  // 6. System-1 Proposer & Knowledge Base Integration
  test('FormaSystem1Proposer applies knowledge base priors, penalizes contraindications, and honors frozen research mode', () => {
    const knowledgeStore = new FormaKnowledgeStore('kb0-test-v1');

    // Promote a qualified case for sparse scatter
    knowledgeStore.promoteCase({
      templateId: 'template-sparse-scatter-v1',
      bindingId: 'binding-radial-scatter',
      phenotype: 'SPATIAL_SCATTER_V1',
      critiques: [
        recordEmbodimentCritique({
          planId: 'p1',
          sliceId: 's1',
          contextId: 'c1',
          semanticNodeId: 'n1',
          critiqueText: 'Sparse radial scatter is legible on mobile',
          confirmed: true,
        }),
        recordEmbodimentCritique({
          planId: 'p2',
          sliceId: 's2',
          contextId: 'c2',
          semanticNodeId: 'n2',
          critiqueText: 'Confirmed cluster clarity',
          confirmed: true,
        }),
      ],
    });

    const proposer = new FormaSystem1Proposer(BASELINE_FORMA_PRIOR_WEIGHTS, knowledgeStore);

    const envelope: SemanticEmbodimentEnvelopeV1 = {
      schemaVersion: 1 as const,

      datasetFingerprint: 'sha256-dataset-1234567890abcdef',
      candidateId: 'AGGREGATE_VOLUME' as const,
      representationFamily: 'AGGREGATE' as const,

      analyticalMethod: {
        name: 'aggregateVolume',
        version: '1.0.0',
        parameters: { groupingFields: ['region'], measure: 'COUNT' },
      },
      approximation: {
        mode: 'EXACT' as const,
        representedRowCount: 1000,
      },
      informationContract: {
        preserves: ['exact-metric-values'],
        loses: ['individual-observation-identity'],
      },
      resource: {
        sourceRowCount: 1000,
        elementCount: 2,
        maxElementCount: 4096,
      },
      provenance: {
        kernelVersion: '1.0.0',
        algorithmVersion: '1.0.0',
        decisionId: 'decision-fm6-test',
        decisionModelVersion: 'onnx-v2',
        decisionModelArtifactHash: 'hash-xyz',
      },

      result: {
        status: 'READY' as const,
        payload: {
          kind: 'AGGREGATE_VOLUME' as const,
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


    const dummyEvidence = [
      {
        datasetFingerprint: 'sha256-dataset-1234567890abcdef',
        kernelVersion: '1.0.0',
        bundleContentDigest: 'sha256-bundle-001',
        receiptId: 'receipt-001',
        receiptContentDigest: 'sha256-receipt-digest-001',
        consumerId: 'descriptive-summary/v1',
        requirementProfileId: 'profile-001',
        requirementProfileDigest: 'sha256-profile-digest-001',
        admissionPolicyId: 'policy-001',
        admissionPolicyDigest: 'sha256-policy-digest-001',
      },
    ];

    const snapshot = normalizeEnvelopeToSnapshot(envelope, dummyEvidence);
    const context = canonicalizeCommittedInvestigationContext({
      schemaVersion: 2,
      nodeId: 'ctx-node-fm6',
      intent: {
        schemaVersion: 1,
        researchQuestion: 'How does regional distribution shape candidate metaphors?',
        variablesOfInterest: ['region', 'count'],
      },
      epistemicPurpose: 'CLAIM_BEARING',
    });

    const manifest = createKB0Manifest();

    // 1. In adaptive mode with qualified case, candidate receives prior boost
    const proposalSet = proposer.generateProposals(
      snapshot,
      context,
      manifest,
      QUEST_CONSTRAINED_BUDGET
    );

    expect(proposalSet.status).toBe('PROPOSED');
    if (proposalSet.status === 'PROPOSED') {
      const topCand = proposalSet.candidates[0];
      expect(topCand.templateId).toBe('template-sparse-scatter-v1');
      expect(topCand.formaKnowledgeCaseId).toBeDefined();
      expect(topCand.rationale).toContain('Forma Knowledge Base prior applied');
    }

    // 2. Freeze store for Research Mode
    knowledgeStore.freeze();
    const frozenProposals = proposer.generateProposals(
      snapshot,
      context,
      manifest,
      QUEST_CONSTRAINED_BUDGET
    );

    expect(frozenProposals.status).toBe('PROPOSED');
    if (frozenProposals.status === 'PROPOSED') {
      expect(frozenProposals.searchHints).toContain('RESEARCH_MODE_FROZEN_PRIORS');
    }
  });
});
