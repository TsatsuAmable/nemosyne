import { describe, expect, it } from 'vitest';
import {
  compareUxr0ReplacementEvidence,
  type Uxr0ReplacementObservation,
} from '../src/validation/uxr0-replacement-qualification.ts';

function observation(
  variant: 'baseline' | 'candidate',
  overrides: Partial<Uxr0ReplacementObservation> = {}
): Uxr0ReplacementObservation {
  return {
    schemaVersion: 1,
    variant,
    implementationId: variant === 'baseline' ? 'local-pointer' : 'candidate-pointer',
    buildHash: variant === 'baseline' ? 'build-a' : 'build-b',
    scenario: {
      deviceTarget: 'META_QUEST_3S',
      deviceRuntimeId: 'quest-runtime-1',
      datasetFingerprint: 'dataset-fp',
      sourceRowCount: 100_000,
      taskScriptId: 'select-drag-return-v1',
      representationId: 'aggregate-volume',
      representationStateHash: 'representation-state-a',
      profileKind: 'functional-5m',
    },
    semanticDigest: 'semantic-same',
    interactionDigest: 'interaction-same',
    metrics: {
      frameP95Ms: variant === 'baseline' ? 14 : 12,
      frameP99Ms: variant === 'baseline' ? 18 : 16,
      drawCallsMax: variant === 'baseline' ? 40 : 32,
      sceneObjectCountEnd: 80,
      jsHeapPeakBytes: variant === 'baseline' ? 1_000 : 900,
      wasmPeakBytes: 2_000,
      workerOutboundPayloadBytesEstimate: variant === 'baseline' ? 500 : 450,
      workerInboundPayloadBytesEstimate: 300,
      bundleBytes: variant === 'baseline' ? 100_000 : 110_000,
      dependencyCount: variant === 'baseline' ? 10 : 11,
    },
    ...overrides,
  };
}

describe('UXR0 replacement qualification contract', () => {
  it('permits different build hashes but only returns comparable evidence and raw deltas', () => {
    const comparison = compareUxr0ReplacementEvidence(
      observation('baseline'),
      observation('candidate')
    );
    expect(comparison.disposition).toBe('evidence-comparable');
    expect(comparison.identityMismatches).toEqual([]);
    expect(comparison.parityIssues).toEqual([]);
    expect(comparison.deltas.frameP95Ms).toBe(-2);
    expect(comparison.deltas.bundleBytes).toBe(10_000);
    expect(comparison.deltas.dependencyCount).toBe(1);
    expect(comparison).not.toHaveProperty('adopt');
    expect(comparison).not.toHaveProperty('winner');
  });

  it('fails closed when device/dataset/task/representation identity is not the same', () => {
    const candidate = observation('candidate');
    candidate.scenario = { ...candidate.scenario, datasetFingerprint: 'different-dataset' };
    const comparison = compareUxr0ReplacementEvidence(observation('baseline'), candidate);
    expect(comparison.disposition).toBe('not-comparable');
    expect(comparison.identityMismatches).toContain('scenario.datasetFingerprint');
  });

  it('refuses comparability when semantic or interaction parity digests diverge', () => {
    const candidate = observation('candidate', {
      semanticDigest: 'semantic-different',
      interactionDigest: 'interaction-different',
    });
    const comparison = compareUxr0ReplacementEvidence(observation('baseline'), candidate);
    expect(comparison.disposition).toBe('not-comparable');
    expect(comparison.parityIssues).toEqual(['semanticDigest', 'interactionDigest']);
  });
});
