import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { InteractableRegistry } from '../src/vr/input/InteractableRegistry.ts';

describe('InteractableRegistry spatial acceleration', () => {
  it('builds and disposes BVH trees for mesh interactables', () => {
    const registry = new InteractableRegistry();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    const geometry = mesh.geometry as THREE.BufferGeometry & { boundsTree?: unknown };

    registry.addInteractable(mesh);
    expect(geometry.boundsTree).toBeDefined();

    registry.removeInteractable(mesh);
    expect(geometry.boundsTree == null).toBe(true);
  });
});
