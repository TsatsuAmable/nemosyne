import type { VRLayout } from '../types.ts';
import type { TopologyType } from '../../data/types.ts';
import type { EmpiricalOutcome } from './types.ts';

export interface TunedLayoutPreference {
  layout: VRLayout;
  topology: TopologyType;
  baseCost: number;
  empiricalAdjustment: number;
  finalWeight: number;
  sampleCount: number;
  avgAccuracy: number;
  avgDurationMs: number;
  avgWorkload: number;
  rationale: string;
}

export interface EmpiricalTuningSummary {
  timestamp: number;
  totalOutcomesProcessed: number;
  tunedPreferences: TunedLayoutPreference[];
  solverOverrideWeights: Partial<Record<VRLayout, number>>;
}

export class MonetaEmpiricalTuner {
  private _outcomes: EmpiricalOutcome[] = [];

  recordOutcomes(outcomes: EmpiricalOutcome[]): void {
    this._outcomes.push(...outcomes);
  }

  clear(): void {
    this._outcomes = [];
  }

  get outcomeCount(): number {
    return this._outcomes.length;
  }

  private _computeTrialUtility(outcome: EmpiricalOutcome): number {
    const acc = Math.max(0, Math.min(1, outcome.accuracy));
    const f1 = Math.max(0, Math.min(1, outcome.f1));
    const speedScore = Math.max(0, 1 - outcome.durationMs / 60000);
    const workload = outcome.nasaTlxAverage ?? 50;
    const comfortScore = Math.max(0, 1 - workload / 100);

    return acc * 0.4 + f1 * 0.2 + speedScore * 0.2 + comfortScore * 0.2;
  }

  tunePreferencesForTopology(
    topology: TopologyType,
    candidateLayouts: VRLayout[]
  ): TunedLayoutPreference[] {
    const results: TunedLayoutPreference[] = [];

    for (const layout of candidateLayouts) {
      const matchingOutcomes = this._outcomes.filter(
        (o) => o.spec?.layout === layout || o.taskType?.includes(layout.toLowerCase())
      );

      const n = matchingOutcomes.length;
      if (n === 0) {
        results.push({
          layout,
          topology,
          baseCost: 0,
          empiricalAdjustment: 0,
          finalWeight: 1.0,
          sampleCount: 0,
          avgAccuracy: 0,
          avgDurationMs: 0,
          avgWorkload: 0,
          rationale: 'No empirical study outcomes recorded for this layout; retaining baseline prior.',
        });
        continue;
      }

      const totalAcc = matchingOutcomes.reduce((s, o) => s + o.accuracy, 0);
      const totalDur = matchingOutcomes.reduce((s, o) => s + o.durationMs, 0);
      const totalWorkload = matchingOutcomes.reduce((s, o) => s + (o.nasaTlxAverage ?? 50), 0);
      const totalUtil = matchingOutcomes.reduce((s, o) => s + this._computeTrialUtility(o), 0);

      const avgAccuracy = Math.round((totalAcc / n) * 1000) / 1000;
      const avgDurationMs = Math.round(totalDur / n);
      const avgWorkload = Math.round((totalWorkload / n) * 10) / 10;
      const avgUtility = totalUtil / n;

      let adjustment = 0;
      if (avgUtility >= 0.75) adjustment = 0.5;
      else if (avgUtility >= 0.6) adjustment = 0.2;
      else if (avgUtility <= 0.4) adjustment = -0.4;
      else if (avgUtility <= 0.5) adjustment = -0.2;

      const finalWeight = Math.max(0.1, Math.round((1.0 + adjustment) * 100) / 100);
      const rationale = `Based on N=${n} human study trials (avg acc=${avgAccuracy}, duration=${avgDurationMs}ms, TLX=${avgWorkload}): ${
        adjustment >= 0 ? 'promoted' : 'demoted'
      } by ${adjustment > 0 ? '+' : ''}${adjustment}.`;

      results.push({
        layout,
        topology,
        baseCost: 0,
        empiricalAdjustment: adjustment,
        finalWeight,
        sampleCount: n,
        avgAccuracy,
        avgDurationMs,
        avgWorkload,
        rationale,
      });
    }

    return results;
  }

  generateTuningSummary(topology: TopologyType, layouts: VRLayout[]): EmpiricalTuningSummary {
    const tunedPreferences = this.tunePreferencesForTopology(topology, layouts);
    const solverOverrideWeights: Partial<Record<VRLayout, number>> = {};

    for (const pref of tunedPreferences) {
      solverOverrideWeights[pref.layout] = pref.finalWeight;
    }

    return {
      timestamp: Date.now(),
      totalOutcomesProcessed: this._outcomes.length,
      tunedPreferences,
      solverOverrideWeights,
    };
  }
}

export { MonetaEmpiricalTuner as DracoEmpiricalTuner };
