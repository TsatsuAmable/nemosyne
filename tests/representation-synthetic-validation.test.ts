import { describe, it, expect } from 'vitest';
import { SYNTHETIC_FIXTURES } from './synthetic/representation-fixtures.ts';
import { RepresentationHypothesisEngine } from '../src/moneta/index.ts';

describe('Phase 8: Synthetic Dataset Validation Suite', () => {
  describe.each(SYNTHETIC_FIXTURES)('$name ($expectedFamily)', (fixture) => {
    it(`correctly selects ${fixture.expectedFamily} with explainable evidence`, () => {
      const decision = RepresentationHypothesisEngine.reason(
        fixture.facts,
        null,
        fixture.requirements,
        {
          spectralFacts: fixture.spectralFacts,
          datasetFingerprint: `synth-${fixture.name}`,
        }
      );

      expect(decision.representationFamily).toBe(fixture.expectedFamily);
      expect(decision.utilityScore).toBeGreaterThanOrEqual(fixture.minConfidence);
      expect(decision.evidence.length).toBeGreaterThan(0);
      expect(decision.rejectedAlternatives.length).toBeGreaterThan(0);

      if (fixture.name === 'anomalous-outliers') {
        expect(decision.chosenCandidateId).toBe('DISTRIBUTION_FIELD');
        expect(decision.preserves).toContain('empirical-distribution-shape');
        expect(decision.loses).toContain('population-density-distribution');
        expect(decision.loses).toContain('outlier-boundary-visibility');
      }

      // Verify all rejected alternatives have explanatory reasons
      for (const alt of decision.rejectedAlternatives) {
        expect(alt.reason.length).toBeGreaterThan(0);
        expect(alt.family).not.toBe(decision.representationFamily);
      }
    });
  });
});
