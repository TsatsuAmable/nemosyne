import { describe, expect, it } from 'vitest';
import {
  BOOTSTRAP_FITNESS_MODEL_VERSION,
} from '../src/moneta/representation/FitnessModel.ts';
import { MonetaHypothesisEngine } from '../src/moneta/representation/MonetaHypothesisEngine.ts';
import { minimalDatasetSignature } from '../src/moneta/representation/DatasetSignature.ts';
import { createDefaultRequirements } from '../src/moneta/representation/RepresentationRequirements.ts';

describe('Moneta V3 live hypothesis engine', () => {
  it('routes candidate ranking through the explicit versioned fitness model', () => {
    const signature = minimalDatasetSignature(2_000, 4, 0, 0, 'v3-live-density', 0);
    signature.clusterStructure.densityVariation = 0.75;
    const requirements = createDefaultRequirements('distribution-analysis', 'MEDIUM');

    const decision = new MonetaHypothesisEngine().arbitrate(signature, requirements);
    const winner = decision.rankedCandidates?.find((candidate) => !candidate.disqualified);

    expect(decision.fitnessModelVersion).toBe(BOOTSTRAP_FITNESS_MODEL_VERSION);
    expect(decision.provenance.fitnessModelVersion).toBe(BOOTSTRAP_FITNESS_MODEL_VERSION);
    expect(decision.embodiment.spatialStrategy.provenance.fitnessModelVersion).toBe(
      BOOTSTRAP_FITNESS_MODEL_VERSION
    );
    expect(winner?.components.map((component) => component.component)).toContain('densityHandling');
    expect(winner?.components.map((component) => component.component)).toContain('configuredPrior');
    expect(winner?.components.map((component) => component.component)).not.toContain('empirical_prior');
  });

  it('returns decision status and margin instead of presenting utility as confidence', () => {
    const signature = minimalDatasetSignature(1_000, 4, 0, 0, 'v3-live-status', 0);
    const requirements = createDefaultRequirements('explore', 'MEDIUM');

    const decision = new MonetaHypothesisEngine().arbitrate(signature, requirements);

    expect(['DECISIVE', 'AMBIGUOUS', 'UNDERDETERMINED']).toContain(decision.decisionStatus);
    expect(decision.utilityScore).toBeGreaterThanOrEqual(0);
    expect(decision.utilityScore).toBeLessThanOrEqual(1);
    expect(decision.confidenceScore).toBeUndefined();
    expect(decision.confidence).toBeUndefined();
    if (decision.runnerUp) {
      expect(decision.decisionMargin).toBeCloseTo(
        decision.utilityScore - decision.runnerUp.score,
        12
      );
    }
  });

  it('attaches deterministic local weight sensitivity rather than implying certainty', () => {
    const signature = minimalDatasetSignature(1_200, 4, 0, 0, 'v3-live-sensitivity', 0);
    signature.clusterStructure.densityVariation = 0.5;
    const requirements = createDefaultRequirements('explore', 'MEDIUM');

    const decision = new MonetaHypothesisEngine().arbitrate(signature, requirements);

    expect(decision.weightSensitivity).toBeDefined();
    expect(decision.weightSensitivity?.scenarioCount).toBe(14);
    expect(decision.weightSensitivity?.perturbationFraction).toBe(0.1);
    expect(decision.weightSensitivity?.winnerChangeRate).toBeGreaterThanOrEqual(0);
    expect(decision.weightSensitivity?.winnerChangeRate).toBeLessThanOrEqual(1);
    expect(decision.explanation).toMatch(/weight perturbations/i);
  });

  it('keeps deterministic decisions for identical frozen inputs', () => {
    const signature = minimalDatasetSignature(800, 3, 0, 0, 'v3-live-determinism', 0);
    const requirements = createDefaultRequirements('identify-outliers', 'MEDIUM');
    signature.distribution.hasOutliers = true;
    signature.distribution.anomalyCount = 5;

    const engine = new MonetaHypothesisEngine();
    const first = engine.arbitrate(signature, requirements);
    const second = engine.arbitrate(signature, requirements);

    expect(second.chosenCandidateId).toBe(first.chosenCandidateId);
    expect(second.chosenLayout).toBe(first.chosenLayout);
    expect(second.utilityScore).toBe(first.utilityScore);
    expect(second.decisionStatus).toBe(first.decisionStatus);
    expect(second.decisionMargin).toBe(first.decisionMargin);
    expect(second.weightSensitivity).toEqual(first.weightSensitivity);
    expect(second.provenance).toEqual(first.provenance);
  });
});
