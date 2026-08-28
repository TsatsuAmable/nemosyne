import * as THREE from 'three';
import { Container, Component, type ContainerProperties } from '@pmndrs/uikit';
import { SpatialUIRoot } from './SpatialUIRoot.ts';
import type { PointerLike } from '../coordinators/types.ts';

export type SpatialPanelReferenceFrame = 'BODY_LOCKED' | 'WORLD_LOCKED';

export interface SpatialPanelGrabConfig {
  enabled: boolean;
  onGrabStart?: () => void;
  onGrabEnd?: () => void;
  onRepositioned?: (position: THREE.Vector3, quaternion: THREE.Quaternion) => void;
}

export class SpatialPanel extends Container {
  private _referenceFrame: SpatialPanelReferenceFrame = 'BODY_LOCKED';
  private _torsoAnchor: THREE.Object3D | null = null;
  private _worldScene: THREE.Object3D | null = null;

  // Damping/Interpolation targets
  private _targetPosition: THREE.Vector3 = new THREE.Vector3();
  private _targetQuaternion: THREE.Quaternion = new THREE.Quaternion();
  private _isLerping = false;
  private _lerpSpeed = 8; // Rad/s or units/s speed

  // Grab rail / drag state
  private _grabConfig: SpatialPanelGrabConfig = { enabled: true };
  private _isGrabbed = false;
  private _grabOffset: THREE.Vector3 = new THREE.Vector3();
  private _grabQuaternionOffset: THREE.Quaternion = new THREE.Quaternion();
  private _grabPointerId: number | null = null;
  private _dragPlane: THREE.Plane = new THREE.Plane();

  constructor(
    properties?: ContainerProperties,
    torsoAnchor: THREE.Object3D | null = null,
    worldScene: THREE.Object3D | null = null
  ) {
    super({
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: 0x263544,
      backgroundColor: 0x0b1119,
      padding: 24,
      ...properties,
    });

    this._torsoAnchor = torsoAnchor;
    this._worldScene = worldScene;

    if (this._torsoAnchor) {
      this._torsoAnchor.add(this);
    }

    // Create grab rail visual affordance
    this._createGrabRail();
  }

  private _createGrabRail(): void {
    // Grab rail - thin bar at top of panel for drag/repositioning
    // Stored as a three.js Mesh (not uikit Component) to avoid Container constraints
    const railGeometry = new THREE.BoxGeometry(0.48, 0.04, 0.008);
    const railMaterial = new THREE.MeshBasicMaterial({
      color: 0x263544,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });
    this._grabRailMesh = new THREE.Mesh(railGeometry, railMaterial);
    // Use default panel height (384) as fallback since Container doesn't expose height directly
    const panelHeight = 384;
    this._grabRailMesh.position.set(0, panelHeight * 0.5 - 0.02, 0.02);
    this._grabRailMesh.name = 'grab-rail';
    this._grabRailMesh.userData = { panel: this, isGrabRail: true };
    this._grabRailMesh.visible = false; // Initially hidden, shown when panel is active
  }

  /** Get the grab rail mesh for raycasting. */
  getGrabRailMesh(): THREE.Mesh | null {
    return this._grabRailMesh;
  }

  /** Show/hide the grab rail visual affordance. */
  setGrabRailVisible(visible: boolean): void {
    if (this._grabRailMesh) {
      this._grabRailMesh.visible = visible;
    }
  }

  private _grabRailMesh: THREE.Mesh | null = null;

  get mesh(): THREE.Object3D {
    return this;
  }

  get referenceFrame(): SpatialPanelReferenceFrame {
    return this._referenceFrame;
  }

  setReferenceFrame(frame: SpatialPanelReferenceFrame, smooth = true): void {
    if (this._referenceFrame === frame) return;

    const oldParent = this.parent;
    if (!oldParent) {
      this._referenceFrame = frame;
      return;
    }

    // Capture current world transform
    const worldPosition = new THREE.Vector3();
    const worldQuaternion = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();
    this.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);

