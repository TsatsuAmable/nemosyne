import { describe, expect, it } from 'vitest';
import {
  analyzeWinnerSensitivity,
  generateWeightPerturbations,
} from '../src/moneta/representation/SensitivityAnalysis.ts';
import { DEFAULT_BOOTSTRAP_FITNESS_WEIGHTS } from '../src/moneta/representation/FitnessModel.ts';

describe('Moneta weight sensitivity analysis', () => {
  it('generates deterministic +/- perturbations for every active dimension', () => {
    const scenarios = generateWeightPerturbations(DEFAULT_BOOTSTRAP_FITNESS_WEIGHTS, 0.1);

    expect(scenarios).toHaveLength(Object.keys(DEFAULT_BOOTSTRAP_FITNESS_WEIGHTS).length * 2);
    for (const scenario of scenarios) {
      const total = Object.values(scenario.weights).reduce((sum, weight) => sum + weight, 0);
      expect(total).toBeCloseTo(1, 12);
      expect(Object.values(scenario.weights).every((weight) => weight >= 0)).toBe(true);
    }
  });

  it('reports a stable winner when local perturbations do not change ranking', () => {
    const result = analyzeWinnerSensitivity(
      'A',
      DEFAULT_BOOTSTRAP_FITNESS_WEIGHTS,
      () => 'A',
      0.1
    );

    expect(result.stable).toBe(true);
    expect(result.winnerChanges).toBe(0);
    expect(result.winnerChangeRate).toBe(0);
  });

  it('reports the fraction of perturbations that change the winner', () => {
    let calls = 0;
    const result = analyzeWinnerSensitivity(
      'A',
      DEFAULT_BOOTSTRAP_FITNESS_WEIGHTS,
      () => (++calls % 2 === 0 ? 'B' : 'A'),
      0.1
    );

    expect(result.scenarioCount).toBe(14);
    expect(result.winnerChanges).toBe(7);
    expect(result.winnerChangeRate).toBeCloseTo(0.5, 12);
    expect(result.stable).toBe(false);
  });

  it('rejects meaningless perturbation ranges', () => {
    expect(() => generateWeightPerturbations(DEFAULT_BOOTSTRAP_FITNESS_WEIGHTS, 0)).toThrow();
    expect(() => generateWeightPerturbations(DEFAULT_BOOTSTRAP_FITNESS_WEIGHTS, 1)).toThrow();
  });
});
