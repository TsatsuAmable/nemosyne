import type { CandidateScore } from './RepresentationDecision.ts';

export type RepresentationDecisionStatus =
  | 'DECISIVE'
  | 'AMBIGUOUS'
  | 'INFEASIBLE'
  | 'UNDERDETERMINED';

export interface DecisionPolicyOptions {
  minimumUtility: number;
  decisiveMargin: number;
  underdeterminedMargin: number;
}

export const DEFAULT_DECISION_POLICY: DecisionPolicyOptions = {
  minimumUtility: 0.35,
  decisiveMargin: 0.08,
  underdeterminedMargin: 0.02,
};

export interface DecisionAssessment {
  status: RepresentationDecisionStatus;
  winner: CandidateScore | null;
  runnerUp: CandidateScore | null;
  margin: number | null;
  rationale: string;
}

function validatePolicy(options: DecisionPolicyOptions): DecisionPolicyOptions {
  for (const [name, value] of Object.entries(options)) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new RangeError(`${name} must be a finite value in [0, 1]`);
    }
  }
  if (options.underdeterminedMargin > options.decisiveMargin) {
    throw new RangeError('underdeterminedMargin cannot exceed decisiveMargin');
  }
  return options;
}

export function assessRepresentationDecision(
  rankedCandidates: CandidateScore[],
  overrides: Partial<DecisionPolicyOptions> = {}
): DecisionAssessment {
  const policy = validatePolicy({ ...DEFAULT_DECISION_POLICY, ...overrides });
  const feasible = rankedCandidates
    .filter((candidate) => !candidate.disqualified)
    .slice()
    .sort((a, b) => {
      const delta = b.score - a.score;
      if (delta !== 0) return delta;
      return `${a.candidateId}:${a.layout}`.localeCompare(`${b.candidateId}:${b.layout}`);
    });

  if (feasible.length === 0) {
    return {
      status: 'INFEASIBLE',
      winner: null,
      runnerUp: null,
      margin: null,
      rationale: 'No representation candidate satisfies the hard constraints.',
    };
  }

  const winner = feasible[0];
  const runnerUp = feasible[1] ?? null;

  if (winner.score < policy.minimumUtility) {
    return {
      status: 'UNDERDETERMINED',
      winner,
      runnerUp,
      margin: runnerUp ? winner.score - runnerUp.score : null,
      rationale: `Best utility ${winner.score.toFixed(3)} is below the minimum ${policy.minimumUtility.toFixed(3)}.`,
    };
  }

  if (!runnerUp) {
    return {
      status: 'DECISIVE',
      winner,
      runnerUp: null,
      margin: null,
      rationale: 'Only one feasible candidate remains after hard constraints.',
    };
  }

  const margin = winner.score - runnerUp.score;
  if (margin < policy.underdeterminedMargin) {
    return {
      status: 'UNDERDETERMINED',
      winner,
      runnerUp,
      margin,
      rationale: `Top candidates are effectively tied (margin ${margin.toFixed(3)}).`,
    };
  }

  if (margin < policy.decisiveMargin) {
    return {
      status: 'AMBIGUOUS',
      winner,
      runnerUp,
      margin,
      rationale: `Top candidates are close (margin ${margin.toFixed(3)}); expose alternatives rather than implying certainty.`,
    };
  }

  return {
    status: 'DECISIVE',
    winner,
    runnerUp,
    margin,
    rationale: `Winner exceeds runner-up by ${margin.toFixed(3)}.`,
  };
}
