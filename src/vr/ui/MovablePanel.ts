import * as THREE from 'three';
import type {
  AccessibilityOptions,
  DragState,
  MovablePanelOptions,
  PointerLike,
} from '../coordinators/types.ts';

interface InternalDragState extends DragState {
  planePoint?: THREE.Vector3;
  planeNormal?: THREE.Vector3;
}

/**
 * Base class for analyst-anchored VR panels that can be dragged by a
 * controller ray, minimized/restored, and placed in depth-aware space.
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
  drag: InternalDragState;
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
    if (this.parentGroup && typeof this.parentGroup.add === 'function') {
      this.parentGroup.add(this.mesh);
    }

    this.defaultPosition = new THREE.Vector3(...position);

    this.drag = {
      active: false,
      pointer: null,
      distance: 0,
      offset: new THREE.Vector3(),
      lastTarget: new THREE.Vector3(),
      planePoint: new THREE.Vector3(),
      planeNormal: new THREE.Vector3(0, 0, 1),
    };

    this.onDragDelta = null;
    this.onDragEnd = null;
    this.onHide = null;

    this.isMinimized = false;
    this.minimizeBtn = { x: 0, y: 0, w: 0, h: 0 };

    this._matrix = new THREE.Matrix4();
    this._quat = new THREE.Quaternion();

    this._resizeMinimizeButton();
    this.render();
  }

  show() {
    this.mesh.visible = true;
    this.isMinimized = false;
    this.render();
  }

  hide() {
    this.mesh.visible = false;
    this.isMinimized = true;
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

    return 'content';
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
    if (this.parentGroup && typeof this.parentGroup.updateMatrixWorld === 'function') {
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

  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    const bg = this.highContrast ? '#050a12' : '#0b1626';
    const border = this.highContrast ? '#00ffff' : '#00ccaa';
    const titleBg = this.highContrast ? '#0d1f38' : '#10243e';
    const textColor = this.highContrast ? '#ffffff' : '#e0f7ff';
    const accent = '#00ffcc';

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = border;
    ctx.lineWidth = 4 * this.textScale;
    ctx.strokeRect(2, 2, w - 4, h - 4);

    ctx.fillStyle = titleBg;
    ctx.fillRect(4, 4, w - 8, this.titleBarHeight);

    ctx.fillStyle = accent;
    ctx.fillRect(4, this.titleBarHeight + 2, w - 8, 2);

    ctx.fillStyle = textColor;
    const fontSize = Math.round(18 * this.textScale);
    ctx.font = `bold ${fontSize}px "Courier New", Courier, monospace`;
    ctx.textBaseline = 'middle';
    ctx.fillText(this.title.toUpperCase(), 16, this.titleBarHeight / 2 + 2);

    // Minimize button
    const mb = this.minimizeBtn;
    ctx.fillStyle = '#ff3366';
    ctx.fillRect(mb.x, mb.y, mb.w, mb.h);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(16 * this.textScale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('—', mb.x + mb.w / 2, mb.y + mb.h / 2);
    ctx.textAlign = 'left';

    this.texture.needsUpdate = true;
  }

  _startDrag(pointer: PointerLike, hitPoint: THREE.Vector3): void {
    const worldRay = pointer.getRay(new THREE.Ray());
    const distance = hitPoint.distanceTo(worldRay.origin);

    this.drag.active = true;
    this.drag.pointer = pointer;
    this.drag.distance = Math.max(this.minDistance, Math.min(this.maxDistance, distance));
    this.drag.offset.set(0, 0, 0);

    // Store stable 3D drag plane anchor and normal
    if (!this.drag.planePoint) this.drag.planePoint = new THREE.Vector3();
    if (!this.drag.planeNormal) this.drag.planeNormal = new THREE.Vector3(0, 0, 1);

    this.drag.planePoint.copy(hitPoint);
    this.drag.planeNormal.copy(worldRay.direction).negate();

    // Compute initial offset so the panel does not jump to the hit point
    const localPlaneHit = hitPoint.clone();
    if (this.parentGroup && typeof this.parentGroup.updateMatrixWorld === 'function') {
      this.parentGroup.updateMatrixWorld(true);
      localPlaneHit.applyMatrix4(new THREE.Matrix4().copy(this.parentGroup.matrixWorld).invert());
    }
    this.drag.offset.subVectors(this.mesh.position, localPlaneHit);
    this.drag.lastTarget.copy(hitPoint);
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
   * Intersect the pointer ray with the stable drag plane stored at drag start.
   * Solves: t = ((planePoint - rayOrigin) . planeNormal) / (rayDir . planeNormal)
   */
  _intersectDragPlane(worldRay: THREE.Ray): THREE.Vector3 | null {
    if (!this.drag.planePoint || !this.drag.planeNormal) return null;

    const denom = worldRay.direction.dot(this.drag.planeNormal);
    if (Math.abs(denom) < 1e-6) return null;

    const toPlane = new THREE.Vector3().subVectors(this.drag.planePoint, worldRay.origin);
    const t = toPlane.dot(this.drag.planeNormal) / denom;
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

  _scaleFont(size: number, weight = 'normal', font = '"Courier New", Courier, monospace'): string {
    const scaled = Math.round(size * this.textScale);
    return `${weight} ${scaled}px ${font}`;
  }

  remapColor(color: string): string {
    if (!this.highContrast) return color;
    if (color === '#00ffcc' || color === '#00ccaa') return '#00ffff';
    if (color === '#ff0055' || color === '#ff3366') return '#ff3300';
    if (color === '#0b1626') return '#000000';
    if (color === '#e0f7ff') return '#ffffff';
    return color;
  }

  _createMockContext(): CanvasRenderingContext2D {
    return {
      canvas: this.canvas,
      fillRect: () => {},
      strokeRect: () => {},
      fillText: () => {},
      measureText: () => ({ width: 100 }),
      beginPath: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => {},
    } as unknown as CanvasRenderingContext2D;
  }
}
