import { describe, it, expect } from 'vitest';
import { cluster, anomaly } from '../src/data/DatasetOperations.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';

describe('Phase 2 Data Operations (k-means & anomaly detection)', () => {
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
});
