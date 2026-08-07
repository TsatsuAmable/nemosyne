import * as THREE from 'three';
import type {
  AccessibilityOptions,
  DragState,
  MovablePanelOptions,
  PointerLike,
} from '../coordinators/types.ts';

/**
 * Base class for analyst-anchored VR panels that can be dragged by a
 * controller ray, minimized/restored, and placed in depth-aware space.
 *
 * The panel is parented to an optional `parentGroup` (defaults to the
 * cameraGroup). This lets HUD panels cluster around an explicit analyst
 * anchor rather than drifting in world space.
 *
 * Improvements:
 *  - Panels are tilted slightly (like a desk or HUD surface) so they do not
 *    feel like a flat 2D sheet floating in air.
 *  - Dragging uses a depth-sampling plane that keeps the panel at the same
 *    Z distance from the viewer, preventing it from being pulled into the face
 *    or pushed behind the user.
 *  - A close/minimize button is joined by a restore button when minimized.
 *  - `toggle()` and `show()` maintain an independent visible state.
 */
export class MovablePanel {
  cameraGroup: THREE.Group;
  parentGroup: THREE.Group | null;
  title: string;
  width: number;
  height: number;
  worldSize: [number, number];
  titleBarHeight: number;
  contentPadding: number;
  tilt: number;
  minDistance: number;
  maxDistance: number;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  material: THREE.MeshBasicMaterial;
  mesh: THREE.Mesh;
  textScale: number;
  highContrast: boolean;
  colorblindMode: string | boolean;
  defaultPosition: THREE.Vector3;
  drag: DragState;
  onDragDelta: ((delta: THREE.Vector3) => void) | null;
  onDragEnd: (() => void) | null;
  onHide: (() => void) | null;
  isMinimized: boolean;
  minimizeBtn: { x: number; y: number; w: number; h: number };

  private _matrix: THREE.Matrix4;
  private _quat: THREE.Quaternion;

  constructor(cameraGroup: THREE.Group, options: MovablePanelOptions = {}) {
    const {
      title = 'PANEL',
      width = 800,
      height = 480,
      position = [0, 1.5, -1.2],
      worldSize = [1.1, 0.66],
      titleBarHeight = 44,
      contentPadding = 18,
      tilt = 0.22,
      minDistance = 0.5,
      maxDistance = 2.0,
      parentGroup = null,
      textScale = 1,
      highContrast = false,
      colorblindMode = 'none',
    } = options;

    this.cameraGroup = cameraGroup;
    this.parentGroup = parentGroup ?? cameraGroup;
    this.title = title;
    this.width = width;
    this.height = height;
    this.worldSize = worldSize;
    this.titleBarHeight = titleBarHeight;
    this.contentPadding = contentPadding;
    this.tilt = tilt;
    this.minDistance = minDistance;
    this.maxDistance = maxDistance;

    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d') ?? this._createMockContext();

    this.textScale = textScale;
    this.highContrast = highContrast;
    this.colorblindMode = colorblindMode;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;

    const geom = new THREE.PlaneGeometry(worldSize[0], worldSize[1]);
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(geom, this.material);
    this.mesh.position.set(...position);
    this.mesh.rotation.x = -tilt;
    if (this.parentGroup) this.parentGroup.add(this.mesh);

    this.defaultPosition = new THREE.Vector3(...position);

    this.drag = {
      active: false,
      pointer: null,
      distance: 0,
      offset: new THREE.Vector3(),
      lastTarget: new THREE.Vector3(),
    };

    /** Optional callback(deltaWorld) invoked during title-bar drag. */
    this.onDragDelta = null;

    /** Optional callback invoked when a drag ends. */
    this.onDragEnd = null;

    /** Optional callback invoked when the panel is hidden/minimized. */
    this.onHide = null;

    this.isMinimized = false;

    // Window controls in canvas coordinates (top-right corner).
    const btnSize = 40 * this.textScale;
    this.minimizeBtn = {
      x: width - btnSize - 4,
      y: 4,
      w: btnSize,
      h: btnSize - 4,
    };

    this._matrix = new THREE.Matrix4();
    this._quat = new THREE.Quaternion();
  }

