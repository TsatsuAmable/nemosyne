/**
 * EvidenceWeightedScorer for Nemosyne Draco.
 *
 * Adjusts Draco recommendation scores and soft constraint evaluations using
 * empirical human performance utility priors from the EvidenceStore.
 */

import type { DracoSpec, SolverResult } from '../types.ts';
import type { EvidenceStore } from './EvidenceStore.ts';

export class EvidenceWeightedScorer {
  constructor(private evidenceStore: EvidenceStore) {}

  /**
   * Adjusts a candidate Draco recommendation score based on empirical evidence.
   * In Draco's constraint solver, lower score = fewer constraint violations / higher preference.
   */
  adjustCandidateScore(spec: DracoSpec, baseScore: number): { adjustedScore: number; empiricalDelta: number } {
    const utilityScores = this.evidenceStore.computeUtilityScores();
    const specKey = this.evidenceStore.getSpecKey(spec);
    const evidence = utilityScores.get(specKey);

    if (!evidence || evidence.sampleCount === 0) {
      return { adjustedScore: baseScore, empiricalDelta: 0 };
    }

    // Confidence weighting based on sample count (approaches 1.0 at N=10)
    const confidenceWeight = Math.min(1.0, evidence.sampleCount / 10);

    // Delta relative to baseline neutral utility (0.5)
    // Positive utility (>0.5) decreases penalty score (better).
    // Negative utility (<0.5) increases penalty score (worse).
    const utilityDelta = (evidence.compositeUtility - 0.5) * 30 * confidenceWeight;
    const adjustedScore = Math.max(0, Math.round(baseScore - utilityDelta));

    return {
      adjustedScore,
      empiricalDelta: Math.round(-utilityDelta),
    };
  }

  /**
   * Re-ranks a list of candidate SolverResults using empirical evidence modifiers.
   */
  reRankCandidates(candidates: SolverResult[]): SolverResult[] {
    const scored = candidates.map((cand) => {
      const { adjustedScore } = this.adjustCandidateScore(cand.spec, cand.score);
      return {
        ...cand,
        score: adjustedScore,
      };
    });

    return scored.sort((a, b) => a.score - b.score);
  }
}
