import type { CandidateScore, HardConstraintTrace } from './RepresentationDecision.ts';
import type { AnalyticalIntent, RepresentationRequirements } from './RepresentationRequirements.ts';

export interface NoFeasibleRepresentationProvenance {
  datasetFingerprint: string;
  kernelVersion: string;
  /** Exact analytical evidence ids that bounded representation reasoning. */
  evidenceIds: readonly string[];
  /** Canonical requirements hash when the arbitration path has already resolved defaults. */
  requirementsHash?: string;
  /** Caller-supplied requirements, when explicit. */
  requirements?: RepresentationRequirements;
  /** Caller-supplied analytical intent, when explicit. */
  intent?: AnalyticalIntent;
  /** Semantic model identity used by the failed ranking attempt. */
  fitnessModelVersion?: string;
  /** Immutable learned-model artifact identity, null for bootstrap/non-learned ranking. */
  fitnessModelArtifactHash?: string | null;
  /** Stable identity of an upstream bootstrap decision when learned re-ranking abstains. */
  sourceDecisionId?: string;
  /** Canonical hash of upstream decision evidence when applicable. */
  sourceDecisionEvidenceHash?: string;
}

/**
 * A representation request may be valid while none of the declared candidates
 * can satisfy its hard constraints. Treating that as a recommendation is an
 * analytical error, so callers receive a typed NIL outcome they can present,
 * persist and replay without inventing a successful RepresentationDecision.
 */
export class NoFeasibleRepresentationError extends Error {
  readonly code = 'NO_FEASIBLE_REPRESENTATION';

  constructor(
    readonly traces: readonly HardConstraintTrace[],
    readonly nearMisses: readonly CandidateScore[],
    readonly provenance?: NoFeasibleRepresentationProvenance,
  ) {
    super('No Moneta representation candidate satisfies the declared hard constraints');
    this.name = 'NoFeasibleRepresentationError';
    Object.setPrototypeOf(this, NoFeasibleRepresentationError.prototype);
  }

  withProvenance(provenance: NoFeasibleRepresentationProvenance): NoFeasibleRepresentationError {
    const enriched = new NoFeasibleRepresentationError(
      structuredClone(this.traces),
      structuredClone(this.nearMisses),
      structuredClone(provenance),
    );
    enriched.stack = this.stack;
    return enriched;
  }
}
