import * as THREE from 'three';

/**
 * An infinite-feeling pulsing neon datumplane grid.
 * Represents the substrate of cyberspace beneath the data palace.
 */
export class DatumPlane {
  constructor({ size = 200, divisions = 100, color1 = 0xff0055, color2 = 0x00ffaa } = {}) {
    this.mesh = new THREE.GridHelper(size, divisions, color1, color2);
    this.mesh.position.y = 0;
    this.mesh.material.transparent = true;
    this.mesh.material.opacity = 0.7;
    this.mesh.material.blending = THREE.AdditiveBlending;
  }

  update(delta, time) {
    this.mesh.material.opacity = 0.5 + Math.sin(time * 1.5) * 0.2;
  }
}
