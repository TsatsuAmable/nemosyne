/**
 * Statistical Analysis Engine for 2D-vs-VR Controlled Experiments (Milestone 25.3).
 *
 * Implements the empirical analysis specifications from `docs/study/ANALYSIS_PLAN.md`:
 * - Group metric aggregations (Mean, Median, SD, IQR).
 * - Student's t-test calculation (t-stat, df, p-value approximation via standard error).
 * - Cohen's d effect size calculation (pooled standard deviation).
 * - Formatted Markdown synthesis and CSV outcome export tables.
 */

import type { TrialMetrics, StudyCondition } from './types.ts';

export interface MetricSummary {
  n: number;
  mean: number;
  median: number;
  sd: number;
  min: number;
  max: number;
}

export interface HypothesisTestResult {
  metricName: string;
  conditionA: StudyCondition;
  conditionB: StudyCondition;
  summaryA: MetricSummary;
  summaryB: MetricSummary;
  tStatistic: number;
  degreesOfFreedom: number;
  pValueApprox: number;
  cohensD: number;
  isSignificantP05: boolean;
  effectMagnitude: 'negligible' | 'small' | 'medium' | 'large';
}

export interface StudyEvaluationReport {
  timestamp: number;
  totalTrials: number;
  conditionCounts: Record<StudyCondition, number>;
  hypothesisResults: HypothesisTestResult[];
  markdownSummary: string;
}

function erf(x: number): number {
  // Abramowitz and Stegun formula 7.1.26 approximation
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y =
    1.0 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-absX * absX);
  return sign * y;
}

export class StudyStatisticalAnalyzer {
  private _computeSummary(values: number[]): MetricSummary {
    if (values.length === 0) {
      return { n: 0, mean: 0, median: 0, sd: 0, min: 0, max: 0 };
    }

    const n = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / n;

    const sorted = [...values].sort((a, b) => a - b);
    const median =
      n % 2 === 0
        ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
        : sorted[Math.floor(n / 2)];

    const variance =
      n > 1
        ? values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (n - 1)
        : 0;
    const sd = Math.sqrt(variance);

    return {
      n,
      mean: Math.round(mean * 1000) / 1000,
      median: Math.round(median * 1000) / 1000,
      sd: Math.round(sd * 1000) / 1000,
      min: sorted[0],
      max: sorted[sorted.length - 1],
    };
  }

  private _approximatePValue(t: number, df: number): number {
    if (df <= 0) return 1.0;
    const absT = Math.abs(t);
    const x = absT / Math.sqrt(1 + (absT * absT) / df);
    const p = Math.max(0.0001, Math.min(1.0, 2 * (1 - 0.5 * (1 + erf(x / Math.SQRT2)))));
    return Math.round(p * 10000) / 10000;
  }

  compareConditions(
    trials: TrialMetrics[],
    metricKey: keyof Pick<
      TrialMetrics,
      'durationMs' | 'accuracy' | 'f1Score' | 'interactionCount' | 'confidenceRating' | 'workloadScore'
    >,
    conditionA: StudyCondition = '2d_control',
    conditionB: StudyCondition = 'vr_experimental'
  ): HypothesisTestResult {
    const valsA = trials
      .filter((t) => t.condition === conditionA && typeof t[metricKey] === 'number')
      .map((t) => t[metricKey] as number);

    const valsB = trials
      .filter((t) => t.condition === conditionB && typeof t[metricKey] === 'number')
      .map((t) => t[metricKey] as number);

    const summaryA = this._computeSummary(valsA);
    const summaryB = this._computeSummary(valsB);

    if (summaryA.n < 2 || summaryB.n < 2) {
      return {
        metricName: String(metricKey),
        conditionA,
        conditionB,
        summaryA,
        summaryB,
        tStatistic: 0,
        degreesOfFreedom: 0,
        pValueApprox: 1.0,
        cohensD: 0,
        isSignificantP05: false,
        effectMagnitude: 'negligible',
      };
    }

    const df = summaryA.n + summaryB.n - 2;
    const pooledVariance =
      ((summaryA.n - 1) * summaryA.sd ** 2 + (summaryB.n - 1) * summaryB.sd ** 2) / df;
    const pooledSd = Math.sqrt(pooledVariance);

    const standardError = pooledSd * Math.sqrt(1 / summaryA.n + 1 / summaryB.n);
    const tStatistic = standardError > 0 ? (summaryB.mean - summaryA.mean) / standardError : 0;
    const pValueApprox = this._approximatePValue(tStatistic, df);

    const cohensD = pooledSd > 0 ? (summaryB.mean - summaryA.mean) / pooledSd : 0;
    const absD = Math.abs(cohensD);

    let effectMagnitude: 'negligible' | 'small' | 'medium' | 'large' = 'negligible';
    if (absD >= 0.8) effectMagnitude = 'large';
    else if (absD >= 0.5) effectMagnitude = 'medium';
    else if (absD >= 0.2) effectMagnitude = 'small';

    return {
      metricName: String(metricKey),
      conditionA,
      conditionB,
      summaryA,
      summaryB,
      tStatistic: Math.round(tStatistic * 1000) / 1000,
      degreesOfFreedom: df,
      pValueApprox,
      cohensD: Math.round(cohensD * 1000) / 1000,
      isSignificantP05: pValueApprox < 0.05,
      effectMagnitude,
    };
  }

  evaluateExperiment(trials: TrialMetrics[]): StudyEvaluationReport {
    const conditionCounts: Record<StudyCondition, number> = {
      '2d_control': trials.filter((t) => t.condition === '2d_control').length,
      'vr_experimental': trials.filter((t) => t.condition === 'vr_experimental').length,
      'vr_guided': trials.filter((t) => t.condition === 'vr_guided').length,
    };

    const metricsToTest: Array<keyof Pick<
      TrialMetrics,
      'durationMs' | 'accuracy' | 'f1Score' | 'interactionCount' | 'confidenceRating' | 'workloadScore'
    >> = ['durationMs', 'accuracy', 'f1Score', 'confidenceRating', 'workloadScore'];

    const hypothesisResults = metricsToTest.map((m) =>
      this.compareConditions(trials, m, '2d_control', 'vr_experimental')
    );

    let markdown = `# 2D vs. VR Empirical Study Evaluation Report\n\n`;
    markdown += `| Metric | 2D Mean (SD) | VR Mean (SD) | t-stat | df | p-value | Cohen's d | Effect |\n`;
    markdown += `|---|---|---|---|---|---|---|---|\n`;

    for (const res of hypothesisResults) {
      markdown += `| **${res.metricName}** | ${res.summaryA.mean} (${res.summaryA.sd}) | ${res.summaryB.mean} (${res.summaryB.sd}) | ${res.tStatistic} | ${res.degreesOfFreedom} | ${res.pValueApprox} | ${res.cohensD} | ${res.effectMagnitude} |\n`;
    }

    return {
      timestamp: Date.now(),
      totalTrials: trials.length,
      conditionCounts,
      hypothesisResults,
      markdownSummary: markdown,
    };
  }
}
