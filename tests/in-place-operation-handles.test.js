// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { InPlaceOperationHandles } from '../src/vr/interactions/InPlaceOperationHandles.ts';
import { Dataset } from '../src/data/Dataset.ts';

function makeMesh(name = 'node', x = 0, y = 0, z = -2) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2));
  mesh.name = name;
  mesh.position.set(x, y, z);
  return mesh;
}

function makeFakeRouter() {
  return {
    interactables: [],
    addInteractable: vi.fn(function (mesh, handlers) {
      this.interactables.push({ mesh, ...handlers });
    }),
    removeInteractable: vi.fn(function (mesh) {
      this.interactables = this.interactables.filter((i) => i.mesh !== mesh);
    }),
  };
}

describe('InPlaceOperationHandles', () => {
  let scene;
  let camera;
  let handles;
  let onOperation;

  beforeEach(() => {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 1.6, 0);
    onOperation = vi.fn();
    handles = new InPlaceOperationHandles(scene, camera, { onOperation });
  });

  afterEach(() => {
    handles.clear();
  });

  it('creates filter and sort handles for TABULAR topology', () => {
    const group = new THREE.Group();
    const m1 = makeMesh('a');
    const m2 = makeMesh('b');
    group.add(m1, m2);
    scene.add(group);

    handles.build({
      dataInput: { topology: 'TABULAR' },
      artifact: { nodeMeshes: [m1, m2] },
    });

    expect(handles._handles.length).toBe(2);
    expect(handles._handles.map((h) => h.operation)).toContain('filter');
    expect(handles._handles.map((h) => h.operation)).toContain('sort');
    expect(scene.children.filter((c) => c instanceof THREE.Sprite).length).toBe(2);
  });

  it('creates a timeSlice handle for TIME_SERIES topology', () => {
    const group = new THREE.Group();
    const meshes = [makeMesh('t0'), makeMesh('t1'), makeMesh('t2')];
    group.add(...meshes);
    scene.add(group);

    handles.build({
      dataInput: { topology: 'TIME_SERIES' },
      artifact: { nodeMeshes: meshes },
    });

    expect(handles._handles.length).toBe(1);
    expect(handles._handles[0].operation).toBe('timeSlice');
  });

  it('creates no handles for unsupported topologies', () => {
    handles.build({
      dataInput: { topology: 'GRAPH' },
      artifact: { nodeMeshes: [makeMesh('g')] },
    });
    expect(handles._handles.length).toBe(0);
  });

  it('positions handles above their anchor mesh', () => {
    const m = makeMesh('a', 0, 1.2, -3);
    const group = new THREE.Group();
    group.add(m);
    scene.add(group);
    group.updateMatrixWorld(true);

    handles.build({
      dataInput: { topology: 'TABULAR' },
      artifact: { nodeMeshes: [m] },
    });

    const handle = handles._handles[0];
    handles.update(0.016, 0, null);
    expect(handle.sprite.position.y).toBeGreaterThan(m.position.y);
  });

  it('fades in when pointer ray hits the handle', () => {
    const m = makeMesh('a', 0, 1.2, -1);
    const group = new THREE.Group();
    group.add(m);
    scene.add(group);
    group.updateMatrixWorld(true);

    handles.build({
      dataInput: { topology: 'TABULAR' },
      artifact: { nodeMeshes: [m] },
    });

    // Update once to settle position.
    handles.update(0.016, 0, null);
    const handle = handles._handles[0];

    // Ray aimed straight at the handle (anchor y + 0.55 base offset).
    const ray = new THREE.Ray(
      new THREE.Vector3(0, 1.6, 0),
      new THREE.Vector3(0, 0.15, -1).normalize()
    );
    handles.update(0.5, 0, ray);

    expect(handle.sprite.material.opacity).toBeGreaterThan(0.5);
    expect(handle.sprite.visible).toBe(true);
  });

  it('registers interactables with the router', () => {
    const router = makeFakeRouter();
    const m = makeMesh('a');
    const group = new THREE.Group();
    group.add(m);
    scene.add(group);

    handles.build({
      dataInput: { topology: 'TABULAR' },
      artifact: { nodeMeshes: [m] },
    });
    handles.registerInteractables(router);

    expect(router.addInteractable).toHaveBeenCalledTimes(2);
    expect(router.interactables.length).toBe(2);

    // Simulate selecting the filter handle.
    const filterEntry = router.interactables.find(
      (i) => i.mesh === handles._handles.find((h) => h.operation === 'filter').sprite
    );
    filterEntry.onSelect();
    expect(onOperation).toHaveBeenCalledWith('filter');
  });

  it('hides handles in expert mode', () => {
    const m = makeMesh('a');
    const group = new THREE.Group();
    group.add(m);
    scene.add(group);

    handles.build({
      dataInput: { topology: 'TABULAR' },
      artifact: { nodeMeshes: [m] },
    });

    handles.setUserMode('expert');
    handles.update(1, 0, null);

    expect(handles._handles[0].sprite.material.opacity).toBe(0);
    expect(handles._handles[0].sprite.visible).toBe(false);
  });

  it('clears previous handles when rebuilding', () => {
    const m1 = makeMesh('a');
    const m2 = makeMesh('b');
    const g = new THREE.Group();
    g.add(m1, m2);
    scene.add(g);

    handles.build({ dataInput: { topology: 'TABULAR' }, artifact: { nodeMeshes: [m1, m2] } });
    const firstSprites = handles._handles.map((h) => h.sprite);

    handles.build({ dataInput: { topology: 'TIME_SERIES' }, artifact: { nodeMeshes: [m1, m2] } });

    expect(handles._handles.length).toBe(1);
    for (const s of firstSprites) {
      expect(scene.children).not.toContain(s);
    }
  });
});
