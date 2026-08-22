export interface MonetaComputeBudget {
  maxCandidates: number;
  maxSensitivityScenarios: number;
}

export interface MonetaComputationStats {
  candidateCount: number;
  sensitivityScenarioCount: number;
}

export const DEFAULT_MONETA_COMPUTE_BUDGET: Readonly<MonetaComputeBudget> = Object.freeze({
  maxCandidates: 256,
  maxSensitivityScenarios: 64,
});

function positiveInteger(value: number, label: string): number {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive finite integer`);
  }
  return value;
}

export function resolveMonetaComputeBudget(
  override: Partial<MonetaComputeBudget> = {}
): Readonly<MonetaComputeBudget> {
  return Object.freeze({
    maxCandidates: positiveInteger(
      override.maxCandidates ?? DEFAULT_MONETA_COMPUTE_BUDGET.maxCandidates,
      'Moneta maxCandidates'
    ),
    maxSensitivityScenarios: positiveInteger(
      override.maxSensitivityScenarios ?? DEFAULT_MONETA_COMPUTE_BUDGET.maxSensitivityScenarios,
      'Moneta maxSensitivityScenarios'
    ),
  });
}

export function assertMonetaWithinComputeBudget(
  stats: MonetaComputationStats,
  budget: Readonly<MonetaComputeBudget> = DEFAULT_MONETA_COMPUTE_BUDGET
): void {
  if (stats.candidateCount > budget.maxCandidates) {
    throw new RangeError(
      `Moneta candidate budget exceeded: ${stats.candidateCount} > ${budget.maxCandidates}`
    );
  }
  if (stats.sensitivityScenarioCount > budget.maxSensitivityScenarios) {
    throw new RangeError(
      `Moneta sensitivity budget exceeded: ${stats.sensitivityScenarioCount} > ${budget.maxSensitivityScenarios}`
    );
  }
}
