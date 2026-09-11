import { describe, expect, it } from 'vitest';
import { MONETA_BENCHMARK_FAMILIES, benchmarkFamiliesForAutomation, benchmarkFamiliesRequiringHumans } from '../dev/xr-lab/MonetaBenchmarkCorpus.ts';

describe('Moneta benchmark corpus registry', () => {
  it('contains exact generative, labeled/task and preference evidence without conflating them', () => {
    const strengths = new Set(Object.values(MONETA_BENCHMARK_FAMILIES).map((x) => x.oracleStrength));
    expect(strengths).toContain('exact-generative');
    expect(strengths).toContain('labeled-ground-truth');
    expect(strengths).toContain('task-solution');
    expect(strengths).toContain('human-preference');
  });

  it('keeps human preference benchmarks explicitly human-dependent', () => {
    for (const family of Object.values(MONETA_BENCHMARK_FAMILIES).filter((x) => x.oracleStrength === 'human-preference')) {
      expect(family.requiresHumanValidation).toBe(true);
    }
  });

  it('supports machine-first falsification while preserving a later human-validation set', () => {
    expect(benchmarkFamiliesForAutomation().length).toBeGreaterThan(3);
    expect(benchmarkFamiliesRequiringHumans().length).toBeGreaterThan(3);
    expect(MONETA_BENCHMARK_FAMILIES['synthetic-structure-lab'].requiresHumanValidation).toBe(false);
    expect(MONETA_BENCHMARK_FAMILIES['vast-ground-truth'].requiresHumanValidation).toBe(true);
  });
});
