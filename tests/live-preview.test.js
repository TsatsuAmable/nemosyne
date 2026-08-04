// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { LivePreview } from '../src/vr/interactions/LivePreview.js';
import { computeOperationDataset } from '../src/vr/interactions/DataOperations.js';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';

function makeMesh(name = 'node', value = 0, x = 0, y = 0, z = -2) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2));
  mesh.name = name;
  mesh.position.set(x, y, z);
  mesh.userData.row = { name, value };
  return mesh;
}

function makeDataset(rows, name = 'test') {
  const normalizedRows = rows.map((r, i) => ({
    name: r.name ?? `row-${i}`,
    value: r.value ?? 0,
  }));
  return new Dataset(
    name,
    [
      { name: 'name', type: ColumnType.CATEGORICAL },
      { name: 'value', type: ColumnType.NUMERIC },
    ],
    normalizedRows
  );
}

function makeArtifactMeshes(rows) {
  return rows.map((r, i) => makeMesh(r.name, r.value, i, 0, -2));
}

describe('LivePreview', () => {
  let scene;
  let camera;
  let preview;

  beforeEach(() => {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 1.6, 0);
    preview = new LivePreview(scene, camera);
  });

  afterEach(() => {
    preview.clear();
  });

  it('creates keep/remove markers for a filter preview', () => {
    const rows = [
      { name: 'a', value: 10 },
      { name: 'b', value: 20 },
      { name: 'c', value: 30 },
    ];
    const ds = makeDataset(rows);
    const artifact = { nodeMeshes: makeArtifactMeshes(ds.rows) };
    const filtered = computeOperationDataset('filter', ds, ds);

    preview.preview('filter', filtered, ds, artifact);

    expect(preview._markers.length).toBe(artifact.nodeMeshes.length);
    const sprites = scene.children.filter((c) => c instanceof THREE.Sprite);
    expect(sprites.length).toBe(3);
  });

  it('creates rank markers for a sort preview', () => {
    const rows = [
      { name: 'a', value: 30 },
      { name: 'b', value: 10 },
      { name: 'c', value: 20 },
    ];
    const ds = makeDataset(rows);
    const artifact = { nodeMeshes: makeArtifactMeshes(ds.rows) };
    const sorted = computeOperationDataset('sort', ds, ds);

    preview.preview('sort', sorted, ds, artifact);

    const sprites = scene.children.filter((c) => c instanceof THREE.Sprite);
    expect(sprites.length).toBe(3);
  });

  it('creates outlier markers for an anomaly preview', () => {
    const rows = [
      { name: 'a', value: 1 },
      { name: 'b', value: 2 },
      { name: 'c', value: 3 },
      { name: 'd', value: 4 },
      { name: 'e', value: 5 },
      { name: 'f', value: 10000 },
    ];
    const ds = makeDataset(rows);
    const artifact = { nodeMeshes: makeArtifactMeshes(ds.rows) };
    const anomalous = computeOperationDataset('anomaly', ds, ds);

    preview.preview('anomaly', anomalous, ds, artifact);

    const sprites = scene.children.filter((c) => c instanceof THREE.Sprite);
    expect(sprites.length).toBeGreaterThan(0);
  });

  it('clears all markers and removes sprites from the scene', () => {
    const rows = [{ name: 'a', value: 10 }];
    const ds = makeDataset(rows);
    const artifact = { nodeMeshes: makeArtifactMeshes(ds.rows) };
    const filtered = computeOperationDataset('filter', ds, ds);

    preview.preview('filter', filtered, ds, artifact);
    expect(scene.children.filter((c) => c instanceof THREE.Sprite).length).toBe(1);

    preview.clear();
    expect(scene.children.filter((c) => c instanceof THREE.Sprite).length).toBe(0);
    expect(preview._markers.length).toBe(0);
  });

  it('updates marker positions to follow their anchor meshes', () => {
    const ds = makeDataset([{ name: 'a', value: 10 }]);
    const mesh = makeMesh('a', 10, 0, 1, -2);
    mesh.userData.row = ds.rows[0];
    const artifact = { nodeMeshes: [mesh] };
    const filtered = computeOperationDataset('filter', ds, ds);

    preview.preview('filter', filtered, ds, artifact);
    const marker = preview._markers[0];
    const beforeY = marker.mesh.position.y;

    mesh.position.y += 0.5;
    mesh.updateMatrixWorld();
    preview.update();

    expect(marker.mesh.position.y).toBeGreaterThan(beforeY);
  });

  it('does nothing when disabled', () => {
    preview.setEnabled(false);
    const rows = [{ name: 'a', value: 10 }];
    const ds = makeDataset(rows);
    const artifact = { nodeMeshes: makeArtifactMeshes(ds.rows) };
    const filtered = computeOperationDataset('filter', ds, ds);

    preview.preview('filter', filtered, ds, artifact);
    expect(preview._markers.length).toBe(0);
  });

  it('returns the original dataset for unknown operations', () => {
    const rows = [{ name: 'a', value: 10 }];
    const ds = makeDataset(rows);
    expect(computeOperationDataset('unknown', ds, ds).rowCount).toBe(ds.rowCount);
  });
});
