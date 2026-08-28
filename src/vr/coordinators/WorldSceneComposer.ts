/**
 * Composes the shared scene landmarks that live independently of the current
 * dataset: datum plane, TechnoCore lens hub, HolographicInspector, Farcaster
 * portals, and the analyst anchor that all HUD panels are parented to.
 */

import * as THREE from 'three';
import { DatumPlane } from '../artifacts/DatumPlane.ts';
import { TechnoCoreNode } from '../artifacts/TechnoCoreNode.ts';
import { FarcasterPortal, PortalSemanticTarget } from '../artifacts/FarcasterPortal.ts';
import { HolographicInspector } from '../artifacts/HolographicInspector.ts';
import { IceVaultNode } from '../artifacts/IceVaultNode.ts';
import { WorldTheme } from '../WorldTheme.ts';
import type { Engine } from '../Engine.ts';
import { disposeObject } from '../../utils/Dispose.ts';

export interface WorldSceneComposerCallbacks {
  onWarp?: (zone: string, pos: number[], operation: string | null) => void;
  onSemanticWarp?: (target: PortalSemanticTarget) => void;
}

export class WorldSceneComposer {
  engine: Engine;
  analystAnchor: THREE.Group;
  datum: DatumPlane;
  core: TechnoCoreNode;
  iceVault: IceVaultNode;
  inspector: HolographicInspector;
  portalA: FarcasterPortal;
  portalB: FarcasterPortal;
  /**
   * Forward offset (metres, along the anchor's local -Z) applied to the
   * analystAnchor each frame so the workspace sits at the user's configured
   * panel distance. Defaults to 0 (behaviour-preserving) until
   * `setPanelDistance` is called by the comfort controller; without this, the
   * per-frame torso tracking overwrites any one-shot `position.z` the comfort
   * controller writes, silently making the Panel Distance setting a no-op.
   */
  panelDistance = 0;
  private _disposed = false;

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

    // Ice Vault landmark: Gibson-style data security / cold storage archive
    this.iceVault = new IceVaultNode({
      position: [2.5, 1.6, -2],
      color: 0x00e5ff,
      emissive: 0x003344,
      scale: 0.9,
    });
    this.engine.scene.add(this.iceVault.group);
    this.engine.addUpdatable(this.iceVault);

    // Holographic data inspector.
    this.inspector = new HolographicInspector(this.engine);
    this.inspector.mount(this.engine.scene);
    this.engine.addUpdatable(this.inspector);
    // Register the inspector with the input router so the live pointer path
    // (PointerEventMachine iterates registry.panels) reaches its SpatialPanel
    // fallback — otherwise its interactive tabs, pin/close chrome, and footer
    // buttons are inert in production. The inspector is a SpatialPanel
    // (handlePointerDown/Move/Up + mesh), so it satisfies PanelLike. The real
    // `Engine` always provides `input`; the optional chain tolerates the
    // minimal stub engines used by torso-anchor unit tests.
    this.engine.input?.addPanel?.(this.inspector);

    // Farcaster portals: semantic travel portals.
    this.portalA = new FarcasterPortal({
      position: [-2.5, 1.6, -2],
      targetZone: 'DEEP_NET',
      targetPosition: [0, 0, -20],
      color: WorldTheme.PRESETS.deepNet.pointColor,
      semanticTarget: { kind: 'overview' },
      onSemanticWarp: callbacks.onSemanticWarp,
    });
    this.engine.scene.add(this.portalA.group);
    this.engine.addUpdatable(this.portalA);

    this.portalB = new FarcasterPortal({
      position: [0, 1.6, -8],
      targetZone: 'LOCAL_MATRIX',
      targetPosition: [0, 0, 0],
      color: WorldTheme.PRESETS.neonMidnight.pointColor,
      semanticTarget: { kind: 'saved-investigation', archiveId: 'latest' },
      onSemanticWarp: callbacks.onSemanticWarp,
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
    // positioned at torso level (~0.25m below headset eye level). The configured
    // panelDistance is applied as a forward (-Z) offset so the workspace sits at
    // the user's chosen reading distance rather than at the headset.
    const torsoY = Math.max(0.8, cam.position.y - 0.25);
    this.analystAnchor.position.set(cam.position.x, torsoY, cam.position.z - this.panelDistance);

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

  /**
   * Set the forward panel-distance offset (metres) applied each frame. Takes
   * effect on the next `update()` tick, so it survives the per-frame torso
   * tracking that previously overwrote a one-shot `position.z` write.
   */
  setPanelDistance(distance: number): void {
    this.panelDistance = distance;
  }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    this.engine.removeUpdatable(this);
    this.engine.removeUpdatable(this.datum);
    this.engine.removeUpdatable(this.core);
    this.engine.removeUpdatable(this.iceVault);
    this.engine.removeUpdatable(this.inspector);
    this.engine.input?.removePanel?.(this.inspector);
    this.engine.removeUpdatable(this.portalA);
    this.engine.removeUpdatable(this.portalB);
    disposeObject(this.datum?.mesh);
    disposeObject(this.core?.group);
    this.iceVault?.dispose();
    disposeObject(this.inspector?.mesh);
    disposeObject(this.portalA?.group);
    disposeObject(this.portalB?.group);
    this.analystAnchor.parent?.remove(this.analystAnchor);
  }
}
