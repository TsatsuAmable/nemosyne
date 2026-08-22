import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MONETA_COMPUTE_BUDGET,
  MonetaHypothesisEngine,
  assertMonetaWithinComputeBudget,
  createDefaultRequirements,
  minimalDatasetSignature,
} from '../src/moneta/representation/index.ts';

describe('Moneta scalability contract', () => {
  it('keeps representation reasoning bounded as dataset cardinality grows', () => {
    const rowCounts = [10_000, 100_000, 1_000_000, 10_000_000];
    const snapshots = rowCounts.map((rowCount) => {
      const signature = minimalDatasetSignature(rowCount, 3, 1, 0, `scale-${rowCount}`, 0);
      signature.clusterStructure.densityVariation = 0.6;
      const requirements = createDefaultRequirements('distribution-analysis', 'MASSIVE');
      delete requirements.hardwareConstraints.maxElements;

      const decision = new MonetaHypothesisEngine().arbitrate(signature, requirements);
      const stats = {
        candidateCount: decision.rankedCandidates.length,
        sensitivityScenarioCount: decision.weightSensitivity.scenarioCount,
      };
      assertMonetaWithinComputeBudget(stats);
      return stats;
    });

    expect(new Set(snapshots.map((snapshot) => snapshot.candidateCount)).size).toBe(1);
    expect(new Set(snapshots.map((snapshot) => snapshot.sensitivityScenarioCount)).size).toBe(1);
    expect(snapshots[0].candidateCount).toBeLessThanOrEqual(
      DEFAULT_MONETA_COMPUTE_BUDGET.maxCandidates,
    );
    expect(snapshots[0].sensitivityScenarioCount).toBeLessThanOrEqual(
      DEFAULT_MONETA_COMPUTE_BUDGET.maxSensitivityScenarios,
    );
  });

  it('fails closed when bounded reasoning budgets are exceeded', () => {
    expect(() =>
      assertMonetaWithinComputeBudget(
        { candidateCount: 257, sensitivityScenarioCount: 12 },
        DEFAULT_MONETA_COMPUTE_BUDGET,
      ),
    ).toThrow(/candidate budget exceeded/i);

    expect(() =>
      assertMonetaWithinComputeBudget(
        { candidateCount: 10, sensitivityScenarioCount: 65 },
        DEFAULT_MONETA_COMPUTE_BUDGET,
      ),
    ).toThrow(/sensitivity budget exceeded/i);
  });

  it('keeps canonical Moneta reasoning modules free of raw dataset traversal dependencies', () => {
    const files = [
      'src/moneta/representation/FitnessModel.ts',
      'src/moneta/representation/MonetaHypothesisEngine.ts',
      'src/moneta/representation/EvidenceBackedMoneta.ts',
    ];

    for (const file of files) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(source, `${file} must not import Dataset`).not.toMatch(/from ['"][^'"]*Dataset\.ts['"]/);
      expect(source, `${file} must not traverse raw rows`).not.toMatch(/\.rows\b/);
    }
  });
});
