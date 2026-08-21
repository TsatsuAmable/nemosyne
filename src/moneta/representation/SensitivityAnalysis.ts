import type { BootstrapFitnessWeights } from './FitnessModel.ts';

export interface SensitivityScenario {
  dimension: keyof BootstrapFitnessWeights;
  direction: 'increase' | 'decrease';
  weights: BootstrapFitnessWeights;
  winnerKey: string | null;
  winnerChanged: boolean;
}

export interface WeightSensitivityResult {
  perturbationFraction: number;
  scenarioCount: number;
  winnerChanges: number;
  winnerChangeRate: number;
  stable: boolean;
  scenarios: SensitivityScenario[];
}

function normalizeWeights(weights: BootstrapFitnessWeights): BootstrapFitnessWeights {
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(total) || total <= 0) {
    throw new RangeError('Sensitivity analysis requires a positive finite weight total');
  }

  return Object.fromEntries(
    Object.entries(weights).map(([key, value]) => [key, value / total])
  ) as unknown as BootstrapFitnessWeights;
}

export function generateWeightPerturbations(
  base: BootstrapFitnessWeights,
  perturbationFraction = 0.1
): Array<{
  dimension: keyof BootstrapFitnessWeights;
  direction: 'increase' | 'decrease';
  weights: BootstrapFitnessWeights;
}> {
  if (
    !Number.isFinite(perturbationFraction) ||
    perturbationFraction <= 0 ||
    perturbationFraction >= 1
  ) {
    throw new RangeError('perturbationFraction must be finite and in (0, 1)');
  }

  const dimensions = Object.keys(base) as Array<keyof BootstrapFitnessWeights>;
  const scenarios: Array<{
    dimension: keyof BootstrapFitnessWeights;
    direction: 'increase' | 'decrease';
    weights: BootstrapFitnessWeights;
  }> = [];

  for (const dimension of dimensions) {
    for (const direction of ['decrease', 'increase'] as const) {
      const factor = direction === 'increase' ? 1 + perturbationFraction : 1 - perturbationFraction;
      const perturbed = {
        ...base,
        [dimension]: base[dimension] * factor,
      };
      scenarios.push({
        dimension,
        direction,
        weights: normalizeWeights(perturbed),
      });
    }
  }

  return scenarios;
}

/**
 * Deterministically test whether the selected representation is robust to
 * local perturbations of the bootstrap fitness weights.
 */
export function analyzeWinnerSensitivity(
  baseWinnerKey: string,
  baseWeights: BootstrapFitnessWeights,
  ranker: (weights: BootstrapFitnessWeights) => string | null,
  perturbationFraction = 0.1
): WeightSensitivityResult {
  const scenarios = generateWeightPerturbations(baseWeights, perturbationFraction).map(
    (scenario): SensitivityScenario => {
      const winnerKey = ranker(scenario.weights);
      return {
        ...scenario,
        winnerKey,
        winnerChanged: winnerKey !== baseWinnerKey,
      };
    }
  );

  const winnerChanges = scenarios.filter((scenario) => scenario.winnerChanged).length;
  const scenarioCount = scenarios.length;
  const winnerChangeRate = scenarioCount === 0 ? 0 : winnerChanges / scenarioCount;

  return {
    perturbationFraction,
    scenarioCount,
    winnerChanges,
    winnerChangeRate,
    stable: winnerChanges === 0,
    scenarios,
  };
}
