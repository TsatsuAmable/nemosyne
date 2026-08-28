import { describe, expect, it } from 'vitest';
import { AnalyticalState } from '../src/atlas/domain/AnalyticalState.ts';
import { ColumnType, Dataset } from '../src/data/Dataset.ts';
import { canonicalDatasetIdentityHex } from '../src/data/DatasetIdentity.ts';

function dataset(name = 'fingerprint-state', offset = 0): Dataset {
  return new Dataset(
    name,
    [{ name: 'value', type: ColumnType.NUMERIC }],
    [{ value: 1 + offset }, { value: 2 + offset }, { value: 3 + offset }]
  );
}

describe('RF-060 authoritative fingerprint retention', () => {
  it('resolves the live authoritative fingerprint once for unchanged analytical state', () => {
    const state = new AnalyticalState();
    state.loadDataset(dataset());
    let calls = 0;
    const provider = () => {
      calls += 1;
      return 'a'.repeat(64);
    };

    expect(state.getFingerprint(provider)).toBe('a'.repeat(64));
    expect(state.getFingerprint(provider)).toBe('a'.repeat(64));
    expect(calls).toBe(1);
  });

  it('reuses a retained authoritative fingerprint for DatasetSpace without re-querying Rust', () => {
    const state = new AnalyticalState();
    state.loadDataset(dataset());
    expect(state.getFingerprint(() => 'b'.repeat(64))).toBe('b'.repeat(64));

    const space = state.getDatasetSpace(
      () => { throw new Error('retained authoritative fingerprint should avoid provider work'); },
      () => ({ value: { min: 1, max: 3 } })
    );

    expect(space?.fingerprint).toBe('b'.repeat(64));
    expect(space?.normalization.value).toEqual({ min: 1, max: 3 });
  });

  it('invalidates retained identity across governed dataset lifecycle transitions', () => {
    const state = new AnalyticalState();
    state.loadDataset(dataset('initial'));
    let calls = 0;
    const provider = () => `${++calls}`.padStart(64, '0');

    expect(state.getFingerprint(provider)).toBe('1'.padStart(64, '0'));
    expect(state.getFingerprint(provider)).toBe('1'.padStart(64, '0'));

    state.advanceDataset(dataset('advanced', 10));
    expect(state.getFingerprint(provider)).toBe('2'.padStart(64, '0'));

    state.setCurrentDataset(dataset('set', 20));
    expect(state.getFingerprint(provider)).toBe('3'.padStart(64, '0'));

    state.restore(dataset('original'), dataset('restored', 30), 7);
    expect(state.getFingerprint(provider)).toBe('4'.padStart(64, '0'));

    state.invalidateHandle();
    expect(state.getFingerprint(provider)).toBe('5'.padStart(64, '0'));
    expect(calls).toBe(5);
  });

  it('retains an explicit authoritative mutation fingerprint without provider work', () => {
    const state = new AnalyticalState();
    state.loadDataset(dataset());
    state.commitKernelResult({
      handle: 0,
      dataset: dataset('mutated', 10),
      fingerprint: 'c'.repeat(64),
    });
    let calls = 0;

    expect(state.getFingerprint(() => {
      calls += 1;
      return 'd'.repeat(64);
    })).toBe('c'.repeat(64));
    expect(calls).toBe(0);
  });

  it('does not retain an empty provider result as authoritative', () => {
    const state = new AnalyticalState();
    state.loadDataset(dataset());
    const fallback = canonicalDatasetIdentityHex(state.current.toJSON());
    let calls = 0;

    expect(state.getFingerprint(() => {
      calls += 1;
      return null;
    })).toBe(fallback);
    expect(state.getFingerprint(() => {
      calls += 1;
      return 'e'.repeat(64);
    })).toBe('e'.repeat(64));
    expect(calls).toBe(2);
  });

  it('does not retain browser fallback identity or swallow DatasetSpace provider failures', () => {
    const state = new AnalyticalState();
    state.loadDataset(dataset());
    const fallback = canonicalDatasetIdentityHex(state.current.toJSON());

    expect(state.getFingerprint(() => { throw new Error('kernel unavailable'); })).toBe(fallback);

    let calls = 0;
    expect(state.getFingerprint(() => {
      calls += 1;
      return 'f'.repeat(64);
    })).toBe('f'.repeat(64));
    expect(calls).toBe(1);

    state.invalidateHandle();
    expect(() => state.getDatasetSpace(
      () => { throw new Error('authoritative provider failed'); },
      () => ({ value: { min: 1, max: 3 } })
    )).toThrow(/authoritative provider failed/);
  });
});
