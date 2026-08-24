import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { InteractableRegistry } from '../src/vr/input/InteractableRegistry.ts';
import { BVHSpatialAccelerator } from '../src/vr/scalability/BVHSpatialAccelerator.ts';

describe('InteractableRegistry spatial acceleration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds geometry BVHs only at the measured primitive crossover', () => {
    const registry = new InteractableRegistry();
    const small = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    const large = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1, 8, 8),
      new THREE.MeshBasicMaterial()
    );

    registry.addInteractable(small);
    registry.addInteractable(large);

    expect(small.geometry.boundsTree).toBeUndefined();
    expect(large.geometry.boundsTree).toBeDefined();

    registry.clear();
    expect(large.geometry.boundsTree == null).toBe(true);
  });

  it('retains a shared geometry tree until its final interactable is removed', () => {
    const registry = new InteractableRegistry();
    const geometry = new THREE.PlaneGeometry(1, 1, 8, 8);
    const first = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    const second = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());

    registry.addInteractable(first);
    registry.addInteractable(second);
    registry.removeInteractable(first);
    expect(geometry.boundsTree).toBeDefined();

    registry.removeInteractable(second);
    expect(geometry.boundsTree == null).toBe(true);
  });

  it('does not dispose a geometry tree owned by another subsystem', () => {
    const registry = new InteractableRegistry();
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 8, 8), new THREE.MeshBasicMaterial());
    BVHSpatialAccelerator.buildTree(mesh);

    registry.addInteractable(mesh);
    registry.removeInteractable(mesh);
    expect(mesh.geometry.boundsTree).toBeDefined();

    BVHSpatialAccelerator.disposeTree(mesh);
  });

  it('accelerates the registered-object path and rebuilds after invalidation', () => {
    const registry = new InteractableRegistry();
    const geometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const meshes = Array.from({ length: 64 }, (_, index) => {
      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
      mesh.position.x = index * 2;
      registry.addInteractable(mesh, { data: index });
      return mesh;
    });
    const build = vi.spyOn(BVHSpatialAccelerator, 'buildObjectTree');
    registry.raycaster.set(
      new THREE.Vector3(meshes[63].position.x, 0, 5),
      new THREE.Vector3(0, 0, -1)
    );

    expect(registry.raycastScene()?.entry.mesh).toBe(meshes[63]);
    expect(build).toHaveBeenCalledTimes(1);
    registry.raycastScene();
    expect(build).toHaveBeenCalledTimes(1);

    meshes[63].position.x = 200;
    registry.invalidateSpatialAcceleration();
    registry.raycaster.ray.origin.x = 200;
    expect(registry.raycastScene()?.entry.mesh).toBe(meshes[63]);
    expect(build).toHaveBeenCalledTimes(2);
  });

  it('does not expand an instanced cloud beyond the measured object-BVH tier', () => {
    const registry = new InteractableRegistry();
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.1),
      new THREE.MeshBasicMaterial(),
      16_385
    );
    const build = vi.spyOn(BVHSpatialAccelerator, 'buildObjectTree');
    registry.addInteractable(mesh);
    registry.raycaster.set(new THREE.Vector3(0, 0, 5), new THREE.Vector3(0, 0, -1));

    registry.raycastScene();
    expect(build).toHaveBeenCalledWith([mesh], false);
  });

  it('maps recursive child hits back to their registered group', () => {
    const registry = new InteractableRegistry();
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 8, 8), new THREE.MeshBasicMaterial());
    group.add(mesh);
    registry.addInteractable(group, { data: 'landmark' });
    registry.raycaster.set(new THREE.Vector3(0, 0, 5), new THREE.Vector3(0, 0, -1));

    const hit = registry.raycastScene();
    expect(hit?.entry.mesh).toBe(group);
    expect(hit?.entry.data).toBe('landmark');
    expect(mesh.geometry.boundsTree).toBeDefined();

    registry.setSuppressSceneSelection(true);
    expect(registry.raycastScene()).toBeNull();
    expect(registry.raycastScene(registry.raycaster, { ignoreSuppression: true })?.entry.mesh).toBe(
      group
    );

    group.remove(mesh);
    registry.removeInteractable(group);
    expect(mesh.geometry.boundsTree == null).toBe(true);
  });
});
