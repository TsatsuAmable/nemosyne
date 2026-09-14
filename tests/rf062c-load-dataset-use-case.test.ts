import { describe, expect, it, vi } from 'vitest';
import { Dataset } from '../src/data/Dataset.ts';
import {
  LoadDatasetUseCase,
  type DatasetLoadAuthority,
} from '../src/app/dataset/LoadDatasetUseCase.ts';
import { createDefaultRequirements } from '../src/moneta/representation/RepresentationRequirements.ts';
import type { RepresentationDecision } from '../src/moneta/representation/RepresentationDecision.ts';
import { minimalDatasetSignature } from '../src/moneta/representation/DatasetSignature.ts';
import type {
  AnalyticalExecutionPort,
  AnalyticalExecutionRequest,
} from '../src/atlas/ports/AnalyticalExecutionPort.ts';

function dataset(name = 'fixture'): Dataset {
  return new Dataset(
    name,
    [
      { name: 'id', type: 'NUMERIC' },
      { name: 'value', type: 'NUMERIC' },
    ],
    [
      { id: 1, value: 10 },
      { id: 2, value: 20 },
    ],
    [],
  );
}

function fakeAuthority(initial: Dataset) {
  let current = initial;
  const setOriginalDataset = vi.fn((next: Dataset) => {
    current = next;
  });
  const setCurrentDataset = vi.fn((next: Dataset) => {
    current = next;
  });
  const authority = {
    setOriginalDataset,
    setCurrentDataset,
    get dataset() {
      return current;
    },
    isReady: vi.fn(() => false),
    inferEncodings: vi.fn(() => null),
    arbitrateRepresentation: vi.fn(),
    computeDatasetSignature: vi.fn(),
  } as unknown as DatasetLoadAuthority;
  return { authority, setOriginalDataset, setCurrentDataset };
}

