import { describe, it, expect } from 'vitest';
import { inferTopology, inferEncodingsForTopology } from '../../../src/data/TopologyInference.ts';
import { Dataset, ColumnType } from '../../../src/data/Dataset.ts';
import type { ColumnSchema } from '../../../src/data/types.ts';

describe('Tier 2 — Feature 1: Data -> Draco Reverse Import Decoupling (Boundary Cases)', () => {
  it('F1-BC1: inferTopology called with dataset containing 0 columns returns TABULAR topology', () => {
    const emptyDataset = new Dataset('EmptyDataset', [], []);
    const topology = inferTopology(emptyDataset);
    expect(topology).toBe('TABULAR');
  });

  it('F1-BC2: inferTopology with 1,000 mixed-type columns processes inference without crash', () => {
    const columns: ColumnSchema[] = [];
    const row: Record<string, unknown> = {};

    for (let i = 0; i < 1000; i++) {
      const type = i % 3 === 0 ? ColumnType.NUMERIC : i % 3 === 1 ? ColumnType.CATEGORICAL : ColumnType.TEMPORAL;
      const colName = `col_${i}`;
      columns.push({ name: colName, type });
      row[colName] = i % 3 === 0 ? i : i % 3 === 1 ? `cat_${i}` : '2026-08-09';
    }

    const largeDataset = new Dataset('LargeDataset', columns, [row]);
    const startTime = performance.now();
    const topology = inferTopology(largeDataset);
    const duration = performance.now() - startTime;

    expect(topology).toBeDefined();
    expect(typeof topology).toBe('string');
    expect(duration).toBeLessThan(100); // Sub-100ms processing
  });

  it('F1-BC3: inferTopology handles column names with special Unicode and emoji characters', () => {
    const columns: ColumnSchema[] = [
      { name: 'naïve_latitude', type: ColumnType.NUMERIC },
      { name: '🎯_longitude', type: ColumnType.NUMERIC },
    ];
    const rows = [{ 'naïve_latitude': 37.7749, '🎯_longitude': -122.4194 }];
    const unicodeDataset = new Dataset('UnicodeDataset', columns, rows);

    const topology = inferTopology(unicodeDataset);
    expect(topology).toBe('GEO');
  });

  it('F1-BC4: inferEncodingsForTopology handles dataset with zero columns gracefully', () => {
    const emptyDataset = new Dataset('EmptyDataset', [], []);
    const encodings = inferEncodingsForTopology(emptyDataset, 'TABULAR');

    expect(encodings).toBeDefined();
    expect(Object.keys(encodings).length).toBe(0);
  });

  it('F1-BC5: Explicit invalid topology string falls back safely to TABULAR or exact resolution', () => {
    const columns: ColumnSchema[] = [{ name: 'val', type: ColumnType.NUMERIC }];
    const dataset = new Dataset('TestDataset', columns, [{ val: 42 }]);

    const topology = inferTopology(dataset, 'NON_EXISTENT_TOPOLOGY_TYPE');
    expect(topology).toBe('TABULAR');
  });
});
