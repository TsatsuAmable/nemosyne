import { describe, expect, it } from 'vitest';
import {
  assessFitnessModelPromotion,
  GROUP_BALANCED_PAIRWISE_METRIC,
  oneSidedGroupWinSignTest,
  withGroupBalancedHoldoutEvaluation,
  type FitnessModelArtifact,
  type FitnessModelPromotionPolicy,
  type PairwiseTrainingExample,
} from '../src/fitness/index.ts';
import {
  captureMonetaPairwiseFeatureSnapshots,
  MONETA_PAIRWISE_FEATURE_DIMENSIONS,
} from '../src/fitness/MonetaFeatureSnapshot.ts';
import {
  materializePairwiseDataset,
  trainPairwiseLinearModel,
} from '../src/fitness/PairwiseLearning.ts';
import type { CandidateScore, RepresentationDecision } from '../src/moneta/representation/RepresentationDecision.ts';
import type { RepresentationFamily } from '../src/moneta/representation/RepresentationFamily.ts';
import type { SemanticRepresentationId } from '../src/moneta/representation/RepresentationCandidate.ts';
import { BOOTSTRAP_FITNESS_MODEL_VERSION } from '../src/moneta/representation/FitnessModel.ts';
import { MonetaHypothesisEngine } from '../src/moneta/representation/MonetaHypothesisEngine.ts';
import { minimalDatasetSignature } from '../src/moneta/representation/DatasetSignature.ts';
import { createDefaultRequirements } from '../src/moneta/representation/RepresentationRequirements.ts';
import {
  JUDGEMENT_DATASET_SCHEMA_VERSION,
  JUDGEMENT_PARTITION_ALGORITHM,
  type CuratedJudgementDataset,
} from '../src/judgement/JudgementDatasetBuilder.ts';
import { GestureRetrainService } from '../src/vr/input/GestureRetrainService.ts';
import type { EvaluatedSample } from '../src/vr/input/GestureRetrainService.ts';
import {
  GESTURE_CLASSES,
  type GestureClass,
  type ModelCard,
} from '../modules/gesture-intelligence/src/contracts.ts';

// TEC3-MA2 third slice: PT9 promotion-gate control fixtures (MA1 §3, P-1..P-5;
// docs/audits/TEC3_METRIC_ADMISSIBILITY_INVENTORY_2026-10-02.md). Deterministic
// synthetic fixtures driven through the production classes only — no production
// threshold, weight, gate or format is changed. Every pinned number below was
// observed by running these fixtures and then pinned as measured truth; none is
// inferred from ladder/ratio arithmetic in the source. Where the observed truth
// was probed first and pinned afterwards, the value is the exact double the
// production code produced.
//
// Policy note (recorded in the control harness report §7): the promotion-gate
// thresholds other than the alpha fallback are deployment configuration, not
// exported constants. The policy object below mirrors the policy shape of the
// existing promotion-gate test fixtures (tests/fitness-model-promotion-gate.test.ts,
// tests/learned-fitness-runtime-adapter.test.ts); the gate's only in-source
// default is the one-sided sign-test alpha fallback of 0.05
// (PromotionGate.ts assertPolicy / assessFitnessModelPromotion), which the P-2
// controls exercise WITHOUT overriding maximumGroupWinPValue.

const POLICY: FitnessModelPromotionPolicy = {
  minimumHoldoutJudgements: 30,
  minimumHoldoutGroups: 10,
  minimumAbsoluteImprovement: 0.05,
};

const BASE_FINGERPRINT = 'ma2-pt9-fixture';

function baseArtifact(): FitnessModelArtifact {
  return {
    schemaVersion: '1.0.0',
    modelId: 'moneta-pairwise-linear',
    modelVersion: 'ma2-pt9-probe',
    modelKind: 'pairwise-linear',
    createdAt: 1,
    trainingDatasetHash: 'train',
    curationPolicyHash: 'policy',
    featureSchemaVersion: '1.0.0',
    parameters: { weights: [1] },
    evaluation: {
      bootstrapMetric: 0,
      candidateMetric: 0,
      metricName: 'pairwise-accuracy',
      holdoutJudgementCount: 1,
      holdoutGroupCount: 1,
    },
  };
}

interface FixturesExample {
  judgements: readonly {
    candidateWins: boolean;
    bootstrapCorrect: boolean;
    weight?: number;
  }[];
}

// Deterministic holdout examples: one feature dimension; the production dot
// rule (dot(weights, featureDelta) > 0) decides candidate correctness, and
// bootstrapCorrect is the caller-supplied boolean the metric consumes verbatim.
function examplesFromGroups(groups: readonly FixturesExample[], groupPrefix: string): PairwiseTrainingExample[] {
  const examples: PairwiseTrainingExample[] = [];
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
    const judgements = groups[groupIndex].judgements;
    for (let judgementIndex = 0; judgementIndex < judgements.length; judgementIndex++) {
      const judgement = judgements[judgementIndex];
      examples.push({
        judgementId: `${groupPrefix}-g${groupIndex}-j${judgementIndex}`,
        partition: 'holdout',
        partitionGroup: `${groupPrefix}-g${groupIndex}`,
        datasetFingerprint: BASE_FINGERPRINT,
        preferredGraphId: 'preferred',
        alternativeGraphId: 'alternative',
        featureDelta: [judgement.candidateWins ? 1 : -1],
        bootstrapCorrect: judgement.bootstrapCorrect,
      });
    }
  }
  return examples;
}

function balancedGroups(
  groupCount: number,
  judgementsPerGroup: number,
  candidateCorrectPerGroup: number,
  bootstrapCorrectPerGroup: number,
): FixturesExample[] {
  return Array.from({ length: groupCount }, () => ({
    judgements: Array.from({ length: judgementsPerGroup }, (_, index) => ({
      candidateWins: index < candidateCorrectPerGroup,
      bootstrapCorrect: index < bootstrapCorrectPerGroup,
    })),
  }));
}

