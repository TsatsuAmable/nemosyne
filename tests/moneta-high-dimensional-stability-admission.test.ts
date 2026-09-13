import { describe, expect, it } from 'vitest';
import {
  adjudicateMonetaEvidence,
  type MonetaEvidenceCandidate,
} from '../dev/xr-lab/MonetaEvidenceProtocol.ts';

const base = (): MonetaEvidenceCandidate => ({
  candidateId: 'candidate-a',
  oracleStrength: 'exact-generative',
  measurementScales: ['ratio'],
  compositionHandling: 'not-applicable',
  sampleSize: 20,
  featureCount: 200,
  selectionMode: 'fixed-before-data',
  makesInferentialClaim: false,
  calibration: 'not-applicable',
  requiresHumanValidation: false,
  humanValidationObserved: false,
});

describe('Moneta high-dimensional stability admission', () => {
  it('does not treat an unqualified perturbation score as promotion evidence', () => {
    const decision = adjudicateMonetaEvidence({
      ...base(),
      perturbation: { runs: 100, metric: 'candidate-rank-stability', value: 0.99 },
    });
    expect(decision.disposition).toBe('ABSTAIN');
    expect(decision.flags.stabilityEvidencePresent).toBe(false);
  });

  it('does not promote when the pre-specified criterion fails', () => {
    const decision = adjudicateMonetaEvidence({
      ...base(),
      perturbation: {
        runs: 100,
        metric: 'candidate-rank-stability',
        value: 0.41,
        acceptance: {
          direction: 'at-least',
          threshold: 0.8,
          source: 'pre-registered-protocol',
          criterionId: 'MONETA-HD-STABILITY-v1',
        },
      },
    });
    expect(decision.disposition).toBe('ABSTAIN');
    expect(decision.flags.stabilityEvidencePresent).toBe(false);
  });

  it('permits promotion only when the governed criterion passes', () => {
    const decision = adjudicateMonetaEvidence({
      ...base(),
      perturbation: {
        runs: 100,
        metric: 'candidate-rank-stability',
        value: 0.91,
        acceptance: {
          direction: 'at-least',
          threshold: 0.8,
          source: 'pre-registered-protocol',
          criterionId: 'MONETA-HD-STABILITY-v1',
        },
      },
    });
    expect(decision.disposition).toBe('ELIGIBLE');
    expect(decision.flags.stabilityEvidencePresent).toBe(true);
  });
});
