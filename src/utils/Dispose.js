import * as THREE from 'three';

/** Recursively dispose of a Three.js object and its children. */
export function disposeObject(obj) {
  if (!obj) return;

  if (obj.geometry) {
    obj.geometry.dispose();
  }

  if (obj.material) {
    if (Array.isArray(obj.material)) {
      obj.material.forEach((m) => disposeMaterial(m));
    } else {
      disposeMaterial(obj.material);
    }
  }

  if (obj.dispose && typeof obj.dispose === 'function') {
    obj.dispose();
  }

  // Recurse.
  const children = obj.children ? obj.children.slice() : [];
  for (const child of children) {
    disposeObject(child);
  }

  if (obj.parent) {
    obj.parent.remove(obj);
  }
}

function disposeMaterial(material) {
  if (!material) return;
  for (const key of Object.keys(material)) {
    const value = material[key];
    if (value && value.isTexture) {
      value.dispose();
    }
  }
  material.dispose();
}
