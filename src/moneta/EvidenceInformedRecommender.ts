export interface RecommenderTrialEvidence {
  datasetTopology: string;
  recommendedLayout: string;
  taskType: string;
  isSuccessful: boolean;
  completionTimeMs: number;
  workloadScore: number;
}

export interface RecommendationPreferenceScore {
  layout: string;
  basePriorWeight: number;
  empiricalAdjustment: number;
  finalWeight: number;
  trialCount: number;
}

export class EvidenceInformedRecommender {
  private _evidenceStore: RecommenderTrialEvidence[] = [];
  private _basePriors: Record<string, number> = {
    force_directed: 1.0,
    time_ribbon: 1.0,
    geo_surface: 1.0,
    grid: 0.8,
    tda_mapper: 1.2,
  };

  recordTrialEvidence(evidence: RecommenderTrialEvidence): void {
    this._evidenceStore.push(evidence);
  }

  get evidenceCount(): number {
    return this._evidenceStore.length;
  }

  computePreference(layout: string, topology: string): RecommendationPreferenceScore {
    const basePrior = this._basePriors[layout] ?? 1.0;
    const relevantTrials = this._evidenceStore.filter(
      (e) => e.recommendedLayout === layout && e.datasetTopology === topology
    );

    if (relevantTrials.length === 0) {
      return {
        layout,
        basePriorWeight: basePrior,
        empiricalAdjustment: 0.0,
        finalWeight: basePrior,
        trialCount: 0,
      };
    }

    const successCount = relevantTrials.filter((t) => t.isSuccessful).length;
    const successRate = successCount / relevantTrials.length;

    const empiricalAdjustment = (successRate - 0.6) * 0.5;
    const finalWeight = Math.max(0.1, basePrior + empiricalAdjustment);

    return {
      layout,
      basePriorWeight: basePrior,
      empiricalAdjustment: Math.round(empiricalAdjustment * 100) / 100,
      finalWeight: Math.round(finalWeight * 100) / 100,
      trialCount: relevantTrials.length,
    };
  }

  clear(): void {
    this._evidenceStore = [];
  }
}
