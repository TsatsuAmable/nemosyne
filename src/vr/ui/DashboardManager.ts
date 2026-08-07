import * as THREE from 'three';
import type { DashboardCell, DashboardPanelEntry, PanelLike } from '../coordinators/types.ts';

const DEFAULT_WALL_POS: [number, number, number] = [0, 1.6, 1.5];
const DEFAULT_COLUMNS = 3;
const DEFAULT_ROWS = 2;
const DEFAULT_CELL_WIDTH = 0.9;
const DEFAULT_CELL_HEIGHT = 0.7;
const SNAP_DISTANCE = 0.55;

const DEFAULT_LAYOUT_MODE = 'wall';
const DEFAULT_RADIUS = 1.35;
const DEFAULT_ARC_SPAN = Math.PI;
const DEFAULT_CENTER_ANGLE = 0;
const DEFAULT_HEIGHT_Y = 1.45;
const DEFAULT_ROW_PITCH = 0.75;
const DEFAULT_TILT = 0.12;
const SCROLL_LERP = 0.15;

type LayoutMode = 'wall' | 'semicircle';

interface DashboardOptions {
  analystAnchor?: THREE.Group;
  layoutMode?: LayoutMode;
  columns?: number;
  rows?: number;
  cellWidth?: number;
  cellHeight?: number;
  wallPosition?: [number, number, number];
  snapDistance?: number;
  autoScale?: boolean;
  radius?: number;
  arcSpan?: number;
  centerAngle?: number;
  heightY?: number;
  rowPitch?: number;
  tilt?: number;
  visibleColumns?: number;
}

/**
 * Spatial dashboard with two layout modes:
 *
 *  - `wall` (legacy): a flat grid behind the user with drag-to-snap cells.
 *  - `semicircle`: a curved, scrollable grid that wraps around the analyst in
 *    a front-facing arc. Extra panels live just outside the visible arc and
 *    roll into view with a swipe / thumbstick / wheel-menu scroll.
 *
 * The dashboard is attached to the camera rig (or an explicit analyst anchor)
 * so it moves comfortably with the user. Design patterns are borrowed from
 * cockpit-style VR games (Elite Dangerous, No Man's Sky) and constellation
 * menus (Google VR, Starblood Arena): panels sit in analyst-relative space,
 * snap to a regular radial grid, and face the viewer for readability.
 */
export class DashboardManager {
  cameraGroup: THREE.Group;
  analystAnchor: THREE.Group;
  layoutMode: LayoutMode;

  columns: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  wallPosition: [number, number, number];
  snapDistance: number;
  autoScale: boolean;

  radius: number;
  arcSpan: number;
  centerAngle: number;
  heightY: number;
  rowPitch: number;
  tilt: number;
  visibleColumns: number;

  wallWidth: number;
  wallHeight: number;

  wallGroup: THREE.Group;
  wallMesh: THREE.Mesh | null;

  panels: DashboardPanelEntry[];
  zones: DashboardCell[];
  zoneMeshes: THREE.Line[];

  private _dragStates: Map<PanelLike, { dragging: boolean }>;
  private _highlightedIndex: number;

  scrollOffset: number;
  targetScrollOffset: number;
  private _lastScrollOffset: number | null;

  private _tempVec: THREE.Vector3;
  private _tempWorld: THREE.Vector3;