    // Swap parents
    oldParent.remove(this);
    this._referenceFrame = frame;

    const newParent = frame === 'BODY_LOCKED' ? this._torsoAnchor : this._worldScene;
    if (newParent) {
      newParent.add(this);
      newParent.updateMatrixWorld();

      // Convert world transform back to new local space
      const localMatrix = new THREE.Matrix4()
        .copy(newParent.matrixWorld)
        .invert()
        .compose(worldPosition, worldQuaternion, worldScale);

      localMatrix.decompose(this.position, this.quaternion, this.scale);
      this.updateMatrixWorld();
    }

    if (smooth) {
      // Trigger smooth lerp to neutral slot position if returning to body-lock
      if (frame === 'BODY_LOCKED') {
        this._isLerping = true;
      }
    }
  }

  setTargetTransform(pos: THREE.Vector3, rot: THREE.Quaternion): void {
    this._targetPosition.copy(pos);
    this._targetQuaternion.copy(rot);
    this._isLerping = true;
  }

  updateTransition(deltaSeconds: number): void {
    if (!this._isLerping) return;

    const targetPos = this._targetPosition;
    const targetRot = this._targetQuaternion;
    const alpha = Math.min(1.0, deltaSeconds * this._lerpSpeed);

    this.position.lerp(targetPos, alpha);
    this.quaternion.slerp(targetRot, alpha);

    if (this.position.distanceTo(targetPos) < 0.001 && this.quaternion.angleTo(targetRot) < 0.001) {
      this.position.copy(targetPos);
      this.quaternion.copy(targetRot);
      this._isLerping = false;
    }
  }

  // ---- Grab rail / drag handling (P1-U3) ----

  /** Enable or disable the grab rail drag affordance. */
  setGrabEnabled(enabled: boolean): void {
    this._grabConfig.enabled = enabled;
  }

  /** Configure grab behavior callbacks. */
  setGrabConfig(config: Partial<SpatialPanelGrabConfig>): void {
    this._grabConfig = { ...this._grabConfig, ...config };
  }

  /** Check if the panel is currently being grabbed. */
  get isGrabbed(): boolean {
    return this._isGrabbed;
  }

  /** Handle grab start on the grab rail. */
  handleGrabStart(raycaster: THREE.Raycaster, pointerId: number): boolean {
    if (!this._grabConfig.enabled || this._isGrabbed) return false;

    const grabRail = this._grabRailMesh;
    if (!grabRail) return false;

    const hits = raycaster.intersectObject(grabRail, false);
    if (hits.length === 0) return false;

    const hit = hits[0];

    // Store grab state
    this._isGrabbed = true;
    this._grabPointerId = pointerId;

    // Calculate grab offset in world space
    const worldPos = new THREE.Vector3();
    this.getWorldPosition(worldPos);
    this._grabOffset.copy(hit.point).sub(worldPos);

    // Store quaternion offset
    const worldQuat = new THREE.Quaternion();
    this.getWorldQuaternion(worldQuat);
    this._grabQuaternionOffset.copy(this.quaternion).premultiply(worldQuat.clone().invert());

    // Create drag plane (perpendicular to camera/view direction for WORLD_LOCKED,
    // or perpendicular to torso up for BODY_LOCKED)
    if (this._referenceFrame === 'WORLD_LOCKED' && this._worldScene) {
      const camDir = new THREE.Vector3();
      this._worldScene.getWorldDirection(camDir);
      this._dragPlane.setFromNormalAndCoplanarPoint(camDir.negate(), hit.point);
    } else if (this._torsoAnchor) {
      const torsoUp = new THREE.Vector3(0, 1, 0);
      torsoUp.applyQuaternion(this._torsoAnchor.quaternion);
      this._dragPlane.setFromNormalAndCoplanarPoint(torsoUp, hit.point);
    }

    this._grabConfig.onGrabStart?.();
    return true;
  }

  /** Handle grab move (drag). */
  handleGrabMove(raycaster: THREE.Raycaster): boolean {
    if (!this._isGrabbed) return false;

    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(this._dragPlane, hit)) return false;

    // Calculate new world position
    const newWorldPos = hit.clone().sub(this._grabOffset);

    if (this._referenceFrame === 'BODY_LOCKED' && this._torsoAnchor) {
      // Convert to torso-local space
      const torsoWorldMatrix = new THREE.Matrix4().copy(this._torsoAnchor.matrixWorld).invert();
      const localPos = newWorldPos.clone().applyMatrix4(torsoWorldMatrix);
      this.position.lerp(localPos, 0.3); // Smooth lerp for body-locked
    } else {
      // World-locked: set directly
      this.position.lerp(newWorldPos, 0.3);
    }

    return true;
  }

  /** Handle grab end. */
  handleGrabEnd(): boolean {
    if (!this._isGrabbed) return false;

    this._isGrabbed = false;
    this._grabPointerId = null;

    // Snap to nearest layout slot if BODY_LOCKED
    if (this._referenceFrame === 'BODY_LOCKED' && this._torsoAnchor) {
      this._snapToLayoutSlot();
    }

    this._grabConfig.onGrabEnd?.();
    this._grabConfig.onRepositioned?.(this.position.clone(), this.quaternion.clone());
    return true;
  }

  /** Snap panel to nearest layout slot (for body-locked panels). */
  private _snapToLayoutSlot(): void {
    // This would snap to the nearest PANEL_LAYOUT slot
    // For now, just ensure it's in a valid position
    const targetPos = new THREE.Vector3().copy(this.position);
    targetPos.y = Math.max(0.1, Math.min(1.0, targetPos.y));
    targetPos.x = Math.max(-1.5, Math.min(1.5, targetPos.x));
    targetPos.z = Math.max(-2.0, Math.min(-0.5, targetPos.z));
    this.position.copy(targetPos);
  }

  /** Check if a pointer event is over the grab rail. */
  isPointerOverGrabRail(raycaster: THREE.Raycaster): boolean {
    const grabRail = this._grabRailMesh;
    if (!grabRail) return false;
    const hits = raycaster.intersectObject(grabRail, false);
    return hits.length > 0;
  }

  // ---- End grab handling ----

  private _lastHoveredComponent: Component | null = null;
  private _capturedPointers: Map<number, Component> = new Map();

  private _findUIRoot(): SpatialUIRoot | null {
    let curr = this.parent;
    while (curr) {
      if (curr instanceof SpatialUIRoot) {
        return curr;
      }
      curr = curr.parent;
    }
    return null;
  }

  handlePointerDown(raycaster: THREE.Raycaster, pointer: PointerLike): string | null {
    const root = this._findUIRoot();
    if (root) {
      root.handlePointerDown(raycaster, pointer.index ?? 0);
      return 'direct-touch';
    }

    // Check for grab rail interaction first (P1-U3)
    const pointerId = pointer.index ?? 0;
    if (this.isPointerOverGrabRail(raycaster) && this._grabConfig.enabled) {
      if (this.handleGrabStart(raycaster, pointerId)) {
        return 'grab-rail';
      }
    }

    const hits = raycaster.intersectObject(this, true);
    if (hits.length === 0) return null;

    const hit = hits.find(h => h.object instanceof Component);
    if (!hit) return null;

    const component = hit.object as Component;

    component.dispatchEvent({
      type: 'pointerdown',
      pointerId,
      ...hit,
    } as unknown as Parameters<Component['dispatchEvent']>[0]);

    this._capturedPointers.set(pointerId, component);
    return 'direct-touch';
  }

  handlePointerMove(raycaster: THREE.Raycaster, pointer: PointerLike): void {
    const root = this._findUIRoot();
    if (root) {
      root.handlePointerMove(raycaster, pointer.index ?? 0);
      return;
    }

    const pointerId = pointer.index ?? 0;

    // Handle grab rail drag (P1-U3)
    if (this._isGrabbed && this._grabPointerId === pointerId) {
      this.handleGrabMove(raycaster);
      return;
    }

    const captured = this._capturedPointers.get(pointerId);
    
    const hits = raycaster.intersectObject(this, true);
    const hit = hits.find(h => h.object instanceof Component);
    const current = hit ? (hit.object as Component) : null;

    if (captured) {
      // A captured pointer continues to drive the capturing component (e.g. a
      // Slider drag). Raycast the captured component alone so the dispatched
      // event carries a uv local to THAT component — not the uv of whatever
      // neighbouring component the ray happens to graze when the pointer drifts
      // off-target. Without this, a Slider drag whose ray slips onto an
      // adjacent row would jump to that row's local fraction. When the pointer
      // leaves the captured component entirely, the miss yields no uv and the
      // control's own guard leaves the value unchanged (no jump, value holds).
      const capturedHits = raycaster.intersectObject(captured, false);
      const capturedHit = capturedHits.length > 0 ? capturedHits[0] : null;
      captured.dispatchEvent({
        type: 'pointermove',
        pointerId,
        ...(capturedHit || {}),
      } as unknown as Parameters<Component['dispatchEvent']>[0]);
    }

    if (current !== this._lastHoveredComponent) {
      if (this._lastHoveredComponent) {
        this._lastHoveredComponent.dispatchEvent({
          type: 'pointerout',
          pointerId,
        } as unknown as Parameters<Component['dispatchEvent']>[0]);
        this._lastHoveredComponent.dispatchEvent({
          type: 'pointerleave',
          pointerId,
        } as unknown as Parameters<Component['dispatchEvent']>[0]);
      }
      if (current) {
        current.dispatchEvent({
          type: 'pointerover',
          pointerId,
          ...(hit || {}),
        } as unknown as Parameters<Component['dispatchEvent']>[0]);
        current.dispatchEvent({
          type: 'pointerenter',
          pointerId,
          ...(hit || {}),
        } as unknown as Parameters<Component['dispatchEvent']>[0]);
      }
      this._lastHoveredComponent = current;
    } else if (current && !captured) {
      current.dispatchEvent({
        type: 'pointermove',
        pointerId,
        ...hit,
      } as unknown as Parameters<Component['dispatchEvent']>[0]);
    }
  }

  handlePointerUp(raycaster: THREE.Raycaster, pointer: PointerLike): void {
    const root = this._findUIRoot();
    if (root) {
      root.handlePointerUp(raycaster, pointer.index ?? 0);
      return;
    }

    const pointerId = pointer.index ?? 0;

    // Handle grab rail release (P1-U3)
    if (this._isGrabbed && this._grabPointerId === pointerId) {
      this.handleGrabEnd();
      return;
    }

    const captured = this._capturedPointers.get(pointerId);
    this._capturedPointers.delete(pointerId);

    const hits = raycaster.intersectObject(this, true);
    const hit = hits.find(h => h.object instanceof Component);
    const current = hit ? (hit.object as Component) : null;

    const target = captured || current;
    if (target) {
      target.dispatchEvent({
        type: 'pointerup',
        pointerId,
        ...(hit || {}),
      } as unknown as Parameters<Component['dispatchEvent']>[0]);

      if (captured === current && current) {
        current.dispatchEvent({
          type: 'click',
          pointerId,
          ...(hit || {}),
        } as unknown as Parameters<Component['dispatchEvent']>[0]);
      }
    }
  }

  override dispose(): void {
    super.dispose();
    if (this.parent) {
      this.parent.remove(this);
    }
    this._torsoAnchor = null;
    this._worldScene = null;
  }
}
