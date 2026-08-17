/**
 * EvidenceStore for Nemosyne Draco.
 *
 * Accumulates and indexes empirical study trial outcomes to quantify human
 * task performance across different spatial visual encodings.
 */

import type { StudySessionExport } from '../../study/types.ts';
import type { EmpiricalOutcome, EmpiricalUtilityScore } from './types.ts';
import type { DracoSpec } from '../types.ts';

export class EvidenceStore {
  private outcomes: EmpiricalOutcome[] = [];

  /**
   * Records a single empirical outcome.
   */
  recordOutcome(outcome: EmpiricalOutcome): void {
    this.outcomes.push(outcome);
  }

  /**
   * Ingests a complete StudySessionExport bundle.
   */
  ingestStudySession(sessionExport: StudySessionExport): void {
    for (const trial of sessionExport.trials) {
      if (!trial.completed) continue;

      this.recordOutcome({
        trialId: trial.trialId,
        datasetFingerprint: sessionExport.configHash,
        condition: trial.condition,
        taskType: trial.taskId,
        accuracy: trial.accuracy,
        precision: trial.precision,
        recall: trial.recall,
        f1: trial.f1Score,
        durationMs: trial.durationMs,
        nasaTlxAverage: trial.workloadScore,
        confidenceRating: trial.confidenceRating,
        timestamp: sessionExport.sessionEndTime,
      });
    }
  }

  /**
   * Computes empirical utility scores grouped by spec key or condition.
   */
  computeUtilityScores(): Map<string, EmpiricalUtilityScore> {
    const groups = new Map<string, EmpiricalOutcome[]>();

    for (const outcome of this.outcomes) {
      const key = outcome.spec
        ? `${outcome.spec.layout}:${outcome.spec.geometry}`
        : `condition:${outcome.condition}`;

      const list = groups.get(key) ?? [];
      list.push(outcome);
      groups.set(key, list);
    }

    const results = new Map<string, EmpiricalUtilityScore>();

    for (const [key, list] of groups.entries()) {
      const count = list.length;
      const meanAcc = list.reduce((s, o) => s + o.accuracy, 0) / count;
      const meanF1 = list.reduce((s, o) => s + o.f1, 0) / count;
      const meanDuration = list.reduce((s, o) => s + o.durationMs, 0) / count;
      const tlxList = list.filter((o) => o.nasaTlxAverage !== undefined);
      const meanTlx = tlxList.length > 0
        ? tlxList.reduce((s, o) => s + (o.nasaTlxAverage ?? 50), 0) / tlxList.length
        : 50;

      // Normalized components (duration capped at 2 mins = 120,000ms, TLX 0-100)
      const normTimeScore = Math.max(0, 1 - meanDuration / 120_000);
      const normTlxScore = Math.max(0, 1 - meanTlx / 100);

      // Composite utility: 50% F1 accuracy, 30% speed efficiency, 20% low cognitive load
      const utility = 0.5 * meanF1 + 0.3 * normTimeScore + 0.2 * normTlxScore;

      results.set(key, {
        specKey: key,
        condition: list[0].condition,
        sampleCount: count,
        meanAccuracy: meanAcc,
        meanF1: meanF1,
        meanDurationMs: meanDuration,
        meanNasaTlx: meanTlx,
        compositeUtility: Math.min(1.0, Math.max(0.0, utility)),
      });
    }

    return results;
  }

  /**
   * Generates a spec key from a DracoSpec.
   */
  getSpecKey(spec: DracoSpec): string {
    return `${spec.layout}:${spec.geometry}`;
  }

  /**
   * Clears all stored outcomes.
   */
  clear(): void {
    this.outcomes = [];
  }

  get totalOutcomes(): number {
    return this.outcomes.length;
  }
}
