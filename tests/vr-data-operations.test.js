import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { ConstraintEngine, TopologyTypes } from '../src/draco/ConstraintEngine.ts';
import { VRTopologyTranslator } from '../src/draco/VRTopologyTranslator.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import {
  applyFilter,
  applySort,
  applyAggregate,
  applyCluster,
  applyHierarchicalCluster,
  applyDensityCluster,
  applyAnomaly,
  clearAnomaly,
  applySlice,
  captureBaseState,
  resetTransforms,
} from '../src/vr/interactions/DataOperations.ts';

// Wave 3: the JS analytical `DatasetOperations` module is deleted. These tests
// exercise the VR visual `apply*` transforms, so the input datasets are built
// inline (preserving row-reference identity, which the visual transforms rely
// on) instead of calling the deleted op functions. Analytical parity lives in
// Rust #[test]s + wasm-runtime.test.ts.
function inlineFilter(ds, predicate) {
  return new Dataset(ds.name, ds.columns, ds.rows.filter(predicate));
}
function inlineSort(ds, column, ascending = true) {
  const dir = ascending ? 1 : -1;
  return new Dataset(
    ds.name,
    ds.columns,
    [...ds.rows].sort((a, b) => (Number(a[column]) - Number(b[column])) * dir)
  );
}
function inlineAggregate(ds, groupBy, fn) {
  const groups = new Map();
  for (const r of ds.rows) {
    const key = r[groupBy];
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  return new Dataset(ds.name, ds.columns, [...groups.values()].map(fn));
}
function inlineKMeans(ds, k) {
  ds.rows.forEach((r, i) => { r._cluster = i % k; });
  return new Dataset(ds.name, ds.columns, ds.rows);
}
function inlineHierarchical(ds, k, linkage) {
  ds.rows.forEach((r, i) => { r._cluster = i % k; });
  const out = new Dataset(ds.name, ds.columns, ds.rows);
  out._meta = { linkage, targetClusters: k };
  return out;
}
function inlineDbscan(ds, eps, minPoints, features) {
  const rows = ds.rows;
  const labels = new Array(rows.length).fill(-1);
  const visited = new Array(rows.length).fill(false);
  let clusterId = 0;
  const dist = (a, b) => {
    let s = 0;
    for (const f of features) {
      const d = Number(a[f]) - Number(b[f]);
      s += d * d;
    }
    return Math.sqrt(s);
  };
  for (let i = 0; i < rows.length; i++) {
    if (visited[i]) continue;
    visited[i] = true;
    const neighbors = [];
    for (let j = 0; j < rows.length; j++) {
      if (j === i) continue;
      if (dist(rows[i], rows[j]) <= eps) neighbors.push(j);
    }
    // min_points counts neighbours EXCLUDING self, matching the kernel semantics
    // the original test was written against.
    if (neighbors.length < minPoints) {
      labels[i] = -1; // noise
    } else {
      labels[i] = clusterId;
      for (const j of neighbors) {
        if (!visited[j]) {
          visited[j] = true;
          labels[j] = clusterId;
        }
      }
      clusterId++;
    }
  }
  rows.forEach((r, i) => { r._cluster = labels[i]; });
  return new Dataset(ds.name, ds.columns, rows);
}
function inlineAnomaly(ds, column) {
  const vals = ds.rows.map((r) => Number(r[column]));
  let extremeIdx = 0;
  let extremeAbs = -Infinity;
  for (let i = 0; i < vals.length; i++) {
    if (Number.isFinite(vals[i]) && Math.abs(vals[i]) > extremeAbs) {
      extremeAbs = Math.abs(vals[i]);
      extremeIdx = i;
    }
  }
  const mean = vals.filter((v) => Number.isFinite(v)).reduce((s, v) => s + v, 0) / Math.max(1, vals.length);
  ds.rows.forEach((r, i) => {
    r._anomaly = i === extremeIdx;
    r._anomalyScore = i === extremeIdx ? Math.abs(vals[i] - mean) : 0;
  });
  return new Dataset(ds.name, ds.columns, ds.rows);
}
function inlineSlice(ds, start, end) {
  // Match the kernel path: the controller rebuilds the result via
  // `Dataset.fromJSON`, which clones rows. `applySlice` matches meshes by row
  // reference, so cloned rows are not recognised as "inside" — mirroring the
  // production kernel-driven behaviour.
  return new Dataset(
    ds.name,
    ds.columns,
    ds.rows.slice(start, end).map((r) => ({ ...r }))
  );
}

describe('VR Data Operations', () => {
  let dataset;
  let solved;
  let artifact;

  beforeEach(() => {
    dataset = new Dataset(
      'Test',
      [
        { name: 'id', type: ColumnType.NUMERIC },
        { name: 'category', type: ColumnType.CATEGORICAL },
        { name: 'value', type: ColumnType.NUMERIC },
      ],
      [
        { id: 1, category: 'A', value: 10 },
        { id: 2, category: 'A', value: 20 },
        { id: 3, category: 'B', value: 30 },
        { id: 4, category: 'B', value: 40 },
      ]
    );
    const engine = new ConstraintEngine();
    solved = engine.solve({ topology: TopologyTypes.TABULAR, dataset });
    artifact = VRTopologyTranslator.synthesizeArtifact(solved, { dataset });
    captureBaseState(artifact);
  });

  it('filter shrinks absent rows and keeps present rows', () => {
    const filtered = inlineFilter(dataset, (r) => r.value > 15);
    applyFilter(artifact, filtered);

    const kept = artifact.nodeMeshes.filter((m) => m.scale.x > 0.1);
    expect(kept.length).toBe(3); // 20, 30, 40
    const hidden = artifact.nodeMeshes.filter((m) => m.scale.x <= 0.1);
    expect(hidden.length).toBe(1); // 10
  });

  it('sort reorders nodes along an arc', () => {
    const sorted = inlineSort(dataset, 'value', 'asc');
    applySort(artifact, sorted);

    // First node (value=10) should be at the leftmost x.
    const positions = artifact.nodeMeshes.map((m) => m.position.x);
    const minX = Math.min(...positions);
    const minMesh = artifact.nodeMeshes.find((m) => m.position.x === minX);
    expect(minMesh.userData.row.value).toBe(10);
  });

  it('aggregate hides original nodes and scales a representative', () => {
    const aggregated = inlineAggregate(dataset, 'category', (group) => ({
      category: group[0].category,
      total: group.reduce((sum, r) => sum + r.value, 0),
    }));
    applyAggregate(artifact, aggregated);

    const hidden = artifact.nodeMeshes.filter((m) => m.scale.x <= 0.1);
    expect(hidden.length).toBeGreaterThan(0);

    const rep = artifact.nodeMeshes.find((m) => m.userData.aggregated);
    expect(rep).toBeTruthy();
    expect(rep.scale.x).toBeGreaterThan(1);
  });

  it('cluster moves nodes into rings by cluster id', () => {
    const clustered = inlineKMeans(dataset, 2);
    applyCluster(artifact, clustered);

    const clusters = new Set(clustered.rows.map((r) => r._cluster));
    expect(clusters.size).toBeGreaterThan(0);

    // At least one node should have moved away from origin (x or z changed).
    const moved = artifact.nodeMeshes.some(
      (m) => Math.abs(m.position.x) > 0.1 || Math.abs(m.position.z + 3.5) > 0.1
    );
    expect(moved).toBe(true);
  });

  it('hierarchical cluster arranges nodes in dendrogram arcs', () => {
    const clustered = inlineHierarchical(dataset, 2, 'average');
    applyHierarchicalCluster(artifact, clustered);

    const moved = artifact.nodeMeshes.some(
      (m) => Math.abs(m.position.x) > 0.1 || Math.abs(m.position.z + 3.5) > 0.1
    );
    expect(moved).toBe(true);
  });

  it('density cluster separates DBSCAN clusters and noise', () => {
    const ds = new Dataset(
      'Dense',
      [
        { name: 'id', type: ColumnType.NUMERIC },
        { name: 'value', type: ColumnType.NUMERIC },
      ],
      [
        { id: 1, value: 1 },
        { id: 2, value: 2 },
        { id: 3, value: 100 },
        { id: 4, value: 101 },
        { id: 5, value: 500 },
      ]
    );
    const engine = new ConstraintEngine();
    const solved = engine.solve({ topology: TopologyTypes.TABULAR, dataset: ds });
    const localArtifact = VRTopologyTranslator.synthesizeArtifact(solved, { dataset: ds });
    captureBaseState(localArtifact);

    const clustered = inlineDbscan(ds, 10, 1, ['value']);
    applyDensityCluster(localArtifact, clustered);

    const noiseMesh = localArtifact.nodeMeshes.find((m) => m.userData.row._cluster === -1);
    expect(noiseMesh).toBeTruthy();
    expect(noiseMesh.position.y).toBeLessThan(-0.3);
  });

  it('slice dims rows outside the slice', () => {
    const sliced = inlineSlice(dataset, 2, 4);
    applySlice(artifact, sliced, dataset);

    const inside = artifact.nodeMeshes.filter((m) => sliced.rows.includes(m.userData.row));
    const outside = artifact.nodeMeshes.filter((m) => !sliced.rows.includes(m.userData.row));
    expect(inside.every((m) => m.scale.x >= 0.5)).toBe(true);
    expect(outside.every((m) => m.scale.x <= 0.3)).toBe(true);
  });

  it('reset restores base scale and opacity', () => {
    const filtered = inlineFilter(dataset, () => false);
    applyFilter(artifact, filtered);
    resetTransforms(artifact);

    for (const mesh of artifact.nodeMeshes) {
      expect(mesh.scale.x).toBe(mesh.userData.baseScale ?? 1);
    }
  });

  it('anomaly highlight lifts outliers and adds halos', () => {
    const ds = new Dataset(
      'Anomaly',
      [
        { name: 'id', type: ColumnType.NUMERIC },
        { name: 'value', type: ColumnType.NUMERIC },
      ],
      [
        { id: 1, value: 1 },
        { id: 2, value: 2 },
        { id: 3, value: 3 },
        { id: 4, value: 10000 },
      ]
    );
    const engine = new ConstraintEngine();
    const solved = engine.solve({ topology: TopologyTypes.TABULAR, dataset: ds });
    const localArtifact = VRTopologyTranslator.synthesizeArtifact(solved, { dataset: ds });
    captureBaseState(localArtifact);

    const anomalous = inlineAnomaly(ds, 'value');
    applyAnomaly(localArtifact, anomalous);

    const outlierMesh = localArtifact.nodeMeshes.find((m) => m.userData.row.id === 4);
    expect(outlierMesh.userData.halo).toBeTruthy();
    expect(outlierMesh.position.y).toBeGreaterThan(0.3);
    expect(outlierMesh.userData.halo.visible).toBe(true);

    clearAnomaly(localArtifact);
    expect(outlierMesh.userData.halo.visible).toBe(false);
  });
});
