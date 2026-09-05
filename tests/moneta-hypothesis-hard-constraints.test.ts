import { describe, expect, it } from 'vitest';
import {
  createDefaultRequirements,
  minimalDatasetSignature,
  MonetaHypothesisEngine,
  NoFeasibleRepresentationError,
} from '../src/moneta/index.ts';

describe('Moneta hypothesis hard constraints', () => {
  it('returns a typed infeasibility outcome rather than selecting a disqualified candidate', () => {
    const signature = minimalDatasetSignature(1_000, 3, 1, 0, 'hardware-infeasible', 0);
    const requirements = createDefaultRequirements('individual-inspection');
    requirements.hardwareConstraints = { ...requirements.hardwareConstraints, maxElements: 1 };

    expect(() => new MonetaHypothesisEngine().arbitrate(signature, requirements)).toThrow(
      NoFeasibleRepresentationError
    );
  });

  it('keeps the rendered strategy layout identical to the ranked winner', () => {
    const signature = minimalDatasetSignature(100, 3, 1, 1, 'temporal-fp', 0);
    signature.temporalStructure.isTimeSeries = true;
    const decision = new MonetaHypothesisEngine().arbitrate(
      signature,
      createDefaultRequirements('temporal-trend')
    );

    expect(decision.embodiment.primaryLayout).toBe(decision.chosenLayout);
    expect(decision.embodiment.spatialStrategy.macroLayout.layout).toBe(decision.chosenLayout);
    expect(decision.provenance.generatedAt).toBe(0);
  });

  it('does not permit an invalid hypothesis-weight vector', () => {
    expect(() => new MonetaHypothesisEngine({ w_struct: -0.1 })).toThrow(/finite non-negative/);
    expect(() => new MonetaHypothesisEngine({ w_struct: 0.5 })).toThrow(/sum to 1/);
  });

  it('includes hardware in the canonicalised requirements identity and stays deterministic', () => {
    const signature = minimalDatasetSignature(100, 3, 1, 0, 'hash-fp', 0);
    const quest = createDefaultRequirements('explore');
    const desktop = createDefaultRequirements('explore');
    desktop.hardwareConstraints = {
      ...desktop.hardwareConstraints,
      deviceTier: 'desktop',
      maxDrawCalls: 60,
    };

    const engine = new MonetaHypothesisEngine();
    const first = engine.arbitrate(signature, quest);
    const second = engine.arbitrate(signature, quest);
    const hardwareChanged = engine.arbitrate(signature, desktop);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.embodiment.spatialStrategy.provenance.requirementsHash).not.toBe(
      hardwareChanged.embodiment.spatialStrategy.provenance.requirementsHash
    );
  });

  it('refuses field-bound semantic candidates when overview intent declares no analytical dimensions', () => {
    const signature = minimalDatasetSignature(1_000, 4, 2, 0, 'implicit-dimension-fp', 0);
    const requirements = createDefaultRequirements('overview', 'MEDIUM');
    const decision = new MonetaHypothesisEngine().arbitrate(signature, requirements);
    const rankedCandidates = decision.rankedCandidates ?? [];

    const density = rankedCandidates.filter(
      (candidate) => candidate.candidateId === 'DENSITY_FIELD'
    );
    const distribution = rankedCandidates.filter(
      (candidate) => candidate.candidateId === 'DISTRIBUTION_FIELD'
    );

    expect(requirements.primaryDimensions).toBeUndefined();
    expect(density.length).toBeGreaterThan(0);
    expect(distribution.length).toBeGreaterThan(0);
    expect(
      density.every(
        (candidate) =>
          candidate.disqualified &&
          candidate.disqualificationCode === 'analytical-dimensions-required'
      )
    ).toBe(true);
    expect(
      distribution.every(
        (candidate) =>
          candidate.disqualified &&
          candidate.disqualificationCode === 'analytical-dimensions-required'
      )
    ).toBe(true);
    expect(['DENSITY_FIELD', 'DISTRIBUTION_FIELD']).not.toContain(decision.chosenCandidateId);
  });

  it('admits each field-bound candidate only at its exact declared dimensionality', () => {
    const signature = minimalDatasetSignature(1_000, 4, 2, 0, 'explicit-dimension-fp', 0);
    const engine = new MonetaHypothesisEngine();

    const distributionRequirements = createDefaultRequirements('overview', 'MEDIUM');
    distributionRequirements.primaryDimensions = ['units'];
    const distributionDecision = engine.arbitrate(signature, distributionRequirements);
    const distribution = (distributionDecision.rankedCandidates ?? []).filter(
      (candidate) => candidate.candidateId === 'DISTRIBUTION_FIELD'
    );

    const densityRequirements = createDefaultRequirements('overview', 'MEDIUM');
    densityRequirements.primaryDimensions = ['units', 'revenue'];
    const densityDecision = engine.arbitrate(signature, densityRequirements);
    const density = (densityDecision.rankedCandidates ?? []).filter(
      (candidate) => candidate.candidateId === 'DENSITY_FIELD'
    );

    expect(distribution.length).toBeGreaterThan(0);
    expect(
      distribution.some(
        (candidate) => candidate.disqualificationCode === 'analytical-dimensions-required'
      )
    ).toBe(false);
    expect(density.length).toBeGreaterThan(0);
    expect(
      density.some((candidate) => candidate.disqualificationCode === 'analytical-dimensions-required')
    ).toBe(false);
  });

  it('keeps blank, duplicate, or surplus analytical dimensions fail-closed', () => {
    const signature = minimalDatasetSignature(1_000, 4, 2, 0, 'invalid-dimension-fp', 0);
    const engine = new MonetaHypothesisEngine();

    for (const primaryDimensions of [
      ['', 'revenue'],
      ['units', 'units'],
      ['units', 'revenue', 'margin'],
    ]) {
      const requirements = createDefaultRequirements('overview', 'MEDIUM');
      requirements.primaryDimensions = primaryDimensions;
      const decision = engine.arbitrate(signature, requirements);
      const density = (decision.rankedCandidates ?? []).filter(
        (candidate) => candidate.candidateId === 'DENSITY_FIELD'
      );

      expect(density.length).toBeGreaterThan(0);
      expect(
        density.every(
          (candidate) =>
            candidate.disqualified &&
            candidate.disqualificationCode === 'analytical-dimensions-required'
        )
      ).toBe(true);
    }

    const distributionRequirements = createDefaultRequirements('overview', 'MEDIUM');
    distributionRequirements.primaryDimensions = ['units', 'revenue'];
    const distributionDecision = engine.arbitrate(signature, distributionRequirements);
    const distribution = (distributionDecision.rankedCandidates ?? []).filter(
      (candidate) => candidate.candidateId === 'DISTRIBUTION_FIELD'
    );
    expect(distribution.length).toBeGreaterThan(0);
    expect(
      distribution.every(
        (candidate) =>
          candidate.disqualified &&
          candidate.disqualificationCode === 'analytical-dimensions-required'
      )
    ).toBe(true);
  });
});
