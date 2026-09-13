import { describe, expect, it } from 'vitest';
import { MONETA_BENCHMARK_FAMILIES } from '../dev/xr-lab/MonetaBenchmarkCorpus.ts';
import {
  adjudicateBenchmarkCandidate,
  adjudicateMonetaEvidence,
  type MonetaEvidenceCandidate,
} from '../dev/xr-lab/MonetaEvidenceProtocol.ts';

const base = (): MonetaEvidenceCandidate => ({
  candidateId: 'candidate-a',
  oracleStrength: 'exact-generative',
  measurementScales: ['ratio'],
  compositionHandling: 'not-applicable',
  sampleSize: 100,
  featureCount: 8,
  selectionMode: 'fixed-before-data',
  makesInferentialClaim: false,
  calibration: 'not-applicable',
  requiresHumanValidation: false,
  humanValidationObserved: false,
});

describe('Moneta evidence validity protocol', () => {
  it('rejects raw-Euclidean treatment of compositional variables', () => {
    const decision = adjudicateMonetaEvidence({
      ...base(),
      measurementScales: ['compositional'],
      compositionHandling: 'raw-euclidean',
    });
    expect(decision.disposition).toBe('INVALID');
  });

  it('rejects inferential claims after adaptive selection without selection-aware calibration', () => {
    const decision = adjudicateMonetaEvidence({
      ...base(),
      selectionMode: 'adaptive-after-data',
      makesInferentialClaim: true,
      calibration: 'none',
    });
    expect(decision.disposition).toBe('INVALID');
  });

  it('abstains in p >= n regimes until explicit perturbation evidence exists', () => {
    const decision = adjudicateMonetaEvidence({
      ...base(),
      sampleSize: 20,
      featureCount: 200,
    });
    expect(decision.disposition).toBe('ABSTAIN');
  });

  it('keeps diagnostic benchmarks in falsification-only authority', () => {
    const decision = adjudicateMonetaEvidence({
      ...base(),
      oracleStrength: 'diagnostic-only',
    });
    expect(decision.disposition).toBe('MACHINE-FALSIFICATION-ONLY');
  });

  it('does not let machine evidence close a human-dependent claim', () => {
    const decision = adjudicateMonetaEvidence({
      ...base(),
      oracleStrength: 'human-preference',
      requiresHumanValidation: true,
      humanValidationObserved: false,
    });
    expect(decision.disposition).toBe('REQUIRES-HUMAN');
  });

  it('allows high-dimensional evidence only when an authority-owned policy certifies it', () => {
    const decision = adjudicateMonetaEvidence(
      {
        ...base(),
        sampleSize: 20,
        featureCount: 200,
        perturbation: { runs: 100, metric: 'candidate-rank-stability', value: 0.91 },
      },
      {
        stabilityPolicy: {
          acceptedMetrics: ['candidate-rank-stability'],
          minRuns: 50,
          valueRange: { minInclusive: 0, maxInclusive: 1 },
        },
      }
    );
    expect(decision.disposition).toBe('ELIGIBLE');
    expect(decision.flags.stabilityEvidencePresent).toBe(true);
    expect(decision.flags.stabilityCertificationApplied).toBe(true);
  });

  it('fails closed when high-dimensional perturbation evidence has no authority-owned policy', () => {
    const decision = adjudicateMonetaEvidence({
      ...base(),
      sampleSize: 20,
      featureCount: 200,
      perturbation: { runs: 100, metric: 'candidate-rank-stability', value: 0.91 },
    });
    expect(decision.disposition).toBe('ABSTAIN');
    expect(decision.flags.stabilityEvidencePresent).toBe(false);
    expect(decision.flags.stabilityCertificationApplied).toBe(false);
  });

  it('rejects malformed perturbation evidence instead of treating presence as stability', () => {
    const decision = adjudicateMonetaEvidence(
      {
        ...base(),
        sampleSize: 20,
        featureCount: 200,
        perturbation: { runs: 1, metric: '', value: -999 },
      },
      {
        stabilityPolicy: {
          acceptedMetrics: ['candidate-rank-stability'],
          minRuns: 50,
          valueRange: { minInclusive: 0, maxInclusive: 1 },
        },
      }
    );
    expect(decision.disposition).toBe('INVALID');
  });

  it('keeps well-formed but uncertified perturbation evidence in abstention', () => {
    const decision = adjudicateMonetaEvidence(
      {
        ...base(),
        sampleSize: 20,
        featureCount: 200,
        perturbation: { runs: 1, metric: 'nonsense', value: 0 },
      },
      {
        stabilityPolicy: {
          acceptedMetrics: ['candidate-rank-stability'],
          minRuns: 50,
          valueRange: { minInclusive: 0, maxInclusive: 1 },
        },
      }
    );
    expect(decision.disposition).toBe('ABSTAIN');
    expect(decision.flags.stabilityEvidencePresent).toBe(false);
  });

  it('takes oracle authority and human requirement from the benchmark registry', () => {
    const family = MONETA_BENCHMARK_FAMILIES['anscombe-datasaurus'];
    const candidate = base();
    const decision = adjudicateBenchmarkCandidate(family, {
      ...candidate,
      humanValidationObserved: false,
    });
    expect(decision.disposition).toBe('MACHINE-FALSIFICATION-ONLY');
  });
});