  show() {
    this.isMinimized = false;
    this.mesh.visible = true;
    this.mesh.rotation.x = -this.tilt;
    this.mesh.position.copy(this.defaultPosition);
    this._clampDistance();
    this.render();
  }

  hide() {
    this.mesh.visible = false;
    this.isMinimized = true;
    this._endDrag();
    if (this.onHide) this.onHide();
  }

  toggle() {
    if (this.mesh.visible) this.hide();
    else this.show();
  }

  /** Called when the pointer intersects the panel on a down event. */
  handlePointerDown(worldRaycaster: THREE.Raycaster, pointer: PointerLike): string | null {
    if (!this.mesh.visible) return null;

    const hits = worldRaycaster.intersectObject(this.mesh, false);
    if (hits.length === 0) return null;

    const uv = hits[0].uv;
    if (!uv) return null;
    const cx = uv.x * this.width;
    const cy = (1 - uv.y) * this.height;

    // Minimize button.
    const mb = this.minimizeBtn;
    if (cx >= mb.x && cx <= mb.x + mb.w && cy >= mb.y && cy <= mb.y + mb.h) {
      this._endDrag();
      this.hide();
      return 'minimize';
    }

    // Title bar drag.
    if (cy <= this.titleBarHeight) {
      this._startDrag(pointer, hits[0].point);
      return 'drag';
    }

    // Content click handled by subclass.
    const consumed = this.handleContentClick(worldRaycaster);
    return consumed ? 'content' : null;
  }

  handlePointerMove(worldRaycaster: THREE.Raycaster, pointer: PointerLike): void {
    if (!this.drag.active || this.drag.pointer !== pointer) return;

    const worldRay = pointer.getRay(new THREE.Ray());
    const target = this._intersectDragPlane(worldRay);
    if (!target) return;

    if (this.onDragDelta) {
      const delta = new THREE.Vector3().subVectors(target, this.drag.lastTarget);
      this.onDragDelta(delta);
      this.drag.lastTarget.copy(target);
      return;
    }

    // Convert the world-space drag target into the panel's parent local space
    // so the mesh position is consistent regardless of where the camera rig is.
    const localTarget = target.clone();
    if (this.parentGroup) {
      this.parentGroup.updateMatrixWorld(true);
      localTarget.applyMatrix4(new THREE.Matrix4().copy(this.parentGroup.matrixWorld).invert());
    }
    this.mesh.position.copy(localTarget).add(this.drag.offset);
    this._clampDistance();
    // Keep panels facing the viewer (the parent group's origin in local space).
    this.mesh.lookAt(0, 0, 0);
    this.mesh.rotation.x = -this.tilt;
  }

  handlePointerUp(worldRaycaster: THREE.Raycaster, pointer: PointerLike): void {
    if (!this.drag.active || this.drag.pointer !== pointer) return;
    this._endDrag();
  }

  _resizeMinimizeButton() {
    const btnSize = 40 * this.textScale;
    this.minimizeBtn = {
      x: this.width - btnSize - 4,
      y: 4,
      w: btnSize,
      h: btnSize - 4,
    };
  }

  /** Update text scale and high-contrast state from global settings. */
  applyAccessibility(options: AccessibilityOptions): void {
    const { textScale, highContrast, colorblindMode } = options;
    let changed = false;
    if (textScale != null && this.textScale !== textScale) {
      this.textScale = textScale;
      changed = true;
    }
    if (highContrast != null && this.highContrast !== highContrast) {
      this.highContrast = highContrast;
      changed = true;
    }
    if (colorblindMode != null && this.colorblindMode !== colorblindMode) {
      this.colorblindMode = colorblindMode;
      changed = true;
    }
    if (changed) {
      this._resizeMinimizeButton();
      this.render();
    }
  }

