import * as THREE from 'three';
import { Container, Component, type ContainerProperties } from '@pmndrs/uikit';
import { SpatialUIRoot } from './SpatialUIRoot.ts';
import type { PointerLike } from '../coordinators/types.ts';

export type SpatialPanelReferenceFrame = 'BODY_LOCKED' | 'WORLD_LOCKED';

export class SpatialPanel extends Container {
  private _referenceFrame: SpatialPanelReferenceFrame = 'BODY_LOCKED';
  private _torsoAnchor: THREE.Object3D | null = null;
  private _worldScene: THREE.Object3D | null = null;

  // Damping/Interpolation targets
  private _targetPosition: THREE.Vector3 = new THREE.Vector3();
  private _targetQuaternion: THREE.Quaternion = new THREE.Quaternion();
  private _isLerping = false;
  private _lerpSpeed = 8; // Rad/s or units/s speed

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
  }

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

    const hits = raycaster.intersectObject(this, true);
    if (hits.length === 0) return null;

    const hit = hits.find(h => h.object instanceof Component);
    if (!hit) return null;

    const component = hit.object as Component;
    const pointerId = pointer.index ?? 0;

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