describe('RF-062C LoadDatasetUseCase', () => {
  it('uses declared aggregate semantics instead of conflicting presentation encodings', async () => {
    const active = new Dataset(
      'aggregate-active',
      [
        { name: 'group', type: 'CATEGORICAL' },
        { name: 'value', type: 'NUMERIC' },
        { name: 'decoyGroup', type: 'CATEGORICAL' },
        { name: 'decoyValue', type: 'NUMERIC' },
      ],
      [{ group: 'a', value: 1, decoyGroup: 'x', decoyValue: 99 }],
    );
    const { authority } = fakeAuthority(active);
    const execute = vi.fn(async (request: AnalyticalExecutionRequest) => ({
      requestId: request.requestId,
      generation: request.generation,
      datasetVersion: request.dataset.version,
      datasetFingerprint: request.dataset.fingerprint,
      value: null,
    }));
    const executionPort: AnalyticalExecutionPort = {
      isAsync: true,
      supersede: vi.fn(),
      hasRegisteredDataset: vi.fn(() => true),
      execute: execute as unknown as AnalyticalExecutionPort['execute'],
    };
    const decision = {
      id: 'aggregate-decision',
      chosenCandidateId: 'AGGREGATE_VOLUME',
      decisionStatus: 'DECISIVE',
      rankedCandidates: [],
      utilityScore: 0.5,
      provenance: { fitnessModelVersion: 'bootstrap-fitness-v1' },
    } as unknown as RepresentationDecision;
    Object.assign(authority, {
      executionPort,
      generation: 4,
      datasetVersion: 7,
      datasetFingerprint: active.fingerprint,
    });
    authority.computeDatasetSignature = vi.fn(() =>
      minimalDatasetSignature(100, 2, 2, 0, active.fingerprint, 0),
    );
    const requirements = {
      ...createDefaultRequirements('group-comparison', 'LARGE'),
      aggregateSemantics: {
        kind: 'GROUPED_AGGREGATE',
        groupingField: 'group',
        measure: { field: 'value', function: 'MEAN' },
      },
    } as const;

    const result = new LoadDatasetUseCase(authority).execute(
      {
        name: 'Aggregate fixture',
        topology: 'TABULAR',
        dataset: active,
        encodings: { color: 'decoyGroup', size: 'decoyValue' },
      },
      {
        preserveAnalyticalState: true,
        requirements,
        authoritativeRepresentation: { decision },
      },
    );
    await result.dataInput.semanticEmbodimentPromise;

    expect(execute).toHaveBeenCalledOnce();
    expect(execute.mock.calls[0][0].params).toMatchObject({
      groupingField: 'group',
      measure: { field: 'value', function: 'MEAN' },
    });
    expect(JSON.stringify(execute.mock.calls[0][0].params)).not.toContain('decoy');
  });

  it('routes a fresh load through Atlas ownership with dataset-level overview intent', () => {
    const source = dataset('source');
    const { authority, setOriginalDataset, setCurrentDataset } = fakeAuthority(source);
    const useCase = new LoadDatasetUseCase(authority);

    const result = useCase.execute({
      key: 'fixture',
      name: 'Fixture',
      topology: 'TABULAR',
      dataset: source,
      maxDepth: 2,
      encodings: { color: 'value' },
    });

    expect(setOriginalDataset).toHaveBeenCalledOnce();
    expect(setCurrentDataset).toHaveBeenCalledOnce();
    const baseline = setOriginalDataset.mock.calls[0][0];
    const working = setCurrentDataset.mock.calls[0][0];
    expect(baseline).not.toBe(source);
    expect(working).not.toBe(source);
    expect(working).not.toBe(baseline);
    expect(result.embodiedDataset).toBe(working);
    expect(result.dataInput.dataset).toBe(working);
    expect(result.dataInput.encodings).toEqual({ color: 'value' });
    expect(result.requirements.task).toBe('overview');
    expect(result.requirements.requiredStructures.map(({ type }) => type)).toEqual([
      'distribution',
      'density',
    ]);
    expect(
      result.requirements.preservationGoals.some(
        ({ information, priority }) =>
          information === 'individual-observation-identity' && priority === 'CRITICAL'
      )
    ).toBe(false);
    expect(result.representationDecision).toBeNull();
    expect(result.outcome).toBeNull();
  });

  it('preserves the authoritative analytical dataset and caller requirements during re-arbitration', () => {
    const active = dataset('active');
    const source = dataset('source');
    const { authority, setOriginalDataset, setCurrentDataset } = fakeAuthority(active);
    const useCase = new LoadDatasetUseCase(authority);
    const requirements = createDefaultRequirements('overview');

    const result = useCase.execute(
      {
        name: 'Fixture',
        topology: 'TABULAR',
        dataset: source,
      },
      { preserveAnalyticalState: true, requirements },
    );

    expect(setOriginalDataset).not.toHaveBeenCalled();
    expect(setCurrentDataset).not.toHaveBeenCalled();
    expect(result.embodiedDataset).toBe(active);
    expect(result.dataInput.dataset).toBe(active);
    expect(result.requirements).toBe(requirements);
  });

  it('embodies a restored authoritative decision without re-arbitrating it', () => {
    const active = dataset('active');
    const { authority } = fakeAuthority(active);
    authority.isReady = vi.fn(() => true);
    authority.computeDatasetSignature = vi.fn(() => ({})) as never;
    const useCase = new LoadDatasetUseCase(authority);
    const decision = {
      chosenCandidateId: 'restored-candidate',
    } as unknown as RepresentationDecision;

    const result = useCase.execute(
      {
        name: 'Fixture',
        topology: 'TABULAR',
        dataset: active,
      },
      {
        preserveAnalyticalState: true,
        authoritativeRepresentation: { decision },
      }
    );

    expect(authority.arbitrateRepresentation).not.toHaveBeenCalled();
    expect(result.representationDecision).toBe(decision);
  });
});
