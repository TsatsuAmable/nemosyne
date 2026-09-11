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

  it('allows a high-dimensional candidate to proceed when explicit stability evidence exists', () => {
    const decision = adjudicateMonetaEvidence({
      ...base(),
      sampleSize: 20,
      featureCount: 200,
      perturbation: { runs: 100, metric: 'candidate-rank-stability', value: 0.91 },
    });
    expect(decision.disposition).toBe('ELIGIBLE');
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
