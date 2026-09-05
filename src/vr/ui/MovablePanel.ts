import * as THREE from 'three';
import { CanvasTextureCacheManager } from './CanvasTextureCacheManager.ts';
import { COLOR_TOKENS, cssHex } from '../ui-system/tokens.ts';
import {
  beginBodyFramePanelDrag,
  endBodyFramePanelDrag,
  getBodyFrameViewerTargetLocal,
} from '../spatial/BodyFrameState.ts';
import type {
  AccessibilityOptions,
  DragState,
  IPanelContentHandler,
  MovablePanelOptions,
  PointerLike,
} from '../coordinators/types.ts';

interface InternalDragState extends DragState {
  planePoint?: THREE.Vector3;
  planeNormal?: THREE.Vector3;
}

export interface PanelCameraGroup extends THREE.Group {
  engine?: {
    telemetry?: {
      recordPanelAction?(title: string, action: string): void;
    };
    uiManager?: {
      panelManager?: {
        showLauncher?(): void;
      };
    };
  };
}

/**
 * Base class for analyst-anchored VR panels that can be dragged by a
 * controller ray, minimized/restored, and placed in depth-aware space.
 */
export class MovablePanel implements IPanelContentHandler {
  private static _textureCacheManager: CanvasTextureCacheManager | null = null;
  private _renderGeneration = 0;
  cameraGroup: PanelCameraGroup;
  parentGroup: THREE.Group | null;
  renderContent?(ctx: CanvasRenderingContext2D, width: number, height: number): void;
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

  scrollOffset: number;
  totalContentHeight: number;
  scrollbarWidth: number;

  private _disposed = false;
  private readonly _readingTargetLocal = new THREE.Vector3();
  private readonly _dragRay = new THREE.Ray();
  private readonly _dragTarget = new THREE.Vector3();
  private readonly _localTarget = new THREE.Vector3();
  private readonly _parentInverse = new THREE.Matrix4();
  private readonly _meshWorldQuaternion = new THREE.Quaternion();

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
    this.mesh.rotation.order = 'YXZ';

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

    this.scrollOffset = 0;
    this.totalContentHeight = 0;
    this.scrollbarWidth = 32;

