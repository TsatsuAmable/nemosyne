// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { Dataset, ColumnType } from '../src/data/Dataset.js';

describe('Dataset JSON serialization', () => {
  const ds = new Dataset(
    'Test',
    [
      { name: 'id', type: ColumnType.CATEGORICAL },
      { name: 'value', type: ColumnType.NUMERIC },
      { name: 'time', type: ColumnType.TEMPORAL },
    ],
    [
      { id: 'A', value: 10, time: '2026-07-28T00:00:00' },
      { id: 'B', value: null, time: '2026-07-28T01:00:00' },
    ]
  );

  it('round-trips through toJSON / fromJSON', () => {
    const restored = Dataset.fromJSON(ds.toJSON());
    expect(restored.name).toBe('Test');
    expect(restored.rowCount).toBe(2);
    expect(restored.columns).toEqual(ds.columns);
    expect(restored.rows).toEqual(ds.rows);
  });

  it('preserves graph edges', () => {
    ds.edges = [
      { source: 'A', target: 'B', weight: 0.8 },
      { source: 'B', target: 'C', weight: 0.3 },
    ];
    const restored = Dataset.fromJSON(ds.toJSON());
    expect(restored.edges).toEqual(ds.edges);
  });

  it('handles empty datasets', () => {
    const empty = new Dataset('Empty', [], []);
    const restored = Dataset.fromJSON(empty.toJSON());
    expect(restored.rowCount).toBe(0);
    expect(restored.columnCount).toBe(0);
  });

  it('rejects invalid JSON input', () => {
    expect(() => Dataset.fromJSON(null)).toThrow();
    expect(() => Dataset.fromJSON('string')).toThrow();
  });

  it('normalizes undefined values to null on export', () => {
    const partial = new Dataset(
      'Partial',
      [{ name: 'a', type: ColumnType.TEXT }],
      [{ a: undefined }]
    );
    const json = partial.toJSON();
    expect(json.rows[0].a).toBeNull();
    const restored = Dataset.fromJSON(json);
    expect(restored.rows[0].a).toBeNull();
  });
});
