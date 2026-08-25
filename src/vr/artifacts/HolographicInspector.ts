import * as THREE from 'three';
import type { EngineLike, PointerLike, Updatable } from '../coordinators/types.ts';

export interface HolographicInspectorOptions {
  width?: number;
  height?: number;
  worldSize?: [number, number];
  offsetX?: number;
  offsetY?: number;
  offsetZ?: number;
  followSpeed?: number;
  dismissFlickThreshold?: number;
  lookAwayThreshold?: number;
}

/**
 * A gravity-glove-style holographic data inspector.
 *
 * Appears near the user's active pointer hand when a data node is selected,
 * follows the hand smoothly, always faces the user, and can be dismissed with
 * a quick flick or by looking away. Inspired by Half-Life: Alyx gravity-glove
 * tooltips and No Man's Sky holographic cockpit readouts.
 */
export class HolographicInspector implements Updatable {
  engine: EngineLike;
  camera: THREE.Camera | undefined;
  cameraGroup: THREE.Group | undefined;

  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  material: THREE.MeshBasicMaterial;
  mesh: THREE.Mesh;

  active: boolean;
  data: Record<string, unknown> | null;
  title: string;

  // Smooth follow state.
  targetPosition: THREE.Vector3;
  targetQuaternion: THREE.Quaternion;
  currentHandPos: THREE.Vector3;
  currentHandDir: THREE.Vector3;
  lookAwayTimer: number;
  lastPointerDir: THREE.Vector3;

  followSpeed: number;
  offset: THREE.Vector3;
  dismissFlickThreshold: number;
  lookAwayThreshold: number;

  pointer: PointerLike | null;

  private _cameraPos: THREE.Vector3;
  private _cameraDir: THREE.Vector3;
  private _handPos: THREE.Vector3;
  private _handQuat: THREE.Quaternion;
  private _handDir: THREE.Vector3;
  private _tmpVec: THREE.Vector3;
  private _tmpQuat: THREE.Quaternion;
  private _tmpMat: THREE.Matrix4;

  constructor(engine: EngineLike, options: HolographicInspectorOptions = {}) {
    this.engine = engine;
    this.camera = engine?.camera;
    this.cameraGroup = engine?.cameraGroup;

    this.canvas = document.createElement('canvas');
    this.canvas.width = options.width ?? 512;
    this.canvas.height = options.height ?? 384;
    this.ctx = (this.canvas.getContext('2d') || this._createMockContext()) as CanvasRenderingContext2D;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;

    const worldSize = options.worldSize ?? [0.6, 0.45];
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(worldSize[0], worldSize[1]), this.material);
    this.mesh.name = 'holographic-inspector';
    this.mesh.visible = false;
    // Reference frame: WORLD_LOCKED transient whose pose follows the active hand
    // each frame in world space (UX spec §5 "Holographic Inspector"). Callers
    // must mount() into the scene — never parent to the camera rig, or the
    // world-space targets assigned in update() would drift under locomotion.

    this.active = false;
    this.data = null;
    this.title = '';

    this.targetPosition = new THREE.Vector3();
    this.targetQuaternion = new THREE.Quaternion();
    this.currentHandPos = new THREE.Vector3();
    this.currentHandDir = new THREE.Vector3(0, 0, -1);
    this.lookAwayTimer = 0;
    this.lastPointerDir = new THREE.Vector3();

    this.followSpeed = options.followSpeed ?? 8;
    this.offset = new THREE.Vector3(
      options.offsetX ?? 0.12,
      options.offsetY ?? 0.18,
      options.offsetZ ?? -0.25
    );
    this.dismissFlickThreshold = options.dismissFlickThreshold ?? 2.5;
    this.lookAwayThreshold = options.lookAwayThreshold ?? 0.8;

    this._cameraPos = new THREE.Vector3();
    this._cameraDir = new THREE.Vector3();
    this._handPos = new THREE.Vector3();
    this._handQuat = new THREE.Quaternion();
    this._handDir = new THREE.Vector3();
    this._tmpVec = new THREE.Vector3();
    this._tmpQuat = new THREE.Quaternion();
    this._tmpMat = new THREE.Matrix4();