  constructor(cameraGroup: THREE.Group, options: DashboardOptions = {}) {
    this.cameraGroup = cameraGroup;
    this.analystAnchor = options.analystAnchor ?? this.cameraGroup;

    this.layoutMode = options.layoutMode ?? DEFAULT_LAYOUT_MODE;

    this.columns = options.columns ?? DEFAULT_COLUMNS;
    this.rows = options.rows ?? DEFAULT_ROWS;
    this.cellWidth = options.cellWidth ?? DEFAULT_CELL_WIDTH;
    this.cellHeight = options.cellHeight ?? DEFAULT_CELL_HEIGHT;
    this.wallPosition = options.wallPosition ?? DEFAULT_WALL_POS;
    this.snapDistance = options.snapDistance ?? SNAP_DISTANCE;
    this.autoScale = options.autoScale ?? true;

    this.radius = options.radius ?? DEFAULT_RADIUS;
    this.arcSpan = options.arcSpan ?? DEFAULT_ARC_SPAN;
    this.centerAngle = options.centerAngle ?? DEFAULT_CENTER_ANGLE;
    this.heightY = options.heightY ?? DEFAULT_HEIGHT_Y;
    this.rowPitch = options.rowPitch ?? DEFAULT_ROW_PITCH;
    this.tilt = options.tilt ?? DEFAULT_TILT;
    this.visibleColumns = options.visibleColumns ?? this.columns;

    this.wallWidth = this.columns * this.cellWidth;
    this.wallHeight = this.rows * this.cellHeight;

    this.wallGroup = new THREE.Group();
    this.wallMesh = null;
    if (this.layoutMode === 'semicircle') {
      this.wallGroup.position.set(0, 0, 0);
      this.wallGroup.rotation.set(0, 0, 0);
    } else {
      this.wallGroup.position.set(...this.wallPosition);
      // Rotate 180° so the wall's +Z faces the user (camera faces -Z).
      this.wallGroup.rotation.y = Math.PI;
    }
    if (this.analystAnchor) this.analystAnchor.add(this.wallGroup);

    this.panels = [];
    this.zones = [];
    this.zoneMeshes = [];
    this._dragStates = new Map();
    this._highlightedIndex = -1;

    this.scrollOffset = 0;
    this.targetScrollOffset = 0;
    this._lastScrollOffset = null;

    this._tempVec = new THREE.Vector3();
    this._tempWorld = new THREE.Vector3();

    this._buildWall();
    this._buildZones();
    this._updateZonePositions();
    this._hideZones();
  }

  /** Register a panel and optionally assign it to a snap zone. */
  registerPanel(panel: PanelLike, zoneIndex: number | null = null): void {
    if (this.panels.find((p) => p.panel === panel)) return;
    const entry: DashboardPanelEntry = { panel, zoneIndex: null };
    this.panels.push(entry);
    this._dragStates.set(panel, { dragging: false });

    if (zoneIndex !== null && this._isValidZone(zoneIndex)) {
      entry.zoneIndex = zoneIndex;
      this._snapPanelToZone(panel, zoneIndex);
    } else {
      const nextZone = this._findNextFreeZone();
      if (nextZone >= 0) {
        entry.zoneIndex = nextZone;
        this._snapPanelToZone(panel, nextZone);
      }
    }
  }

  unregisterPanel(panel: PanelLike): void {
    const idx = this.panels.findIndex((p) => p.panel === panel);
    if (idx < 0) return;
    this.panels.splice(idx, 1);
    this._dragStates.delete(panel);
  }

  /** Return every registered panel to its assigned snap zone. */
  resetDashboard(): void {
    this.scrollTo(0);
    this.scrollOffset = this.targetScrollOffset;
    this._updateZonePositions();
    for (const entry of this.panels) {
      if (entry.zoneIndex !== null && this._isValidZone(entry.zoneIndex)) {
        this._snapPanelToZone(entry.panel, entry.zoneIndex);
      }
    }
  }

  /** Scroll the carousel by a raw angle in radians. */
  scrollBy(angleDelta: number): void {
    this.targetScrollOffset += angleDelta;
  }

  /** Scroll the carousel to an absolute angular offset. */
  scrollTo(angleOffset: number): void {
    this.targetScrollOffset = angleOffset;
  }

  /** Scroll by a number of carousel slots (positive = toward higher angles). */
  scrollBySlots(slotDelta: number): void {
    this.targetScrollOffset += slotDelta * this._angularStep();
  }

