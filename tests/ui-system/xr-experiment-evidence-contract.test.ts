import { describe, expect, it } from 'vitest';
import {
  assertComparableExperimentEvidence,
  createExperimentEvidenceBinding,
} from '../../dev/xr-lab/XRExperimentEvidenceContract.ts';
import { XREvaluationRecorder } from '../../dev/xr-simulator/XREvaluationEpisode.ts';

const base = {
  architecture: 'SWSE_BASELINE' as const,
  protocolId: 'uxr3-architecture-comparison',
  protocolVersion: '1',
  datasetId: 'synthetic-structure-lab',
  datasetFingerprint: 'sha256:dataset-a',
  oracleId: 'synthetic-structure-lab:v1',
  seed: 1234,
  replayTraceId: 'trace-teleport-flood-v1',
  resourceBudgetId: 'quest3-class-default-v1',
};

describe('XR architecture experiment evidence contract', () => {
  it('binds all comparison-critical provenance', () => {
    expect(createExperimentEvidenceBinding(base)).toEqual(base);
  });

  it.each([
    ['protocolId', ''],
    ['protocolVersion', ''],
    ['datasetId', ''],
    ['datasetFingerprint', ''],
    ['oracleId', ''],
    ['replayTraceId', ''],
  ] as const)('fails closed when %s is absent', (field, value) => {
    expect(() => createExperimentEvidenceBinding({ ...base, [field]: value })).toThrow();
  });

  it('fails closed on invalid seed', () => {
    expect(() => createExperimentEvidenceBinding({ ...base, seed: Number.NaN })).toThrow(/seed/i);
  });

  it('refuses comparison across different protocol, dataset, oracle, seed, or replay trace', () => {
    const left = createExperimentEvidenceBinding(base);
    for (const right of [
      { ...base, protocolVersion: '2', architecture: 'COUPLED_STAIRCASE' as const },
      { ...base, datasetFingerprint: 'sha256:dataset-b', architecture: 'COUPLED_STAIRCASE' as const },
      { ...base, oracleId: 'other-oracle', architecture: 'COUPLED_STAIRCASE' as const },
      { ...base, seed: 999, architecture: 'COUPLED_STAIRCASE' as const },
      { ...base, replayTraceId: 'other-trace', architecture: 'COUPLED_STAIRCASE' as const },
    ]) {
      expect(() => assertComparableExperimentEvidence(left, createExperimentEvidenceBinding(right))).toThrow(/not comparable/i);
    }
  });

  it('allows different architecture arms when all governing provenance matches', () => {
    const left = createExperimentEvidenceBinding(base);
    const right = createExperimentEvidenceBinding({ ...base, architecture: 'ORTHOGONAL_MATRIX' });
    expect(() => assertComparableExperimentEvidence(left, right)).not.toThrow();
  });

  it('binds comparison provenance into every experiment XR episode', () => {
    const binding = createExperimentEvidenceBinding(base);
    const recorder = new XREvaluationRecorder({ scenarioId: 'teleport-flood', experimentEvidence: binding });
    recorder.begin();
    recorder.setOutcome('PASSED');
    expect(recorder.finish().experimentEvidence).toEqual(binding);
  });

  it('does not silently turn an ordinary XR episode into experiment evidence', () => {
    const recorder = new XREvaluationRecorder({ scenarioId: 'ordinary-xr-check' });
    recorder.begin();
    recorder.setOutcome('PASSED');
    expect(recorder.finish().experimentEvidence).toBeNull();
  });
});

