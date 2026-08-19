/**
 * DecisionHistory — tracks recommender output, active guidance, and auditor decision records.
 */

import type {
  AtlasRecommendation,
  RecommendationDecision,
} from '../types.ts';

export class DecisionHistory {
  private _activeRecommendation: AtlasRecommendation | null = null;
  private _decisionHistory: AtlasRecommendation[] = [];

  get activeRecommendation(): AtlasRecommendation | null {
    return this._activeRecommendation;
  }

  get history(): AtlasRecommendation[] {
    return this._decisionHistory;
  }

  setRecommendation(rec: AtlasRecommendation | null): void {
    this._activeRecommendation = rec;
  }

  recordDecision(decision: RecommendationDecision): AtlasRecommendation | null {
    if (!this._activeRecommendation) return null;
    const recorded: AtlasRecommendation = {
      ...this._activeRecommendation,
      decision,
    };
    this._activeRecommendation = recorded;
    this._decisionHistory.push(recorded);
    return recorded;
  }

  reset(): void {
    this._activeRecommendation = null;
    this._decisionHistory = [];
  }

  restore(
    active: AtlasRecommendation | null,
    history: AtlasRecommendation[],
  ): void {
    this._activeRecommendation = active;
    this._decisionHistory = history.slice();
  }
}
