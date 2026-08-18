import * as THREE from 'three';
import type { LensMode, Updatable } from '../coordinators/types.ts';

export interface TechnoCoreNodeOptions {
  position?: [number, number, number];
  scale?: number;
}

const MODE_COLORS: Record<LensMode, number> = {
  off: 0x00ffff,
  statistical: 0x00ffcc,
  anomaly: 0xff00cc,
};

/**
 * A functional landmark that serves as the memory palace's computation hub.
 *
 * Beyond symbolism, the TechnoCore is an interactable lens hub. Pointing and
 * pinching it cycles through analysis modes (statistical lens, anomaly lens,
 * off). Its pulse intensity also reflects live analysis activity so the user
 * can "feel" the amount of computation in the scene.
 */
export class TechnoCoreNode implements Updatable {
  static readonly LENS_MODES: LensMode[] = ['off', 'statistical', 'anomaly'];

  group: THREE.Group;
  coreMat: THREE.MeshBasicMaterial;
  core: THREE.Mesh;
  sphereMat: THREE.MeshBasicMaterial;
  megasphere: THREE.Mesh;
  ring1: THREE.Mesh;
  ring2: THREE.Mesh;

  private _dataActivity: number;
  lensMode: LensMode;

  constructor({ position = [6, 4, -8], scale = 1 }: TechnoCoreNodeOptions = {}) {
    this.group = new THREE.Group();
    this.group.position.set(...position);
    this.group.scale.setScalar(scale);

    // Soft inner glow core.
    const coreGeo = new THREE.SphereGeometry(1.05, 24, 24);
    this.coreMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.core = new THREE.Mesh(coreGeo, this.coreMat);
    this.group.add(this.core);

    // Wireframe megasphere.
    const sphereGeo = new THREE.SphereGeometry(1.5, 24, 24);
    this.sphereMat = new THREE.MeshBasicMaterial({
      color: 0x00aaff,
      wireframe: true,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.megasphere = new THREE.Mesh(sphereGeo, this.sphereMat);
    this.group.add(this.megasphere);

    // Glowing orbital rings.
    const ringGeo = new THREE.TorusGeometry(2.2, 0.04, 16, 100);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.ring1 = new THREE.Mesh(ringGeo, ringMat);
    this.ring2 = new THREE.Mesh(ringGeo, ringMat.clone());
    this.ring1.rotation.x = Math.PI / 3;
    this.ring2.rotation.y = Math.PI / 4;
    this.group.add(this.ring1);
    this.group.add(this.ring2);

    this._dataActivity = 0;
    this.lensMode = 'off';
  }

  setDataActivity(value: number): void {
    this._dataActivity = Math.max(0, Math.min(1, value));
  }

  setLensMode(mode: LensMode): boolean {
    if (!TechnoCoreNode.LENS_MODES.includes(mode)) return false;
    this.lensMode = mode;
    const colorHex = MODE_COLORS[mode];
    const color = new THREE.Color(colorHex);
    this.coreMat.color.copy(color);
    this.sphereMat.color.copy(color);
    (this.ring1.material as THREE.MeshBasicMaterial).color.copy(color);
    (this.ring2.material as THREE.MeshBasicMaterial).color.copy(color);
    return true;
  }

  nextLensMode(): LensMode {
    const idx = TechnoCoreNode.LENS_MODES.indexOf(this.lensMode);
    const next = TechnoCoreNode.LENS_MODES[(idx + 1) % TechnoCoreNode.LENS_MODES.length];
    this.setLensMode(next);
    return next;
  }

  update(delta: number, time: number): void {
    this.megasphere.rotation.y += delta * 0.2;
    this.ring1.rotation.z += delta * 0.4;
    this.ring2.rotation.x += delta * 0.3;

    const pulse = 0.25 + Math.sin(time * 2) * 0.1 + this._dataActivity * 0.35;
    this.sphereMat.opacity = Math.min(0.9, pulse);
    this.coreMat.opacity = Math.min(0.45, 0.12 + this._dataActivity * 0.35);

    const ringPulse = 0.45 + Math.sin(time * 3 + 1) * 0.15 + this._dataActivity * 0.4;
    (this.ring1.material as THREE.MeshBasicMaterial).opacity = Math.min(1, ringPulse);
    (this.ring2.material as THREE.MeshBasicMaterial).opacity = Math.min(1, ringPulse);
  }
}
