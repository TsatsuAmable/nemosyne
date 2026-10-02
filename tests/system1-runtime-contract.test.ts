import { describe, expect, it, vi } from 'vitest';

import type { ImmutableReferenceV1 } from '../src/governance/GovernedEventContracts.ts';
import {
  System1ContractError,
  assertSystem1ModelArtifactV1,
  evaluateSystem1PrototypeV1,
  runSystem1InferenceV1,
  type System1InferencePort,
  type System1ModelArtifactV1,
} from '../src/moneta/system1/index.ts';

function ref(id: string, char: string): ImmutableReferenceV1 {
  return {
    schemaVersion: '1',
    id,
    version: '1',
    digest: { algorithm: 'SHA256', value: char.repeat(64) },
  };
}

const modelRef = ref('system1.model.test', 'a');
const featureRef = ref('system1.features.test', 'b');
const runtimeRef = ref('system1.runtime.test', 'c');
const calibrationRef = ref('system1.calibration.test', 'd');
const sourceRef = ref('system1.source.test', 'e');

function artifact(overrides: Partial<System1ModelArtifactV1> = {}): System1ModelArtifactV1 {
  return {
    schemaVersion: '1',
    artifact: modelRef,
    purpose: 'REPRESENTATION_PROPOSAL',
    semanticPurpose: 'rank a bounded candidate family for prototype evaluation',
    featureSchema: featureRef,
    trainingSnapshot: null,
    curationPolicy: null,
    trainer: null,
    environment: null,
    sourceRevision: sourceRef,
    format: 'REFERENCE',
    opset: null,
    operatorInventory: [],
    inputs: [{ name: 'features', dtype: 'float32', dimensions: [{ min: 4, max: 4 }] }],
    outputs: [{ name: 'score', dtype: 'float32', dimensions: [{ min: 1, max: 1 }] }],
    byteLength: 0,
    expectedWorkingMemoryBytes: 1024,
    calibration: { status: 'UNCALIBRATED', report: null },
    knownFailureConditions: ['prototype-only synthetic fixture'],
    promotionStage: 'CANDIDATE',
    researchFrozen: false,
    ...overrides,
  };
}

function makePort(): System1InferencePort<readonly number[], string> {
  return {
    runtimeIdentity: {
      runtime: runtimeRef,
      providerId: 'reference.test',
      providerVersion: '1',
      executionProvider: 'REFERENCE',
    },
    infer: vi.fn(async (request) => ({
      model: request.model.artifact,
      featureSchema: request.featureSchema,
      inferredAt: request.requestedAt,
      latencyMs: 2.5,
      outcome: {
        status: 'DECISION' as const,
        value: 'radial',
        rawScore: 0.8,
        calibratedProbability: null,
      },
    })),
  };
}

function request(model = artifact()) {
  return {
    requestId: 'request.test',
    model,
    featureSchema: model.featureSchema,
    features: [1, 2, 3, 4] as const,
    observedAt: '2026-10-02T04:00:00.000Z',
    requestedAt: '2026-10-02T04:00:00.100Z',
    maxObservationAgeMs: 500,
  };
}