    this._orientTowardBodyFrame();
    this._resizeMinimizeButton();
    this.render();
  }

  scroll(deltaY: number): void {
    const containerH = this.height - this.titleBarHeight - 4;
    const maxScroll = Math.max(0, this.totalContentHeight - containerH);
    if (maxScroll <= 0) return;
    this.scrollOffset = Math.max(0, Math.min(maxScroll, this.scrollOffset + deltaY));
    this.render();
  }

  /** Restore visibility without changing the user-authored placement. */
  show(): void {
    this.mesh.visible = true;
    this.isMinimized = false;
    this._orientTowardBodyFrame();
    this.render();
    this.cameraGroup?.engine?.telemetry?.recordPanelAction?.(this.title, 'show');
  }

  /** Explicit reset operation; visibility restoration never implies recentering. */
  resetToDefaultPosition(): void {
    this.mesh.position.copy(this.defaultPosition);
    this._clampDistance();
    this._orientTowardBodyFrame();
    this.cameraGroup?.engine?.telemetry?.recordPanelAction?.(this.title, 'reset-position');
  }

  hide(): void {
    if (this.drag.active) this._endDrag();
    this.mesh.visible = false;
    this.isMinimized = true;
    if (this.onHide) this.onHide();
    this.cameraGroup?.engine?.telemetry?.recordPanelAction?.(this.title, 'hide');
  }

  toggle(): void {
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
      this.hide();
      this.cameraGroup?.engine?.uiManager?.panelManager?.showLauncher?.();
      return 'minimize';
    }

    // Title bar drag.
    if (cy <= this.titleBarHeight) {
      this._startDrag(pointer, hits[0].point);
      this.cameraGroup?.engine?.telemetry?.recordPanelAction?.(this.title, 'drag-start');
      return 'drag';
    }

    // Scrollbar track hit testing
    const containerH = this.height - this.titleBarHeight - 4;
    const maxScroll = Math.max(0, this.totalContentHeight - containerH);
    if (maxScroll > 0) {
      const sbX = this.width - this.scrollbarWidth - 6;
      if (cx >= sbX) {
        const relativeY = cy - (this.titleBarHeight + 4);
        if (relativeY <= 32) {
          // Top scroll up button
          this.scroll(-70);
          return 'scroll';
        } else if (relativeY >= containerH - 32) {
          // Bottom scroll down button
          this.scroll(70);
          return 'scroll';
        } else {
          // Scrollbar thumb area click/drag
          const ratio = (relativeY - 32) / Math.max(1, containerH - 64);
          this.scrollOffset = Math.max(0, Math.min(maxScroll, ratio * maxScroll));
          this.render();
          return 'scroll';
        }
      }
    }

    if (typeof this.handleContentClick === 'function') {
      try {
        this.handleContentClick(worldRaycaster);
      } catch (e) {
        console.error('[MovablePanel] handleContentClick error:', e);
      }
    }
    return 'content';
  }

  handleContentClick?(_worldRaycaster: THREE.Raycaster): void;

  /**
   * Keep a stable local reading yaw toward the body-frame viewer target. This is
   * deliberately local-space math: headset/world movement must not make a panel
   * counter-rotate toward the playspace origin.
   */
  update(_delta?: number): void {
    if (!this.mesh || !this.mesh.visible) return;
    this._orientTowardBodyFrame();
  }

  handlePointerMove(_worldRaycaster: THREE.Raycaster, pointer: PointerLike): void {
    if (!this.drag.active || this.drag.pointer !== pointer) return;
    const target = this._resolveDragTarget(pointer);
    if (!target) return;
    this._applyDragTarget(target);
  }

  handlePointerUp(_worldRaycaster: THREE.Raycaster, pointer: PointerLike): void {
    if (!this.drag.active || this.drag.pointer !== pointer) return;
    // Commit the exact final pointer target before closing the grab. The old
    // smoothed path stopped short of the release point.
    const target = this._resolveDragTarget(pointer);
    if (target) this._applyDragTarget(target);
    this._endDrag();
  }

  _resizeMinimizeButton(): void {
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

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    if (this.drag.active) this._endDrag();
    this.mesh.parent?.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
    this.canvas.width = 1;
    this.canvas.height = 1;
  }

  render(): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    const bg = cssHex(this.highContrast ? COLOR_TOKENS.space.void : COLOR_TOKENS.surface.base);
    const border = cssHex(this.highContrast ? COLOR_TOKENS.interaction.focus : COLOR_TOKENS.surface.border);
    const titleBg = cssHex(this.highContrast ? COLOR_TOKENS.surface.raised : COLOR_TOKENS.surface.raised);
    const textColor = cssHex(this.highContrast ? COLOR_TOKENS.text.primary : COLOR_TOKENS.text.primary);
    const accent = cssHex(COLOR_TOKENS.interaction.focus);

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = border;
    ctx.lineWidth = 2 * this.textScale;
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
    ctx.fillStyle = cssHex(COLOR_TOKENS.danger.destructive);
    ctx.fillRect(mb.x, mb.y, mb.w, mb.h);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(16 * this.textScale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('—', mb.x + mb.w / 2, mb.y + mb.h / 2);
    ctx.textAlign = 'left';

    const containerH = h - this.titleBarHeight - 4;
    const maxScroll = Math.max(0, this.totalContentHeight - containerH);
    if (this.scrollOffset > maxScroll) this.scrollOffset = maxScroll;

    if (typeof this.renderContent === 'function') {
      try {
        if (typeof ctx?.save === 'function') ctx.save();
        if (typeof ctx?.translate === 'function') ctx.translate(0, this.titleBarHeight + 4);

        // Clip content viewport if scrollbar is active
        if (maxScroll > 0 && typeof ctx?.beginPath === 'function') {
          ctx.beginPath();
          ctx.rect(0, 0, w - this.scrollbarWidth - 10, containerH);
          ctx.clip();
          ctx.translate(0, -this.scrollOffset);
        }

        this.renderContent(ctx, maxScroll > 0 ? w - this.scrollbarWidth - 10 : w, containerH);
        if (typeof ctx?.restore === 'function') ctx.restore();
      } catch {
        if (typeof ctx?.restore === 'function') {
          try {
            ctx.restore();
          } catch {
            /* ignore nested restore failure */
          }
        }
      }
    }

    // Render scrollbar track and thumb if content overflows
    if (maxScroll > 0) {
      const sbX = w - this.scrollbarWidth - 6;
      const sbY = this.titleBarHeight + 4;
      const sbW = this.scrollbarWidth;
      const sbH = containerH;

      // Track background
      ctx.fillStyle = cssHex(COLOR_TOKENS.surface.base);
      ctx.fillRect(sbX, sbY, sbW, sbH);
      ctx.strokeStyle = cssHex(COLOR_TOKENS.surface.border);
      ctx.lineWidth = 2;
      ctx.strokeRect(sbX, sbY, sbW, sbH);

      // Up scroll button (▲)
      ctx.fillStyle = cssHex(COLOR_TOKENS.surface.raised);
      ctx.fillRect(sbX + 2, sbY + 2, sbW - 4, 28);
      ctx.fillStyle = cssHex(COLOR_TOKENS.interaction.focus);
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('▲', sbX + sbW / 2, sbY + 16);

      // Down scroll button (▼)
      ctx.fillStyle = cssHex(COLOR_TOKENS.surface.raised);
      ctx.fillRect(sbX + 2, sbY + sbH - 30, sbW - 4, 28);
      ctx.fillStyle = cssHex(COLOR_TOKENS.interaction.focus);
      ctx.fillText('▼', sbX + sbW / 2, sbY + sbH - 16);

      // Thumb
      const thumbAreaH = sbH - 64;
      const thumbH = Math.max(36, (containerH / this.totalContentHeight) * thumbAreaH);
      const thumbY =
        sbY +
        32 +
        (maxScroll > 0 ? (this.scrollOffset / maxScroll) * (thumbAreaH - thumbH) : 0);

      ctx.fillStyle = cssHex(COLOR_TOKENS.interaction.focus);
      ctx.fillRect(sbX + 4, thumbY, sbW - 8, thumbH);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(sbX + 4, thumbY, sbW - 8, thumbH);
      ctx.textAlign = 'left';
    }

    this._renderGeneration++;
    const stateSig = `${this.title}:${this._renderGeneration}:${this.scrollOffset}:${this.totalContentHeight}:${this.textScale}:${this.highContrast}:${this.colorblindMode}:${this.isMinimized}`;
    if (!MovablePanel._textureCacheManager) {
      MovablePanel._textureCacheManager = new CanvasTextureCacheManager();
    }
    MovablePanel._textureCacheManager.shouldUpdateTexture(this.title, stateSig, this.texture);
  }

  _startDrag(pointer: PointerLike, hitPoint: THREE.Vector3): void {
    if (this.drag.active) return;
    const worldRay = pointer.getRay(this._dragRay);
    const distance = hitPoint.distanceTo(worldRay.origin);

    this.drag.active = true;
    this.drag.pointer = pointer;
    // Preserve the actual grab depth. Free-floating manipulation uses this as a
    // ray parameter, so moving the hand/controller in 3D moves the panel in 3D.
    this.drag.distance = Math.max(0.05, distance);

    if (!this.drag.planePoint) this.drag.planePoint = new THREE.Vector3();
    if (!this.drag.planeNormal) this.drag.planeNormal = new THREE.Vector3(0, 0, 1);

    this.drag.planePoint.copy(hitPoint);
    this.mesh.updateWorldMatrix(true, false);
    this.mesh.getWorldQuaternion(this._meshWorldQuaternion);
    this.drag.planeNormal.set(0, 0, 1).applyQuaternion(this._meshWorldQuaternion).normalize();

    const localGrabPoint = this._worldToParentLocal(hitPoint, this._localTarget);
    this.drag.offset.subVectors(this.mesh.position, localGrabPoint);
    this.drag.lastTarget.copy(hitPoint);
    beginBodyFramePanelDrag(this.parentGroup);
  }

  _endDrag(): void {
    const wasActive = this.drag.active;
    if (!wasActive) return;

    if (!this.onDragDelta) {
      // Safety bounds are a commit-time policy. Applying this every move creates
      // the rubber-band/jitter behavior that makes manipulation feel sticky.
      this._clampDistance();
      this._orientTowardBodyFrame();
    }

    this.drag.active = false;
    this.drag.pointer = null;
    this.drag.distance = 0;
    this.drag.offset.set(0, 0, 0);
    endBodyFramePanelDrag(this.parentGroup);
    if (this.onDragEnd) this.onDragEnd();
  }

  private _resolveDragTarget(pointer: PointerLike): THREE.Vector3 | null {
    const worldRay = pointer.getRay(this._dragRay);
    const rayDistance = this.drag.distance || 0.8;
    this._dragTarget
      .copy(worldRay.direction)
      .multiplyScalar(rayDistance)
      .add(worldRay.origin);

    // Production free-floating panels use a ray-parametric grab, which preserves
    // genuine 3D hand/controller translation including depth. Anchored-layout
    // mode reports deltas instead; for that legacy path use a stable plane whose
    // normal is the panel's own world normal captured at grab time.
    if (!this.onDragDelta) return this._dragTarget;
    return this._intersectDragPlane(worldRay) ?? this._dragTarget;
  }

  private _applyDragTarget(target: THREE.Vector3): void {
    if (this.onDragDelta) {
      const delta = this._localTarget.subVectors(target, this.drag.lastTarget);
      this.onDragDelta(delta);
      this.drag.lastTarget.copy(target);
      return;
    }

    const localTarget = this._worldToParentLocal(target, this._localTarget);
    this.mesh.position.copy(localTarget).add(this.drag.offset);
    this.drag.lastTarget.copy(target);
    this._orientTowardBodyFrame();
  }

  private _worldToParentLocal(worldPoint: THREE.Vector3, target: THREE.Vector3): THREE.Vector3 {
    target.copy(worldPoint);
    if (this.parentGroup && typeof this.parentGroup.updateMatrixWorld === 'function') {
      this.parentGroup.updateMatrixWorld(true);
      this._parentInverse.copy(this.parentGroup.matrixWorld).invert();
      target.applyMatrix4(this._parentInverse);
    }
    return target;
  }

  private _orientTowardBodyFrame(): void {
    getBodyFrameViewerTargetLocal(this.parentGroup, this._readingTargetLocal);
    const dx = this._readingTargetLocal.x - this.mesh.position.x;
    const dz = this._readingTargetLocal.z - this.mesh.position.z;
    const yaw = dx * dx + dz * dz > 1e-8 ? Math.atan2(dx, dz) : this.mesh.rotation.y;
    this.mesh.rotation.set(-this.tilt, yaw, 0, 'YXZ');
  }

  /**
   * Intersect the pointer ray with the stable panel-parallel drag plane stored
   * at drag start. This path is used by anchored-mode delta dragging.
   */
  _intersectDragPlane(worldRay: THREE.Ray): THREE.Vector3 | null {
    if (!this.drag.planePoint || !this.drag.planeNormal) return null;

    const denom = worldRay.direction.dot(this.drag.planeNormal);
    if (Math.abs(denom) < 1e-6) return null;

    const toPlane = this._localTarget.subVectors(this.drag.planePoint, worldRay.origin);
    const t = toPlane.dot(this.drag.planeNormal) / denom;
    if (t < 0) return null;

    return this._dragTarget.copy(worldRay.direction).multiplyScalar(t).add(worldRay.origin);
  }

  _clampDistance(): void {
    const pos = this.mesh.position;
    const dist = pos.length();
    if (dist >= this.minDistance && dist <= this.maxDistance) return;
    const target = Math.min(Math.max(dist, this.minDistance), this.maxDistance);
    if (dist === 0) {
      pos.set(0, 0, -target);
      return;
    }
    pos.multiplyScalar(target / dist);
  }

  _scaleFont(
    sizeOrFont: number | string,
    weight = 'normal',
    family = '"Courier New", Courier, monospace'
  ): string {
    if (typeof sizeOrFont === 'number') {
      const scaled = Math.round(sizeOrFont * this.textScale);
      return `${weight} ${scaled}px ${family}`;
    }
    if (typeof sizeOrFont === 'string') {
      return sizeOrFont.replace(
        /(\d+)px/g,
        (_, px) => `${Math.round(parseInt(px, 10) * this.textScale)}px`
      );
    }
    return String(sizeOrFont);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  remapColor(colorOrVal?: unknown, _extra?: unknown): any {
    if (typeof colorOrVal === 'number') {
      if (!this.highContrast) return colorOrVal;
      if (colorOrVal === 0x00ffcc || colorOrVal === 0x00ccaa) return 0x00ffff;
      if (colorOrVal === 0xff0055 || colorOrVal === 0xff3366) return 0xff3300;
      return colorOrVal;
    }
    if (typeof colorOrVal === 'string') {
      if (!this.highContrast) return colorOrVal;
      if (colorOrVal === '#00ffcc' || colorOrVal === '#00ccaa') return '#00ffff';
      if (colorOrVal === '#ff0055' || colorOrVal === '#ff3366') return '#ff3300';
      if (colorOrVal === '#0b1626') return '#000000';
      if (colorOrVal === '#e0f7ff') return '#ffffff';
      return colorOrVal;
    }
    return 0x00ffcc;
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
