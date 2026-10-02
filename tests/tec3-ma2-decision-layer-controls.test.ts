import { describe, expect, it } from 'vitest';
import {
  BootstrapFitnessModel,
  DEFAULT_BOOTSTRAP_FITNESS_WEIGHTS,
} from '../src/moneta/representation/FitnessModel.ts';
import { MONETA_REPRESENTATION_CANDIDATES } from '../src/moneta/representation/RepresentationCandidate.ts';
import {
  createDefaultRequirements,
  type PreservationGoal,
  type RepresentationRequirements,
} from '../src/moneta/representation/RepresentationRequirements.ts';
import {
  assessRepresentationDecision,
  DEFAULT_DECISION_POLICY,
} from '../src/moneta/representation/DecisionPolicy.ts';
import type { CandidateScore } from '../src/moneta/representation/RepresentationDecision.ts';
import { analyzeWinnerSensitivity } from '../src/moneta/representation/SensitivityAnalysis.ts';
import {
  minimalDatasetSignature,
  MonetaHypothesisEngine,
  NoFeasibleRepresentationError,
} from '../src/moneta/index.ts';
import type { DatasetSignature } from '../src/moneta/representation/DatasetSignature.ts';
import {
  assertDecisionRelevantSignatureMatchesEvidence,
  datasetEvidenceToSignature,
} from '../src/moneta/representation/DatasetEvidenceSignature.ts';
import { structureProfileToDatasetEvidence } from '../src/data/evidence/StructureProfileEvidenceAdapter.ts';
import { EvidenceBackedMoneta } from '../src/moneta/representation/EvidenceBackedMoneta.ts';
import { createMonetaStructureProfile } from './helpers/moneta-kernel-fixture.ts';

// TEC3-MA2 second slice: decision-layer control fixtures (MA1 F-3, F-4, F-13,
// F-14, F-15, F-16; docs/audits/TEC3_METRIC_ADMISSIBILITY_INVENTORY_2026-10-02.md
// section 1). Deterministic synthetic fixtures driven through the production
// classes only — no production threshold, weight, gate or format is changed.
// Every pinned number below was observed by running these fixtures and then
// pinned as measured truth; none is inferred from ladder/ratio arithmetic in
// the source.

function componentRawScore(
  candidates: CandidateScore[],
  candidateId: string,
  dimension: string
): number {
  const entry = candidates.find((candidate) => candidate.candidateId === candidateId);
  expect(entry, `${candidateId} present in ranked candidates`).toBeDefined();
  const component = entry!.components.find(
    (component) => component.component === dimension
  );
  expect(component, `${dimension} component of ${candidateId}`).toBeDefined();
  return component!.rawScore;
}

function rawRequirements(preservationGoals: PreservationGoal[]): RepresentationRequirements {
  return {
    task: 'explore',
    requiredStructures: [],
    preservationGoals,
    acceptableLoss: {
      allowIdentityLoss: true,
      allowExactMetricLoss: true,
      allowClusterLoss: true,
      maxFrustumExclusionTolerance: 0.3,
    },
    scale: 'MEDIUM',
    hardwareConstraints: {},
    maxFrustumExclusionTolerance: 0.3,
    interactionBudget: 'MEDIUM',
  };
}

const RAW_MODEL = new BootstrapFitnessModel();
const RAW_NO_GOALS = rawRequirements([]);

function infoScore(
  preservationGoals: PreservationGoal[],
  candidateId: 'POINT_SET' | 'DISTRIBUTION_FIELD'
): number {
  const candidate = MONETA_REPRESENTATION_CANDIDATES[candidateId];
  const evaluation = RAW_MODEL.evaluate(
    minimalDatasetSignature(200, 2, 0, 0, `ma2-info-${candidateId}`, 0),
    rawRequirements(preservationGoals),
    candidate,
    candidateId === 'POINT_SET' ? 'POINT' : 'DISTRIBUTION'
  );
  return evaluation.components.find((component) => component.dimension === 'informationPreservation')!
    .rawScore;
}

// ---------------------------------------------------------------------------
// F-3 — scale component (FitnessModel scoreScale) + scale-range hard constraint
// ---------------------------------------------------------------------------

