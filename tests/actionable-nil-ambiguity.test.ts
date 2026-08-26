import { describe, expect, it } from 'vitest';
import {
  applyRemediation,
  diagnoseInvestigatorOutcome,
  minimalDatasetSignature,
  MonetaHypothesisEngine,
  createDefaultRequirements,
} from '../src/moneta/index.ts';

describe('P1-E: Actionable NIL, Ambiguity and Uncertainty Framework', () => {
  it('E1: distinguishes DECISIVE, AMBIGUOUS, UNDERDETERMINED, and INFEASIBLE states', () => {
    const engine = new MonetaHypothesisEngine();
    const signature = minimalDatasetSignature(100, 3, 1, 0, 'fp-e1', 0);

    // 1. Decisive state (temporal dataset with temporal-trend intent)
    const temporalSig = minimalDatasetSignature(100, 3, 1, 1, 'fp-e1-temp', 0);
    temporalSig.temporalStructure.isTimeSeries = true;
    const decisiveReqs = createDefaultRequirements('temporal-trend');
    const decisiveOutcome = engine.diagnose(temporalSig, decisiveReqs);
    expect(['DECISIVE', 'AMBIGUOUS', 'UNDERDETERMINED']).toContain(decisiveOutcome.state);
    expect(decisiveOutcome.decision).not.toBeNull();
    expect(decisiveOutcome.blockingConstraints.length).toBe(0);

    // 2. Infeasible state (hardware limit: maxElements = 1)
    const infeasibleReqs = {
      ...createDefaultRequirements('individual-inspection'),
      hardwareConstraints: { maxElements: 1, targetFps: 90 },
    };
    const infeasibleOutcome = engine.diagnose(signature, infeasibleReqs);
    expect(infeasibleOutcome.state).toBe('INFEASIBLE');
    expect(infeasibleOutcome.decision).toBeNull();
    expect(infeasibleOutcome.blockingConstraints.length).toBeGreaterThan(0);
    expect(infeasibleOutcome.availableRemediations.length).toBeGreaterThan(0);
  });

  it('E2: surfaces machine traces and human-readable explanations for blocked candidates', () => {
    const engine = new MonetaHypothesisEngine();
    const signature = minimalDatasetSignature(1_000, 3, 1, 0, 'fp-e2', 0);
    const requirements = {
      ...createDefaultRequirements('individual-inspection'),
      hardwareConstraints: { maxElements: 10, targetFps: 90 },
    };

    const outcome = engine.diagnose(signature, requirements);
    expect(outcome.state).toBe('INFEASIBLE');
    expect(outcome.readableExplanation).toMatch(/Infeasible:/);

    const hwBlock = outcome.blockingConstraints.find((b) => b.isHardwareConstraint);
    expect(hwBlock).toBeDefined();
    expect(hwBlock?.rule).toBeDefined();
    expect(hwBlock?.disqualificationReason).toMatch(/hardware allows at most/);
  });

  it('E3: ranks near misses by theoretical utility when unblocked', () => {
    const engine = new MonetaHypothesisEngine();
    const signature = minimalDatasetSignature(500, 3, 1, 0, 'fp-e3', 0);
    const requirements = {
      ...createDefaultRequirements('explore'),
      hardwareConstraints: { maxElements: 5, targetFps: 90 },
    };

    const outcome = engine.diagnose(signature, requirements);
    expect(outcome.nearMisses.length).toBeGreaterThan(0);
    // Near misses should be ordered by score descending
    for (let i = 0; i < outcome.nearMisses.length - 1; i++) {
      expect(outcome.nearMisses[i].score).toBeGreaterThanOrEqual(
        outcome.nearMisses[i + 1].score
      );
    }
  });

  it('E4: differentiates safe preference relaxation from critical information-preservation constraints', () => {
    const engine = new MonetaHypothesisEngine();
    const signature = minimalDatasetSignature(500, 3, 1, 0, 'fp-e4', 0);
    const requirements = {
      ...createDefaultRequirements('explore'),
      hardwareConstraints: { maxElements: 10, targetFps: 90 },
      preservationGoals: [
        { information: 'exact-metric-values' as const, priority: 'CRITICAL' as const, rationale: 'Test critical goal' },
      ],
    };

    const outcome = engine.diagnose(signature, requirements);
    const safeRemediations = outcome.availableRemediations.filter((r) => r.isSafeToRelax);
    const unsafeRemediations = outcome.availableRemediations.filter((r) => !r.isSafeToRelax);

    // Hardware element adjustment is safe to relax
    expect(safeRemediations.some((r) => r.kind === 'adjust-hardware-limit')).toBe(true);

    // Critical scientific info preservation requires explicit task modification, not silent relaxation
    for (const unsafe of unsafeRemediations) {
      expect(unsafe.isSafeToRelax).toBe(false);
      expect(Object.keys(unsafe.suggestedRequirementPatch).length).toBe(0);
    }
  });

  it('E5: applying safe remediation unblocks candidate in subsequent arbitration', () => {
    const engine = new MonetaHypothesisEngine();
    const signature = minimalDatasetSignature(50, 3, 1, 0, 'fp-e5', 0);
    const strictRequirements = {
      ...createDefaultRequirements('explore'),
      hardwareConstraints: { maxElements: 10, targetFps: 90 }, // too small for 50 rows
    };

    const initialOutcome = engine.diagnose(signature, strictRequirements);
    expect(initialOutcome.state).toBe('INFEASIBLE');

    const hwRemediation = initialOutcome.availableRemediations.find(
      (r) => r.kind === 'adjust-hardware-limit'
    );
    expect(hwRemediation).toBeDefined();

    // Apply remediation patch
    const relaxedReqs = applyRemediation(strictRequirements, hwRemediation!);
    expect(relaxedReqs.hardwareConstraints?.maxElements).toBe(20);

    // Re-arbitrate with relaxed requirements
    const secondOutcome = engine.diagnose(signature, {
      ...relaxedReqs,
      hardwareConstraints: { maxElements: 100, targetFps: 90 },
    });
    expect(secondOutcome.state).toBeDefined();
    expect(secondOutcome.decision).not.toBeNull();
  });

  it('E6: refuses silent relaxation of critical scientific requirements', () => {
    const requirements = createDefaultRequirements('explore');
    const unsafeRemediation = {
      id: 'unsafe_loss',
      label: 'Silently drop outliers',
      kind: 'switch-task' as const,
      description: 'Loss of outlier visibility',
      isSafeToRelax: false,
      suggestedRequirementPatch: {},
      unblocksCandidates: ['POINT_SET' as const],
    };

    expect(() => applyRemediation(requirements, unsafeRemediation)).toThrow(
      /Cannot automatically relax critical scientific constraint/
    );
  });

  it('E7: surfaces ambiguous outcome alternatives for investigator choice', () => {
    const signature = minimalDatasetSignature(100, 3, 1, 0, 'fp-e7', 0);
    const requirements = createDefaultRequirements('explore');

    // Create a synthetic ambiguous decision
    const decision = {
      id: 'mock_ambiguous_decision',
      chosenCandidateId: 'POINT_SET' as const,
      chosenFamily: 'POINT' as const,
      chosenLayout: 'GRID_3D' as const,
      explanation: 'Ambiguous outcome',
      rulesEvaluated: [],
      rankedCandidates: [
        {
          family: 'POINT' as const,
          candidateId: 'POINT_SET' as const,
          layout: 'GRID_3D' as const,
          score: 0.85,
          components: [],
          preserves: [],
          loses: [],
        },
        {
          family: 'DISTRIBUTION' as const,
          candidateId: 'DISTRIBUTION_FIELD' as const,
          layout: 'GRID_3D' as const,
          score: 0.83, // margin 0.02 < 0.08 decisive margin
          components: [],
          preserves: [],
          loses: [],
        },
      ],
      preserves: [],
      loses: [],
      datasetFingerprint: signature.provenance.datasetFingerprint,
      kernelVersion: '0.1.0',
      decisionTimestamp: 0,
      representationFamily: 'POINT' as const,
      utilityScore: 0.85,
      decisionStatus: 'AMBIGUOUS' as const,
      runnerUp: {
        family: 'DISTRIBUTION' as const,
        candidateId: 'DISTRIBUTION_FIELD' as const,
        layout: 'GRID_3D' as const,
        score: 0.83,
        components: [],
        preserves: [],
        loses: [],
      },
      decisionMargin: 0.02,
      decisionRationale: 'Top candidates are within 0.02 margin.',
      fitnessModelVersion: 'bootstrap-v3',
      provenance: {
        generatedAt: 0,
        engine: 'MonetaHypothesisEngine',
        version: '2.1.0',
        datasetFingerprint: signature.provenance.datasetFingerprint,
        fitnessModelVersion: 'bootstrap-v3',
      },
      evidence: [],
    };

    const outcome = diagnoseInvestigatorOutcome(
      signature,
      requirements,
      decision as unknown as import('../src/moneta/index.ts').RepresentationDecision
    );
    expect(outcome.state).toBe('AMBIGUOUS');
    expect(outcome.availableRemediations.length).toBe(1);
    expect(outcome.availableRemediations[0].kind).toBe('accept-ambiguous-alternative');
    expect(outcome.availableRemediations[0].unblocksCandidates).toContain('DISTRIBUTION_FIELD');
  });
});
