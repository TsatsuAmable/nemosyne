// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { MiniOverview } from '../src/vr/ui/MiniOverview.js';

function makeMesh(name = 'node', x = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2));
  mesh.name = name;
  mesh.position.set(x, 0, z);
  mesh.updateMatrixWorld();
  return mesh;
}

function makeCamera(x = 0, z = 0) {
  const cam = new THREE.PerspectiveCamera();
  cam.position.set(x, 1.6, z);
  cam.lookAt(x, 1.6, z - 1);
  cam.updateMatrixWorld();
  return cam;
}

describe('MiniOverview', () => {
  let cameraGroup;
  let overview;

  beforeEach(() => {
    cameraGroup = new THREE.Group();
  });

  afterEach(() => {
    if (overview?.mesh) {
      overview.mesh.material.map?.dispose?.();
      overview.mesh.material.dispose?.();
      overview.mesh.geometry.dispose?.();
    }
  });

  it('creates a canvas-texture mesh attached to the follow anchor', () => {
    overview = new MiniOverview(cameraGroup, {
      getNodeMeshes: () => [],
      getCamera: () => makeCamera(),
    });

    expect(overview.mesh).toBeTruthy();
    expect(overview.mesh.material.map).toBeInstanceOf(THREE.CanvasTexture);
    expect(overview.mesh.parent).toBe(cameraGroup);
  });

  it('draws nodes from the provided getter', () => {
    const nodes = [makeMesh('a', -2, -2), makeMesh('b', 2, -2), makeMesh('c', 0, -4)];
    overview = new MiniOverview(cameraGroup, {
      getNodeMeshes: () => nodes,
      getCamera: () => makeCamera(0, 0),
    });

    overview.update();

    // Bounds should be centered near the palace and include all nodes + camera.
    const center = overview._bounds.getCenter(new THREE.Vector2());
    expect(center.x).toBeCloseTo(0, 0);
    expect(center.y).toBeCloseTo(-2, 0);
    expect(overview._bounds.isEmpty()).toBe(false);
  });

  it('includes the camera position when computing bounds', () => {
    const farCamera = makeCamera(10, 10);
    overview = new MiniOverview(cameraGroup, {
      getNodeMeshes: () => [],
      getCamera: () => farCamera,
    });

    overview.update();

    const center = overview._bounds.getCenter(new THREE.Vector2());
    expect(center.x).toBeCloseTo(10, 0);
    expect(center.y).toBeCloseTo(10, 0);
  });

  it('toggles visibility with setEnabled', () => {
    overview = new MiniOverview(cameraGroup, {
      getNodeMeshes: () => [],
      getCamera: () => makeCamera(),
    });

    expect(overview.mesh.visible).toBe(true);
    overview.setEnabled(false);
    expect(overview.mesh.visible).toBe(false);
    overview.setEnabled(true);
    expect(overview.mesh.visible).toBe(true);
  });

  it('does not update when hidden', () => {
    let calls = 0;
    overview = new MiniOverview(cameraGroup, {
      getNodeMeshes: () => {
        calls++;
        return [];
      },
      getCamera: () => makeCamera(),
    });

    overview.setEnabled(false);
    overview.update();
    expect(calls).toBe(0);
  });

  it('has a title for panel integration', () => {
    overview = new MiniOverview(cameraGroup, {
      title: 'Mini Map',
      getNodeMeshes: () => [],
      getCamera: () => makeCamera(),
    });
    expect(overview.title).toBe('Mini Map');
  });
});