describe('TEC3-MA2 F-3 scale envelope controls (MA1 F-3)', () => {
  const candidate = MONETA_REPRESENTATION_CANDIDATES.DENSITY_FIELD;
  const scaleScore = (rowCount: number) =>
    RAW_MODEL.evaluate(
      minimalDatasetSignature(rowCount, 2, 0, 0, `ma2-scale-${rowCount}`, 0),
      RAW_NO_GOALS,
      candidate,
      'DISTRIBUTION'
    ).components.find((component) => component.dimension === 'scale')!.rawScore;

  it('separates a rowCount inside the declared envelope from one far outside it', () => {
    // Positive: DENSITY_FIELD scaleCharacteristics minN=100, maxN=500000,
    // optimalN=[1000,50000] -> rowCount 1000 is inside the optimal window.
    // Negative: rowCount 1_000_000 is far above maxN.
    expect(scaleScore(1000)).toBe(1);
    const negative = scaleScore(1_000_000);
    expect(negative).toBe(0);
    // Observed positive/negative separation on the component's own [0,1] scale.
    expect((scaleScore(1000) - negative) / 1).toBe(1);
  });

  it('the component is a three-valued function inside the envelope, not a scale fit', () => {
    // Outside the optimalN window (on both sides) the metric is pinned to the
    // constant scalabilityRating (0.9) regardless of where rowCount sits in
    // the band, and it cannot distinguish sub-optimal from over-optimal
    // rowCount; 0.9 is observed identically at 101 and at 500_000 rows.
    expect(scaleScore(100)).toBeCloseTo(0.9, 12);
    expect(scaleScore(101)).toBeCloseTo(0.9, 12);
    expect(scaleScore(999)).toBeCloseTo(scaleScore(101), 12);
    expect(scaleScore(1000)).toBe(1);
    expect(scaleScore(20_000)).toBe(1);
    expect(scaleScore(50_000)).toBe(1);
    expect(scaleScore(50_001)).toBeCloseTo(0.9, 12);
    expect(scaleScore(500_000)).toBeCloseTo(0.9, 12);
    // Discontinuity at the optimalN boundaries: one row loses/earns 0.1.
    expect(scaleScore(999) - scaleScore(1000)).toBeCloseTo(-0.1, 12);
    expect(scaleScore(50_000) - scaleScore(50_001)).toBeCloseTo(0.1, 12);
  });

  it('hard scale-range constraint flips exactly at minN (99 vs 100 rows)', () => {
    const arbitrate = (rowCount: number, maxElements?: number) => {
      const requirements = createDefaultRequirements('explore', ['x', 'y']);
      if (maxElements !== undefined) {
        requirements.hardwareConstraints = { ...requirements.hardwareConstraints, maxElements };
      }
      const decision = new MonetaHypothesisEngine().arbitrate(
        minimalDatasetSignature(rowCount, 2, 0, 0, `ma2-scale-min-${rowCount}`, 0),
        requirements
      );
      return (decision.rankedCandidates ?? []).filter(
        (candidateScore) => candidateScore.candidateId === 'DENSITY_FIELD'
      );
    };

    const justOutside = arbitrate(99);
    expect(justOutside).toHaveLength(1);
    expect(justOutside[0].disqualified).toBe(true);
    expect(justOutside[0].disqualificationCode).toBe('scale-range');
    expect(justOutside[0].score).toBe(0);
    expect(justOutside[0].components).toHaveLength(0);

    const justInside = arbitrate(100);
    expect(justInside).toHaveLength(1);
    // Feasible entries carry `disqualified: undefined` (the engine does not set
    // the flag) — pinned as observed.
    expect(justInside[0].disqualified).toBeUndefined();
    expect(componentRawScore(justInside, 'DENSITY_FIELD', 'scale')).toBeCloseTo(0.9, 12);
  });

  it('hard scale-range constraint flips exactly at maxN (500001 vs 500000 rows)', () => {
    const arbitrate = (rowCount: number) => {
      const requirements = createDefaultRequirements('explore', ['x', 'y']);
      // Raise the hardware element budget above DENSITY_FIELD maxN so the
      // scale-range code is not masked by hardware-element-budget.
      requirements.hardwareConstraints = { ...requirements.hardwareConstraints, maxElements: 600_000 };
      try {
        const decision = new MonetaHypothesisEngine().arbitrate(
          minimalDatasetSignature(rowCount, 2, 0, 0, `ma2-scale-max-${rowCount}`, 0),
          requirements
        );
        return (decision.rankedCandidates ?? []).filter(
          (candidateScore) => candidateScore.candidateId === 'DENSITY_FIELD'
        );
      } catch (error) {
        // At 500_001 rows no candidate is feasible at all, so the engine's
        // typed NIL outcome is the observed surface for the just-outside side.
        expect(error).toBeInstanceOf(NoFeasibleRepresentationError);
        const densityTraces = (error as NoFeasibleRepresentationError).traces.filter((trace) =>
          trace.ruleName.startsWith('DENSITY_FIELD')
        );
        expect(densityTraces.length).toBeGreaterThan(0);
        expect(
          densityTraces.every(
            (trace) => !trace.passed && trace.code === 'scale-range'
          )
        ).toBe(true);
        return (error as NoFeasibleRepresentationError).nearMisses.filter(
          (candidateScore) => candidateScore.candidateId === 'DENSITY_FIELD'
        );
      }
    };

    const justInside = arbitrate(500_000);
    expect(justInside).toHaveLength(1);
    expect(justInside[0].disqualified).toBeUndefined();
    expect(componentRawScore(justInside, 'DENSITY_FIELD', 'scale')).toBeCloseTo(0.9, 12);
    const justOutside = arbitrate(500_001);
    expect(justOutside).toHaveLength(1);
    expect(justOutside[0].disqualified).toBe(true);
    expect(justOutside[0].score).toBe(0);
    expect(justOutside[0].components).toHaveLength(0);
  });

  it('the component-scale negative (rawScore 0) is shadowed by the hard constraint in live ranking', () => {
    // Through engine.arbitrate a rowCount outside [minN, maxN] never surfaces a
    // scored scale component: the entry is disqualified with empty components
    // before the model runs. Observed, not inferred — the entries probed above
    // at rowCount 99 and 500_001 both carry components [].
    const requirements = createDefaultRequirements('explore', ['x', 'y']);
    const decision = new MonetaHypothesisEngine().arbitrate(
      minimalDatasetSignature(99, 2, 0, 0, 'ma2-scale-shadow', 0),
      requirements
    );
    const density = (decision.rankedCandidates ?? []).find(
      (candidateScore) => candidateScore.candidateId === 'DENSITY_FIELD'
    )!;
    expect(density.disqualificationCode).toBe('scale-range');
    expect(density.components).toHaveLength(0);
    expect(density.score).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// F-4 — informationPreservation component + CRITICAL-loss hard constraint
// ---------------------------------------------------------------------------

describe('TEC3-MA2 F-4 information-preservation controls (MA1 F-4)', () => {
  it('full preservation vs CRITICAL loss separates D = 1 on the raw component', () => {
    const goals: PreservationGoal[] = [
      { information: 'exact-metric-values', priority: 'CRITICAL' },
    ];
    // POINT_SET preserves exact-metric-values; DISTRIBUTION_FIELD declares it lost.
    const positive = infoScore(goals, 'POINT_SET');
    const negative = infoScore(goals, 'DISTRIBUTION_FIELD');
    expect(positive).toBe(1);
    expect(negative).toBe(0);
    expect((positive - negative) / 1).toBe(1);
  });

  it('a declared type not in preserves and not in loses earns exactly half credit', () => {
    // POINT_SET neither preserves nor loses relational-edge-connectivity.
    const goals: PreservationGoal[] = [
      { information: 'relational-edge-connectivity', priority: 'DESIRED' },
    ];
    expect(infoScore(goals, 'POINT_SET')).toBeCloseTo(0.5, 12);
  });

  it('mixed goals: preserved DESIRED + not-declared loss averages to 0.75', () => {
    const goals: PreservationGoal[] = [
      { information: 'empirical-distribution-shape', priority: 'DESIRED' },
      { information: 'relational-edge-connectivity', priority: 'DESIRED' },
    ];
    // DISTRIBUTION_FIELD preserves empirical-distribution-shape (0.6) and gets
    // half credit for relational-edge-connectivity (0.3) of a 1.2 total.
    expect(infoScore(goals, 'DISTRIBUTION_FIELD')).toBeCloseTo(0.75, 12);
  });

  it('no preservation goals yields the maximum component value', () => {
    expect(infoScore([], 'DISTRIBUTION_FIELD')).toBe(1);
  });

  it('a DESIRED goal lost to zero is observable in live ranking; a lost CRITICAL goal is a disqualification instead', () => {
    // explore + two declared dimensions -> the single DESIRED preservation
    // goal is empirical-bivariate-bin-mass. DENSITY_FIELD preserves it (1.0);
    // POINT_SET neither preserves nor loses it: exactly half credit (0.5).
    const requirements = createDefaultRequirements('explore', ['x', 'y']);
    const decision = new MonetaHypothesisEngine().arbitrate(
      minimalDatasetSignature(200, 2, 0, 0, 'ma2-info-live', 0),
      requirements
    );
    expect(componentRawScore(decision.rankedCandidates ?? [], 'DENSITY_FIELD', 'informationPreservation'))
      .toBe(1);
    expect(componentRawScore(decision.rankedCandidates ?? [], 'POINT_SET', 'informationPreservation'))
      .toBeCloseTo(0.5, 12);

    // separate case: CRITICAL loss. individual-inspection declares
    // individual-observation-identity and exact-metric-values CRITICAL. Every
    // candidate that loses a CRITICAL goal is disqualified by the F-8
    // information-loss-critical constraint before the model scores it, so the
    // CRITICAL branch of scoreInformationPreservation (0.0) is unreachable in
    // live ranking through canonical intake. Observed on the engine path:
    const critical = new MonetaHypothesisEngine().arbitrate(
      minimalDatasetSignature(200, 2, 0, 0, 'ma2-info-critical', 0),
      createDefaultRequirements('individual-inspection')
    );
    const criticalLosers = (critical.rankedCandidates ?? []).filter(
      (candidateScore) => candidateScore.disqualificationCode === 'information-loss-critical'
    );
    expect(criticalLosers.length).toBeGreaterThan(0);
    expect(criticalLosers.map((candidateScore) => candidateScore.candidateId)).toContain(
      'DENSITY_FIELD'
    );
    expect(criticalLosers.every((candidateScore) => candidateScore.components.length === 0)).toBe(
      true
    );
    expect(criticalLosers.every((candidateScore) => candidateScore.score === 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// F-13 — p >= n stability-admission gate
// ---------------------------------------------------------------------------

describe('TEC3-MA2 F-13 p>=n gate boundary controls (MA1 F-13)', () => {
  it('p == n fires the typed ABSTAIN refusal; the same dataset minus one column does not', () => {
    const gateOn = new MonetaHypothesisEngine().arbitrate(
      minimalDatasetSignature(40, 40, 0, 0, 'ma2-p-eq-n', 0),
      createDefaultRequirements('distribution-analysis', ['value'])
    );
    expect(gateOn.decisionStatus).toBe('ABSTAIN');
    expect(gateOn.chosenCandidateId).toBeUndefined();
    const blocked = (gateOn.rankedCandidates ?? []).filter(
      (candidateScore) => candidateScore.disqualificationCode === 'stability-evidence-required'
    );
    expect(blocked.length).toBeGreaterThan(0);
    expect(blocked.every((candidateScore) => candidateScore.score > 0)).toBe(true);
    expect(
      blocked.every((candidateScore) =>
        candidateScore.disqualificationReason?.includes('p >= n (40 features, 40 observations)')
      )
    ).toBe(true);
    expect(gateOn.decisionRationale).toContain('p >= n');

    const gateOff = new MonetaHypothesisEngine().arbitrate(
      minimalDatasetSignature(40, 39, 0, 0, 'ma2-p-lt-n', 0),
      createDefaultRequirements('distribution-analysis', ['value'])
    );
    expect(gateOff.chosenCandidateId).toBeDefined();
    expect(gateOff.decisionStatus).not.toBe('ABSTAIN');
    expect(
      (gateOff.rankedCandidates ?? []).some(
        (candidateScore) => candidateScore.disqualificationCode === 'stability-evidence-required'
      )
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// F-14 — DecisionPolicy thresholds (boundary-localized control pairs)
// ---------------------------------------------------------------------------

describe('TEC3-MA2 F-14 decision-policy boundary pairs (MA1 F-14)', () => {
  const policyCandidate = (
    candidateId: CandidateScore['candidateId'],
    score: number,
    disqualified = false
  ): CandidateScore => ({
    family: 'POINT',
    candidateId,
    layout: 'GRID_3D',
    score,
    components: [],
    disqualified,
    preserves: [],
    loses: [],
  });

  it('minimumUtility 0.35: a winner just below is UNDERDETERMINED, exactly at it is DECISIVE', () => {
    const justBelow = assessRepresentationDecision([
      policyCandidate('POINT_SET', 0.3499),
    ]);
    expect(justBelow.status).toBe('UNDERDETERMINED');
    expect(justBelow.rationale).toMatch(/below the minimum/);

    const justInside = assessRepresentationDecision([
      policyCandidate('POINT_SET', DEFAULT_DECISION_POLICY.minimumUtility),
    ]);
    expect(justInside.status).toBe('DECISIVE');
    expect(justInside.margin).toBeNull();
    // Diagnostic: with a single feasible candidate the DECISIVE verdict comes
    // entirely from uniqueness — the margin thresholds are bypassed even at
    // the minimum-utility boundary itself.
    expect(justInside.rationale).toMatch(/Only one feasible candidate/);
  });

  it('decisiveMargin 0.08: margin just above 0.08 is DECISIVE, just below is AMBIGUOUS', () => {
    const justDecisive = assessRepresentationDecision([
      policyCandidate('POINT_SET', 0.5),
      policyCandidate('DISTRIBUTION_FIELD', 0.42),
    ]);
    // 0.5 - 0.42 lands 1 double-ulp above 0.08 (observed margin
    // 0.0800000000000000015...) — at/above the decisive boundary. The full
    // literal would lose precision, so the relations are pinned instead of the
    // printed digits; the DECISIVE/AMBIGUOUS statuses are the pinned facts.
    expect(justDecisive.status).toBe('DECISIVE');
    expect(justDecisive.margin).toBeCloseTo(0.08, 16);
    expect(justDecisive.margin)
      .toBeGreaterThanOrEqual(DEFAULT_DECISION_POLICY.decisiveMargin);

    const justAmbiguous = assessRepresentationDecision([
      policyCandidate('POINT_SET', 0.5),
      policyCandidate('DISTRIBUTION_FIELD', 0.4201),
    ]);
    // 0.5 - 0.4201 = 0.0799 < 0.08.
    expect(justAmbiguous.status).toBe('AMBIGUOUS');
    expect(justAmbiguous.margin).toBeCloseTo(0.0799, 15);
  });

  it('underdeterminedMargin 0.02: margin just above 0.02 is AMBIGUOUS, just below is UNDERDETERMINED', () => {
    const justAmbiguous = assessRepresentationDecision([
      policyCandidate('POINT_SET', 0.5),
      policyCandidate('DISTRIBUTION_FIELD', 0.48),
    ]);
    // 0.5 - 0.48 lands a few double-ulps above 0.02 (observed margin
    // 0.0200000000000000178...) — at/above the underdetermined boundary but
    // below the decisive one; the relations pin what the literal cannot.
    expect(justAmbiguous.status).toBe('AMBIGUOUS');
    expect(justAmbiguous.margin).toBeCloseTo(0.02, 16);
    expect(justAmbiguous.margin)
      .toBeGreaterThanOrEqual(DEFAULT_DECISION_POLICY.underdeterminedMargin);
    expect(justAmbiguous.margin).toBeLessThan(DEFAULT_DECISION_POLICY.decisiveMargin);

    const justUnderdetermined = assessRepresentationDecision([
      policyCandidate('POINT_SET', 0.5),
      policyCandidate('DISTRIBUTION_FIELD', 0.4801),
    ]);
    // 0.5 - 0.4801 < 0.02; the exact double is pinned.
    expect(justUnderdetermined.status).toBe('UNDERDETERMINED');
    expect(justUnderdetermined.margin).toBe(0.019899999999999973);
    expect(justUnderdetermined.rationale).toMatch(/effectively tied/);
  });

  it('INFEASIBLE vs one-feasible boundary: the last feasible candidate decides alone', () => {
    const infeasible = assessRepresentationDecision([
      policyCandidate('POINT_SET', 0.9, true),
      policyCandidate('DISTRIBUTION_FIELD', 0.85, true),
    ]);
    expect(infeasible.status).toBe('INFEASIBLE');
    expect(infeasible.winner).toBeNull();

    const oneFeasible = assessRepresentationDecision([
      policyCandidate('POINT_SET', 0.9, true),
      policyCandidate('DISTRIBUTION_FIELD', 0.4),
    ]);
    expect(oneFeasible.status).toBe('DECISIVE');
    expect(oneFeasible.winner?.candidateId).toBe('DISTRIBUTION_FIELD');
    expect(oneFeasible.margin).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// F-15 — weight-sensitivity winnerChangeRate
// ---------------------------------------------------------------------------

describe('TEC3-MA2 F-15 weight-sensitivity controls (MA1 F-15)', () => {
  // Hand-authored two-candidate fixture over the frozen v5 weights. The ranker
  // applies the production functional form U = sum_i w_i * u_i to hand-authored
  // component raw scores; A draws everything from task (w=0.25), B from
  // structure (w=0.30) with a proportional component.
  const rankerFor = (bStructure: number) => (weights: typeof DEFAULT_BOOTSTRAP_FITNESS_WEIGHTS) => {
    const a = weights.task;
    const b = weights.structure * bStructure;
    return a >= b ? 'A:GRID_3D' : 'B:GRID_3D';
  };

  it('a 1% base margin flips under a single +/-10% perturbation (2 of 14 scenarios)', () => {
    // A: task 1.0 -> U_A = 0.25. B: structure 0.83 -> U_B = 0.249.
    // Base margin 0.0035 of utility; structure +10% (0.33/1.03 normalized)
    // and task -10% both flip the winner.
    const result = analyzeWinnerSensitivity(
      'A:GRID_3D',
      DEFAULT_BOOTSTRAP_FITNESS_WEIGHTS,
      rankerFor(0.83),
      0.1
    );
    expect(result.scenarioCount).toBe(14);
    expect(result.winnerChanges).toBe(2);
    expect(result.winnerChangeRate).toBeCloseTo(2 / 14, 12);
    expect(result.stable).toBe(false);
    const flipped = result.scenarios
      .filter((scenario) => scenario.winnerChanged)
      .map((scenario) => `${scenario.dimension}:${scenario.direction}`)
      .sort();
    expect(flipped).toEqual(['structure:increase', 'task:decrease']);
    expect(result.scenarios.every((scenario) => scenario.winnerKey !== null)).toBe(true);
  });

  it('no flip when the base margin exceeds the +/-10% band (0 of 14)', () => {
    // A: task 1.0 -> U_A = 0.25. B: structure 0.75 -> U_B = 0.225. Base margin
    // 0.025; structure +10% moves B to 0.2475 < 0.25, still A.
    const result = analyzeWinnerSensitivity(
      'A:GRID_3D',
      DEFAULT_BOOTSTRAP_FITNESS_WEIGHTS,
      rankerFor(0.75),
      0.1
    );
    expect(result.scenarioCount).toBe(14);
    expect(result.winnerChanges).toBe(0);
    expect(result.winnerChangeRate).toBe(0);
    expect(result.stable).toBe(true);
  });

  it('the production-path readback on a canonical fixture reports its observed rate', () => {
    const requirements = createDefaultRequirements('explore', ['x', 'y']);
    const decision = new MonetaHypothesisEngine().arbitrate(
      minimalDatasetSignature(200, 2, 0, 0, 'ma2-sensitivity-live', 0),
      requirements
    );
    expect(decision.weightSensitivity?.scenarioCount).toBe(14);
    expect(decision.weightSensitivity?.winnerChangeRate).toBe(0);
    expect(decision.weightSensitivity?.stable).toBe(true);
    // Pin the base gap the report's margin diagnostic cites: the observed
    // ranked utilities are DENSITY_FIELD 0.6515, MATRIX_FIELD 0.3735,
    // POINT_SET 0.3510 — a base margin (≈ 0.278) far above the ±10% band, so
    // the 0-rate is a property of this fixture's gap, not an artifact.
    expect(decision.rankedCandidates?.[0].candidateId).toBe('DENSITY_FIELD');
    expect(decision.rankedCandidates?.[0].score).toBeCloseTo(0.6515, 6);
    expect(decision.rankedCandidates?.[1].candidateId).toBe('MATRIX_FIELD');
    expect(decision.rankedCandidates?.[1].score).toBeCloseTo(0.3735, 6);
  });
});

// ---------------------------------------------------------------------------
// F-16 — signature equality admission gate
// ---------------------------------------------------------------------------

describe('TEC3-MA2 F-16 signature equality gate controls (MA1 F-16)', () => {
  const gateProfile = createMonetaStructureProfile({
    datasetName: 'ma2-signature-gate',
    rowCount: 200,
    columnCount: 3,
    numericColumns: 3,
    categoricalColumns: 0,
  });
  const authoritative = datasetEvidenceToSignature(
    structureProfileToDatasetEvidence(gateProfile)
  );

  const tamperCases: Array<[string, (provided: DatasetSignature) => void]> = [
    ['dataset fingerprint', (sig) => { sig.provenance.datasetFingerprint = 'tampered'; }],
    ['kernel version', (sig) => { sig.provenance.kernelVersion = 'other-kernel'; }],
    ['row count', (sig) => { sig.cardinality.rowCount = 201; }],
    ['column count', (sig) => { sig.cardinality.columnCount = 4; }],
    ['edge count', (sig) => { sig.cardinality.edgeCount = 1; }],
    ['hierarchy depth', (sig) => { sig.cardinality.depth = 2; }],
    ['numeric column count', (sig) => { sig.schema.numericCount = 4; }],
    ['categorical column count', (sig) => { sig.schema.categoricalCount = 1; }],
    ['temporal column count', (sig) => { sig.schema.temporalCount = 1; }],
    ['outlier presence', (sig) => { sig.distribution.hasOutliers = true; }],
    ['high variance', (sig) => { sig.distribution.highVariance = true; }],
    ['cluster presence', (sig) => { sig.clusterStructure.hasClusters = true; }],
    ['topology', (sig) => { sig.topologicalStructure.topology = 'HIERARCHY'; }],
    ['time-series structure', (sig) => { sig.temporalStructure.isTimeSeries = true; }],
    ['spectral periodicity', (sig) => {
      sig.spectralStructure = {
        dominantFrequencies: [1],
        spectralEntropy: 0.5,
        powerSpectrumPeak: 0.5,
        hasPeriodicity: true,
      };
    }],
  ];

  it('an exact match passes', () => {
    expect(() =>
      assertDecisionRelevantSignatureMatchesEvidence(
        structuredClone(authoritative),
        authoritative
      )
    ).not.toThrow();
  });

  it.each(tamperCases.map(([label]) => [label]))(
    'refuses when a caller signature tampers the %s field',
    (label) => {
      const provided = structuredClone(authoritative);
      const mutate = tamperCases.find(([caseLabel]) => caseLabel === label)![1];
      mutate(provided);
      expect(() =>
        assertDecisionRelevantSignatureMatchesEvidence(provided, authoritative)
      ).toThrow(/mismatch/);
    }
  );

  it('the deliberate densityVariation exclusion: tampering only that field still passes', () => {
    // authoritative carries no densityVariation (canonical evidence never
    // emits it); a caller-supplied value is passed through to the
    // FitnessModel's own epistemic gate, not compared here.
    expect(authoritative.clusterStructure.densityVariation).toBeUndefined();
    const withDensityVariation = structuredClone(authoritative);
    withDensityVariation.clusterStructure.densityVariation = 0.42;
    expect(() =>
      assertDecisionRelevantSignatureMatchesEvidence(withDensityVariation, authoritative)
    ).not.toThrow();
  });

  it('production path: EvidenceBackedMoneta accepts a matching signature and refuses a tampered one', () => {
    const evidence = structureProfileToDatasetEvidence(gateProfile);
    const backed = new EvidenceBackedMoneta();
    expect(() =>
      backed.arbitrate(evidence, structuredClone(authoritative), createDefaultRequirements('explore', ['x', 'y']))
    ).not.toThrow();

    const tampered = structuredClone(authoritative);
    tampered.cardinality.rowCount = 201;
    expect(() =>
      backed.arbitrate(evidence, tampered, createDefaultRequirements('explore', ['x', 'y']))
    ).toThrow(/row count/);
  });
});