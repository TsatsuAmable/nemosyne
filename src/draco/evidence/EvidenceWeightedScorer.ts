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
   * Adjusts a candidate Draco recommendation cost based on empirical evidence.
   * In Draco's constraint solver, lower cost = fewer constraint violations / higher preference.
   */
  adjustCandidateScore(spec: DracoSpec, baseCost: number): { adjustedCost: number; empiricalDelta: number } {
    const utilityScores = this.evidenceStore.computeUtilityScores();
    const specKey = this.evidenceStore.getSpecKey(spec);
    const evidence = utilityScores.get(specKey);

    if (!evidence || evidence.sampleCount === 0) {
      return { adjustedCost: baseCost, empiricalDelta: 0 };
    }

    // Confidence weighting based on sample count (approaches 1.0 at N=10)
    const confidenceWeight = Math.min(1.0, evidence.sampleCount / 10);

    // Delta relative to baseline neutral utility (0.5)
    // Positive utility (>0.5) decreases penalty cost (better).
    // Negative utility (<0.5) increases penalty cost (worse).
    const utilityDelta = (evidence.compositeUtility - 0.5) * 30 * confidenceWeight;
    const adjustedCost = Math.max(0, Math.round(baseCost - utilityDelta));

    return {
      adjustedCost,
      empiricalDelta: Math.round(-utilityDelta),
    };
  }

  /**
   * Re-ranks a list of candidate SolverResults using empirical evidence modifiers.
   */
  reRankCandidates(candidates: SolverResult[]): SolverResult[] {
    const scored = candidates.map((cand) => {
      const { adjustedCost } = this.adjustCandidateScore(cand.spec, cand.cost);
      return {
        ...cand,
        cost: adjustedCost,
      };
    });

    return scored.sort((a, b) => a.cost - b.cost);
  }
}
