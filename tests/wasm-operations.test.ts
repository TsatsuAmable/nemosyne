import { describe, it, expect } from 'vitest';
import { cluster, anomaly, hierarchical, dbscan } from '../src/data/DatasetOperations.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';

describe('Phase 2 & 3 Data Operations (k-means, anomaly, hierarchical & dbscan)', () => {
  it('clusters numeric dataset rows into k groups with _cluster column', () => {
    const ds = new Dataset(
      'test-cluster',
      [
        { name: 'x', type: ColumnType.NUMERIC },
        { name: 'y', type: ColumnType.NUMERIC },
      ],
      [
        { x: 1, y: 1 },
        { x: 1.2, y: 1.1 },
        { x: 10, y: 10 },
        { x: 10.2, y: 10.1 },
      ]
    );

    const clustered = cluster(ds, 2);
    expect(clustered.rows).toHaveLength(4);
    expect(clustered.columns.some((c) => c.name === '_cluster')).toBe(true);

    const cluster0 = clustered.rows[0]._cluster;
    const cluster1 = clustered.rows[1]._cluster;
    const cluster2 = clustered.rows[2]._cluster;

    expect(cluster0).toEqual(cluster1);
    expect(cluster2).not.toEqual(cluster0);
  });

  it('detects outlier anomalies using IQR score and highlights anomalies', () => {
    const ds = new Dataset(
      'test-anomaly',
      [{ name: 'val', type: ColumnType.NUMERIC }],
      [
        { val: 10 },
        { val: 11 },
        { val: 12 },
        { val: 11 },
        { val: 10 },
        { val: 100 }, // Outlier
      ]
    );

    const detected = anomaly(ds, 'val', 'iqr', 1.5);
    expect(detected.columns.some((c) => c.name === '_anomaly')).toBe(true);
    expect(detected.columns.some((c) => c.name === '_anomalyScore')).toBe(true);

    const outlierRow = detected.rows.find((r) => r.val === 100);
    expect(outlierRow?._anomaly).toBe(true);
    expect(outlierRow?._anomalyScore as number).toBeGreaterThan(0);
  });

  it('clusters rows hierarchically using average linkage dendrogram split', () => {
    const ds = new Dataset(
      'test-hierarchical',
      [
        { name: 'v1', type: ColumnType.NUMERIC },
        { name: 'v2', type: ColumnType.NUMERIC },
      ],
      [
        { v1: 0, v2: 0 },
        { v1: 0.1, v2: 0.1 },
        { v1: 50, v2: 50 },
        { v1: 50.1, v2: 50.1 },
      ]
    );

    const result = hierarchical(ds, null, 'average', 2);
    expect(result.rows).toHaveLength(4);
    expect(result.columns.some((c) => c.name === '_cluster')).toBe(true);

    const c0 = result.rows[0]._cluster;
    const c1 = result.rows[1]._cluster;
    const c2 = result.rows[2]._cluster;

    expect(c0).toEqual(c1);
    expect(c2).not.toEqual(c0);
  });

  it('clusters density regions using DBSCAN with noise detection (-1)', () => {
    const ds = new Dataset(
      'test-dbscan',
      [
        { name: 'a', type: ColumnType.NUMERIC },
        { name: 'b', type: ColumnType.NUMERIC },
      ],
      [
        { a: 1, b: 1 },
        { a: 1.1, b: 1.05 },
        { a: 1.05, b: 1.1 },
        { a: 500, b: 500 }, // Isolated noise point
      ]
    );

    const result = dbscan(ds, 2.0, 2);
    expect(result.rows).toHaveLength(4);
    expect(result.columns.some((c) => c.name === '_cluster')).toBe(true);

    const clusterDense0 = result.rows[0]._cluster;
    const clusterDense1 = result.rows[1]._cluster;
    const clusterNoise = result.rows[3]._cluster;

    expect(clusterDense0).toEqual(clusterDense1);
    expect(clusterNoise).toBe(-1);
  });
});
