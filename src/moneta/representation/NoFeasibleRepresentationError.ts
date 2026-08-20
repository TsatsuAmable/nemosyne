import type { CandidateScore, HardConstraintTrace } from './RepresentationDecision.ts';

/**
 * A representation request may be valid while none of the declared candidates
 * can satisfy its hard constraints. Treating that as a recommendation is an
 * analytical error, so callers receive a typed outcome they can present and
 * record in the Investigation instead.
 */
export class NoFeasibleRepresentationError extends Error {
  readonly code = 'NO_FEASIBLE_REPRESENTATION';

  constructor(
    readonly traces: readonly HardConstraintTrace[],
    readonly nearMisses: readonly CandidateScore[]
  ) {
    super('No Moneta representation candidate satisfies the declared hard constraints');
    this.name = 'NoFeasibleRepresentationError';
    Object.setPrototypeOf(this, NoFeasibleRepresentationError.prototype);
  }
}
