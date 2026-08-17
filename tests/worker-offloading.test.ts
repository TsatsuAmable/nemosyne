import { describe, it, expect } from 'vitest';
import { DracoSolverWorker } from '../src/draco/DracoSolverWorker.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { makeFactProvider } from './helpers/dracoFactsHelper.ts';

describe('Sprint 17.2: Web Worker Offloading Suite', () => {
  it('solves Draco GA layout candidates asynchronously', async () => {
    const ds = new Dataset(
      'TabularAsync',
      [{ name: 'rev', type: ColumnType.NUMERIC }],
      [{ rev: 100 }, { rev: 200 }]
    );

    const res = await DracoSolverWorker.solveAsync({
      dataInput: { dataset: ds },
      factProvider: makeFactProvider(),
    });

    expect(res.result.spec.layout).toBe('GRID_3D');
    expect(res.solveTimeMs).toBeGreaterThanOrEqual(0);
  });
});