describe('FM5 System-1 runtime contract', () => {
  it('rejects false ONNX and calibration claims', () => {
    expect(() => assertSystem1ModelArtifactV1(artifact({ format: 'ONNX', opset: null }))).toThrow(
      'ONNX artifacts require an opset',
    );
    expect(() =>
      assertSystem1ModelArtifactV1(
        artifact({ calibration: { status: 'CALIBRATED', report: calibrationRef } }),
      ),
    ).not.toThrow();

    const invalid = artifact({
      calibration: { status: 'UNCALIBRATED', report: calibrationRef } as never,
    });
    expect(() => assertSystem1ModelArtifactV1(invalid)).toThrow('closed V1 contract');

    const withUnknownField = { ...artifact(), hiddenAuthority: true } as System1ModelArtifactV1;
    expect(() => assertSystem1ModelArtifactV1(withUnknownField)).toThrow('closed V1 contract');

    const nestedUnknownField = artifact({
      inputs: [{
        name: 'features',
        dtype: 'float32',
        dimensions: [{ min: 4, max: 4, secret: 1 } as never],
      }],
    });
    expect(() => assertSystem1ModelArtifactV1(nestedUnknownField)).toThrow('closed V1 contract');
  });

  it('fails closed before provider execution when an observation is stale', async () => {
    const candidatePort = makePort();
    const result = await runSystem1InferenceV1(candidatePort, {
      ...request(),
      requestedAt: '2026-10-02T04:00:01.000Z',
      maxObservationAgeMs: 500,
    });

    expect(candidatePort.infer).not.toHaveBeenCalled();
    expect(result.executionStatus).toBe('SKIPPED');
    expect(result.runtime).toBeNull();
    expect(result.outcome).toEqual({
      status: 'ABSTAIN',
      reason: 'STALE_OBSERVATION',
      rawScore: null,
    });
  });

  it('rejects provider output bound to the wrong model identity', async () => {
    const candidatePort = makePort();
    candidatePort.infer = vi.fn(async (input) => ({
      model: ref('other.model', 'f'),
      featureSchema: input.featureSchema,
      inferredAt: input.requestedAt,
      latencyMs: 1,
      outcome: {
        status: 'DECISION' as const,
        value: 'radial',
        rawScore: 0.4,
        calibratedProbability: null,
      },
    }));

    await expect(runSystem1InferenceV1(candidatePort, request())).rejects.toMatchObject({
      code: 'INVALID_PROVIDER_RESULT',
    });
  });

  it('rejects mismatched feature-schema, malformed runtime, and non-finite latency', async () => {
    await expect(
      runSystem1InferenceV1(makePort(), {
        ...request(),
        featureSchema: ref('system1.features.other', 'f'),
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });

    const baseRuntimePort = makePort();
    const malformedRuntime: System1InferencePort<readonly number[], string> = {
      ...baseRuntimePort,
      runtimeIdentity: {
        ...baseRuntimePort.runtimeIdentity,
        providerId: 'contains whitespace',
      },
    };
    await expect(runSystem1InferenceV1(malformedRuntime, request())).rejects.toMatchObject({
      code: 'INVALID_PROVIDER_RESULT',
    });

    const invalidLatency = makePort();
    invalidLatency.infer = vi.fn(async (input) => ({
      model: input.model.artifact,
      featureSchema: input.featureSchema,
      inferredAt: input.requestedAt,
      latencyMs: Number.POSITIVE_INFINITY,
      outcome: {
        status: 'ABSTAIN' as const,
        reason: 'PROVIDER_REFUSAL' as const,
        rawScore: null,
      },
    }));
    await expect(runSystem1InferenceV1(invalidLatency, request())).rejects.toMatchObject({
      code: 'INVALID_PROVIDER_RESULT',
    });
  });

  it('never accepts calibrated probability from an uncalibrated artifact', async () => {
    const candidatePort = makePort();
    candidatePort.infer = vi.fn(async (input) => ({
      model: input.model.artifact,
      featureSchema: input.featureSchema,
      inferredAt: input.requestedAt,
      latencyMs: 1,
      outcome: {
        status: 'DECISION' as const,
        value: 'grid',
        rawScore: 0.7,
        calibratedProbability: 0.9,
      },
    }));

    await expect(runSystem1InferenceV1(candidatePort, request())).rejects.toBeInstanceOf(
      System1ContractError,
    );
  });

  it('preserves runtime and model provenance for an advisory decision', async () => {
    const result = await runSystem1InferenceV1(makePort(), request());

    expect(result.executionStatus).toBe('EXECUTED');
    expect(result.runtime?.executionProvider).toBe('REFERENCE');
    expect(result.model).toEqual(modelRef);
    expect(result.featureSchema).toEqual(featureRef);
    expect(result.outcome).toMatchObject({
      status: 'DECISION',
      value: 'radial',
      rawScore: 0.8,
      calibratedProbability: null,
    });
  });

  it('evaluates prototypes without promoting a winner', async () => {
    const report = await evaluateSystem1PrototypeV1({
      model: artifact(),
      port: makePort(),
      cases: [
        {
          id: 'a',
          features: [1, 2, 3, 4],
          observedAt: '2026-10-02T04:00:00.000Z',
          requestedAt: '2026-10-02T04:00:00.100Z',
          maxObservationAgeMs: 500,
          expected: { status: 'DECISION', value: 'radial' },
        },
        {
          id: 'stale',
          features: [4, 3, 2, 1],
          observedAt: '2026-10-02T04:00:00.000Z',
          requestedAt: '2026-10-02T04:00:02.000Z',
          maxObservationAgeMs: 500,
          expected: { status: 'ABSTAIN' },
        },
      ],
    });

    expect(report.caseCount).toBe(2);
    expect(report.decisionCount).toBe(1);
    expect(report.abstainCount).toBe(1);
    expect(report.exactMatchRate).toBe(1);
    expect(report.meanExecutedLatencyMs).toBe(2.5);
    expect(report.p95ExecutedLatencyMs).toBe(2.5);
    expect(Object.keys(report)).not.toContain('winner');
  });
});
