import { describe, it, expect } from 'vitest';
import { CSVParserWorker } from '../src/data/CSVParserWorker.ts';
import { DracoSolverWorker } from '../src/draco/DracoSolverWorker.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';

describe('Sprint 17.2: Web Worker Offloading Suite', () => {
  it('parses CSV data asynchronously without blocking main thread execution', async () => {
    const csvText = `region,revenue\n"North",120.5\n"South",250.0`;

    const res = await CSVParserWorker.parseAsync({
      datasetName: 'AsyncSales',
      csvText,
    });

    expect(res.datasetName).toBe('AsyncSales');
    expect(res.columns.length).toBe(2);
    expect(res.rows.length).toBe(2);
    expect(res.rows[0].revenue).toBe(120.5);
  });

  it('solves Draco GA layout candidates asynchronously', async () => {
    const ds = new Dataset(
      'TabularAsync',
      [{ name: 'rev', type: ColumnType.NUMERIC }],
      [{ rev: 100 }, { rev: 200 }]
    );

    const res = await DracoSolverWorker.solveAsync({
      dataInput: { dataset: ds },
    });

    expect(res.result.spec.layout).toBe('GRID_3D');
    expect(res.solveTimeMs).toBeGreaterThanOrEqual(0);
  });
});