// ---------------------------------------------------------------------------
// P-1 — group-balanced pairwise accuracy (MA1 P-1)
// ---------------------------------------------------------------------------

describe('TEC3-MA2 P-1 group-balanced pairwise accuracy controls (MA1 P-1)', () => {
  it('a candidate beating the bootstrap on every balanced group clears the gate', () => {
    // 12 groups x 5 judgements: candidate correct on all judgements, bootstrap
    // correct on 2 of 5. Observed through the production evaluation +
    // assessFitnessModelPromotion.
    const evaluated = withGroupBalancedHoldoutEvaluation(
      baseArtifact(),
      examplesFromGroups(balancedGroups(12, 5, 5, 2), 'p1-pos'),
    );
    const assessment = assessFitnessModelPromotion(evaluated, POLICY);

    expect(evaluated.evaluation.metricName).toBe(GROUP_BALANCED_PAIRWISE_METRIC);
    // Observed: candidate 1, bootstrap 0.39999999999999997 (the double nearest
    // 0.4 produced by 2/5 group means), improvement 0.6000000000000001.
    expect(evaluated.evaluation.candidateMetric).toBe(1);
    expect(evaluated.evaluation.bootstrapMetric).toBe(0.39999999999999997);
    expect(assessment.absoluteImprovement).toBe(0.6000000000000001);
    expect(evaluated.evaluation.candidateGroupWins).toBe(12);
    expect(evaluated.evaluation.bootstrapGroupWins).toBe(0);
    expect(evaluated.evaluation.tiedGroups).toBe(0);
    expect(evaluated.evaluation.oneSidedGroupWinPValue).toBe(0.000244140625);
    expect(evaluated.evaluation.leaveOneGroupOutImprovementFloor).toBe(0.5999999999999999);
    expect(assessment.robustImprovementFloor).toBe(0.5999999999999999);
    expect(assessment.eligible).toBe(true);
    expect(assessment.reasons).toEqual([]);
  });

  it('a candidate below the bootstrap is refused outright', () => {
    // 12 groups x 5 judgements: candidate correct on 2 of 5, bootstrap on all.
    const evaluated = withGroupBalancedHoldoutEvaluation(
      baseArtifact(),
      examplesFromGroups(balancedGroups(12, 5, 2, 5), 'p1-neg'),
    );
    const assessment = assessFitnessModelPromotion(evaluated, POLICY);

    // Observed: the candidate mean is the accumulated double 0.39999999999999997.
    expect(evaluated.evaluation.candidateMetric).toBe(0.39999999999999997);
    expect(evaluated.evaluation.bootstrapMetric).toBe(1);
    expect(assessment.absoluteImprovement).toBe(-0.6000000000000001);
    expect(assessment.eligible).toBe(false);
    expect(assessment.reasons).toContain('CANDIDATE_DOES_NOT_BEAT_BOOTSTRAP');
  });

  it('a candidate exactly at parity with the bootstrap is refused (strict improvement)', () => {
    // 12 groups x 5 judgements: candidate accuracy 0.4 == bootstrap 0.4 per
    // group (all groups tie). Observed through the production gate.
    const groups = Array.from({ length: 12 }, () => ({
      judgements: [
        { candidateWins: true, bootstrapCorrect: false },
        { candidateWins: true, bootstrapCorrect: true },
        { candidateWins: false, bootstrapCorrect: true },
        { candidateWins: false, bootstrapCorrect: false },
        { candidateWins: false, bootstrapCorrect: false },
      ],
    }));
    const evaluated = withGroupBalancedHoldoutEvaluation(baseArtifact(), examplesFromGroups(groups, 'p1-parity'));
    const assessment = assessFitnessModelPromotion(evaluated, POLICY);

    expect(evaluated.evaluation.candidateMetric).toBe(0.39999999999999997);
    expect(evaluated.evaluation.bootstrapMetric).toBe(0.39999999999999997);
    expect(assessment.absoluteImprovement).toBe(0);
    expect(evaluated.evaluation.tiedGroups).toBe(12);
    // The gate requires strictly positive improvement; exact parity is a refusal.
    expect(assessment.reasons).toContain('CANDIDATE_DOES_NOT_BEAT_BOOTSTRAP');
    // The tie/tail-1 handling (all 12 groups tie → decisive 0 → tail `1`,
    // p = 1 > α) is pinned here too: the significance reason co-fires.
    expect(assessment.reasons).toContain('GROUP_WIN_EVIDENCE_NOT_SIGNIFICANT');
    expect(assessment.eligible).toBe(false);
  });

  it('the bootstrap side is supplied, not recomputed: identical candidate behaviour flips the verdict', () => {
    // MA1 P-1 confound (`bootstrapCorrect` is consumed verbatim, GroupBalancedEvaluation
    // does not recompute it). Two datasets with IDENTICAL candidate behaviour
    // (same featureDeltas, same dot outcomes, candidateMetric 1 in both) differ
    // only in the caller-supplied bootstrapCorrect pattern — and the gate
    // verdict flips from eligible to CANDIDATE_DOES_NOT_BEAT_BOOTSTRAP.
    const sparseBootstrap = balancedGroups(10, 5, 5, 1);
    const fullBootstrap = balancedGroups(10, 5, 5, 5);
    const sparseEvaluated = withGroupBalancedHoldoutEvaluation(baseArtifact(), examplesFromGroups(sparseBootstrap, 'p1-sparse'));
    const fullEvaluated = withGroupBalancedHoldoutEvaluation(baseArtifact(), examplesFromGroups(fullBootstrap, 'p1-full'));

    // Both arms observe identical candidate behaviour.
    expect(sparseEvaluated.evaluation.candidateMetric).toBe(1);
    expect(fullEvaluated.evaluation.candidateMetric).toBe(1);
    // Observed bootstrap side: 1/5 group means vs 5/5 group means.
    expect(sparseEvaluated.evaluation.bootstrapMetric).toBe(0.19999999999999998);
    expect(fullEvaluated.evaluation.bootstrapMetric).toBe(1);

    const sparseAssessment = assessFitnessModelPromotion(sparseEvaluated, POLICY);
    const fullAssessment = assessFitnessModelPromotion(fullEvaluated, POLICY);
    expect(sparseAssessment.eligible).toBe(true);
    expect(sparseAssessment.reasons).toEqual([]);
    expect(fullAssessment.eligible).toBe(false);
    expect(fullAssessment.reasons).toContain('CANDIDATE_DOES_NOT_BEAT_BOOTSTRAP');
  });
});

