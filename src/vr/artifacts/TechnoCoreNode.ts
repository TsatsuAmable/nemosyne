import * as THREE from 'three';
import type { RepresentationDecisionStatus } from '../../moneta/representation/DecisionPolicy.ts';
import type { LensMode, Updatable } from '../coordinators/types.ts';

export interface TechnoCoreNodeOptions {
  position?: [number, number, number];
  scale?: number;
}

export type TechnoCoreDecisionState = RepresentationDecisionStatus | 'PENDING';

const MODE_COLORS: Record<LensMode, number> = {
  off: 0x00ffff,
  statistical: 0x00ffcc,
  anomaly: 0xff00cc,
};

/**
 * A functional landmark that serves as the memory palace's representation
 * reasoning instrument.
 *
 * The node keeps the historical lens APIs for compatibility, but the normal
 * product path projects the exact Moneta decision state here and uses selection
 * to inspect the governed guidance surface. Decision state is communicated by
 * geometry/pose as well as colour so it is categorical rather than a faux
 * confidence gauge.
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
  decisionState: TechnoCoreDecisionState;
  private _decisionBaseOpacity = 0.45;

  constructor({ position = [6, 4, -8], scale = 1 }: TechnoCoreNodeOptions = {}) {
    this.group = new THREE.Group();
    this.group.position.set(...position);
    this.group.scale.setScalar(scale);
    this.group.userData = {
      role: 'technocore',
      interactive: true,
      decisionState: 'PENDING',
    };

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
    this.group.add(this.ring1);
    this.group.add(this.ring2);

    this._dataActivity = 0;
    this.lensMode = 'off';
    this.decisionState = 'PENDING';
    this.setDecisionState('PENDING');
  }

  setDataActivity(value: number): void {
    this._dataActivity = Math.max(0, Math.min(1, value));
  }

  /**
   * Project the exact categorical Moneta decision state into non-numeric visual
   * cues. This method never derives or reclassifies the state.
   */
  setDecisionState(state: TechnoCoreDecisionState): void {
    this.decisionState = state;
    this.group.userData.decisionState = state;

    this.core.scale.setScalar(1);
    this.megasphere.scale.setScalar(1);
    this.ring1.scale.setScalar(1);
    this.ring2.scale.setScalar(1);
    this.ring1.visible = true;
    this.ring2.visible = true;

    switch (state) {
      case 'DECISIVE':
        this.ring1.rotation.set(Math.PI / 2, 0, 0);
        this.ring2.rotation.set(Math.PI / 2, 0, Math.PI / 2);
        this._decisionBaseOpacity = 0.55;
        break;
      case 'AMBIGUOUS':
        this.ring1.rotation.set(Math.PI / 3, 0, Math.PI / 6);
        this.ring2.rotation.set(-Math.PI / 3, Math.PI / 4, -Math.PI / 6);
        this.ring2.scale.setScalar(0.82);
        this._decisionBaseOpacity = 0.5;
        break;
      case 'UNDERDETERMINED':
        this.ring1.rotation.set(Math.PI / 4, 0, 0);
        this.ring2.rotation.set(0, Math.PI / 4, 0);
        this.ring1.scale.setScalar(0.72);
        this.ring2.scale.setScalar(1.14);
        this._decisionBaseOpacity = 0.36;
        break;
      case 'INFEASIBLE':
        this.ring1.rotation.set(Math.PI / 4, Math.PI / 4, 0);
        this.ring2.rotation.set(-Math.PI / 4, Math.PI / 4, 0);
        this.core.scale.setScalar(0.72);
        this.megasphere.scale.setScalar(0.88);
        this._decisionBaseOpacity = 0.62;
        break;
      case 'PENDING':
      default:
        this.ring1.rotation.set(Math.PI / 3, 0, 0);
        this.ring2.rotation.set(0, Math.PI / 4, 0);
        this._decisionBaseOpacity = 0.32;
        break;
    }
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

    const ringPulse =
      this._decisionBaseOpacity + Math.sin(time * 3 + 1) * 0.1 + this._dataActivity * 0.25;
    (this.ring1.material as THREE.MeshBasicMaterial).opacity = Math.min(1, ringPulse);
    (this.ring2.material as THREE.MeshBasicMaterial).opacity = Math.min(1, ringPulse);
  }
}