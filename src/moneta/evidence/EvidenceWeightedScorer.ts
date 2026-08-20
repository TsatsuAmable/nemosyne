import type { StudyCondition } from '../../study/types.ts';
import type { MonetaSpec, SolverResult } from '../types.ts';
import { EvidenceStore } from './EvidenceStore.ts';

export class EvidenceWeightedScorer {
  private _store: EvidenceStore;
  private _defaultCondition: StudyCondition;

  constructor(store: EvidenceStore, defaultCondition: StudyCondition = 'vr_experimental') {
    this._store = store;
    this._defaultCondition = defaultCondition;
  }

  scoreCandidateWithEvidence(
    candidate: MonetaSpec,
    baseCost: number,
    condition: StudyCondition = this._defaultCondition
  ): { adjustedCost: number; evidenceAdjustment: number; sampleCount: number } {
    const utility = this._store.computeUtilityForSpec(candidate, condition);
    if (!utility || utility.sampleCount === 0) {
      return { adjustedCost: baseCost, evidenceAdjustment: 0, sampleCount: 0 };
    }

    const confidenceWeight = Math.min(1.0, utility.sampleCount / 10);
    const utilityDelta = (utility.compositeUtility - 0.5) * 30.0 * confidenceWeight;
    const adjustedCost = Math.max(0, Math.round(baseCost - utilityDelta));

    return {
      adjustedCost,
      evidenceAdjustment: Math.round(-utilityDelta),
      sampleCount: utility.sampleCount,
    };
  }

  adjustCandidateScore(
    candidate: MonetaSpec,
    baseCost: number,
    condition: StudyCondition = this._defaultCondition
  ): { adjustedCost: number; empiricalDelta: number; utilityScore: number } {
    const utility = this._store.computeUtilityForSpec(candidate, condition);
    const u = utility ? utility.compositeUtility : 0.5;
    const confidenceWeight = utility ? Math.min(1.0, utility.sampleCount / 10) : 0;
    const empiricalDelta = (0.5 - u) * 20.0 * (confidenceWeight || 1.0);
    const adjustedCost = Math.max(0, baseCost + empiricalDelta);
    return {
      adjustedCost,
      empiricalDelta,
      utilityScore: u,
    };
  }

  reRankCandidates(
    candidates: SolverResult[],
    condition: StudyCondition = this._defaultCondition
  ): SolverResult[] {
    return [...candidates]
      .map((c) => {
        const { adjustedCost } = this.adjustCandidateScore(c.spec, c.cost, condition);
        return {
          ...c,
          cost: adjustedCost,
        };
      })
      .sort((a, b) => a.cost - b.cost);
  }
}
