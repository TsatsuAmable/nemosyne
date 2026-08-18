// @ts-nocheck
// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { disposeObject } from '../src/utils/Dispose.ts';

describe('disposeObject', () => {
  it('disposes geometry and material of a mesh', () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const mesh = new THREE.Mesh(geometry, material);

    const geomSpy = vi.spyOn(geometry, 'dispose');
    const matSpy = vi.spyOn(material, 'dispose');

    disposeObject(mesh);

    expect(geomSpy).toHaveBeenCalled();
    expect(matSpy).toHaveBeenCalled();
  });

  it('recursively disposes children', () => {
    const parent = new THREE.Group();
    const childGeo = new THREE.SphereGeometry(1, 8, 8);
    const childMat = new THREE.MeshBasicMaterial();
    const child = new THREE.Mesh(childGeo, childMat);
    parent.add(child);

    const geomSpy = vi.spyOn(childGeo, 'dispose');
    const matSpy = vi.spyOn(childMat, 'dispose');

    disposeObject(parent);

    expect(geomSpy).toHaveBeenCalled();
    expect(matSpy).toHaveBeenCalled();
  });

  it('disposes material array', () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const materials = [
      new THREE.MeshBasicMaterial({ color: 0xff0000 }),
      new THREE.MeshBasicMaterial({ color: 0x00ff00 }),
    ];
    const mesh = new THREE.Mesh(geometry, materials);

    const spies = materials.map((m) => vi.spyOn(m, 'dispose'));

    disposeObject(mesh);

    for (const spy of spies) {
      expect(spy).toHaveBeenCalled();
    }
  });

  it('disposes textures attached to materials', () => {
    const texture = new THREE.CanvasTexture(document.createElement('canvas'));
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);

    const texSpy = vi.spyOn(texture, 'dispose');

    disposeObject(mesh);

    expect(texSpy).toHaveBeenCalled();
  });

  it('removes the object from its parent', () => {
    const parent = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    parent.add(mesh);

    disposeObject(mesh);

    expect(mesh.parent).toBeNull();
  });

  it('does nothing for null input', () => {
    expect(() => disposeObject(null)).not.toThrow();
  });

  it('calls object.dispose if present', () => {
    const obj = { dispose: vi.fn() };
    disposeObject(obj);
    expect(obj.dispose).toHaveBeenCalled();
  });
});
