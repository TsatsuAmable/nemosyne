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
  }
}