  /** Called each frame by the engine. */
  update(): void {
    // Smoothly interpolate scroll so the carousel doesn't jump.
    const diff = this.targetScrollOffset - this.scrollOffset;
    if (Math.abs(diff) > 0.0001) {
      this.scrollOffset += diff * SCROLL_LERP;
    } else {
      this.scrollOffset = this.targetScrollOffset;
    }

    this._updateZonePositions();

    let anyDragging = false;
    let nearest = -1;

    for (const entry of this.panels) {
      const panel = entry.panel;
      const wasDragging = this._dragStates.get(panel)?.dragging ?? false;
      const isDragging = panel.drag?.active ?? false;

      if (!wasDragging && isDragging) {
        this._showZones();
      }

      if (isDragging) {
        anyDragging = true;
        nearest = this._getNearestZoneIndex(panel);
      }

      if (wasDragging && !isDragging) {
        const zoneIdx = this._getNearestZoneIndex(panel);
        if (zoneIdx >= 0) {
          const zone = this.zones[zoneIdx];
          const dist = this._panelToZoneDistance(panel, zone);
          if (dist <= this.snapDistance) {
            this._snapPanelToZone(panel, zoneIdx);
            entry.zoneIndex = zoneIdx;
            if (!this._zoneVisible(zone)) {
              this._scrollToMakeVisible(zone);
            }
          }
        }
        this._hideZones();
      }

      this._dragStates.set(panel, { dragging: isDragging });
    }

    // Panels snapped to off-screen zones roll in as the carousel scrolls.
    if (this.layoutMode === 'semicircle' && this.scrollOffset !== this._lastScrollOffset) {
      for (const entry of this.panels) {
        if (entry.zoneIndex !== null && !entry.panel.drag?.active) {
          this._snapPanelToZone(entry.panel, entry.zoneIndex);
        }
      }
      this._lastScrollOffset = this.scrollOffset;
    }

    this._highlightZone(anyDragging ? nearest : -1);
  }

  private _buildWall(): void {
    if (this.layoutMode === 'semicircle') {
      this.wallMesh = null;
      return;
    }

    const geom = new THREE.PlaneGeometry(this.wallWidth + 0.1, this.wallHeight + 0.1);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x001122,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.wallMesh = new THREE.Mesh(geom, mat);
    this.wallGroup.add(this.wallMesh);
  }

  private _buildZones(): void {
    this._clearZones();
    if (this.layoutMode === 'semicircle') {
      this._buildSemicircleZones();
    } else {
      this._buildWallZones();
    }
  }

  private _clearZones(): void {
    for (const mesh of this.zoneMeshes) {
      mesh.geometry.dispose();
      (mesh.material as THREE.LineBasicMaterial).dispose();
      this.wallGroup.remove(mesh);
    }
    this.zones = [];
    this.zoneMeshes = [];
    this._highlightedIndex = -1;
  }