    this.pointer = null;
  }

  mount(scene: { add(object: THREE.Object3D): void }): void {
    scene.add(this.mesh);
  }

  /**
   * Show the inspector attached to a node and its selection pointer.
   */
  showAtNode(
    nodeMesh: THREE.Object3D | null,
    data: Record<string, unknown> | null,
    pointer: PointerLike | null = null,
    title = 'DATA NODE'
  ): void {
    this.data = data;
    this.title = title;
    this.active = true;
    this.mesh.visible = true;
    this.lookAwayTimer = 0;

    if (nodeMesh) {
      nodeMesh.getWorldPosition(this.targetPosition);
      this.mesh.position.copy(this.targetPosition).add(this._tmpVec.set(0, 0.4, 0));
    }

    this.pointer = pointer;
    this.render();
    this._playOpenFeedback(nodeMesh);
  }

  hide(): void {
    if (!this.active) return;
    this.active = false;
    this.mesh.visible = false;
    this.pointer = null;
    this._playCloseFeedback();
  }

  update(delta: number, time: number): void {
    if (!this.active || !this.camera) return;

    this._updateTargetFromPointer();

    // Smooth position.
    const speed = Math.min(1, this.followSpeed * delta);
    this.mesh.position.lerp(this.targetPosition, speed);

    // Face the user's head.
    this.camera.getWorldPosition(this._cameraPos);
    this.mesh.lookAt(this._cameraPos);

    // Dismiss on look-away or flick.
    if (this._shouldDismiss(delta)) {
      this.hide();
      return;
    }

    // Subtle hover breathe.
    this.mesh.position.y += Math.sin(time * 2) * 0.001;

    this.lastPointerDir.copy(this.currentHandDir);
  }

  private _updateTargetFromPointer(): void {
    const pointer = this.pointer;
    if (!pointer || !this.cameraGroup) {
      // No active pointer: stay roughly where we are, facing user.
      this.targetPosition.copy(this.mesh.position);
      return;
    }

    if (pointer.getWorldPosition) {
      pointer.getWorldPosition(this._handPos);
    } else if (pointer.rayOrigin) {
      this._handPos.copy(pointer.rayOrigin as unknown as THREE.Vector3);
    } else {
      this._handPos.copy(this.mesh.position);
    }

    if (pointer.getHandTransform) {
      pointer.getHandTransform(this._handPos, this._handQuat);
      this._handDir.set(0, 0, -1).applyQuaternion(this._handQuat).normalize();
    } else if (pointer.rayDirection) {
      this._handDir.copy(pointer.rayDirection as unknown as THREE.Vector3);
    } else {
      this._handDir.set(0, 0, -1);
    }

    this.currentHandPos.copy(this._handPos);
    this.currentHandDir.copy(this._handDir);

    // Convert hand-local offset to world space.
    this._tmpMat.identity();
    this._tmpMat.makeRotationFromQuaternion(
      this._tmpQuat.setFromUnitVectors(new THREE.Vector3(0, 0, -1), this._handDir)
    );
    const worldOffset = this._tmpVec.copy(this.offset).applyMatrix4(this._tmpMat);
    this.targetPosition.copy(this._handPos).add(worldOffset);
  }

  private _shouldDismiss(delta: number): boolean {
    // Flick: rapid downward change in pointing direction.
    if (this.currentHandDir.lengthSq() > 0 && this.lastPointerDir.lengthSq() > 0) {
      const dirDelta = this.currentHandDir.y - this.lastPointerDir.y;
      const speed = Math.abs(dirDelta) / Math.max(1e-6, delta);
      if (speed > this.dismissFlickThreshold && dirDelta < -0.2) {
        return true;
      }
    }

    // Look-away: user keeps pointing away from the inspected node for too long.
    if (this.targetPosition && this._cameraPos) {
      const toInspector = this._tmpVec.subVectors(this.targetPosition, this._cameraPos).normalize();
      this.camera?.getWorldDirection(this._cameraDir);
      const gazeDot = toInspector.dot(this._cameraDir);
      if (gazeDot < 0.25) {
        this.lookAwayTimer += delta;
      } else {
        this.lookAwayTimer = Math.max(0, this.lookAwayTimer - delta);
      }
      if (this.lookAwayTimer > this.lookAwayThreshold) {
        return true;
      }
    }

    return false;
  }

  render(): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Background.
    ctx.fillStyle = 'rgba(4, 12, 24, 0.85)';
    ctx.fillRect(0, 0, w, h);

    // Scanlines.
    ctx.fillStyle = 'rgba(0, 255, 204, 0.04)';
    for (let y = 0; y < h; y += 6) {
      ctx.fillRect(0, y, w, 2);
    }

    // Border.
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 5;
    ctx.strokeRect(10, 10, w - 20, h - 20);

    // Header bar.
    ctx.fillStyle = 'rgba(0, 255, 204, 0.15)';
    ctx.fillRect(10, 10, w - 20, 52);

    // Title.
    ctx.font = 'bold 26px monospace';
    ctx.fillStyle = '#00ffcc';
    ctx.shadowColor = '#00ffcc';
    ctx.shadowBlur = 8;
    ctx.textAlign = 'left';
    ctx.fillText(`// ${this.title}`, 26, 46);
    ctx.shadowBlur = 0;

    // Category badge (if present).
    const category = this.data?.category ?? this.data?.type ?? '';
    if (category) {
      const badgeW = ctx.measureText(String(category)).width + 24;
      ctx.fillStyle = 'rgba(255, 0, 85, 0.85)';
      ctx.fillRect(w - badgeW - 18, 18, badgeW, 34);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.font = 'bold 18px monospace';
      ctx.fillText(String(category), w - badgeW / 2 - 18, 42);
      ctx.textAlign = 'left';
    }

    // Fields.
    const entries = Object.entries(this.data ?? {});
    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = '#88ccff';
    let y = 92;
    const lineHeight = 30;
    const maxRows = Math.floor((h - y - 40) / lineHeight);
    for (let i = 0; i < entries.length && i < maxRows; i++) {
      const [key, value] = entries[i];
      ctx.fillStyle = '#00ffcc';
      ctx.fillText(`${key}`, 26, y);
      const valueText = String(value).slice(0, 20);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'right';
      ctx.fillText(valueText, w - 26, y);
      ctx.textAlign = 'left';
      y += lineHeight;
    }

    // Hint footer.
    ctx.fillStyle = 'rgba(0, 255, 204, 0.5)';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('look away or flick wrist to dismiss', w / 2, h - 18);
    ctx.textAlign = 'left';

    this.texture.needsUpdate = true;
  }

  private _playOpenFeedback(nodeMesh: THREE.Object3D | null): void {
    const fb = this.engine?.input?.feedback;
    if (!fb) return;
    const volume = fb.volume ?? 0.15;
    fb.playTone?.({ frequency: 990, duration: 0.06, shape: 'sine', volume });
    setTimeout(
      () => fb.playTone?.({ frequency: 1320, duration: 0.08, shape: 'sine', volume }),
      50
    );
    if (nodeMesh) {
      fb.showHitMarker?.(
        this.engine.scene as unknown as THREE.Scene,
        nodeMesh.getWorldPosition(this._tmpVec),
        0x00ffcc,
        220
      );
    }
  }

  private _playCloseFeedback(): void {
    const fb = this.engine?.input?.feedback;
    if (!fb) return;
    const volume = fb.volume ?? 0.15;
    fb.playTone?.({ frequency: 660, duration: 0.08, shape: 'sine', volume: volume * 0.7 });
  }

  private _createMockContext(): Partial<CanvasRenderingContext2D> {
    const noOp = () => {};
    return {
      clearRect: noOp,
      fillRect: noOp,
      strokeRect: noOp,
      beginPath: noOp,
      arc: noOp,
      fill: noOp,
      fillText: noOp,
      measureText: () => ({ width: 0 } as TextMetrics),
      set fillStyle(_value: string) {},
      set strokeStyle(_value: string) {},
      set lineWidth(_value: number) {},
      set font(_value: string) {},
      set textAlign(_value: CanvasTextAlign) {},
      set shadowColor(_value: string) {},
      set shadowBlur(_value: number) {},
    };
  }
}
