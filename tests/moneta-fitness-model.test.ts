import { describe, expect, it } from 'vitest';
import {
  BootstrapFitnessModel,
  DEFAULT_BOOTSTRAP_FITNESS_WEIGHTS,
  validateBootstrapFitnessWeights,
} from '../src/moneta/representation/FitnessModel.ts';
import {
  markDatasetSignatureFact,
  minimalDatasetSignature,
} from '../src/moneta/representation/DatasetSignature.ts';
import { MONETA_REPRESENTATION_CANDIDATES } from '../src/moneta/representation/RepresentationCandidate.ts';
import { createDefaultRequirements } from '../src/moneta/representation/RepresentationRequirements.ts';

describe('V3 BootstrapFitnessModel', () => {
  it('requires all active component weights to sum exactly to one', () => {
    const total = Object.values(DEFAULT_BOOTSTRAP_FITNESS_WEIGHTS).reduce(
      (sum, weight) => sum + weight,
      0
    );
    expect(total).toBeCloseTo(1, 12);

    expect(() =>
      validateBootstrapFitnessWeights({
        ...DEFAULT_BOOTSTRAP_FITNESS_WEIGHTS,
        densityHandling: 0.1,
      })
    ).toThrow(/sum to 1/i);
  });

  it('contains the density component that the previous solver declared but omitted', () => {
    const signature = minimalDatasetSignature(2_000, 3, 0, 0, 'density-fixture', 0);
    signature.clusterStructure.densityVariation = 0.8;
    const requirements = createDefaultRequirements('distribution-analysis', 'MEDIUM');
    const model = new BootstrapFitnessModel();

    const density = model.evaluate(
      signature,
      requirements,
      MONETA_REPRESENTATION_CANDIDATES.DENSITY_FIELD,
      'DISTRIBUTION'
    );
    const points = model.evaluate(
      signature,
      requirements,
      MONETA_REPRESENTATION_CANDIDATES.POINT_SET,
      'POINT'
    );

    const densityComponent = density.components.find((c) => c.dimension === 'densityHandling');
    const pointDensityComponent = points.components.find((c) => c.dimension === 'densityHandling');

    expect(densityComponent).toBeDefined();
    expect(densityComponent?.weight).toBe(DEFAULT_BOOTSTRAP_FITNESS_WEIGHTS.densityHandling);
    expect(densityComponent?.rawScore).toBe(1);
    expect(pointDensityComponent?.rawScore).toBe(0);
  });

  it('does not let a legacy heuristic/unknown densityVariation drive density ranking', () => {
    // Historical signatures carry `clusterStructure.densityVariation` from the
    // retired two-valued Rust proxy (0.25 iff clusters detected). Without a
    // measured/derived epistemic source such a value must not make density
    // relevant: the retired proxy carried no more information than
    // `hasClusters` while appearing as a continuous quantity.
    const signature = minimalDatasetSignature(2_000, 3, 0, 0, 'legacy-density-fixture', 0);
    signature.clusterStructure.densityVariation = 0.25;
    const requirements = createDefaultRequirements('explore', 'MEDIUM');
    requirements.requiredStructures = [];
    const model = new BootstrapFitnessModel();

    for (const source of ['heuristic', 'unknown'] as const) {
      markDatasetSignatureFact(signature.epistemic!, 'clusterStructure.densityVariation', source);
      const evaluation = model.evaluate(
        signature,
        requirements,
        MONETA_REPRESENTATION_CANDIDATES.POINT_SET,
        'POINT'
      );
      const densityComponent = evaluation.components.find((c) => c.dimension === 'densityHandling');
      expect(densityComponent?.rawScore).toBe(1);
    }
  });

  it('still lets explicitly measured or derived densityVariation make density handling relevant', () => {
    // The epistemic gate is the only legitimate route for a density-variation
    // value: an explicitly measured/derived fact may drive density handling
    // even with no declared density requirement. This must survive the removal
    // of the bogus canonical Rust proxy. Both halves of the gate
    // ('measured' and 'derived') are exercised so a regression dropping
    // either one fails here.
    const signature = minimalDatasetSignature(2_000, 3, 0, 0, 'measured-density-fixture', 0);
    signature.clusterStructure.densityVariation = 0.8;
    const requirements = createDefaultRequirements('explore', 'MEDIUM');
    requirements.requiredStructures = [];
    const model = new BootstrapFitnessModel();

    for (const source of ['measured', 'derived'] as const) {
      markDatasetSignatureFact(signature.epistemic!, 'clusterStructure.densityVariation', source);

      // POINT_SET loses `population-density-distribution`, so once density is
      // relevant its density component must be penalized (0), not neutral (1).
      const points = model.evaluate(
        signature,
        requirements,
        MONETA_REPRESENTATION_CANDIDATES.POINT_SET,
        'POINT'
      );
      const pointDensityComponent = points.components.find((c) => c.dimension === 'densityHandling');
      expect(pointDensityComponent?.rawScore, `POINT_SET under ${source}`).toBe(0);

      // A candidate that preserves population density stays at 1 under the same
      // evidence, proving the gated value changes relevance, not the score
      // of every candidate uniformly.
      const densityField = model.evaluate(
        signature,
        requirements,
        MONETA_REPRESENTATION_CANDIDATES.DENSITY_FIELD,
        'DISTRIBUTION'
      );
      const densityFieldComponent = densityField.components.find(
        (c) => c.dimension === 'densityHandling'
      );
      expect(densityFieldComponent?.rawScore, `DENSITY_FIELD under ${source}`).toBe(1);
    }
  });

  it('gives every public structure requirement a defined task-coverage effect', () => {
    const signature = minimalDatasetSignature(500, 4, 0, 0, 'coverage-fixture', 0);
    const model = new BootstrapFitnessModel();
    const requirementTypes = [
      'distribution',
      'cluster-separation',
      'density',
      'temporal-order',
      'periodicity',
      'manifold',
      'hierarchy',
      'connectivity',
      'anomaly-visibility',
      'observation-identity',
      'group-comparison',
    ] as const;

    for (const type of requirementTypes) {
      const requirements = createDefaultRequirements('explore', 'MEDIUM');
      requirements.requiredStructures = [{ type, importance: 1 }];
      const evaluation = model.evaluate(
        signature,
        requirements,
        MONETA_REPRESENTATION_CANDIDATES.POINT_SET,
        'POINT'
      );
      const task = evaluation.components.find((component) => component.dimension === 'task');
      expect(task, `missing task effect for ${type}`).toBeDefined();
      expect(Number.isFinite(task?.rawScore)).toBe(true);
    }
  });

  it('labels preference contribution as configured prior rather than empirical evidence', () => {
    const signature = minimalDatasetSignature(100, 3, 0, 0, 'prior-fixture', 0);
    signature.preferredFamilies = ['POINT'];
    const requirements = createDefaultRequirements('individual-inspection', 'SMALL');
    const evaluation = new BootstrapFitnessModel().evaluate(
      signature,
      requirements,
      MONETA_REPRESENTATION_CANDIDATES.POINT_SET,
      'POINT'
    );

    const prior = evaluation.components.find((component) => component.dimension === 'configuredPrior');
    expect(prior?.rawScore).toBe(1);
    expect(prior?.rationale.toLowerCase()).toContain('not an empirical probability');
  });

  it('never produces utility outside [0, 1]', () => {
    const signature = minimalDatasetSignature(1_000, 5, 0, 0, 'bounded-fixture', 0);
    const requirements = createDefaultRequirements('explore', 'MEDIUM');
    const evaluation = new BootstrapFitnessModel().evaluate(
      signature,
      requirements,
      MONETA_REPRESENTATION_CANDIDATES.DISTRIBUTION_FIELD,
      'DISTRIBUTION'
    );

    expect(evaluation.utilityScore).toBeGreaterThanOrEqual(0);
    expect(evaluation.utilityScore).toBeLessThanOrEqual(1);
    expect(evaluation.components.reduce((sum, component) => sum + component.weight, 0)).toBeCloseTo(
      1,
      12
    );
  });
});
