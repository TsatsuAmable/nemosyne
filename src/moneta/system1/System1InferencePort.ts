import {
  System1ContractError,
  assertSystem1InferenceRequestV1,
  assertSystem1ProviderResponseV1,
  assertSystem1RuntimeIdentityV1,
  type System1InferenceRequestV1,
  type System1InferenceResultV1,
  type System1ProviderResponseV1,
  type System1RuntimeIdentityV1,
} from './System1Contracts.ts';

export interface System1InferencePort<TFeatures, TDecision> {
  readonly runtimeIdentity: System1RuntimeIdentityV1;
  infer(request: System1InferenceRequestV1<TFeatures>): Promise<System1ProviderResponseV1<TDecision>>;
}

export async function runSystem1InferenceV1<TFeatures, TDecision>(
  port: System1InferencePort<TFeatures, TDecision>,
  request: System1InferenceRequestV1<TFeatures>,
): Promise<System1InferenceResultV1<TDecision>> {
  assertSystem1InferenceRequestV1(request);
  assertSystem1RuntimeIdentityV1(port.runtimeIdentity);

  const observationAgeMs = Date.parse(request.requestedAt) - Date.parse(request.observedAt);
  if (observationAgeMs > request.maxObservationAgeMs) {
    return Object.freeze({
      schemaVersion: '1',
      requestId: request.requestId,
      model: request.model.artifact,
      featureSchema: request.featureSchema,
      executionStatus: 'SKIPPED',
      runtime: null,
      inferredAt: request.requestedAt,
      observationAgeMs,
      latencyMs: 0,
      outcome: Object.freeze({
        status: 'ABSTAIN',
        reason: 'STALE_OBSERVATION',
        rawScore: null,
      }),
    });
  }

  let response: System1ProviderResponseV1<TDecision>;
  try {
    response = await port.infer(request);
  } catch (error) {
    if (error instanceof System1ContractError) throw error;
    throw new System1ContractError(
      'INVALID_PROVIDER_RESULT',
      'System-1 provider failed without a typed ABSTAIN result: ' + String(error),
    );
  }

  assertSystem1ProviderResponseV1(request.model, response);

  return Object.freeze({
    schemaVersion: '1',
    requestId: request.requestId,
    model: response.model,
    featureSchema: response.featureSchema,
    executionStatus: 'EXECUTED',
    runtime: Object.freeze({ ...port.runtimeIdentity }),
    inferredAt: response.inferredAt,
    observationAgeMs,
    latencyMs: response.latencyMs,
    outcome: response.outcome,
  });
}
