// @ts-nocheck
// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import {
  applyNestedRings,
  applyDensityCloud,
  applyDendrogramArc,
  autoLayout,
} from '../src/vr/interactions/ClusterTransforms.ts';

function makeArtifact(rows) {
  const group = new THREE.Group();
  const nodeMeshes = rows.map((row, i) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    mesh.position.set(i * 0.1, 0, 0);
    mesh.userData.row = row;
    mesh.userData.baseScale = 1;
    group.add(mesh);
    return mesh;
  });
  return { group, nodeMeshes };
}

function makeClusteredDataset() {
  return new Dataset(
    'Clusters',
    [
      { name: 'value', type: ColumnType.NUMERIC },
      { name: '_cluster', type: ColumnType.NUMERIC },
    ],
    [
      { value: 1, _cluster: 0 },
      { value: 2, _cluster: 0 },
      { value: 10, _cluster: 1 },
      { value: 11, _cluster: 1 },
      { value: 100, _cluster: -1 },
    ]
  );
}

describe('ClusterTransforms', () => {
  let dataset;

  beforeEach(() => {
    dataset = makeClusteredDataset();
  });

  it('applyNestedRings moves members into ring positions around the centre', () => {
    const artifact = makeArtifact(dataset.rows);
    applyNestedRings(artifact, dataset);

    const cluster0 = dataset.rows
      .filter((r) => r._cluster === 0)
      .map((r) => artifact.nodeMeshes.find((m) => m.userData.row === r).position.clone());

    expect(cluster0.length).toBeGreaterThan(0);
    for (const pos of cluster0) {
      const dist = Math.sqrt(pos.x ** 2 + (pos.z - -3.5) ** 2);
      // Sorted cluster ids are [-1, 0, 1], so cluster 0 gets radius 2.5.
      expect(dist).toBeGreaterThanOrEqual(2.4);
      expect(dist).toBeLessThanOrEqual(2.6);
    }
  });

  it('applyDensityCloud sinks noise points below the plane', () => {
    const artifact = makeArtifact(dataset.rows);
    applyDensityCloud(artifact, dataset);

    const noise = dataset.rows.find((r) => r._cluster === -1);
    const noiseMesh = artifact.nodeMeshes.find((m) => m.userData.row === noise);
    expect(noiseMesh.position.y).toBeLessThan(-0.5);
    expect(noiseMesh.material.opacity).toBe(0.4);
  });

  it('applyDensityCloud colours non-noise clusters', () => {
    const artifact = makeArtifact(dataset.rows);
    applyDensityCloud(artifact, dataset);

    const cluster0Row = dataset.rows.find((r) => r._cluster === 0);
    const mesh = artifact.nodeMeshes.find((m) => m.userData.row === cluster0Row);
    expect(mesh.material.color.getHex()).not.toBe(0xffffff);
  });

  it('applyDendrogramArc places rows along an arc', () => {
    const artifact = makeArtifact(dataset.rows);
    applyDendrogramArc(artifact, dataset);

    const cluster0 = dataset.rows
      .filter((r) => r._cluster === 0)
      .map((r) => artifact.nodeMeshes.find((m) => m.userData.row === r).position.clone());

    expect(cluster0.length).toBe(2);
    for (const pos of cluster0) {
      expect(Math.abs(pos.x)).toBeGreaterThan(0);
    }
  });

  it('autoLayout dispatches to density cloud for dbscan', () => {
    const artifact = makeArtifact(dataset.rows);
    autoLayout(artifact, dataset, 'dbscan');

    const noise = dataset.rows.find((r) => r._cluster === -1);
    const noiseMesh = artifact.nodeMeshes.find((m) => m.userData.row === noise);
    expect(noiseMesh.position.y).toBeLessThan(-0.5);
  });

  it('autoLayout dispatches to dendrogram for hierarchical', () => {
    const artifact = makeArtifact(dataset.rows);
    autoLayout(artifact, dataset, 'hierarchical');

    const cluster0 = dataset.rows.find((r) => r._cluster === 0);
    const mesh = artifact.nodeMeshes.find((m) => m.userData.row === cluster0);
    expect(mesh.position.x).not.toBe(0);
  });

  it('autoLayout uses nested rings for unknown hints', () => {
    const artifact = makeArtifact(dataset.rows);
    autoLayout(artifact, dataset, 'kmeans');

    const cluster0 = dataset.rows.find((r) => r._cluster === 0);
    const mesh = artifact.nodeMeshes.find((m) => m.userData.row === cluster0);
    const dist = Math.sqrt(mesh.position.x ** 2 + (mesh.position.z - -3.5) ** 2);
    expect(dist).toBeGreaterThanOrEqual(2.4);
    expect(dist).toBeLessThanOrEqual(2.6);

    // Verify it is actually a ring layout, not density cloud.
    const noise = dataset.rows.find((r) => r._cluster === -1);
    const noiseMesh = artifact.nodeMeshes.find((m) => m.userData.row === noise);
    expect(noiseMesh.position.y).toBe(0);
  });

  it('skips rows that do not have a matching mesh', () => {
    const artifact = makeArtifact(dataset.rows.slice(0, 2));
    expect(() => applyNestedRings(artifact, dataset)).not.toThrow();
  });
});
