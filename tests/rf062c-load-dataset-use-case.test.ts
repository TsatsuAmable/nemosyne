import { describe, expect, it, vi } from 'vitest';
import { Dataset } from '../src/data/Dataset.ts';
import {
  LoadDatasetUseCase,
  type DatasetLoadAuthority,
} from '../src/app/dataset/LoadDatasetUseCase.ts';
import { createDefaultRequirements } from '../src/moneta/representation/RepresentationRequirements.ts';

function dataset(name = 'fixture'): Dataset {
  return new Dataset(
    name,
    [
      { name: 'id', type: 'number' },
      { name: 'value', type: 'number' },
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
  it('routes a fresh load through Atlas baseline/current ownership before building presentation input', () => {
    const source = dataset('source');
    const { authority, setOriginalDataset, setCurrentDataset } = fakeAuthority(source);
    const useCase = new LoadDatasetUseCase(authority);

    const result = useCase.execute({
      key: 'fixture',
      name: 'Fixture',
      topology: 'TABLE',
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
    expect(result.requirements.taskIntent).toBe('individual-inspection');
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
        topology: 'TABLE',
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
});
