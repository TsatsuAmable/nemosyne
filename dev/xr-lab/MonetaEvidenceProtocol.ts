import type { MonetaBenchmarkFamily, OracleStrength } from './MonetaBenchmarkCorpus.ts';

export type MeasurementScale =
  'nominal' | 'ordinal' | 'interval' | 'ratio' | 'compositional' | 'unknown';

export type CompositionHandling =
  'not-applicable' | 'log-ratio' | 'simplex-native' | 'raw-euclidean';

export type SelectionMode = 'fixed-before-data' | 'adaptive-after-data';

export type InferentialCalibration =
  'not-applicable' | 'none' | 'sample-split' | 'selective-inference' | 'conformal-after-selection';

export type MonetaEvidenceDisposition =
  'INVALID' | 'ABSTAIN' | 'MACHINE-FALSIFICATION-ONLY' | 'REQUIRES-HUMAN' | 'ELIGIBLE';

export interface PerturbationEvidence {
  runs: number;
  metric: string;
  value: number;
}

export interface MonetaEvidenceCandidate {
  candidateId: string;
  oracleStrength: OracleStrength;
  measurementScales: MeasurementScale[];
  compositionHandling: CompositionHandling;
  sampleSize: number;
  featureCount: number;
  selectionMode: SelectionMode;
  makesInferentialClaim: boolean;
  calibration: InferentialCalibration;
  perturbation?: PerturbationEvidence;
  requiresHumanValidation: boolean;
  humanValidationObserved: boolean;
  hardViolations?: string[];
}

export interface MonetaEvidenceDecision {
  disposition: MonetaEvidenceDisposition;
  reasons: string[];
  flags: {
    highDimensional: boolean;
    adaptiveSelection: boolean;
    compositional: boolean;
    stabilityEvidencePresent: boolean;
    stabilityCertificationApplied: boolean;
  };
}

/**
 * Public Moneta scientific-evidence gate.
 *
 * This function deliberately does NOT rank representations. It decides whether
 * evidence is admissible for further consideration. Hard scientific validity
 * boundaries must not be traded away inside a utility/fitness scalar.
 */
export function adjudicateMonetaEvidence(
  candidate: MonetaEvidenceCandidate
): MonetaEvidenceDecision {
  const reasons: string[] = [];
  const highDimensional = candidate.featureCount >= candidate.sampleSize;
  const adaptiveSelection = candidate.selectionMode === 'adaptive-after-data';
  const compositional = candidate.measurementScales.includes('compositional');
  const perturbationWellFormed = candidate.perturbation !== undefined &&
    Number.isInteger(candidate.perturbation.runs) &&
    candidate.perturbation.runs > 0 &&
    typeof candidate.perturbation.metric === 'string' &&
    candidate.perturbation.metric.trim().length > 0 &&
    Number.isFinite(candidate.perturbation.value);
  // No authority-bearing stability certificate exists yet. Well-formed
  // perturbation diagnostics remain inspectable but cannot self-promote a
  // high-dimensional candidate into admissible evidence.
  const stabilityCertificationApplied = false;
  const stabilityEvidencePresent = false;

  if (candidate.sampleSize <= 0 || candidate.featureCount <= 0) {
    reasons.push('sampleSize and featureCount must both be positive');
  }

  if (candidate.measurementScales.length === 0 || candidate.measurementScales.includes('unknown')) {
    reasons.push('measurement scale is missing or unknown');
  }

  if (compositional && candidate.compositionHandling === 'raw-euclidean') {
    reasons.push(
      'compositional variables cannot be treated as unconstrained raw Euclidean coordinates'
    );
  }

  if (!compositional && candidate.compositionHandling !== 'not-applicable') {
    reasons.push('composition handling was declared for a non-compositional candidate');
  }

  if (
    candidate.makesInferentialClaim &&
    adaptiveSelection &&
    (candidate.calibration === 'none' || candidate.calibration === 'not-applicable')
  ) {
    reasons.push('adaptive selection followed by inference requires selection-aware calibration');
  }

  if (
    candidate.makesInferentialClaim &&
    !adaptiveSelection &&
    candidate.calibration === 'not-applicable'
  ) {
    reasons.push('inferential claims require an explicit calibration/inference strategy');
  }

  if (candidate.perturbation && !perturbationWellFormed) {
    reasons.push(
      'perturbation evidence must contain a positive integer run count, non-empty metric identifier and finite metric value'
    );
  }

  if (candidate.hardViolations?.length) {
    reasons.push(...candidate.hardViolations.map((x) => `hard violation: ${x}`));
  }

  const flags = {
    highDimensional,
    adaptiveSelection,
    compositional,
    stabilityEvidencePresent,
    stabilityCertificationApplied,
  };

  if (reasons.length > 0) return { disposition: 'INVALID', reasons, flags };

  if (highDimensional && !stabilityEvidencePresent) {
    const detail = candidate.perturbation === undefined
      ? 'no perturbation evidence supplied'
      : !stabilityCertificationApplied
        ? 'perturbation evidence cannot be certified because no benchmark-family stability policy is in scope'
        : 'perturbation evidence is not admissible under the benchmark-family stability policy';
    return {
      disposition: 'ABSTAIN',
      reasons: [
        `p >= n requires explicit perturbation/stability evidence before promotion: ${detail}`,
      ],
      flags,
    };
  }

  if (candidate.oracleStrength === 'diagnostic-only') {
    return {
      disposition: 'MACHINE-FALSIFICATION-ONLY',
      reasons: [
        'diagnostic benchmark can falsify collapse/pathology but cannot establish preferred representation',
      ],
      flags,
    };
  }

  if (candidate.requiresHumanValidation && !candidate.humanValidationObserved) {
    return {
      disposition: 'REQUIRES-HUMAN',
      reasons: ['claim depends on perceptual/discovery utility that machine evidence cannot close'],
      flags,
    };
  }

  return { disposition: 'ELIGIBLE', reasons: [], flags };
}

/**
 * Bind a benchmark family to the evidence gate. The family, not the candidate,
 * owns oracle authority and whether human validation is required. This prevents
 * a candidate generator from self-upgrading its evidential status.
 */
export function adjudicateBenchmarkCandidate(
  family: MonetaBenchmarkFamily,
  candidate: Omit<MonetaEvidenceCandidate, 'oracleStrength' | 'requiresHumanValidation'>
): MonetaEvidenceDecision {
  return adjudicateMonetaEvidence({
    ...candidate,
    oracleStrength: family.oracleStrength,
    requiresHumanValidation: family.requiresHumanValidation,
  });
}
