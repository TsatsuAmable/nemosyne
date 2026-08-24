import { describe, expect, it, vi } from 'vitest';
import { assessAnalystRepresentation } from '../src/app/AnalystRepresentationAssessment.ts';
import type { RepresentationDecision } from '../src/moneta/representation/RepresentationDecision.ts';
import { NoFeasibleRepresentationError } from '../src/moneta/representation/NoFeasibleRepresentationError.ts';

function decision(): RepresentationDecision {
  return {
    id: 'decision-point-grid',
    chosenFamily: 'POINT_CLOUD',
    chosenLayout: 'grid',
    representationFamily: 'POINT_CLOUD',
    utilityScore: 0.75,
    embodiment: { primaryLayout: 'grid' },
  } as unknown as RepresentationDecision;
}

function assessmentWith(
  atlas: Record<string, unknown>,
  session: Record<string, unknown> = {
    sessionId: 'analyst-session',
    nilOutcomes: [],
    recordNoFeasibleRepresentation: vi.fn(),
  },
) {
  return (maxElements?: number) =>
    assessAnalystRepresentation(
      atlas as Parameters<typeof assessAnalystRepresentation>[0],
      session as Parameters<typeof assessAnalystRepresentation>[1],
      maxElements,
    );
}

describe('analyst representation outcomes', () => {
  it('reports the active Moneta decision without rerunning arbitration', () => {
    const arbitrateRepresentation = vi.fn();
    const assess = assessmentWith({
      isReady: () => true,
      activeRepresentationDecision: decision(),
      arbitrateRepresentation,
    });

    expect(assess()).toEqual({
      kind: 'decision',
      decisionId: 'decision-point-grid',
      family: 'POINT_CLOUD',
      layout: 'grid',
      utilityScore: 0.75,
    });
    expect(arbitrateRepresentation).not.toHaveBeenCalled();
  });

  it('persists a provenance-complete NIL outcome under an explicit element budget', () => {
    const recordNoFeasibleRepresentation = vi.fn();
    const nil = new NoFeasibleRepresentationError(
      [{ ruleName: 'max-elements', passed: false, reason: 'requires more than one element' }],
      [],
    ).withProvenance({
      datasetFingerprint: 'rust-dataset-fingerprint',
      kernelVersion: 'rust-profile-v1',
      evidenceIds: ['cardinality:dataset'],
    });
    const assess = assessmentWith(
      {
        isReady: () => true,
        activeRepresentationDecision: decision(),
        arbitrateRepresentation: vi.fn(() => {
          throw nil;
        }),
      },
      {
        sessionId: 'analyst-session',
        nilOutcomes: [],
        recordNoFeasibleRepresentation,
      },
    );

    expect(assess(1)).toEqual({
      kind: 'nil',
      nilId: 'nil-analyst-session-1',
      failedConstraintCount: 1,
      nearMissCount: 0,
    });
    expect(recordNoFeasibleRepresentation).toHaveBeenCalledWith(
      expect.objectContaining({
        nilId: 'nil-analyst-session-1',
        provenance: nil.provenance,
      }),
    );
  });

  it('rejects invalid budgets and unavailable analytical authority', () => {
    const unavailable = assessmentWith({ isReady: () => false });
    expect(() => unavailable()).toThrow('Analytical kernel unavailable');

    const ready = assessmentWith({ isReady: () => true });
    expect(() => ready(0)).toThrow('positive integer');
    expect(() => ready(1.5)).toThrow('positive integer');
  });

  it('rejects a NIL outcome that lacks analytical provenance', () => {
    const assess = assessmentWith({
      isReady: () => true,
      activeRepresentationDecision: decision(),
      arbitrateRepresentation: () => {
        throw new NoFeasibleRepresentationError([], []);
      },
    });

    expect(() => assess(1)).toThrow('NIL without analytical provenance');
  });
});