  /** Remap a color through the panel's current colorblind mode. */
  remapColor(hex: number): number {
    if (!this.colorblindMode || this.colorblindMode === 'none') return hex;
    const mode = this.colorblindMode;
    if (typeof mode !== 'string') return hex;

    const palettes: Record<string, Record<string, number>> = {
      deuteranopia: { green: 0x0077ff, red: 0xaa00ff, cyan: 0x0077ff, magenta: 0xffdd00 },
      protanopia: { green: 0x00aaff, red: 0x8800cc, cyan: 0x00aaff, magenta: 0xffee33 },
      tritanopia: { green: 0x00ccff, red: 0xff6600, cyan: 0x00ffcc, magenta: 0xff0055 },
    };
    const palette = palettes[mode];
    if (!palette) return hex;

    const r = (hex >> 16) & 0xff;
    const g = (hex >> 8) & 0xff;
    const b = hex & 0xff;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max === 0) return hex;
    let hue = 0;
    if (max !== min) {
      const delta = max - min;
      if (max === r) hue = ((g - b) / delta + (g < b ? 6 : 0)) * 60;
      else if (max === g) hue = ((b - r) / delta + 2) * 60;
      else hue = ((r - g) / delta + 4) * 60;
    }
    let family = 'other';
    if (hue >= 90 && hue < 150) family = 'green';
    else if (hue >= 330 || hue < 20) family = 'red';
    else if (hue >= 160 && hue < 200) family = 'cyan';
    else if (hue >= 260 && hue < 320) family = 'magenta';
    return palette[family] ?? hex;
  }

  handleContentClick(_worldRaycaster: THREE.Raycaster): boolean {
    // Subclasses override.
    return false;
  }

  renderContent(_ctx: CanvasRenderingContext2D, _w: number, _contentH: number): void {
    // Subclasses override.
  }

  render(): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);

    // Background.
    ctx.fillStyle = 'rgba(10, 20, 40, 0.96)';
    ctx.fillRect(0, 0, w, h);

    // Title bar.
    ctx.fillStyle = this.highContrast ? 'rgba(255, 255, 255, 1)' : 'rgba(0, 80, 100, 0.9)';
    ctx.fillRect(0, 0, w, this.titleBarHeight);

    // Border.
    ctx.strokeStyle = this.highContrast ? '#ffffff' : '#00ffff';
    ctx.lineWidth = this.highContrast ? 8 : 6;
    ctx.strokeRect(4, 4, w - 8, h - 8);

    // Title text.
    ctx.font = this._scaleFont('bold 24px monospace');
    ctx.fillStyle = this.highContrast ? '#000000' : '#00ffff';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 10;
    ctx.textAlign = 'left';
    ctx.fillText(`// ${this.title}`, 14, 32);
    ctx.shadowBlur = 0;

    // Drag handle hint.
    ctx.fillStyle = this.highContrast ? '#000000' : '#00ffff';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(14 + i * 10, this.titleBarHeight - 10, 6, 3);
    }

    // Minimize button.
    const mb = this.minimizeBtn;
    ctx.fillStyle = this.highContrast ? '#ffffff' : 'rgba(0, 30, 40, 0.8)';
    ctx.fillRect(mb.x, mb.y, mb.w, mb.h);
    ctx.strokeStyle = this.highContrast ? '#000000' : '#00ffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(mb.x, mb.y, mb.w, mb.h);
    ctx.fillStyle = this.highContrast ? '#000000' : '#00ffff';
    ctx.font = this._scaleFont('bold 22px monospace');
    ctx.textAlign = 'center';
    ctx.fillText('−', mb.x + mb.w / 2, mb.y + 27);
    ctx.textAlign = 'left';

    // Content area.
    this.renderContent(ctx, w, h - this.titleBarHeight);

    this.texture.needsUpdate = true;
  }

  _scaleFont(font: string): string {
    return font.replace(
      /(\d+(?:\.\d+)?)\s*px/,
      (match: string, size: string) => `${(parseFloat(size) * this.textScale).toFixed(1)}px`
    );
  }

  _startDrag(pointer: PointerLike, hitPointWorld: THREE.Vector3): void {
    this.parentGroup?.updateMatrixWorld(true);

    // Sample distance from the analyst anchor origin at the moment of grab.
    const localHit = hitPointWorld.clone();
    if (this.parentGroup)
      localHit.applyMatrix4(new THREE.Matrix4().copy(this.parentGroup.matrixWorld).invert());
    const distance = Math.sqrt(localHit.x ** 2 + localHit.y ** 2 + localHit.z ** 2);

    this.drag.active = true;
    this.drag.pointer = pointer;
    this.drag.distance = Math.max(this.minDistance, Math.min(this.maxDistance, distance));
    this.drag.offset.set(0, 0, 0);

    // Compute an offset so the panel does not snap to the ray origin.
    const worldRay = pointer.getRay(new THREE.Ray());
    const planeHit = this._intersectDragPlane(worldRay);
    if (planeHit) {
      const localPlaneHit = planeHit.clone();
      if (this.parentGroup) {
        this.parentGroup.updateMatrixWorld(true);
        localPlaneHit.applyMatrix4(new THREE.Matrix4().copy(this.parentGroup.matrixWorld).invert());
      }
      this.drag.offset.subVectors(this.mesh.position, localPlaneHit);
      this.drag.lastTarget.copy(planeHit);
    }
  }

  _endDrag(): void {
    const wasActive = this.drag.active;
    this.drag.active = false;
    this.drag.pointer = null;
    this.drag.distance = 0;
    this.drag.offset.set(0, 0, 0);
    if (wasActive && this.onDragEnd) this.onDragEnd();
  }

  /**
   * Intersect the pointer ray with a plane facing the viewer at the stored
   * drag distance. This keeps the panel at a fixed depth while dragging.
   */
  _intersectDragPlane(worldRay: THREE.Ray): THREE.Vector3 | null {
    if (!this.parentGroup) {
      // No rig (test mode): intersect a plane at z = -distance.
      const denom = worldRay.direction.dot(new THREE.Vector3(0, 0, 1));
      if (Math.abs(denom) < 1e-6) return null;
      const t = (-this.drag.distance - worldRay.origin.z) / denom;
      if (t < 0) return null;
      return worldRay.origin.clone().add(worldRay.direction.clone().multiplyScalar(t));
    }

    this.parentGroup.updateMatrixWorld(true);
    const rigOrigin = new THREE.Vector3().setFromMatrixPosition(this.parentGroup.matrixWorld);
    const rigDir = new THREE.Vector3(0, 0, -1).applyQuaternion(
      this.parentGroup.getWorldQuaternion(new THREE.Quaternion())
    );

    const denom = worldRay.direction.dot(rigDir);
    if (Math.abs(denom) < 1e-6) return null;
    const toPlane = new THREE.Vector3().subVectors(rigOrigin, worldRay.origin);
    const t = (toPlane.dot(rigDir) + this.drag.distance) / denom;
    if (t < 0) return null;
    return worldRay.origin.clone().add(worldRay.direction.clone().multiplyScalar(t));
  }

  _clampDistance(): void {
    const pos = this.mesh.position;
    const dist = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z);
    if (dist >= this.minDistance && dist <= this.maxDistance) return;
    const target = Math.min(Math.max(dist, this.minDistance), this.maxDistance);
    if (dist === 0) {
      pos.set(0, 0, -target);
      return;
    }
    pos.multiplyScalar(target / dist);
  }

  _createMockContext(): CanvasRenderingContext2D {
    // Fallback for test environments where jsdom does not provide a real
    // 2D canvas context. Implements the subset of CanvasRenderingContext2D
    // used by MovablePanel and its subclasses.
    const noOp = () => {};
    return {
      clearRect: noOp,
      fillRect: noOp,
      strokeRect: noOp,
      beginPath: noOp,
      moveTo: noOp,
      lineTo: noOp,
      stroke: noOp,
      fillText: noOp,
      measureText: () => ({ width: 0 }),
      set fillStyle(_value: unknown) {},
      set strokeStyle(_value: unknown) {},
      set lineWidth(_value: unknown) {},
      set font(_value: unknown) {},
      set textAlign(_value: unknown) {},
      set shadowColor(_value: unknown) {},
      set shadowBlur(_value: unknown) {},
    } as unknown as CanvasRenderingContext2D;
  }
}
