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
import {
  hasActiveBodyFramePanelDrag,
  setBodyFrameViewerTargetLocal,
} from '../spatial/BodyFrameState.ts';

export interface WorldSceneComposerCallbacks {
  onWarp?: (zone: string, pos: number[], operation: string | null) => void;
  onSemanticWarp?: (target: PortalSemanticTarget) => void;
}

const BODY_YAW_ENTER_DEADBAND = THREE.MathUtils.degToRad(18);
const BODY_YAW_EXIT_DEADBAND = THREE.MathUtils.degToRad(8);
const BODY_YAW_INTENT_SECONDS = 0.2;
const BODY_YAW_DAMPING_LAMBDA = 2.5;

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
   * Forward offset (metres) from the locomotion rig origin to the analyst
   * workspace. The offset is applied along the stable body-frame heading, not
   * the rig's raw -Z axis.
   */
  panelDistance = 0;
  private _disposed = false;
  private _bodyYaw = 0;
  private _bodyYawInitialized = false;
  private _bodyYawTracking = false;
  private _bodyYawIntentSeconds = 0;
  private _bodyYawIntentDirection = 0;
  private readonly _viewerPosition = new THREE.Vector3();
  private readonly _viewerQuaternion = new THREE.Quaternion();
  private readonly _viewerEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly _forward = new THREE.Vector3();
  private readonly _viewerTargetLocal = new THREE.Vector3();
  private readonly _yawAxis = new THREE.Vector3(0, 1, 0);

  /**
   * @param engine
   * @param callbacks
   */
  constructor(engine: Engine, callbacks: WorldSceneComposerCallbacks = {}) {
    this.engine = engine;

    // Explicit analyst anchor: all persistent HUD panels are parented here. It
    // is already a child of the locomotion rig, so rig/world locomotion moves
    // the workspace automatically. Physical HMD X/Z translation is deliberately
    // not copied into this anchor; a head lean must not drag the whole cockpit.
    this.analystAnchor = new THREE.Group();
    this.analystAnchor.name = 'analystAnchor';
    this.engine.cameraGroup.add(this.analystAnchor);
    setBodyFrameViewerTargetLocal(this.analystAnchor, this._viewerTargetLocal.set(0, 0, 0));

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
    // minimal stub engines used by body-frame unit tests.
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

    this.engine.addUpdatable(this);
  }

  /**
   * Update the analyst body frame.
   *
   * Translation is rig-relative: physical HMD X/Z motion is head motion, not
   * locomotion, so it cannot pull the persistent workspace around. Heading uses
   * hysteresis plus a sustained-turn gate; ordinary gaze scanning inside the
   * deadband leaves the workspace fixed. Once a real heading change is accepted,
   * damping is delta-time independent. While a panel is being manipulated the
   * anchor transform is frozen so the user's coordinate frame cannot move under
   * the pointer.
   */
  update(delta = 1 / 72): void {
    if (!this.engine?.camera || !this.analystAnchor) return;
    if (hasActiveBodyFramePanelDrag(this.analystAnchor)) return;

    this._readCurrentViewerPose();
    const dt = Math.max(0, Math.min(Number.isFinite(delta) ? delta : 1 / 72, 0.1));

    this._viewerEuler.setFromQuaternion(this._viewerQuaternion);
    const targetYaw = this._viewerEuler.y;

    if (!this._bodyYawInitialized) {
      // The initial body frame should agree with the direction the user entered
      // the experience facing. Damping is for subsequent heading changes, not
      // for an artificial startup sweep from zero.
      this._bodyYaw = targetYaw;
      this._bodyYawInitialized = true;
    } else {
      const yawError = this._shortestYawDelta(targetYaw, this._bodyYaw);
      const absError = Math.abs(yawError);

      if (!this._bodyYawTracking) {
        if (absError >= BODY_YAW_ENTER_DEADBAND) {
          const intentDirection = Math.sign(yawError);
          if (intentDirection !== this._bodyYawIntentDirection) {
            // A sustained body turn must persist in one direction. Alternating
            // left/right gaze excursions outside the deadband are scanning, not
            // evidence that the torso heading changed.
            this._bodyYawIntentDirection = intentDirection;
            this._bodyYawIntentSeconds = dt;
          } else {
            this._bodyYawIntentSeconds += dt;
          }
          if (this._bodyYawIntentSeconds >= BODY_YAW_INTENT_SECONDS) {
            this._bodyYawTracking = true;
            this._bodyYawIntentSeconds = 0;
            this._bodyYawIntentDirection = 0;
          }
        } else {
          this._bodyYawIntentSeconds = 0;
          this._bodyYawIntentDirection = 0;
        }
      }

      if (this._bodyYawTracking) {
        if (absError <= BODY_YAW_EXIT_DEADBAND) {
          this._bodyYawTracking = false;
          this._bodyYawIntentSeconds = 0;
          this._bodyYawIntentDirection = 0;
        } else if (dt > 0) {
          const alpha = 1 - Math.exp(-BODY_YAW_DAMPING_LAMBDA * dt);
          this._bodyYaw = this._wrapYaw(this._bodyYaw + yawError * alpha);
        }
      }
    }

    this.analystAnchor.rotation.set(0, this._bodyYaw, 0);

    // Eye height still determines a useful torso-height baseline, but horizontal
    // HMD translation is intentionally ignored. The anchor is already inside
    // cameraGroup, so locomotion/snap-turn transforms arrive through the parent.
    const torsoY = Math.max(0.8, this._viewerPosition.y - 0.25);
    this._forward.set(0, 0, -1).applyAxisAngle(this._yawAxis, this._bodyYaw);
    this.analystAnchor.position.set(
      this._forward.x * this.panelDistance,
      torsoY,
      this._forward.z * this.panelDistance
    );

    // Panels orient toward the body/rig origin in anchor-local coordinates.
    // With the workspace translated forward by panelDistance this point lies on
    // local +Z, not at the anchor origin itself.
    setBodyFrameViewerTargetLocal(
      this.analystAnchor,
      this._viewerTargetLocal.set(0, 0, this.panelDistance)
    );
  }

  /**
   * Prefer the current XRFrame viewer pose because Engine exposes it before
   * updatables run. This avoids depending on Three.js applying the HMD camera
   * transform later during renderer.render(). Desktop/simulator paths fall back
   * to the camera transform.
   */
  private _readCurrentViewerPose(): void {
    const frame = this.engine.xrFrame;
    const refSpace = this.engine.xrRefSpace;
    if (frame && refSpace) {
      try {
        const pose = frame.getViewerPose(refSpace);
        if (pose) {
          const { position, orientation } = pose.transform;
          this._viewerPosition.set(position.x, position.y, position.z);
          this._viewerQuaternion.set(
            orientation.x,
            orientation.y,
            orientation.z,
            orientation.w
          );
          return;
        }
      } catch {
        // Fall through to camera state when a mocked/ending XR frame cannot
        // provide a viewer pose.
      }
    }

    this._viewerPosition.copy(this.engine.camera.position);
    this._viewerQuaternion.copy(this.engine.camera.quaternion);
  }

  private _shortestYawDelta(target: number, current: number): number {
    return THREE.MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) - Math.PI;
  }

  private _wrapYaw(yaw: number): number {
    return THREE.MathUtils.euclideanModulo(yaw + Math.PI, Math.PI * 2) - Math.PI;
  }

  /**
   * Set the configured workspace offset. The offset is interpreted along the
   * body-frame heading, so turning the body rotates the reading zone rather than
   * leaving it stranded on the locomotion rig's original -Z axis.
   */
  setPanelDistance(distance: number): void {
    if (!Number.isFinite(distance)) return;
    this.panelDistance = Math.max(0, distance);
    setBodyFrameViewerTargetLocal(
      this.analystAnchor,
      this._viewerTargetLocal.set(0, 0, this.panelDistance)
    );
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
