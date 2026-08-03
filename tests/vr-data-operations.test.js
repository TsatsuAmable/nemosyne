import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { ConstraintEngine, TopologyTypes } from '../src/draco/ConstraintEngine.js';
import { VRTopologyTranslator } from '../src/draco/VRTopologyTranslator.js';
import { Dataset, ColumnType } from '../src/data/Dataset.js';
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
} from '../src/vr/interactions/DataOperations.js';
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
    const filtered = filter(dataset, (r) => r.value > 15);
    applyFilter(artifact, filtered);

    const kept = artifact.nodeMeshes.filter((m) => m.scale.x > 0.1);
    expect(kept.length).toBe(3); // 20, 30, 40
    const hidden = artifact.nodeMeshes.filter((m) => m.scale.x <= 0.1);
    expect(hidden.length).toBe(1); // 10
  });

  it('sort reorders nodes along an arc', () => {
    const sorted = sort(dataset, 'value', 'asc');
    applySort(artifact, sorted);

    // First node (value=10) should be at the leftmost x.
    const positions = artifact.nodeMeshes.map((m) => m.position.x);
    const minX = Math.min(...positions);
    const minMesh = artifact.nodeMeshes.find((m) => m.position.x === minX);
    expect(minMesh.userData.row.value).toBe(10);
  });

  it('aggregate hides original nodes and scales a representative', () => {
    const aggregated = aggregate(dataset, 'category', (group) => ({
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
    const clustered = cluster(dataset, 2);
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
    const clustered = hierarchical(dataset, ['value'], 'average', 2);
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

    const clustered = dbscan(ds, 10, 1, ['value']);
    applyDensityCluster(localArtifact, clustered);

    const noiseMesh = localArtifact.nodeMeshes.find((m) => m.userData.row._cluster === -1);
    expect(noiseMesh).toBeTruthy();
    expect(noiseMesh.position.y).toBeLessThan(-0.3);
  });

  it('slice dims rows outside the slice', () => {
    const sliced = slice(dataset, 2, 4);
    applySlice(artifact, sliced, dataset);

    const inside = artifact.nodeMeshes.filter((m) => sliced.rows.includes(m.userData.row));
    const outside = artifact.nodeMeshes.filter((m) => !sliced.rows.includes(m.userData.row));
    expect(inside.every((m) => m.scale.x >= 0.5)).toBe(true);
    expect(outside.every((m) => m.scale.x <= 0.3)).toBe(true);
  });

  it('reset restores base scale and opacity', () => {
    const filtered = filter(dataset, () => false);
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

    const anomalous = anomaly(ds, 'value', 'zscore', 1);
    applyAnomaly(localArtifact, anomalous);

    const outlierMesh = localArtifact.nodeMeshes.find((m) => m.userData.row.id === 4);
    expect(outlierMesh.userData.halo).toBeTruthy();
    expect(outlierMesh.position.y).toBeGreaterThan(0.3);
    expect(outlierMesh.userData.halo.visible).toBe(true);

    clearAnomaly(localArtifact);
    expect(outlierMesh.userData.halo.visible).toBe(false);
  });
});
