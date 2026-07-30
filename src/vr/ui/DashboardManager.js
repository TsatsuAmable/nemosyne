import * as THREE from 'three';

const DEFAULT_WALL_POS = [0, 1.6, 1.5];
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
  constructor(cameraGroup, options = {}) {
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

    // Semicircle / curved workspace parameters.
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
    if (this.layoutMode === 'semicircle') {
      // The analyst sits at the local origin; the curved grid is centered
      // in front of them.
      this.wallGroup.position.set(0, 0, 0);
      this.wallGroup.rotation.set(0, 0, 0);
    } else {
      this.wallGroup.position.set(...this.wallPosition);
      // Rotate 180° so the wall's +Z faces the user (camera faces -Z).
      this.wallGroup.rotation.y = Math.PI;
    }
    if (this.analystAnchor) this.analystAnchor.add(this.wallGroup);

    this.panels = []; // { panel, zoneIndex }
    this.zones = []; // { index, col, row, x, y, z, angle, width, height, visible }
    this.zoneMeshes = [];
    this._dragStates = new Map(); // panel -> { dragging }
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
  registerPanel(panel, zoneIndex = null) {
    if (this.panels.find((p) => p.panel === panel)) return;
    const entry = { panel, zoneIndex: null };
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

  unregisterPanel(panel) {
    const idx = this.panels.findIndex((p) => p.panel === panel);
    if (idx < 0) return;
    this.panels.splice(idx, 1);
    this._dragStates.delete(panel);
  }

  /** Return every registered panel to its assigned snap zone. */
  resetDashboard() {
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
  scrollBy(angleDelta) {
    this.targetScrollOffset += angleDelta;
  }

  /** Scroll the carousel to an absolute angular offset. */
  scrollTo(angleOffset) {
    this.targetScrollOffset = angleOffset;
  }

  /** Scroll by a number of carousel slots (positive = toward higher angles). */
  scrollBySlots(slotDelta) {
    this.targetScrollOffset += slotDelta * this._angularStep();
  }

  /** Called each frame by the engine. */
  update() {
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
        if (entry.zoneIndex !== null && !(entry.panel.drag?.active)) {
          this._snapPanelToZone(entry.panel, entry.zoneIndex);
        }
      }
      this._lastScrollOffset = this.scrollOffset;
    }

    this._highlightZone(anyDragging ? nearest : -1);
  }

  _buildWall() {
    if (this.layoutMode === 'semicircle') {
      // The curved shell is implied by the zone grid; no backing plane needed.
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

  _buildZones() {
    this._clearZones();
    if (this.layoutMode === 'semicircle') {
      this._buildSemicircleZones();
    } else {
      this._buildWallZones();
    }
  }

  _clearZones() {
    for (const mesh of this.zoneMeshes) {
      mesh.geometry.dispose();
      mesh.material.dispose();
      this.wallGroup.remove(mesh);
    }
    this.zones = [];
    this.zoneMeshes = [];
    this._highlightedIndex = -1;
  }

  _buildWallZones() {
    const startX = -(this.columns - 1) * this.cellWidth / 2;
    const startY = (this.rows - 1) * this.cellHeight / 2;
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

  _buildSemicircleZones() {
    const step = this._angularStep();
    const startAngle = this.centerAngle - ((this.columns - 1) * step) / 2;
    const startY = this.heightY + (this.rows - 1) * this.rowPitch / 2;
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

  _zoneGeometry(width, height) {
    const w = width / 2;
    const h = height / 2;
    const vertices = new Float32Array([
      -w, -h, 0,
       w, -h, 0,
       w,  h, 0,
      -w,  h, 0,
      -w, -h, 0,
    ]);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    return geom;
  }

  _angularStep() {
    return this.arcSpan / Math.max(1, this.visibleColumns - 1);
  }

  _updateZonePositions() {
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

  _showZones() {
    for (const mesh of this.zoneMeshes) mesh.visible = true;
    if (this.wallMesh) this.wallMesh.material.opacity = 0.45;
  }

  _hideZones() {
    for (const mesh of this.zoneMeshes) {
      mesh.visible = false;
      mesh.material.opacity = 0.35;
      mesh.material.color.setHex(0x00ffcc);
    }
    this._highlightedIndex = -1;
    if (this.wallMesh) this.wallMesh.material.opacity = 0.25;
  }

  _highlightZone(index) {
    if (index === this._highlightedIndex) return;
    this._highlightedIndex = index;
    for (let i = 0; i < this.zoneMeshes.length; i++) {
      const mesh = this.zoneMeshes[i];
      if (i === index) {
        mesh.material.color.setHex(0xff00cc);
        mesh.material.opacity = 0.9;
      } else {
        mesh.material.color.setHex(0x00ffcc);
        mesh.material.opacity = 0.35;
      }
    }
  }

  _snapPanelToZone(panel, zoneIndex) {
    const zone = this.zones[zoneIndex];
    if (!zone) return;

    let targetLocal;
    if (this.layoutMode === 'semicircle') {
      targetLocal = new THREE.Vector3(zone.x, zone.y, zone.z);
      panel.mesh.rotation.set(-this.tilt, -zone.angle, 0);
    } else {
      targetLocal = this._wallLocalToCameraGroupLocal(new THREE.Vector3(zone.x, zone.y, 0));
      panel.mesh.rotation.set(-this.tilt, Math.PI, 0);
    }
    panel.mesh.position.copy(targetLocal);

    if (this.autoScale) {
      const geom = panel.mesh.geometry;
      const panelW = geom?.parameters?.width ?? 1;
      const panelH = geom?.parameters?.height ?? 1;
      const scaleX = (zone.width * 0.92) / panelW;
      const scaleY = (zone.height * 0.92) / panelH;
      const scale = Math.min(scaleX, scaleY);
      panel.mesh.scale.set(scale, scale, 1);
    } else {
      panel.mesh.scale.set(1, 1, 1);
    }

    // Hide panels parked in off-screen carousel slots; they reappear when
    // the user scrolls them back into view.
    panel.mesh.visible = this._zoneVisible(zone);

    panel.defaultPosition.copy(targetLocal);
  }

  _zoneVisible(zone) {
    if (this.layoutMode !== 'semicircle') return true;
    return zone.visible ?? true;
  }

  _scrollToMakeVisible(zone) {
    const step = this._angularStep();
    // Bring the snapped zone to the center of the visible arc so the user
    // can read it immediately. Align the target to slot increments so the
    // carousel lands cleanly.
    this.targetScrollOffset += this.centerAngle - zone.angle;
    this.targetScrollOffset = Math.round(this.targetScrollOffset / step) * step;
  }

  _getNearestZoneIndex(panel) {
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

  _panelToZoneDistance(panel, zone) {
    if (this.layoutMode === 'semicircle') {
      const dx = panel.mesh.position.x - zone.x;
      const dy = panel.mesh.position.y - zone.y;
      const dz = panel.mesh.position.z - zone.z;
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    const panelLocal = this._panelCenterInWallLocal(panel);
    return Math.sqrt(
      (panelLocal.x - zone.x) ** 2 +
      (panelLocal.y - zone.y) ** 2
    );
  }

  _panelCenterInWallLocal(panel) {
    panel.mesh.updateMatrixWorld(true);
    const world = this._tempWorld.setFromMatrixPosition(panel.mesh.matrixWorld);
    return this.wallGroup.worldToLocal(world);
  }

  _wallLocalToCameraGroupLocal(v) {
    this.wallGroup.updateMatrixWorld(true);
    const world = v.clone().applyMatrix4(this.wallGroup.matrixWorld);
    if (!this.cameraGroup) return world;
    this.cameraGroup.updateMatrixWorld(true);
    return world.applyMatrix4(this.cameraGroup.matrixWorld.clone().invert());
  }

  _isValidZone(index) {
    return index >= 0 && index < this.zones.length;
  }

  /**
   * Pick a free zone for a newly registered panel.
   * Wall mode fills left-to-right, top-to-bottom.
   * Semicircle mode fills from the center column outward so the first panels
   * appear in front of the analyst.
   */
  _findNextFreeZone() {
    const used = new Set(this.panels.map((p) => p.zoneIndex));
    const order = this._zoneAllocationOrder();
    for (const idx of order) {
      if (!used.has(idx)) return idx;
    }
    return -1;
  }

  _zoneAllocationOrder() {
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
  getPanelCount() {
    return this.panels.length;
  }

  dispose() {
    for (const mesh of this.zoneMeshes) {
      mesh.geometry.dispose();
      mesh.material.dispose();
      this.wallGroup.remove(mesh);
    }
    if (this.wallMesh) {
      this.wallMesh.geometry.dispose();
      this.wallMesh.material.dispose();
      this.wallGroup.remove(this.wallMesh);
    }
    if (this.wallGroup.parent) this.wallGroup.parent.remove(this.wallGroup);
    this.panels = [];
    this.zones = [];
    this.zoneMeshes = [];
  }
}
