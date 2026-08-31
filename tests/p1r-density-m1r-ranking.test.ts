import { describe, expect, it } from 'vitest';
import {
  BOOTSTRAP_FITNESS_MODEL_VERSION,
  BootstrapFitnessModel,
  FITNESS_TREATMENT_ID,
} from '../src/moneta/representation/FitnessModel.ts';
import {
  MONETA_REPRESENTATION_CANDIDATES,
  type RepresentationCandidate,
} from '../src/moneta/representation/RepresentationCandidate.ts';
import {
  createDefaultRequirements,
  validateRepresentationRequirements,
} from '../src/moneta/representation/RepresentationRequirements.ts';
import { minimalDatasetSignature } from '../src/moneta/representation/DatasetSignature.ts';

function component(
  evaluation: ReturnType<BootstrapFitnessModel['evaluate']>,
  dimension: 'task' | 'informationPreservation' | 'densityHandling',
): number {
  return evaluation.components.find((entry) => entry.dimension === dimension)?.rawScore ?? -1;
}

describe('P1-R Density M1R ranking semantics', () => {
  const signature = minimalDatasetSignature(5_000, 3, 0, 0, 'density-m1r-ranking', 0);

  it('retains the corrected density ontology under the current rank-effective treatment', () => {
    expect(BOOTSTRAP_FITNESS_MODEL_VERSION).toBe('bootstrap-fitness-v4');
    expect(FITNESS_TREATMENT_ID).toBe('fitness-treatment-v4');
  });

  it('asks density tasks for bounded empirical bin mass rather than population density', () => {
    const requirements = createDefaultRequirements('spatial-analysis', 'LARGE');
    expect(requirements.requiredStructures).toContainEqual({ type: 'density', importance: 0.9 });
    expect(requirements.preservationGoals).toContainEqual({
      information: 'empirical-bivariate-bin-mass',
      priority: 'DESIRED',
    });
    expect(requirements.preservationGoals).not.toContainEqual({
      information: 'population-density-distribution',
      priority: 'DESIRED',
    });
    expect(() => validateRepresentationRequirements(requirements)).not.toThrow();
  });

  it('gives the bounded field full generic density-task credit without granting continuous-density semantics', () => {
    const requirements = createDefaultRequirements('spatial-analysis', 'LARGE');
    const candidate = MONETA_REPRESENTATION_CANDIDATES.DENSITY_FIELD;
    const evaluation = new BootstrapFitnessModel().evaluate(
      signature,
      requirements,
      candidate,
      'DISTRIBUTION',
    );

    expect(candidate.supports).not.toContain('continuous-density');
    expect(candidate.preserves).not.toContain('population-density-distribution');
    expect(candidate.loses).toContain('population-density-distribution');
    expect(component(evaluation, 'task')).toBe(1);
    expect(component(evaluation, 'informationPreservation')).toBe(1);
    expect(component(evaluation, 'densityHandling')).toBe(1);
  });

  it('does not treat large cardinality by itself as density evidence', () => {
    const requirements = createDefaultRequirements('individual-inspection', 'LARGE');
    requirements.requiredStructures = [];
    requirements.preservationGoals = [];
    const evaluation = new BootstrapFitnessModel().evaluate(
      minimalDatasetSignature(250_000, 3, 0, 0, 'density-m1r-cardinality-only', 0),
      requirements,
      MONETA_REPRESENTATION_CANDIDATES.POINT_SET,
      'POINT',
    );

    expect(component(evaluation, 'densityHandling')).toBe(1);
  });

  it('does not award full density-handling credit to a one-sided continuous-density claim', () => {
    const requirements = createDefaultRequirements('spatial-analysis', 'LARGE');
    const partialContinuous: RepresentationCandidate = {
      ...MONETA_REPRESENTATION_CANDIDATES.DENSITY_FIELD,
      id: 'DENSITY_FIELD',
      supports: ['continuous-density'],
      preserves: [],
      loses: [
        'individual-observation-identity',
        'exact-metric-values',
        'empirical-bivariate-bin-mass',
        'empirical-distribution-shape',
        'outlier-boundary-visibility',
      ],
    };
    const evaluation = new BootstrapFitnessModel().evaluate(
      signature,
      requirements,
      partialContinuous,
      'DISTRIBUTION',
    );

    expect(component(evaluation, 'densityHandling')).toBe(0.75);
  });

  it('scores an explicit population-density preservation demand as unmet by the binned field', () => {
    const requirements = createDefaultRequirements('spatial-analysis', 'LARGE');
    requirements.preservationGoals = [
      { information: 'population-density-distribution', priority: 'CRITICAL' },
    ];
    const evaluation = new BootstrapFitnessModel().evaluate(
      signature,
      requirements,
      MONETA_REPRESENTATION_CANDIDATES.DENSITY_FIELD,
      'DISTRIBUTION',
    );

    expect(component(evaluation, 'informationPreservation')).toBe(0);
  });
});
