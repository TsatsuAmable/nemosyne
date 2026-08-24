import type { AtlasCore } from '../atlas/AtlasCore.ts';
import type { NemosyneSession } from '../session/NemosyneSession.ts';
import { NoFeasibleRepresentationError } from '../moneta/representation/NoFeasibleRepresentationError.ts';
import { createDefaultRequirements } from '../moneta/representation/RepresentationRequirements.ts';

export type AnalystRepresentationOutcome =
  | {
      kind: 'decision';
      decisionId: string;
      family: string;
      layout: string;
      utilityScore: number;
    }
  | {
      kind: 'nil';
      nilId: string;
      failedConstraintCount: number;
      nearMissCount: number;
    };

export function assessAnalystRepresentation(
  atlas: Pick<
    AtlasCore,
    'isReady' | 'activeRepresentationDecision' | 'arbitrateRepresentation'
  >,
  session: Pick<
    NemosyneSession,
    'sessionId' | 'nilOutcomes' | 'recordNoFeasibleRepresentation'
  >,
  maxElements?: number,
): AnalystRepresentationOutcome {
  if (!atlas.isReady()) {
    throw new Error('Analytical kernel unavailable; cannot assess representation');
  }
  if (
    maxElements !== undefined &&
    (!Number.isInteger(maxElements) || maxElements < 1)
  ) {
    throw new Error('Maximum rendered elements must be a positive integer');
  }

  try {
    const activeDecision = atlas.activeRepresentationDecision;
    const requirements =
      maxElements === undefined
        ? undefined
        : createDefaultRequirements('individual-inspection');
    if (requirements && maxElements !== undefined) {
      requirements.hardwareConstraints = {
        ...requirements.hardwareConstraints,
        maxElements,
      };
    }
    const decision =
      maxElements === undefined && activeDecision
        ? activeDecision
        : atlas.arbitrateRepresentation(requirements);
    return {
      kind: 'decision',
      decisionId: decision.id ?? 'unidentified-decision',
      family: decision.chosenFamily ?? decision.representationFamily,
      layout: decision.chosenLayout ?? decision.embodiment.primaryLayout,
      utilityScore: decision.utilityScore,
    };
  } catch (error) {
    if (!(error instanceof NoFeasibleRepresentationError)) throw error;
    if (!error.provenance) {
      throw new Error('Moneta returned NIL without analytical provenance', { cause: error });
    }
    const nilId = `nil-${session.sessionId}-${session.nilOutcomes.length + 1}`;
    session.recordNoFeasibleRepresentation({
      nilId,
      recordedAt: Date.now(),
      traces: error.traces,
      nearMisses: error.nearMisses,
      provenance: error.provenance,
    });
    return {
      kind: 'nil',
      nilId,
      failedConstraintCount: error.traces.filter((trace) => !trace.passed).length,
      nearMissCount: error.nearMisses.length,
    };
  }
}
