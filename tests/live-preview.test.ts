// @ts-nocheck
// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { LivePreview } from '../src/vr/interactions/LivePreview.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';

function makeMesh(row, x = 0, y = 0, z = -2) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2));
  mesh.name = String(row.name ?? 'node');
  mesh.position.set(x, y, z);
  mesh.userData.row = row;
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
    normalizedRows,
    undefined,
    normalizedRows.map((_, i) => `${name}:row:${i}`)
  );
}

/** Simulate renderer rows reconstructed separately from the analytical result. */
function makeArtifact(dataset) {
  const reconstructed = Dataset.fromJSON(dataset.toJSON());
  return {
    nodeMeshes: reconstructed.rows.map((row, i) => makeMesh(row, i, 0, -2)),
  };
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

  it('creates keep/remove markers for a filter preview across reconstructed rows', () => {
    const ds = makeDataset([
      { name: 'a', value: 10 },
      { name: 'b', value: 20 },
      { name: 'c', value: 30 },
    ]);
    const artifact = makeArtifact(ds);
    const filtered = new Dataset(
      ds.name,
      ds.columns,
      ds.rows.filter((r) => Number(r.value) > 10),
      undefined,
      ds.rowIds?.slice(1)
    );

    preview.preview('filter', filtered, ds, artifact);

    expect(preview._markers.length).toBe(3);
    expect(scene.children.filter((c) => c instanceof THREE.Sprite)).toHaveLength(3);
  });

  it('creates rank markers for a sort preview across reconstructed rows', () => {
    const ds = makeDataset([
      { name: 'a', value: 30 },
      { name: 'b', value: 10 },
      { name: 'c', value: 20 },
    ]);
    const artifact = makeArtifact(ds);
    const order = [1, 2, 0];
    const sorted = new Dataset(
      ds.name,
      ds.columns,
      order.map((i) => ({ ...ds.rows[i] })),
      undefined,
      order.map((i) => ds.rowIds[i])
    );

    preview.preview('sort', sorted, ds, artifact);

    expect(scene.children.filter((c) => c instanceof THREE.Sprite)).toHaveLength(3);
  });

  it('creates the anomaly marker for the correct reconstructed observation', () => {
    const ds = makeDataset([
      { name: 'a', value: 1 },
      { name: 'b', value: 2 },
      { name: 'c', value: 3 },
      { name: 'd', value: 10000 },
    ]);
    const artifact = makeArtifact(ds);
    const anomalous = new Dataset(
      ds.name,
      [...ds.columns, { name: '_anomaly', type: ColumnType.BOOLEAN }],
      ds.rows.map((r) => ({ ...r, _anomaly: r.value > 1000 })),
      undefined,
      ds.rowIds
    );

    preview.preview('anomaly', anomalous, ds, artifact);

    expect(scene.children.filter((c) => c instanceof THREE.Sprite)).toHaveLength(1);
    expect(preview._markers[0].anchorMesh.userData.row.name).toBe('d');
  });

  it('distinguishes equal-valued duplicate observations by durable ID', () => {
    const ds = makeDataset([
      { name: 'same', value: 42 },
      { name: 'same', value: 42 },
    ], 'duplicates');
    const artifact = makeArtifact(ds);
    const filtered = new Dataset(
      ds.name,
      ds.columns,
      [{ ...ds.rows[1] }],
      undefined,
      [ds.rowIds[1]]
    );

    preview.preview('filter', filtered, ds, artifact);

    const markerKinds = preview._markers.map((marker) => marker.mesh.material);
    expect(markerKinds).toHaveLength(2);
    expect(preview._markers[0].anchorMesh.userData.row).not.toBe(preview._markers[1].anchorMesh.userData.row);
  });

  it('clears all markers and removes sprites from the scene', () => {
    const ds = makeDataset([{ name: 'a', value: 10 }]);
    const artifact = makeArtifact(ds);
    const filtered = Dataset.fromJSON(ds.toJSON());

    preview.preview('filter', filtered, ds, artifact);
    expect(scene.children.filter((c) => c instanceof THREE.Sprite)).toHaveLength(1);

    preview.clear();
    expect(scene.children.filter((c) => c instanceof THREE.Sprite)).toHaveLength(0);
    expect(preview._markers).toHaveLength(0);
  });

  it('updates marker positions to follow their anchor meshes', () => {
    const ds = makeDataset([{ name: 'a', value: 10 }]);
    const artifact = makeArtifact(ds);
    const mesh = artifact.nodeMeshes[0];
    mesh.position.y = 1;
    const filtered = Dataset.fromJSON(ds.toJSON());

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
    const ds = makeDataset([{ name: 'a', value: 10 }]);
    const artifact = makeArtifact(ds);
    preview.preview('filter', Dataset.fromJSON(ds.toJSON()), ds, artifact);
    expect(preview._markers).toHaveLength(0);
  });
});