// ---------------------------------------------------------------------------
// P-2 — one-sided exact binomial sign test at the alpha boundary (MA1 P-2)
// ---------------------------------------------------------------------------

describe('TEC3-MA2 P-2 sign-test significance boundary controls (MA1 P-2)', () => {
  // Boundary-localized pair over decisive group counts where the exact tail is
  // computable: a 25-decisive-group fixture with 17 candidate wins has one-sided
  // tail 0.05387607216835022 (just ABOVE the gate's alpha default); a
  // 37-decisive-group fixture with 24 wins has tail 0.04943587479647249 (just
  // BELOW it). Both p-values were measured through the production sign test,
  // not derived here: they are the closest achievable pair around 0.05 for
  // decisive counts up to 40 (granularity recorded in the report, §7).
  const pAboveBoundary = 0.05387607216835022;
  const pBelowBoundary = 0.04943587479647249;

  it('pins the boundary-localized p-values on the production sign test', () => {
    expect(oneSidedGroupWinSignTest(17, 8)).toBe(pAboveBoundary);
    expect(oneSidedGroupWinSignTest(24, 13)).toBe(pBelowBoundary);
    // The pair brackets the gate's alpha default from both sides.
    expect(pAboveBoundary).toBeGreaterThan(0.05);
    expect(pBelowBoundary).toBeLessThanOrEqual(0.05);
    // Tails are monotone in the candidate win margin at a fixed decisive count.
    expect(oneSidedGroupWinSignTest(25, 0)).toBeLessThan(pAboveBoundary);
  });

  it('a win pattern whose tail sits just above alpha is refused on significance alone', () => {
    // 25 groups x 2 judgements: candidate wins 17 groups, bootstrap 8, no ties.
    // Observed through the production evaluation + gate, with the gate's own
    // alpha default in force (maximumGroupWinPValue deliberately NOT set).
    const fixture: FixturesExample[] = [];
    for (let groupIndex = 0; groupIndex < 25; groupIndex++) {
      fixture.push({
        // Candidate wins the whole group (accuracy 1) in 17 of 25 groups;
        // bootstrap wins the other 8 (candidate accuracy 0, bootstrap 1).
        judgements: Array.from({ length: 2 }, () => ({
          candidateWins: groupIndex < 17,
          bootstrapCorrect: groupIndex >= 17,
        })),
      });
    }
    const evaluated = withGroupBalancedHoldoutEvaluation(baseArtifact(), examplesFromGroups(fixture, 'p2-above'));
    const assessment = assessFitnessModelPromotion(evaluated, POLICY);

    expect(evaluated.evaluation.candidateMetric).toBe(0.68);
    expect(evaluated.evaluation.bootstrapMetric).toBe(0.32);
    expect(assessment.absoluteImprovement).toBe(0.36000000000000004);
    expect(evaluated.evaluation.candidateGroupWins).toBe(17);
    expect(evaluated.evaluation.bootstrapGroupWins).toBe(8);
    expect(evaluated.evaluation.tiedGroups).toBe(0);
    expect(evaluated.evaluation.oneSidedGroupWinPValue).toBe(pAboveBoundary);
    // Mean and robustness pass; significance alone refuses.
    expect(evaluated.evaluation.leaveOneGroupOutImprovementFloor).toBe(0.3333333333333333);
    expect(assessment.reasons).toEqual(['GROUP_WIN_EVIDENCE_NOT_SIGNIFICANT']);
    expect(assessment.eligible).toBe(false);
  });

  it('a win pattern whose tail sits just below alpha clears the gate', () => {
    const fixture: FixturesExample[] = [];
    for (let groupIndex = 0; groupIndex < 37; groupIndex++) {
      fixture.push({
        judgements: Array.from({ length: 2 }, () => ({
          candidateWins: groupIndex < 24,
          bootstrapCorrect: groupIndex >= 24,
        })),
      });
    }
    const evaluated = withGroupBalancedHoldoutEvaluation(baseArtifact(), examplesFromGroups(fixture, 'p2-below'));
    const assessment = assessFitnessModelPromotion(evaluated, POLICY);

    expect(evaluated.evaluation.candidateMetric).toBe(0.6486486486486487);
    expect(evaluated.evaluation.bootstrapMetric).toBe(0.35135135135135137);
    expect(assessment.absoluteImprovement).toBe(0.2972972972972973);
    expect(evaluated.evaluation.candidateGroupWins).toBe(24);
    expect(evaluated.evaluation.bootstrapGroupWins).toBe(13);
    expect(evaluated.evaluation.tiedGroups).toBe(0);
    expect(evaluated.evaluation.oneSidedGroupWinPValue).toBe(pBelowBoundary);
    expect(evaluated.evaluation.leaveOneGroupOutImprovementFloor).toBe(0.2777777777777778);
    expect(assessment.reasons).toEqual([]);
    expect(assessment.eligible).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// P-3 — leaveOneGroupOutImprovementFloor (MA1 P-3)
// ---------------------------------------------------------------------------

describe('TEC3-MA2 P-3 leave-one-group-out floor controls (MA1 P-3)', () => {
  // Fixture family: one large group (improvement 1.0, 50 judgements) plus nine
  // smaller groups identical in their per-group improvement. The floor is the
  // mean improvement after removing the influential large group, so the floor
  // equals the small groups' improvement; moving only that improvement moves
  // only the floor verdict.
  function fixture(smallCandidateCorrect: number, smallJudgements: number): PairwiseTrainingExample[] {
    const examples: PairwiseTrainingExample[] = [];
    for (let index = 0; index < 50; index++) {
      examples.push({
        judgementId: `p3-big-${index}`,
        partition: 'holdout',
        partitionGroup: 'p3-big',
        datasetFingerprint: BASE_FINGERPRINT,
        preferredGraphId: 'preferred',
        alternativeGraphId: 'alternative',
        featureDelta: [1],
        bootstrapCorrect: false,
      });
    }
    for (let groupIndex = 0; groupIndex < 9; groupIndex++) {
      for (let index = 0; index < smallJudgements; index++) {
        const candidateWins = index < smallCandidateCorrect;
        examples.push({
          judgementId: `p3-small-${groupIndex}-${index}`,
          partition: 'holdout',
          partitionGroup: `p3-small-${groupIndex}`,
          datasetFingerprint: BASE_FINGERPRINT,
          preferredGraphId: 'preferred',
          alternativeGraphId: 'alternative',
          featureDelta: [candidateWins ? 1 : -1],
          bootstrapCorrect: !candidateWins,
        });
      }
    }
    return examples;
  }

  it('an effect that survives every single-group removal clears the floor', () => {
    // Small groups: 29/50 candidate correct vs 21/50 bootstrap correct
    // (per-group improvement 0.16). Observed floor 0.16.
    const evaluated = withGroupBalancedHoldoutEvaluation(baseArtifact(), fixture(29, 50));
    const assessment = assessFitnessModelPromotion(evaluated, POLICY);

    expect(evaluated.evaluation.candidateMetric).toBe(0.6220000000000001);
    expect(evaluated.evaluation.bootstrapMetric).toBe(0.378);
    expect(evaluated.evaluation.leaveOneGroupOutImprovementFloor).toBe(0.16);
    expect(assessment.robustImprovementFloor).toBe(0.16);
    expect(assessment.reasons).toEqual([]);
    expect(assessment.eligible).toBe(true);
  });

  it('a floor exactly at the policy threshold passes (strict below-comparison, observed double residue)', () => {
    // Small groups: 21/40 candidate correct vs 19/40 bootstrap correct
    // (per-group improvement 0.05). Observed floor 0.050000000000000044 —
    // the double residue sits just above the policy constant, so the gate does
    // not reject. Pinned as observed; the comparison is robustFloor < robustMinimum.
    const evaluated = withGroupBalancedHoldoutEvaluation(baseArtifact(), fixture(21, 40));
    const assessment = assessFitnessModelPromotion(evaluated, POLICY);

    expect(assessment.absoluteImprovement).toBe(0.14499999999999996);
    expect(evaluated.evaluation.leaveOneGroupOutImprovementFloor).toBe(0.050000000000000044);
    expect(assessment.reasons).toEqual([]);
    expect(assessment.eligible).toBe(true);
  });

  it('one group whose removal drags the floor below the policy floor flips the gate', () => {
    // Small groups: 26/50 candidate correct vs 24/50 bootstrap correct
    // (per-group improvement 0.04). Observed floor 0.040000000000000036.
    const evaluated = withGroupBalancedHoldoutEvaluation(baseArtifact(), fixture(26, 50));
    const assessment = assessFitnessModelPromotion(evaluated, POLICY);

    expect(evaluated.evaluation.candidateMetric).toBe(0.568);
    expect(evaluated.evaluation.bootstrapMetric).toBe(0.43200000000000005);
    expect(assessment.absoluteImprovement).toBe(0.1359999999999999);
    expect(evaluated.evaluation.candidateGroupWins).toBe(10);
    expect(evaluated.evaluation.oneSidedGroupWinPValue).toBe(0.0009765625);
    expect(evaluated.evaluation.leaveOneGroupOutImprovementFloor).toBe(0.040000000000000036);
    expect(assessment.robustImprovementFloor).toBe(0.040000000000000036);
    // Mean improvement 0.136 passes everything else; the floor alone refuses.
    expect(assessment.reasons).toEqual(['ROBUST_IMPROVEMENT_BELOW_THRESHOLD']);
    expect(assessment.eligible).toBe(false);
  });

  it('the null <2-group path is missing evidence, not a pass', () => {
    // Single holdout group under a deliberately permissive policy so the floor
    // null is the only structural cause of refusal.
    const single: PairwiseTrainingExample[] = [
      { judgementId: 'p3-solo-0', partition: 'holdout', partitionGroup: 'p3-only', datasetFingerprint: BASE_FINGERPRINT, preferredGraphId: 'preferred', alternativeGraphId: 'alternative', featureDelta: [1], bootstrapCorrect: false },
      { judgementId: 'p3-solo-1', partition: 'holdout', partitionGroup: 'p3-only', datasetFingerprint: BASE_FINGERPRINT, preferredGraphId: 'preferred', alternativeGraphId: 'alternative', featureDelta: [1], bootstrapCorrect: false },
    ];
    const evaluated = withGroupBalancedHoldoutEvaluation(baseArtifact(), single);
    const assessment = assessFitnessModelPromotion(evaluated, {
      minimumHoldoutJudgements: 1,
      minimumHoldoutGroups: 1,
      minimumAbsoluteImprovement: 0.05,
    });

    // Observed: withGroupBalancedHoldoutEvaluation omits the floor field, and
    // the gate translates that into MISSING_EFFECT_ROBUSTNESS_EVIDENCE with a
    // null robustImprovementFloor; the group-win test also fails (decisive
    // groups 1 → tail 0.5).
    expect(evaluated.evaluation.leaveOneGroupOutImprovementFloor).toBeUndefined();
    expect(assessment.robustImprovementFloor).toBeNull();
    expect(assessment.reasons).toEqual(['GROUP_WIN_EVIDENCE_NOT_SIGNIFICANT', 'MISSING_EFFECT_ROBUSTNESS_EVIDENCE']);
    expect(assessment.eligible).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// P-4 — learned feature vector is downstream of F-1..F-6 (MA1 P-4)
// ---------------------------------------------------------------------------

function twinCandidate(
  candidateId: SemanticRepresentationId,
  family: RepresentationFamily,
  rawScores: readonly number[],
  score: number,
): CandidateScore {
  return {
    family,
    candidateId,
    layout: 'GRID_3D',
    score,
    components: MONETA_PAIRWISE_FEATURE_DIMENSIONS.map((component, index) => ({
      component,
      weight: 1 / 6,
      rawScore: rawScores[index],
      weightedScore: rawScores[index] / 6,
      reason: component,
    })),
    preserves: [],
    loses: [],
  };
}

describe('TEC3-MA2 P-4 feature-vector coupling controls (MA1 P-4)', () => {
  it('snapshot features are exactly the six bootstrap component rawScores on a production decision', () => {
    const engine = new MonetaHypothesisEngine();
    const decision = engine.arbitrate(
      minimalDatasetSignature(1000, 4, 0, 0, 'ma2-p4-coupling', 0),
      createDefaultRequirements('explore', 'MEDIUM'),
    );
    const feasible = (decision.rankedCandidates ?? []).filter((candidate) => !candidate.disqualified);
    const graphIds: Record<string, string> = {};
    for (const candidate of feasible) graphIds[candidate.candidateId] = `graph-${candidate.candidateId}`;
    const snapshots = captureMonetaPairwiseFeatureSnapshots(
      { ...decision, fitnessModelVersion: BOOTSTRAP_FITNESS_MODEL_VERSION },
      graphIds,
    );

    expect(feasible.length).toBeGreaterThanOrEqual(2);
    expect(MONETA_PAIRWISE_FEATURE_DIMENSIONS).toHaveLength(6);
    for (const candidate of feasible) {
      const snapshot = snapshots.find((entry) => entry.graphId === graphIds[candidate.candidateId]);
      expect(snapshot).toBeDefined();
      // Observed: the feature vector is the six production component rawScores,
      // per-dimension, in the canonical order — nothing more.
      expect(snapshot!.features).toEqual(
        MONETA_PAIRWISE_FEATURE_DIMENSIONS.map(
          (dimension) => candidate.components.find((component) => component.component === dimension)!.rawScore,
        ),
      );
      // MA1 P-4: the feature schema deliberately carries no seventh dimension —
      // the ranking components do expose perceptualFitness (F-7), and it is
      // not among the learned features.
      expect(candidate.components.some((component) => component.component === 'perceptualFitness')).toBe(true);
      expect(MONETA_PAIRWISE_FEATURE_DIMENSIONS).not.toContain('perceptualFitness');
    }
  });

  it('two candidates with identical component rawScores yield identical snapshots and indifferent promotion inputs', () => {
    // Production arbitrate fixture supplies the six rawScores; a second
    // candidate is then given exactly those production-computed scores so the
    // two share one rawScore vector.
    const engine = new MonetaHypothesisEngine();
    const decision = engine.arbitrate(
      minimalDatasetSignature(1000, 4, 0, 0, 'ma2-p4-twin', 0),
      createDefaultRequirements('explore', 'MEDIUM'),
    );
    const winner = (decision.rankedCandidates ?? []).find((candidate) => !candidate.disqualified);
    expect(winner).toBeDefined();
    const twinScores = MONETA_PAIRWISE_FEATURE_DIMENSIONS.map(
      (dimension) => winner!.components.find((component) => component.component === dimension)!.rawScore,
    );

    const alpha = twinCandidate('POINT_SET', 'POINT', twinScores, winner!.score);
    const beta = twinCandidate('DENSITY_FIELD', 'DISTRIBUTION', twinScores, winner!.score);
    const twinDecision = {
      utilityScore: winner!.score,
      representationFamily: 'POINT',
      embodiment: {
        primaryLayout: 'GRID_3D',
        primaryGeometry: 'CUBE_MATRIX',
        primaryBehavior: 'STATIC',
        primaryInteraction: 'INSPECT_CELL',
        spatialStrategy: {
          id: 'ma2-p4-twin',
          worldType: 'ANALYST_COCKPIT',
          macroLayout: { layout: 'GRID_3D', parameters: {}, positionSemantics: 'SEMANTIC' },
          datumEncoding: { geometry: 'CUBE_MATRIX', mappings: {}, behavior: 'STATIC' },
          interactionStrategy: { primaryInteraction: 'INSPECT_CELL', supportedGestures: [], detailLens: 'INSPECTOR_SLATE' },
          score: winner!.score,
          rationale: 'MA2 P-4 twin fixture',
          rejectionLog: [],
          provenance: {
            generatedAt: 0,
            engine: 'MonetaHypothesisEngine',
            version: '0',
            datasetFingerprint: BASE_FINGERPRINT,
            requirementsHash: 'requirements',
            fitnessModelVersion: BOOTSTRAP_FITNESS_MODEL_VERSION,
          },
        },
      },
      rankedCandidates: [alpha, beta],
      evidence: [],
      rejectedAlternatives: [],
      provenance: {
        generatedAt: 0,
        engine: 'MonetaHypothesisEngine',
        version: '0',
        datasetFingerprint: BASE_FINGERPRINT,
        fitnessModelVersion: BOOTSTRAP_FITNESS_MODEL_VERSION,
      },
      datasetSignature: { provenance: { kernelVersion: '0' } },
    } as unknown as RepresentationDecision;

    const snapshots = captureMonetaPairwiseFeatureSnapshots(twinDecision, {
      POINT_SET: 'twin-graph-alpha',
      DENSITY_FIELD: 'twin-graph-beta',
    });
    expect(snapshots).toHaveLength(2);
    // Observed: identical in every field except the graph identity.
    expect(snapshots[0].graphId).toBe('twin-graph-alpha');
    expect(snapshots[1].graphId).toBe('twin-graph-beta');
    for (const snapshot of snapshots) {
      expect(snapshot.schemaVersion).toBe(snapshots[0].schemaVersion);
      expect(snapshot.featureSchemaVersion).toBe(snapshots[0].featureSchemaVersion);
      expect(snapshot.datasetFingerprint).toBe(snapshots[0].datasetFingerprint);
      expect(snapshot.fitnessModelVersion).toBe(snapshots[0].fitnessModelVersion);
      expect(snapshot.features).toEqual(snapshots[0].features);
      expect(snapshot.bootstrapUtility).toBe(snapshots[0].bootstrapUtility);
    }

    // Downstream indifference: a curated pairwise judgement between the twins
    // materializes a zero featureDelta and a supplied bootstrapCorrect=false
    // (the strict bootstrapUtility > comparison on equal utilities).
    const curated = {
      schemaVersion: JUDGEMENT_DATASET_SCHEMA_VERSION,
      partitionAlgorithm: JUDGEMENT_PARTITION_ALGORITHM,
      policy: { partitionSeed: 'seed', trainFraction: 0.8, validationFraction: 0 },
      included: [
        {
          judgement: {
            kind: 'PAIRWISE_PREFERENCE',
            judgementId: 'tw-j1',
            provenance: { datasetFingerprint: BASE_FINGERPRINT, fitnessModelVersion: BOOTSTRAP_FITNESS_MODEL_VERSION },
            preferredGraphId: 'twin-graph-beta',
            alternativeGraphId: 'twin-graph-alpha',
          },
          datasetGroup: 'dataset',
          researcherGroup: 'researcher',
          partitionGroup: 'holdout-group',
          partition: 'holdout',
        },
        {
          judgement: {
            kind: 'PAIRWISE_PREFERENCE',
            judgementId: 'tw-j2',
            provenance: { datasetFingerprint: BASE_FINGERPRINT, fitnessModelVersion: BOOTSTRAP_FITNESS_MODEL_VERSION },
            preferredGraphId: 'twin-graph-beta',
            alternativeGraphId: 'twin-graph-alpha',
          },
          datasetGroup: 'dataset',
          researcherGroup: 'researcher',
          partitionGroup: 'train-group',
          partition: 'train',
        },
      ],
      excluded: [],
    } as unknown as CuratedJudgementDataset;

    const dataset = materializePairwiseDataset(curated, snapshots);
    expect(dataset.issues).toEqual([]);
    expect(dataset.featureCount).toBe(6);
    expect(dataset.examples).toHaveLength(2);
    expect(dataset.examples[0].featureDelta).toEqual([0, 0, 0, 0, 0, 0]);
    expect(dataset.examples[0].bootstrapCorrect).toBe(false);
    expect(dataset.examples[1].featureDelta).toEqual([0, 0, 0, 0, 0, 0]);
    expect(dataset.examples[1].bootstrapCorrect).toBe(false);

    // Observed: the twins are weight-invariant to every learned model — the
    // production dot rule cannot separate them, whatever the weights (this
    // includes the production feature-identity vector [1,0,...,0] and the all-
    // negative direction), and a learner trained on zero-delta evidence
    // produces the zero vector: no information beyond F-1..F-6 exists for it.
    for (const weights of [
      [1, 0, 0, 0, 0, 0],
      [0.9, 0.5, 0.15, 0.15, 0.05, 0.05],
      [-1, -1, -1, -1, -1, -1],
    ]) {
      const dot = dataset.examples[0].featureDelta.reduce((sum, delta, index) => sum + weights[index] * delta, 0);
      expect(dot).toBe(0);
      expect(dot > 0).toBe(false);
    }
    const trained = trainPairwiseLinearModel(dataset, {
      modelVersion: 'ma2-p4-twin-learner',
      createdAt: 0,
      trainingDatasetHash: 'train',
      curationPolicyHash: 'policy',
      epochs: 50,
      learningRate: 0.1,
      l2: 0,
    });
    expect(trained.parameters.weights).toEqual([0, 0, 0, 0, 0, 0]);
    expect(trained.evaluation.candidateMetric).toBe(0);
    expect(trained.evaluation.bootstrapMetric).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// P-5 — gesture-model quality bar and staged deployment (MA1 P-5)
// ---------------------------------------------------------------------------

// Reachability notes (recorded in the report §7): the quality-bar constants are
// module-private literals in GestureRetrainService (0.90 accuracy / 0.85 macro-F1)
// and are not exported or configurable; the public entry point
// evaluateUserDisjoint consumes pre-labelled samples and a caller-declared
// training-profile set, so it is a counting verifier over supplied labels, not
// a model scorer. The boundary pairs below are therefore fixture-level
// evidence at the exact observed thresholds; the thresholds themselves cannot
// be imported and are asserted behaviourally.
function gestureSample(trueLabel: GestureClass, predictedLabel: GestureClass, profileHash: string): EvaluatedSample {
  return { features: [0], trueLabel, predictedLabel, confidence: 0.5, profileHash };
}

describe('TEC3-MA2 P-5 gesture quality-bar controls (MA1 P-5)', () => {
  it('accuracy boundary: 0.899 fails the bar while exactly 0.90 passes it', () => {
    // 1000 samples over all six classes, four minor classes perfect, and an
    // isolated two-class confusion between pinchTogether/pinchApart. Errors
    // 101 → accuracy 0.899 (below); errors 100 → accuracy 0.900 == the
    // observed threshold admits (>=).
    const accuracyPair = (xErrors: number, yErrors: number) => {
      const service = new GestureRetrainService();
      const samples: EvaluatedSample[] = [];
      for (const label of ['idle', 'scoopUp', 'pushForward', 'bothPinched'] as GestureClass[]) {
        for (let i = 0; i < 25; i++) samples.push(gestureSample(label, label, `u-${label}`));
      }
      for (let i = 0; i < 450; i++) {
        samples.push(gestureSample('pinchTogether', i < 450 - xErrors ? 'pinchTogether' : 'pinchApart', 'u-x'));
      }
      for (let i = 0; i < 450; i++) {
        samples.push(gestureSample('pinchApart', i < 450 - yErrors ? 'pinchApart' : 'pinchTogether', 'u-y'));
      }
      return service.evaluateUserDisjoint(samples, new Set(['train-user']));
    };

    const below = accuracyPair(51, 50);
    expect(below.validity).toBe('VALID');
    expect(below.accuracy).toBe(0.899);
    // Observed macro-F1 at this arm: 0.962592546410551 — comfortably above the
    // second threshold, so the failure isolates the accuracy boundary.
    expect(below.macroF1).toBe(0.962592546410551);
    expect(below.passedBar).toBe(false);

    const atBoundary = accuracyPair(50, 50);
    expect(atBoundary.validity).toBe('VALID');
    expect(atBoundary.accuracy).toBe(0.9);
    expect(atBoundary.macroF1).toBe(0.9629629629629629);
    expect(atBoundary.passedBar).toBe(true);
  });

  it('macro-F1 boundary: 0.8493... fails the bar while just above 0.85 passes it (accuracy arm clear)', () => {
    // idle support 100, pinchTogether support 100, four classes at 200.
    // idle true → predicted pinchTogether in (100 − t) cases; everything else
    // correct. t=23: observed macroF1 0.8493342334145364 with accuracy 0.923
    // (above the accuracy bar) → refused on macro-F1 alone; t=24: observed
    // macroF1 0.8519557425588281, accuracy 0.924 → passes.
    const macroPair = (t: number) => {
      const service = new GestureRetrainService();
      const samples: EvaluatedSample[] = [];
      for (let i = 0; i < 100; i++) samples.push(gestureSample('idle', i < t ? 'idle' : 'pinchTogether', 'u-a'));
      for (let i = 0; i < 100; i++) samples.push(gestureSample('pinchTogether', 'pinchTogether', 'u-b'));
      for (const label of ['pinchApart', 'scoopUp', 'pushForward', 'bothPinched'] as GestureClass[]) {
        for (let i = 0; i < 200; i++) samples.push(gestureSample(label, label, 'u-o'));
      }
      return service.evaluateUserDisjoint(samples, new Set(['train-user']));
    };

    const below = macroPair(23);
    expect(below.validity).toBe('VALID');
    expect(below.accuracy).toBe(0.923);
    expect(below.macroF1).toBe(0.8493342334145364);
    expect(below.passedBar).toBe(false);

    const above = macroPair(24);
    expect(above.validity).toBe('VALID');
    expect(above.accuracy).toBe(0.924);
    expect(above.macroF1).toBe(0.8519557425588281);
    expect(above.passedBar).toBe(true);
  });

  it('an exact-0.85 macro-F1 construction lands on the threshold double and is admitted', () => {
    // idle: 30 of 90 correct with the remainder predicted pinchTogether
    // (F1 = 0.5 exactly); pinchTogether: 45/45 correct absorbing the 60 false
    // positives (F1 = 0.6 exactly); four other classes perfect. The
    // accumulation-order double sum /6 lands exactly on the 0.85 threshold
    // double and the >= comparison admits it.
    const service = new GestureRetrainService();
    const samples: EvaluatedSample[] = [];
    for (let i = 0; i < 90; i++) samples.push(gestureSample('idle', i < 30 ? 'idle' : 'pinchTogether', 'u-a'));
    for (let i = 0; i < 45; i++) samples.push(gestureSample('pinchTogether', 'pinchTogether', 'u-b'));
    for (const label of ['pinchApart', 'scoopUp', 'pushForward', 'bothPinched'] as GestureClass[]) {
      for (let i = 0; i < 120; i++) samples.push(gestureSample(label, label, 'u-o'));
    }
    const report = service.evaluateUserDisjoint(samples, new Set(['train-user']));

    expect(report.validity).toBe('VALID');
    expect(report.accuracy).toBe(0.9024390243902439);
    expect(report.macroF1).toBe(0.85);
    expect(report.macroF1 >= 0.85).toBe(true);
    expect(report.passedBar).toBe(true);
  });

  it('user-disjointness is exactly the supplied profileHash: same-hash users pool, a leaked hash erases users', () => {
    // Two "users" with disjoint sample content (different labels and error
    // patterns) but ONE shared profileHash.
    const sharedSamples = () => {
      const samples: EvaluatedSample[] = [];
      for (let i = 0; i < 10; i++) samples.push(gestureSample('idle', 'idle', 'shared-hash'));
      for (let i = 0; i < 10; i++) samples.push(gestureSample('pinchTogether', 'pinchApart', 'shared-hash'));
      return samples;
    };

    // If the shared hash is in the training-profile set, BOTH users are
    // silently removed from the evidence — nothing detects two users in one
    // hash; the report simply claims no held-out profiles.
    const erasure = new GestureRetrainService().evaluateUserDisjoint(sharedSamples(), new Set(['shared-hash']));
    expect(erasure.validity).toBe('NO_HELD_OUT_PROFILES');
    expect(erasure.sampleCount).toBe(0);
    expect(erasure.profileCount).toBe(0);
    expect(erasure.passedBar).toBe(false);

    // With the shared hash merely held out, the two users pool into ONE
    // profile: profileCount 1, pooled accuracy 0.5, and no signal that two
    // independent evaluators contributed. Disjointness rests entirely on
    // string equality of the caller-supplied hash — no content check exists.
    const pooled = new GestureRetrainService().evaluateUserDisjoint(sharedSamples(), new Set(['train-user']));
    expect(pooled.profileCount).toBe(1);
    expect(pooled.sampleCount).toBe(20);
    expect(pooled.accuracy).toBe(0.5);
    expect(pooled.validity).toBe('MISSING_CLASS_SUPPORT');
  });

  it('a per-user catastrophic failure is invisible in the pooled report and can pass the bar', () => {
    // u-good covers all six classes almost perfectly; u-bad is wrong on every
    // one of its 10 samples. Observed: pooled accuracy 0.9941520467836257 and
    // macro-F1 0.9973146382961278 — VALID and passing the bar while the per-user
    // accuracy of u-bad is 0.0. The report exposes no per-profile metric:
    // userDisjointAccuracy/userDisjointMacroF1 are copies of the pooled values.
    const service = new GestureRetrainService();
    const samples: EvaluatedSample[] = [];
    for (let i = 0; i < 800; i++) samples.push(gestureSample('idle', 'idle', 'u-good'));
    for (let i = 0; i < 500; i++) samples.push(gestureSample('pinchTogether', 'pinchTogether', 'u-good'));
    for (const label of ['pinchApart', 'scoopUp', 'pushForward', 'bothPinched'] as GestureClass[]) {
      for (let i = 0; i < 100; i++) samples.push(gestureSample(label, label, 'u-good'));
    }
    for (let i = 0; i < 10; i++) samples.push(gestureSample('pinchTogether', 'idle', 'u-bad'));
    const report = service.evaluateUserDisjoint(samples, new Set(['train-user']));

    const badSamples = samples.filter((entry) => entry.profileHash === 'u-bad');
    const badAccuracy = badSamples.filter((entry) => entry.predictedLabel === entry.trueLabel).length / badSamples.length;
    expect(badSamples).toHaveLength(10);
    expect(badAccuracy).toBe(0);

    expect(report.profileCount).toBe(2);
    expect(report.accuracy).toBe(0.9941520467836257);
    expect(report.macroF1).toBe(0.9973146382961278);
    expect(report.validity).toBe('VALID');
    expect(report.passedBar).toBe(true);
    // No per-user surface exists — the userDisjoint fields mirror the pooled
    // metrics exactly.
    expect(report.userDisjointAccuracy).toBe(report.accuracy);
    expect(report.userDisjointMacroF1).toBe(report.macroF1);
  });

  it('features and confidence fields are not consulted by the evaluation', () => {
    // Observed: two evaluation runs over samples carrying wildly different
    // feature payloads and confidences produce identical reports — the counting
    // verifier reads only trueLabel, predictedLabel and profileHash.
    const run = (features: readonly number[], confidence: number) => {
      const service = new GestureRetrainService();
      const samples: EvaluatedSample[] = [
        { features: [...features], trueLabel: 'idle', predictedLabel: 'idle', confidence, profileHash: 'u-1' },
        { features: [...features], trueLabel: 'pinchTogether', predictedLabel: 'pinchTogether', confidence, profileHash: 'u-2' },
        { features: [...features], trueLabel: 'pinchApart', predictedLabel: 'pinchApart', confidence, profileHash: 'u-3' },
        { features: [...features], trueLabel: 'scoopUp', predictedLabel: 'scoopUp', confidence, profileHash: 'u-1' },
        { features: [...features], trueLabel: 'pushForward', predictedLabel: 'pushForward', confidence, profileHash: 'u-2' },
        { features: [...features], trueLabel: 'bothPinched', predictedLabel: 'bothPinched', confidence, profileHash: 'u-3' },
      ];
      return service.evaluateUserDisjoint(samples, new Set(['train-user']));
    };
    const quiet = run([0, 0, 0, 0, 0, 0, 0, 0], 0.0001);
    const noisy = run(Array.from({ length: 56 }, (_, i) => ((i % 2 === 0 ? 1 : -1) * (999 + i)) / 7), 0.9999);
    expect(noisy).toEqual(quiet);
    expect(quiet.validity).toBe('VALID');
    expect(quiet.passedBar).toBe(true);
  });

  it('staged deployment transitions are not coupled to the quality bar: promotion succeeds unconditionally', () => {
    // Observed: promoteDeployment moves a registered version to any requested
    // stage and returns true even when (a) no evaluation exists, and (b) the
    // registered card declares failing metrics (heldOutAccuracy 0, macro-F1 0).
    // Also observed: the stage ladder can be jumped — candidate → rollout in
    // one call with no intermediate candidate→shadow→canary evidence.
    const service = new GestureRetrainService();
    const card: ModelCard = {
      name: 'ma2-pt9-control-card',
      version: '0.0.1',
      inputName: 'input',
      outputName: 'output',
      featureDim: 56,
      classes: [...GESTURE_CLASSES],
      featureSpec: 'ma2-control-spec',
      metrics: { heldOutAccuracy: 0, macroF1: 0, samples: 0, confusion: [] },
      sha256: 'ma2-failing-metrics-sha',
    };
    const deployment = service.registerCandidate(card, 'candidate', 0);
    expect(deployment.stage).toBe('candidate');

    expect(service.promoteDeployment(card.version, 'rollout', 100)).toBe(true);
    expect(service.getDeployment(card.version)?.stage).toBe('rollout');

    // And the full staged walk is available without any quality evidence:
    const staged: ModelCard = { ...card, version: '0.0.2', sha256: 'ma2-staged-sha' };
    service.registerCandidate(staged, 'candidate', 0);
    for (const stage of ['shadow', 'canary', 'rollout'] as const) {
      expect(service.promoteDeployment(staged.version, stage, 10)).toBe(true);
      expect(service.getDeployment(staged.version)?.stage).toBe(stage);
    }
  });
});