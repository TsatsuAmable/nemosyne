/**
 * Composes the shared scene landmarks that live independently of the current
 * dataset: datum plane, TechnoCore lens hub, HolographicInspector, Farcaster
 * portals, and the analyst anchor that all HUD panels are parented to.
 */

import * as THREE from 'three';
import { DatumPlane } from '../artifacts/DatumPlane.ts';
import { TechnoCoreNode } from '../artifacts/TechnoCoreNode.ts';
import { FarcasterPortal } from '../artifacts/FarcasterPortal.ts';
import { HolographicInspector } from '../artifacts/HolographicInspector.ts';
import { WorldTheme } from '../WorldTheme.ts';
import type { Engine } from '../Engine.ts';
import type { WorldSceneComposerCallbacks } from './types.ts';

export class WorldSceneComposer {
  engine: Engine;
  analystAnchor: THREE.Group;
  datum: DatumPlane;
  core: TechnoCoreNode;
  inspector: HolographicInspector;
  portalA: FarcasterPortal;
  portalB: FarcasterPortal;

  /**
   * @param engine
   * @param callbacks
   */
  constructor(engine: Engine, callbacks: WorldSceneComposerCallbacks = {}) {
    this.engine = engine;

    // Explicit analyst anchor: all HUD panels, dashboard, and wheel menu are
    // parented here so the workspace clusters around the user rather than the
    // world origin. It sits at the camera rig origin by default so local
    // coordinates remain compatible with existing panel defaults.
    this.analystAnchor = new THREE.Group();
    this.analystAnchor.name = 'analystAnchor';
    this.engine.cameraGroup.add(this.analystAnchor);

    // Shared substrate.
    this.datum = new DatumPlane();
    this.engine.scene.add(this.datum.mesh);
    this.engine.addUpdatable(this.datum);

    // Lens hub / landmark.
    this.core = new TechnoCoreNode({ position: [7, 4, -10], scale: 1.2 });
    this.engine.scene.add(this.core.group);
    this.engine.addUpdatable(this.core);

    // Holographic data inspector.
    this.inspector = new HolographicInspector(this.engine);
    this.inspector.mount(this.engine.scene);
    this.engine.addUpdatable(this.inspector);

    // Farcaster portals: data-transformation gates.
    this.portalA = new FarcasterPortal({
      position: [-2.5, 1.6, -2],
      targetZone: 'DEEP_NET',
      targetPosition: [0, 0, -20],
      color: WorldTheme.PRESETS.deepNet.pointColor,
      operation: 'anomaly',
      onWarp: callbacks.onWarp,
    });
    this.engine.scene.add(this.portalA.group);
    this.engine.addUpdatable(this.portalA);

    this.portalB = new FarcasterPortal({
      position: [0, 1.6, -8],
      targetZone: 'LOCAL_MATRIX',
      targetPosition: [0, 0, 0],
      color: WorldTheme.PRESETS.neonMidnight.pointColor,
      operation: 'reset',
      onWarp: callbacks.onWarp,
    });
    this.engine.scene.add(this.portalB.group);
    this.engine.addUpdatable(this.portalB);

    // Register scene composer for live torso tracking
    this.engine.addUpdatable(this);
  }

  /**
   * Continuously update analystAnchor to track the user's torso position and facing direction.
   *
   * The yaw is damped toward the headset yaw via a short-arc lerp (factor 0.15)
   * so micro-rotations of the headset do not snap the entire HUD workspace
   * instantly, eliminating jitter while still converging to the target heading.
   */
  update(_delta?: number): void {
    if (!this.engine?.camera || !this.analystAnchor) return;
    const cam = this.engine.camera;

    // Torso position tracking: follows headset position in X and Z,
    // positioned at torso level (~0.25m below headset eye level)
    const torsoY = Math.max(0.8, cam.position.y - 0.25);
    this.analystAnchor.position.set(cam.position.x, torsoY, cam.position.z);

    // Torso orientation tracking: damped lerp toward headset yaw (Y-axis).
    const headEuler = new THREE.Euler(0, 0, 0, 'YXZ');
    headEuler.setFromQuaternion(cam.quaternion);
    const targetYaw = headEuler.y;
    let delta = targetYaw - this.analystAnchor.rotation.y;
    // Wrap the angular delta to the shortest path in [-PI, PI] so a near-PI
    // rotation does not take the long way around the circle.
    delta = THREE.MathUtils.euclideanModulo(delta + Math.PI, Math.PI * 2) - Math.PI;
    this.analystAnchor.rotation.y += delta * 0.15;
  }
}
