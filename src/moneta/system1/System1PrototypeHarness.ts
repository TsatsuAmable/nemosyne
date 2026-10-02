import type {
  System1InferenceRequestV1,
  System1InferenceResultV1,
  System1ModelArtifactV1,
} from './System1Contracts.ts';
import {
  runSystem1InferenceV1,
  type System1InferencePort,
} from './System1InferencePort.ts';

export interface System1PrototypeCaseV1<TFeatures, TDecision> {
  readonly id: string;
  readonly features: TFeatures;
  readonly observedAt: string;
  readonly requestedAt: string;
  readonly maxObservationAgeMs: number;
  readonly expected:
    | Readonly<{ status: 'DECISION'; value: TDecision }>
    | Readonly<{ status: 'ABSTAIN' }>
    | null;
}

export interface System1PrototypeReportV1<TDecision> {
  readonly schemaVersion: '1';
  readonly modelId: string;
  readonly caseCount: number;
  readonly decisionCount: number;
  readonly abstainCount: number;
  readonly labelledCaseCount: number;
  readonly matchedLabelCount: number;
  readonly exactMatchRate: number | null;
  readonly meanExecutedLatencyMs: number | null;
  readonly p95ExecutedLatencyMs: number | null;
  readonly results: readonly Readonly<{
    caseId: string;
    result: System1InferenceResultV1<TDecision>;
    labelMatched: boolean | null;
  }>[];
}

function percentile95(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * 0.95) - 1] ?? null;
}

export async function evaluateSystem1PrototypeV1<TFeatures, TDecision>(input: Readonly<{
  model: System1ModelArtifactV1;
  port: System1InferencePort<TFeatures, TDecision>;
  cases: readonly System1PrototypeCaseV1<TFeatures, TDecision>[];
  decisionsEqual?: (left: TDecision, right: TDecision) => boolean;
}>): Promise<System1PrototypeReportV1<TDecision>> {
  const decisionsEqual = input.decisionsEqual ?? ((left, right) => Object.is(left, right));
  const results: Array<{
    caseId: string;
    result: System1InferenceResultV1<TDecision>;
    labelMatched: boolean | null;
  }> = [];
  const executedLatencies: number[] = [];
  let decisionCount = 0;
  let abstainCount = 0;
  let labelledCaseCount = 0;
  let matchedLabelCount = 0;

  for (const testCase of input.cases) {
    const request: System1InferenceRequestV1<TFeatures> = {
      requestId: 'prototype.' + testCase.id,
      model: input.model,
      featureSchema: input.model.featureSchema,
      features: testCase.features,
      observedAt: testCase.observedAt,
      requestedAt: testCase.requestedAt,
      maxObservationAgeMs: testCase.maxObservationAgeMs,
    };
    const result = await runSystem1InferenceV1(input.port, request);
    if (result.executionStatus === 'EXECUTED') executedLatencies.push(result.latencyMs);
    if (result.outcome.status === 'DECISION') decisionCount += 1;
    else abstainCount += 1;

    let labelMatched: boolean | null = null;
    if (testCase.expected !== null) {
      labelledCaseCount += 1;
      if (testCase.expected.status === 'ABSTAIN') {
        labelMatched = result.outcome.status === 'ABSTAIN';
      } else if (result.outcome.status === 'DECISION') {
        labelMatched = decisionsEqual(result.outcome.value, testCase.expected.value);
      } else {
        labelMatched = false;
      }
      if (labelMatched) matchedLabelCount += 1;
    }
    results.push(Object.freeze({ caseId: testCase.id, result, labelMatched }));
  }

  const latencyTotal = executedLatencies.reduce((sum, latency) => sum + latency, 0);
  return Object.freeze({
    schemaVersion: '1',
    modelId: input.model.artifact.id,
    caseCount: input.cases.length,
    decisionCount,
    abstainCount,
    labelledCaseCount,
    matchedLabelCount,
    exactMatchRate: labelledCaseCount === 0 ? null : matchedLabelCount / labelledCaseCount,
    meanExecutedLatencyMs: executedLatencies.length === 0 ? null : latencyTotal / executedLatencies.length,
    p95ExecutedLatencyMs: percentile95(executedLatencies),
    results: Object.freeze(results),
  });
}
