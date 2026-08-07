import * as THREE from 'three';
import type { Updatable } from '../coordinators/types.ts';

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
 * An infinite-feeling pulsing neon datumplane grid.
 * Represents the substrate of cyberspace beneath the data palace.
 */
export class DatumPlane implements Updatable {
  mesh: THREE.GridHelper;

  constructor({ size = 200, divisions = 100, color1 = 0xff0055, color2 = 0x00ffaa }: DatumPlaneOptions = {}) {
    this.mesh = new THREE.GridHelper(size, divisions, color1, color2);
    this.mesh.position.y = 0;
    const material = singleMaterial(this.mesh.material);
    material.transparent = true;
    material.opacity = 0.7;
    material.blending = THREE.AdditiveBlending;
  }

  update(delta: number, time: number): void {
    const material = singleMaterial(this.mesh.material);
    material.opacity = 0.5 + Math.sin(time * 1.5) * 0.2;
  }
}
