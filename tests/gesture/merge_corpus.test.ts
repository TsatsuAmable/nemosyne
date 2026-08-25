import { describe, expect, it } from 'vitest';
import { mergeCorpus } from '../../scripts/gesture-training/merge_corpus.ts';
import type { RawInstance } from '../../src/gesture/capture.ts';

function fakeInstance(label: RawInstance['label'], n: number): RawInstance {
  const left = [];
  const right = [];
  for (let i = 0; i < n; i++) {
    left.push({ x: i, y: 0, z: 0, pinched: false, t: i });
    right.push({ x: i, y: 0, z: 0, pinched: false, t: i });
  }
  return { left, right, label };
}

describe('mergeCorpus', () => {
  it('adds captured instances to synthetic train/test by 80/20 split', () => {
    const synthTrain = [fakeInstance('idle', 5), fakeInstance('scoopUp', 5)];
    const synthTest = [fakeInstance('idle', 5)];
    const captured = Array.from({ length: 10 }, (_, i) => fakeInstance('pinchTogether', 4 + i));
    const result = mergeCorpus({ syntheticTrain: synthTrain, syntheticTest: synthTest, captured });
    expect(result.train.length).toBe(2 + 8);
    expect(result.test.length).toBe(1 + 2);
    expect(result.capturedUsed).toBe(10);
  });

  it('is deterministic for the same seed', () => {
    const synthTrain = [fakeInstance('idle', 5)];
    const synthTest: RawInstance[] = [];
    const captured = Array.from({ length: 20 }, (_, i) => fakeInstance('pushForward', i + 3));
    const a = mergeCorpus({ syntheticTrain: synthTrain, syntheticTest: synthTest, captured, seed: 42 });
    const b = mergeCorpus({ syntheticTrain: synthTrain, syntheticTest: synthTest, captured, seed: 42 });
    expect(a.train).toEqual(b.train);
    expect(a.test).toEqual(b.test);
  });

  it('different seeds produce different splits (high probability)', () => {
    const captured = Array.from({ length: 30 }, (_, i) => fakeInstance('scoopUp', i + 2));
    const a = mergeCorpus({ syntheticTrain: [], syntheticTest: [], captured, seed: 1 });
    const b = mergeCorpus({ syntheticTrain: [], syntheticTest: [], captured, seed: 2 });
    expect(a.train).not.toEqual(b.train);
  });

  it('handles empty captured corpus', () => {
    const synthTrain = [fakeInstance('idle', 5)];
    const synthTest = [fakeInstance('scoopUp', 5)];
    const result = mergeCorpus({ syntheticTrain: synthTrain, syntheticTest: synthTest, captured: [] });
    expect(result.train).toEqual(synthTrain);
    expect(result.test).toEqual(synthTest);
    expect(result.capturedUsed).toBe(0);
  });

  it('respects a custom captured test fraction', () => {
    const captured = Array.from({ length: 10 }, (_, i) => fakeInstance('bothPinched', i + 1));
    const half = mergeCorpus({
      syntheticTrain: [],
      syntheticTest: [],
      captured,
      capturedTestFraction: 0.5,
    });
    expect(half.train.length).toBe(5);
    expect(half.test.length).toBe(5);
  });
});