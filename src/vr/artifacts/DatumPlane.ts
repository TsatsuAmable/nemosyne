import * as THREE from 'three';
import type { Updatable } from '../coordinators/types.ts';
import { COLOR_TOKENS } from '../ui-system/tokens.ts';

export interface DatumPlaneOptions {
  size?: number;
  divisions?: number;
  color1?: number;
  color2?: number;
}

function singleMaterial(material: THREE.Material | THREE.Material[]): THREE.Material {
  return Array.isArray(material) ? material[0] : material;
}

/**
 * Static datum plane grid. Represents the substrate of cyberspace beneath the data palace.
 * No pulse animation — calm by default.
 */
export class DatumPlane implements Updatable {
  mesh: THREE.GridHelper;

  constructor({ size = 200, divisions = 100, color1 = COLOR_TOKENS.surface.border, color2 = COLOR_TOKENS.space.void }: DatumPlaneOptions = {}) {
    this.mesh = new THREE.GridHelper(size, divisions, color1, color2);
    this.mesh.position.y = 0;
    const material = singleMaterial(this.mesh.material);
    material.transparent = true;
    material.opacity = 0.4;
    material.blending = THREE.NormalBlending;
  }

  update(_delta: number, _time: number): void {
    // Static grid — no pulse
  }
}
