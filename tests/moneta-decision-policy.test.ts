import { describe, expect, it } from 'vitest';
import { assessRepresentationDecision } from '../src/moneta/representation/DecisionPolicy.ts';
import type { CandidateScore } from '../src/moneta/representation/RepresentationDecision.ts';

function candidate(id: CandidateScore['candidateId'], score: number, disqualified = false): CandidateScore {
  return {
    family: 'POINT',
    candidateId: id,
    layout: 'GRID_3D',
    score,
    components: [],
    disqualified,
    preserves: [],
    loses: [],
  };
}

describe('V3 Moneta decision policy', () => {
  it('returns INFEASIBLE when no candidate passes hard constraints', () => {
    const result = assessRepresentationDecision([
      candidate('POINT_SET', 0, true),
      candidate('DISTRIBUTION_FIELD', 0, true),
    ]);
    expect(result.status).toBe('INFEASIBLE');
    expect(result.winner).toBeNull();
  });

  it('returns UNDERDETERMINED for an effectively tied ranking', () => {
    const result = assessRepresentationDecision([
      candidate('POINT_SET', 0.62),
      candidate('DISTRIBUTION_FIELD', 0.615),
    ]);
    expect(result.status).toBe('UNDERDETERMINED');
    expect(result.margin).toBeCloseTo(0.005, 12);
  });

  it('returns AMBIGUOUS for a close but non-tied ranking', () => {
    const result = assessRepresentationDecision([
      candidate('POINT_SET', 0.7),
      candidate('DISTRIBUTION_FIELD', 0.65),
    ]);
    expect(result.status).toBe('AMBIGUOUS');
    expect(result.margin).toBeCloseTo(0.05, 12);
  });

  it('returns DECISIVE only when the utility margin clears the policy threshold', () => {
    const result = assessRepresentationDecision([
      candidate('POINT_SET', 0.82),
      candidate('DISTRIBUTION_FIELD', 0.61),
    ]);
    expect(result.status).toBe('DECISIVE');
    expect(result.margin).toBeCloseTo(0.21, 12);
  });

  it('does not turn a weak winner into a confident-looking recommendation', () => {
    const result = assessRepresentationDecision([
      candidate('POINT_SET', 0.3),
      candidate('DISTRIBUTION_FIELD', 0.1),
    ]);
    expect(result.status).toBe('UNDERDETERMINED');
    expect(result.rationale).toMatch(/below the minimum/i);
  });
});
