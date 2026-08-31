import { describe, it, expect } from 'vitest';
import { SYNTHETIC_FIXTURES } from './synthetic/representation-fixtures.ts';
import {
  RepresentationHypothesisEngine,
  createSourceRelationshipGraphAuthority,
} from '../src/moneta/index.ts';

describe('Phase 8: Synthetic Dataset Validation Suite', () => {
  describe.each(SYNTHETIC_FIXTURES)('$name ($expectedFamily)', (fixture) => {
    it(`correctly selects ${fixture.expectedFamily} with explainable evidence`, () => {
      // Cluster fixtures are hypothesis-only synthetic facts and therefore have no
      // resident named columns to validate. Under the governed R2D V1 contract we
      // still make source authority explicit here instead of letting cluster-like
      // evidence or a categorical count stand in for analyst intent. Rust remains
      // responsible for validating these names against a real resident dataset.
      //
      // Graph fixtures likewise describe a source-provided graph by construction.
      // R2E B1 requires that source meaning to be explicit; GRAPH topology and a
      // positive edge count alone are deliberately not scientific authority.
      const requirements =
        fixture.expectedFamily === 'CLUSTER'
          ? {
              ...fixture.requirements,
              primaryDimensions: ['x', 'y'],
              clusterAuthority: {
                kind: 'SOURCE_PARTITION' as const,
                field: 'clusterLabel',
              },
            }
          : fixture.expectedFamily === 'GRAPH'
            ? {
                ...fixture.requirements,
                graphAuthority: createSourceRelationshipGraphAuthority('UNDIRECTED'),
              }
            : fixture.requirements;

      const decision = RepresentationHypothesisEngine.reason(
        fixture.facts,
        null,
        requirements,
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
