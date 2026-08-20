import type { StudyCondition, StudySessionExport } from '../../study/types.ts';
import type { EmpiricalOutcome, EmpiricalUtilityScore } from './types.ts';
import type { MonetaSpec } from '../types.ts';

export class EvidenceStore {
  private _outcomes: EmpiricalOutcome[] = [];

  recordTrialOutcome(outcome: EmpiricalOutcome): void {
    this._outcomes.push(outcome);
  }

  recordOutcome(outcome: EmpiricalOutcome): void {
    this.recordTrialOutcome(outcome);
  }

  recordTrialOutcomes(outcomes: EmpiricalOutcome[]): void {
    this._outcomes.push(...outcomes);
  }

  get outcomes(): readonly EmpiricalOutcome[] {
    return this._outcomes;
  }

  get totalOutcomes(): number {
    return this._outcomes.length;
  }

  clear(): void {
    this._outcomes = [];
  }

  static specToKey(spec: Partial<MonetaSpec>): string {
    return `${spec.layout ?? '*'}:${spec.geometry ?? '*'}:${spec.behavior ?? '*'}:${spec.interaction ?? '*'}`;
  }

  getSpecKey(spec: Partial<MonetaSpec>): string {
    return EvidenceStore.specToKey(spec);
  }

  ingestStudySession(sessionExport: StudySessionExport): void {
    for (const trial of sessionExport.trials || []) {
      this.recordOutcome({
        trialId: trial.trialId,
        datasetFingerprint: sessionExport.configHash ?? 'unknown',
        condition: trial.condition,
        taskType: trial.taskId,
        accuracy: trial.accuracy,
        precision: trial.precision,
        recall: trial.recall,
        f1: trial.f1Score,
        durationMs: trial.durationMs,
        nasaTlxAverage: trial.workloadScore,
        timestamp: trial.endTime ?? Date.now(),
      });
    }
  }

  computeUtilityScores(): Map<string, EmpiricalUtilityScore> {
    const result = new Map<string, EmpiricalUtilityScore>();

    // Group by spec key
    const bySpec = new Map<string, EmpiricalOutcome[]>();
    // Group by condition
    const byCond = new Map<StudyCondition, EmpiricalOutcome[]>();

    for (const o of this._outcomes) {
      if (o.spec) {
        const key = this.getSpecKey(o.spec);
        if (!bySpec.has(key)) bySpec.set(key, []);
        bySpec.get(key)!.push(o);
      }
      if (o.condition) {
        if (!byCond.has(o.condition)) byCond.set(o.condition, []);
        byCond.get(o.condition)!.push(o);
      }
    }

    const calcGroup = (outcomes: EmpiricalOutcome[], key: string, cond: StudyCondition): EmpiricalUtilityScore => {
      const n = outcomes.length;
      const sumAcc = outcomes.reduce((s, o) => s + (o.accuracy ?? 0), 0);
      const sumF1 = outcomes.reduce((s, o) => s + (o.f1 ?? 0), 0);
      const sumDur = outcomes.reduce((s, o) => s + (o.durationMs ?? 0), 0);
      const sumTlx = outcomes.reduce((s, o) => s + (o.nasaTlxAverage ?? 50), 0);

      const meanAcc = sumAcc / n;
      const meanF1 = sumF1 / n;
      const meanDur = sumDur / n;
      const meanTlx = sumTlx / n;

      const speedScore = Math.max(0, 1 - meanDur / 60000);
      const comfortScore = Math.max(0, 1 - meanTlx / 100);
      const compositeUtility = meanAcc * 0.4 + meanF1 * 0.2 + speedScore * 0.2 + comfortScore * 0.2;

      return {
        specKey: key,
        condition: cond,
        sampleCount: n,
        meanAccuracy: Math.round(meanAcc * 1000) / 1000,
        meanF1: Math.round(meanF1 * 1000) / 1000,
        meanDurationMs: Math.round(meanDur),
        meanNasaTlx: Math.round(meanTlx * 10) / 10,
        compositeUtility: Math.round(compositeUtility * 1000) / 1000,
      };
    };

    for (const [key, outcomes] of bySpec.entries()) {
      const cond = outcomes[0]?.condition ?? 'vr_experimental';
      result.set(key, calcGroup(outcomes, key, cond));
    }

    for (const [cond, outcomes] of byCond.entries()) {
      result.set(`condition:${cond}`, calcGroup(outcomes, `condition:${cond}`, cond));
    }

    return result;
  }

  computeUtilityForSpec(spec: MonetaSpec, condition: StudyCondition): EmpiricalUtilityScore | null {
    const key = EvidenceStore.specToKey(spec);
    const matches = this._outcomes.filter((o) => {
      if (o.condition !== condition) return false;
      if (!o.spec) return false;
      return (
        o.spec.layout === spec.layout &&
        o.spec.geometry === spec.geometry &&
        o.spec.behavior === spec.behavior &&
        o.spec.interaction === spec.interaction
      );
    });

    if (matches.length === 0) return null;

    const n = matches.length;
    const sumAcc = matches.reduce((s, o) => s + o.accuracy, 0);
    const sumF1 = matches.reduce((s, o) => s + o.f1, 0);
    const sumDur = matches.reduce((s, o) => s + o.durationMs, 0);
    const sumTlx = matches.reduce((s, o) => s + (o.nasaTlxAverage ?? 50), 0);

    const meanAcc = sumAcc / n;
    const meanF1 = sumF1 / n;
    const meanDur = sumDur / n;
    const meanTlx = sumTlx / n;

    const speedScore = Math.max(0, 1 - meanDur / 60000);
    const comfortScore = Math.max(0, 1 - meanTlx / 100);
    const compositeUtility = meanAcc * 0.4 + meanF1 * 0.2 + speedScore * 0.2 + comfortScore * 0.2;

    return {
      specKey: key,
      condition,
      sampleCount: n,
      meanAccuracy: Math.round(meanAcc * 1000) / 1000,
      meanF1: Math.round(meanF1 * 1000) / 1000,
      meanDurationMs: Math.round(meanDur),
      meanNasaTlx: Math.round(meanTlx * 10) / 10,
      compositeUtility: Math.round(compositeUtility * 1000) / 1000,
    };
  }
}
