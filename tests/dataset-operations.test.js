import { describe, it, expect } from 'vitest';
import { Dataset, ColumnType } from '../src/data/Dataset.js';
import {
  filter,
  sort,
  aggregate,
  cluster,
  hierarchical,
  dbscan,
  anomaly,
  slice,
} from '../src/data/DatasetOperations.js';

function makeDataset(rows, name = 'Test') {
  const columns = [
    { name: 'id', type: ColumnType.NUMERIC },
    { name: 'category', type: ColumnType.CATEGORICAL },
    { name: 'value', type: ColumnType.NUMERIC },
  ];
  return new Dataset(name, columns, rows);
}

describe('DatasetOperations', () => {
  it('filters rows by predicate', () => {
    const ds = makeDataset([
      { id: 1, category: 'A', value: 10 },
      { id: 2, category: 'B', value: 20 },
      { id: 3, category: 'A', value: 30 },
    ]);
    const result = filter(ds, (r) => r.category === 'A');
    expect(result.rowCount).toBe(2);
    expect(result.rows.map((r) => r.id)).toEqual([1, 3]);
    expect(ds.rowCount).toBe(3); // original unchanged
  });

  it('sorts rows numerically ascending and descending', () => {
    const ds = makeDataset([
      { id: 1, category: 'A', value: 30 },
      { id: 2, category: 'B', value: 10 },
      { id: 3, category: 'A', value: 20 },
    ]);
    const asc = sort(ds, 'value', 'asc');
    expect(asc.rows.map((r) => r.id)).toEqual([2, 3, 1]);

    const desc = sort(ds, 'value', 'desc');
    expect(desc.rows.map((r) => r.id)).toEqual([1, 3, 2]);
  });

  it('sorts rows lexicographically when not numeric', () => {
    const ds = makeDataset([
      { id: 1, category: 'Zebra', value: 1 },
      { id: 2, category: 'Apple', value: 2 },
      { id: 3, category: 'Mango', value: 3 },
    ]);
    const result = sort(ds, 'category', 'asc');
    expect(result.rows.map((r) => r.id)).toEqual([2, 3, 1]);
  });

  it('aggregates rows by a categorical column', () => {
    const ds = makeDataset([
      { id: 1, category: 'A', value: 10 },
      { id: 2, category: 'A', value: 20 },
      { id: 3, category: 'B', value: 30 },
    ]);
    const result = aggregate(ds, 'category', (group) => ({
      category: group[0].category,
      total: group.reduce((sum, r) => sum + r.value, 0),
      count: group.length,
    }));
    expect(result.rowCount).toBe(2);
    const a = result.rows.find((r) => r.category === 'A');
    expect(a.total).toBe(30);
    expect(a.count).toBe(2);
  });

  it('clusters rows into k groups using numeric columns', () => {
    const ds = makeDataset([
      { id: 1, category: 'A', value: 1 },
      { id: 2, category: 'A', value: 2 },
      { id: 3, category: 'A', value: 100 },
      { id: 4, category: 'A', value: 101 },
    ]);
    const result = cluster(ds, 2);
    expect(result.rowCount).toBe(4);
    expect(result.getColumn('_cluster')).toBeDefined();
    const clusters = new Set(result.rows.map((r) => r._cluster));
    expect(clusters.size).toBe(2);
  });

  it('falls back to single cluster when no numeric columns', () => {
    const ds = new Dataset(
      'NoNums',
      [{ name: 'label', type: ColumnType.TEXT }],
      [{ label: 'x' }, { label: 'y' }]
    );
    const result = cluster(ds, 3);
    expect(result.rows.every((r) => r._cluster === 0)).toBe(true);
  });

  it('hierarchical clustering assigns clusters with average linkage', () => {
    const ds = makeDataset([
      { id: 1, category: 'A', value: 1 },
      { id: 2, category: 'A', value: 2 },
      { id: 3, category: 'A', value: 100 },
      { id: 4, category: 'A', value: 101 },
    ]);
    const result = hierarchical(ds, ['value'], 'average', 2);
    expect(result.rowCount).toBe(4);
    expect(result.getColumn('_cluster')).toBeDefined();
    const clusterIds = result.rows.map((r) => r._cluster);
    expect(new Set(clusterIds).size).toBe(2);
    expect(result._meta.linkage).toBe('average');
  });

  it('hierarchical clustering falls back to single cluster without numeric columns', () => {
    const ds = new Dataset(
      'NoNums',
      [{ name: 'label', type: ColumnType.TEXT }],
      [{ label: 'x' }, { label: 'y' }]
    );
    const result = hierarchical(ds, [], 'single', 2);
    expect(result.rows.every((r) => r._cluster === 0)).toBe(true);
  });

  it('dbscan separates dense groups and marks noise', () => {
    const ds = makeDataset([
      { id: 1, category: 'A', value: 1 },
      { id: 2, category: 'A', value: 2 },
      { id: 3, category: 'A', value: 100 },
      { id: 4, category: 'A', value: 101 },
      { id: 5, category: 'A', value: 500 },
    ]);
    const result = dbscan(ds, 5, 1, ['value']);
    expect(result.rowCount).toBe(5);
    expect(result.getColumn('_cluster')).toBeDefined();
    // Two tight groups and one noise point.
    const clusters = new Set(result.rows.map((r) => r._cluster));
    expect(clusters.size).toBeGreaterThanOrEqual(2);
    const noise = result.rows.filter((r) => r._cluster === -1);
    expect(noise.length).toBeGreaterThanOrEqual(1);
  });

  it('dbscan assigns all rows to one cluster when eps is large', () => {
    const ds = makeDataset([
      { id: 1, category: 'A', value: 1 },
      { id: 2, category: 'A', value: 2 },
      { id: 3, category: 'A', value: 100 },
    ]);
    const result = dbscan(ds, 200, 1, ['value']);
    expect(new Set(result.rows.map((r) => r._cluster)).size).toBe(1);
  });

  it('slices rows by index range', () => {
    const ds = makeDataset([
      { id: 1, category: 'A', value: 1 },
      { id: 2, category: 'A', value: 2 },
      { id: 3, category: 'A', value: 3 },
      { id: 4, category: 'A', value: 4 },
    ]);
    const result = slice(ds, 1, 3);
    expect(result.rowCount).toBe(2);
    expect(result.rows.map((r) => r.id)).toEqual([2, 3]);
  });

  it('anomaly IQR flags extreme values', () => {
    const ds = makeDataset([
      { id: 1, category: 'A', value: 1 },
      { id: 2, category: 'A', value: 2 },
      { id: 3, category: 'A', value: 3 },
      { id: 4, category: 'A', value: 4 },
      { id: 5, category: 'A', value: 5 },
      { id: 6, category: 'A', value: 1000 },
    ]);
    const result = anomaly(ds, 'value', 'iqr', 0.5);
    const outliers = result.rows.filter((r) => r._anomaly);
    expect(outliers.length).toBeGreaterThanOrEqual(1);
    expect(outliers[0].id).toBe(6);
    expect(result._meta.method).toBe('iqr');
  });

  it('anomaly zscore flags values far from the mean', () => {
    const ds = makeDataset([
      { id: 1, category: 'A', value: 1 },
      { id: 2, category: 'A', value: 2 },
      { id: 3, category: 'A', value: 3 },
      { id: 4, category: 'A', value: 4 },
      { id: 5, category: 'A', value: 5 },
      { id: 6, category: 'A', value: 1000 },
    ]);
    const result = anomaly(ds, 'value', 'zscore', 2);
    const outlier = result.rows.find((r) => r.id === 6);
    expect(outlier._anomaly).toBe(true);
  });

  it('anomaly isolation produces scores', () => {
    const ds = makeDataset([
      { id: 1, category: 'A', value: 1 },
      { id: 2, category: 'A', value: 2 },
      { id: 3, category: 'A', value: 3 },
      { id: 4, category: 'A', value: 4 },
      { id: 5, category: 'A', value: 5 },
      { id: 6, category: 'A', value: 1000 },
    ]);
    const result = anomaly(ds, 'value', 'isolation');
    const outlier = result.rows.find((r) => r.id === 6);
    // Isolation score is 0 for points that are easy to isolate; non-outliers score 1.
    expect(outlier._anomalyScore).toBeLessThanOrEqual(1);
    expect(result.rows.some((r) => r._anomalyScore > 0)).toBe(true);
  });

  it('anomaly falls back safely with no numeric columns', () => {
    const ds = new Dataset(
      'NoNums',
      [{ name: 'label', type: ColumnType.TEXT }],
      [{ label: 'x' }, { label: 'y' }]
    );
    const result = anomaly(ds);
    expect(result.rows.every((r) => r._anomaly === false)).toBe(true);
  });

  it('updateRows append and replace maintain sliding window', () => {
    const ds = makeDataset([{ id: 1, category: 'A', value: 1 }]);
    ds.updateRows([{ id: 2, category: 'A', value: 2 }], 'append', 2);
    expect(ds.rowCount).toBe(2);
    ds.updateRows([{ id: 3, category: 'A', value: 3 }], 'append', 2);
    expect(ds.rowCount).toBe(2);
    expect(ds.rows.map((r) => r.id)).toEqual([2, 3]);

    ds.updateRows([{ id: 99, category: 'A', value: 99 }], 'replace', 5);
    expect(ds.rowCount).toBe(1);
    expect(ds.rows[0].id).toBe(99);
  });
});