  private _buildWallZones(): void {
    const startX = (-(this.columns - 1) * this.cellWidth) / 2;
    const startY = ((this.rows - 1) * this.cellHeight) / 2;
    let index = 0;

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.columns; col++) {
        const x = startX + col * this.cellWidth;
        const y = startY - row * this.cellHeight;

        this.zones.push({
          index,
          col,
          row,
          x,
          y,
          z: 0,
          angle: 0,
          width: this.cellWidth,
          height: this.cellHeight,
          visible: true,
        });

        const geom = this._zoneGeometry(this.cellWidth, this.cellHeight);
        const mat = new THREE.LineBasicMaterial({
          color: 0x00ffcc,
          transparent: true,
          opacity: 0.35,
          depthWrite: false,
        });
        const mesh = new THREE.Line(geom, mat);
        mesh.position.set(x, y, 0.01);
        mesh.visible = false;
        this.wallGroup.add(mesh);
        this.zoneMeshes.push(mesh);
        index++;
      }
    }
  }

  private _buildSemicircleZones(): void {
    const step = this._angularStep();
    const startAngle = this.centerAngle - ((this.columns - 1) * step) / 2;
    const startY = this.heightY + ((this.rows - 1) * this.rowPitch) / 2;
    let index = 0;

    for (let col = 0; col < this.columns; col++) {
      for (let row = 0; row < this.rows; row++) {
        const angle = startAngle + col * step;
        const x = this.radius * Math.sin(angle);
        const z = -this.radius * Math.cos(angle);
        const y = startY - row * this.rowPitch;

        this.zones.push({
          index,
          col,
          row,
          x,
          y,
          z,
          angle,
          width: this.cellWidth,
          height: this.cellHeight,
          visible: true,
        });

        const geom = this._zoneGeometry(this.cellWidth, this.cellHeight);
        const mat = new THREE.LineBasicMaterial({
          color: 0x00ffcc,
          transparent: true,
          opacity: 0.35,
          depthWrite: false,
        });
        const mesh = new THREE.Line(geom, mat);
        mesh.position.set(x, y, 0);
        mesh.rotation.set(0, -angle, 0);
        mesh.visible = false;
        this.wallGroup.add(mesh);
        this.zoneMeshes.push(mesh);
        index++;
      }
    }
  }

  private _zoneGeometry(width: number, height: number): THREE.BufferGeometry {
    const w = width / 2;
    const h = height / 2;
    const vertices = new Float32Array([-w, -h, 0, w, -h, 0, w, h, 0, -w, h, 0, -w, -h, 0]);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    return geom;
  }

  private _angularStep(): number {
    return this.arcSpan / Math.max(1, this.visibleColumns - 1);
  }

  private _updateZonePositions(): void {
    if (this.layoutMode !== 'semicircle') return;

    const step = this._angularStep();
    const startAngle = this.centerAngle - ((this.columns - 1) * step) / 2;
    const half = this.arcSpan / 2 + step * 0.5;

    for (let i = 0; i < this.zones.length; i++) {
      const zone = this.zones[i];
      const angle = startAngle + zone.col * step - this.scrollOffset;
      zone.angle = angle;
      zone.x = this.radius * Math.sin(angle);
      zone.z = -this.radius * Math.cos(angle);
      zone.visible = Math.abs(angle - this.centerAngle) <= half;

      const mesh = this.zoneMeshes[i];
      mesh.position.set(zone.x, zone.y, 0);
      mesh.rotation.set(0, -angle, 0);
    }
  }

  private _showZones(): void {
    for (const mesh of this.zoneMeshes) mesh.visible = true;
    if (this.wallMesh) (this.wallMesh.material as THREE.MeshBasicMaterial).opacity = 0.45;
  }

  private _hideZones(): void {
    for (const mesh of this.zoneMeshes) {
      mesh.visible = false;
      const mat = mesh.material as THREE.LineBasicMaterial;
      mat.opacity = 0.35;
      mat.color.setHex(0x00ffcc);
    }
    this._highlightedIndex = -1;
    if (this.wallMesh) (this.wallMesh.material as THREE.MeshBasicMaterial).opacity = 0.25;
  }

  private _highlightZone(index: number): void {
    if (index === this._highlightedIndex) return;
    this._highlightedIndex = index;
    for (let i = 0; i < this.zoneMeshes.length; i++) {
      const mesh = this.zoneMeshes[i];
      const mat = mesh.material as THREE.LineBasicMaterial;
      if (i === index) {
        mat.color.setHex(0xff00cc);
        mat.opacity = 0.9;
      } else {
        mat.color.setHex(0x00ffcc);
        mat.opacity = 0.35;
      }
    }
  }

  private _snapPanelToZone(panel: PanelLike, zoneIndex: number): void {
    const zone = this.zones[zoneIndex];
    if (!zone) return;

    let targetLocal: THREE.Vector3;
    if (this.layoutMode === 'semicircle') {
      targetLocal = new THREE.Vector3(zone.x, zone.y, zone.z);
      panel.mesh!.rotation.set(-this.tilt, -zone.angle, 0);
    } else {
      targetLocal = this._wallLocalToCameraGroupLocal(new THREE.Vector3(zone.x, zone.y, 0));
      panel.mesh!.rotation.set(-this.tilt, Math.PI, 0);
    }
    panel.mesh!.position.copy(targetLocal);

    if (this.autoScale) {
      const mesh = panel.mesh as THREE.Mesh;
      const geom = mesh.geometry as THREE.PlaneGeometry & { parameters?: { width?: number; height?: number } };
      const panelW = geom?.parameters?.width ?? 1;
      const panelH = geom?.parameters?.height ?? 1;
      const scaleX = (zone.width * 0.92) / panelW;
      const scaleY = (zone.height * 0.92) / panelH;
      const scale = Math.min(scaleX, scaleY);
      mesh.scale.set(scale, scale, 1);
    } else {
      panel.mesh!.scale.set(1, 1, 1);
    }

    panel.mesh!.visible = this._zoneVisible(zone);
    panel.defaultPosition!.copy(targetLocal);
  }

  private _zoneVisible(zone: DashboardCell): boolean {
    if (this.layoutMode !== 'semicircle') return true;
    return zone.visible ?? true;
  }

  private _scrollToMakeVisible(zone: DashboardCell): void {
    const step = this._angularStep();
    this.targetScrollOffset += this.centerAngle - zone.angle;
    this.targetScrollOffset = Math.round(this.targetScrollOffset / step) * step;
  }

  private _getNearestZoneIndex(panel: PanelLike): number {
    let best = -1;
    let bestDist = Infinity;
    for (const zone of this.zones) {
      const dist = this._panelToZoneDistance(panel, zone);
      if (dist < bestDist) {
        bestDist = dist;
        best = zone.index;
      }
    }
    return best;
  }

  private _panelToZoneDistance(panel: PanelLike, zone: DashboardCell): number {
    if (this.layoutMode === 'semicircle') {
      const dx = panel.mesh!.position.x - zone.x;
      const dy = panel.mesh!.position.y - zone.y;
      const dz = panel.mesh!.position.z - zone.z;
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    const panelLocal = this._panelCenterInWallLocal(panel);
    return Math.sqrt((panelLocal.x - zone.x) ** 2 + (panelLocal.y - zone.y) ** 2);
  }

  private _panelCenterInWallLocal(panel: PanelLike): THREE.Vector3 {
    panel.mesh!.updateMatrixWorld(true);
    const world = this._tempWorld.setFromMatrixPosition(panel.mesh!.matrixWorld);
    return this.wallGroup.worldToLocal(world);
  }

  private _wallLocalToCameraGroupLocal(v: THREE.Vector3): THREE.Vector3 {
    this.wallGroup.updateMatrixWorld(true);
    const world = v.clone().applyMatrix4(this.wallGroup.matrixWorld);
    if (!this.cameraGroup) return world;
    this.cameraGroup.updateMatrixWorld(true);
    return world.applyMatrix4(new THREE.Matrix4().copy(this.cameraGroup.matrixWorld).invert());
  }

  private _isValidZone(index: number): boolean {
    return index >= 0 && index < this.zones.length;
  }

  /**
   * Pick a free zone for a newly registered panel.
   * Wall mode fills left-to-right, top-to-bottom.
   * Semicircle mode fills from the center column outward so the first panels
   * appear in front of the analyst.
   */
  private _findNextFreeZone(): number {
    const used = new Set(this.panels.map((p) => p.zoneIndex));
    const order = this._zoneAllocationOrder();
    for (const idx of order) {
      if (!used.has(idx)) return idx;
    }
    return -1;
  }

  private _zoneAllocationOrder(): number[] {
    if (this.layoutMode !== 'semicircle') {
      return this.zones.map((z) => z.index);
    }

    const centerCol = (this.columns - 1) / 2;
    const indices = this.zones.map((z) => z.index);
    return indices.sort((a, b) => {
      const za = this.zones[a];
      const zb = this.zones[b];
      const da = Math.abs(za.col - centerCol);
      const db = Math.abs(zb.col - centerCol);
      if (da !== db) return da - db;
      return za.row - zb.row;
    });
  }

  /** Count of currently registered panels. */
  getPanelCount(): number {
    return this.panels.length;
  }

  dispose(): void {
    for (const mesh of this.zoneMeshes) {
      mesh.geometry.dispose();
      (mesh.material as THREE.LineBasicMaterial).dispose();
      this.wallGroup.remove(mesh);
    }
    if (this.wallMesh) {
      this.wallMesh.geometry.dispose();
      (this.wallMesh.material as THREE.MeshBasicMaterial).dispose();
      this.wallGroup.remove(this.wallMesh);
    }
    if (this.wallGroup.parent) this.wallGroup.parent.remove(this.wallGroup);
    this.panels = [];
    this.zones = [];
    this.zoneMeshes = [];
  }
}
