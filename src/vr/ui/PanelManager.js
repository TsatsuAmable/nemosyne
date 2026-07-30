import * as THREE from 'three';

/**
 * Manages the HUD / panel layer. By default panels cluster around an
 * "analyst anchor" — a body-locked point in front of the viewer. In
 * free-floating mode panels keep their own local positions in the camera
 * group, can be dragged independently, and their poses can be serialized
 * for persistence.
 */
export class PanelManager {
  constructor(cameraGroup, options = {}) {
    this.cameraGroup = cameraGroup;
    /** @type {import('./MovablePanel.js').MovablePanel[]} */
    this.panels = [];

    // Analyst anchor: a body-locked point slightly in front of and below the
    // headset origin. This is the reference for all panel layouts; it is the
    // viewer's chest/reading zone rather than a fixed world position.
    this._anchor = new THREE.Vector3(
      options.anchorX ?? 0,
      options.anchorY ?? 0.05,
      options.anchorZ ?? -0.55
    );

    // Optional parent group for the anchor. If provided, the launcher and
    // all registered panel meshes are reparented to this group so the HUD
    // moves as a single body-locked cluster around the analyst.
    this._analystAnchor = options.analystAnchor ?? this.cameraGroup;

    this._launcherGroup = new THREE.Group();
    this._launcherGroup.visible = false;
    if (this._analystAnchor) this._analystAnchor.add(this._launcherGroup);

    // Free-floating mode keeps panels in cameraGroup local space instead of
    // forcing them into the analyst anchor's angular slots.
    this.freeFloating = options.freeFloating ?? false;
    this.onChange = options.onChange ?? (() => {});

    // Per-panel slot angles and drag offsets (in local anchor space).
    this._panelSlots = new Map();
    this._panelOffsets = new Map();

    // Independent visibility state (separate from mesh.visible).
    this._visible = new Map();
    this._launchers = [];

    // Track which callbacks this manager installed so unregister only clears its own hooks.
    this._managerDragDelta = new WeakMap();
    this._managerDragEnd = new WeakMap();
    this._managerHide = new WeakMap();

    this._launcherVisible = false;

    this._tempVec = new THREE.Vector3();
  }

  /**
   * Register a panel so it can be independently toggled and moved.
   * @param {import('./MovablePanel.js').MovablePanel} panel
   */
  register(panel) {
    if (this.panels.includes(panel)) return;
    this.panels.push(panel);
    this._visible.set(panel, panel.mesh.visible);
    this._panelOffsets.set(panel, new THREE.Vector3());
    // Rebalance slots whenever the panel set changes so the arc stays even.
    for (const p of this.panels) this._assignSlot(p);

    // Listen for direct hide (e.g., minimize button) so visibility state stays in
    // sync regardless of whether the panel was hidden through PanelManager.
    const hideHandler = () => this._onPanelHidden(panel);
    this._managerHide.set(panel, hideHandler);
    panel.onHide = hideHandler;

    if (this.freeFloating) {
      // Panels stay where the user puts them. MovablePanel handles direct
      // dragging; we just listen for drag-end so we can persist the new pose.
      const dragEndHandler = () => this._notifyChange();
      this._managerDragEnd.set(panel, dragEndHandler);
      panel.onDragEnd = dragEndHandler;
    } else {
      const dragDeltaHandler = (delta) => this.applyDragDelta(panel, delta);
      this._managerDragDelta.set(panel, dragDeltaHandler);
      panel.onDragDelta = dragDeltaHandler;

      // Reparent the panel into the analyst anchor so the whole HUD cluster moves
      // together. Because the anchor is a child of the camera rig, world poses are
      // preserved when the old and new parents share the same world transform.
      if (this._analystAnchor && panel.mesh.parent !== this._analystAnchor) {
        if (panel.mesh.parent) panel.mesh.parent.remove(panel.mesh);
        this._analystAnchor.add(panel.mesh);
        // Keep the panel's logical parent in sync with its scene-graph parent so
        // drag-plane math, default positions, and distance clamps use the right frame.
        panel.parentGroup = this._analystAnchor;
      }
    }

    this._createLauncher(panel);
    if (!this.freeFloating && this._visible.get(panel)) this._layoutPanel(panel);
  }

  unregister(panel) {
    const idx = this.panels.indexOf(panel);
    if (idx < 0) return;
    this.panels.splice(idx, 1);
    this._visible.delete(panel);
    this._panelSlots.delete(panel);
    this._panelOffsets.delete(panel);

    const hideHandler = this._managerHide.get(panel);
    if (panel.onHide === hideHandler) panel.onHide = null;
    this._managerHide.delete(panel);

    const dragDeltaHandler = this._managerDragDelta.get(panel);
    if (panel.onDragDelta === dragDeltaHandler) panel.onDragDelta = null;
    this._managerDragDelta.delete(panel);

    const dragEndHandler = this._managerDragEnd.get(panel);
    if (panel.onDragEnd === dragEndHandler) panel.onDragEnd = null;
    this._managerDragEnd.delete(panel);

    // Rebalance remaining panels.
    for (const p of this.panels) this._assignSlot(p);
    for (const p of this.panels) {
      if (!this.freeFloating && this._visible.get(p)) this._layoutPanel(p);
    }

    const launcher = this._launchers.find((l) => l.panel === panel);
    if (launcher) {
      this._launcherGroup.remove(launcher.mesh);
      launcher.mesh.geometry.dispose();
      launcher.mesh.material.dispose();
      this._launchers = this._launchers.filter((l) => l !== launcher);
    }
  }

  /**
   * Toggle a single panel on/off.
   * @param {import('./MovablePanel.js').MovablePanel} panel
   */
  togglePanel(panel) {
    if (!this.panels.includes(panel)) return;
    const visible = !this._visible.get(panel);
    this._setPanelVisible(panel, visible);
  }

  /**
   * Show or hide a single panel.
   */
  showPanel(panel) {
    this._setPanelVisible(panel, true);
  }

  hidePanel(panel) {
    this._setPanelVisible(panel, false);
  }

  /** Show all registered panels. */
  showAll() {
    for (const panel of this.panels) this._setPanelVisible(panel, true);
    this.hideLauncher();
  }

  /** Hide all registered panels. */
  hideAll() {
    for (const panel of this.panels) this._setPanelVisible(panel, false);
    this.hideLauncher();
  }

  /** Toggle the launcher ring on/off. */
  toggleLauncher() {
    if (this._launcherVisible) this.hideLauncher();
    else this.showLauncher();
  }

  showLauncher() {
    this._launcherVisible = true;
    this._launcherGroup.visible = true;
    this._layoutLauncher();
  }

  hideLauncher() {
    this._launcherVisible = false;
    this._launcherGroup.visible = false;
  }

  /** @returns {boolean} */
  isLauncherVisible() {
    return this._launcherVisible;
  }

  /**
   * Reset all panels. In anchored mode this snaps panels back to their anchor
   * slots; in free-floating mode it restores each panel's constructor position.
   */
  recenter() {
    if (this.freeFloating) {
      for (const panel of this.panels) {
        panel.mesh.position.copy(panel.defaultPosition);
        panel.mesh.rotation.x = -panel.tilt;
        panel.mesh.rotation.y = 0;
        panel.mesh.rotation.z = 0;
      }
      this._notifyChange();
      return;
    }
    for (const panel of this.panels) {
      this._panelOffsets.get(panel)?.set(0, 0, 0);
      if (this._visible.get(panel)) {
        this._layoutPanel(panel);
      }
    }
  }

  /** Return the anchor position in cameraGroup local space. */
  getAnchor() {
    return this._anchor.clone();
  }

  /**
   * Serialize each registered panel's pose and visibility in a stable
   * coordinate frame (the camera group) so the layout can be restored across
   * sessions even if the panel's parent changes.
   */
  getPanelPositions() {
    const positions = [];
    this.cameraGroup?.updateMatrixWorld(true);
    for (const panel of this.panels) {
      const worldPos = new THREE.Vector3();
      panel.mesh.getWorldPosition(worldPos);
      const localPos = worldPos;
      if (this.cameraGroup) {
        localPos.applyMatrix4(new THREE.Matrix4().copy(this.cameraGroup.matrixWorld).invert());
      }
      positions.push({
        title: panel.title,
        position: localPos.toArray(),
        visible: panel.mesh.visible,
      });
    }
    return positions;
  }

  /**
   * Restore panel positions and visibility from a serialized snapshot.
   */
  setPanelPositions(data = []) {
    this.cameraGroup?.updateMatrixWorld(true);
    for (const item of data) {
      const panel = this.panels.find((p) => p.title === item.title);
      if (!panel) continue;
      if (Array.isArray(item.position) && item.position.length === 3) {
        const worldPos = new THREE.Vector3().fromArray(item.position);
        if (this.cameraGroup) {
          worldPos.applyMatrix4(this.cameraGroup.matrixWorld);
        }
        if (panel.mesh.parent) {
          panel.mesh.parent.updateMatrixWorld(true);
          worldPos.applyMatrix4(new THREE.Matrix4().copy(panel.mesh.parent.matrixWorld).invert());
        }
        panel.mesh.position.copy(worldPos);
      }
      this._setPanelVisible(panel, !!item.visible);
    }
  }

  _notifyChange() {
    try {
      this.onChange();
    } catch {
      // Swallow errors so a bad callback cannot break the HUD.
    }
  }

  _onPanelHidden(panel) {
    if (!this.panels.includes(panel)) return;
    const changed = this._visible.get(panel) !== false;
    this._visible.set(panel, false);
    if (changed) this._notifyChange();
  }

  _assignSlot(panel) {
    const idx = this.panels.indexOf(panel);
    const count = Math.max(1, this.panels.length);
    const arc = Math.PI / 2;
    const startAngle = -arc / 2;
    const step = count > 1 ? arc / (count - 1) : 0;
    const angle = startAngle + idx * step;
    this._panelSlots.set(panel, angle);
  }

  _setPanelVisible(panel, visible) {
    const changed = this._visible.get(panel) !== visible;
    this._visible.set(panel, visible);
    if (visible) {
      // Make the panel visible and re-render. In anchored mode the
      // anchor/cluster layout sets the final pose; in free-floating mode the
      // panel keeps its current (or previously restored) position.
      panel.mesh.visible = true;
      panel.isMinimized = false;
      panel.mesh.rotation.x = -panel.tilt;
      panel.render();
      if (this.freeFloating && changed) {
        this._notifyChange();
      } else if (!this.freeFloating) {
        this._layoutPanel(panel);
        this._snapToComfortableDistance(panel);
      }
    } else {
      panel.hide();
      if (this.freeFloating && changed) this._notifyChange();
    }
  }

  /**
   * Compute the base position for a panel's angular slot around the anchor.
   */
  _slotBase(panel) {
    const angle = this._panelSlots.get(panel) ?? 0;
    const radius = 0.55;
    return new THREE.Vector3(
      this._anchor.x + Math.sin(angle) * radius,
      this._anchor.y,
      this._anchor.z + Math.cos(angle) * radius
    );
  }

  /**
   * Position a panel at its anchor slot plus any drag offset, then look at
   * the anchor so the panel faces the viewer.
   */
  _layoutPanel(panel) {
    const base = this._slotBase(panel);
    const offset = this._panelOffsets.get(panel);

    panel.mesh.position.set(base.x + offset.x, base.y + offset.y, base.z + offset.z);
    // Keep the panel's front (+Z) facing the viewer. The camera group origin is
    // the viewer's head position; using the anchor height keeps vertical gaze
    // comfortable when panels are dragged up or down.
    panel.mesh.lookAt(0, this._anchor.y + offset.y, 0);
    panel.mesh.rotation.x = -panel.tilt;
  }

  /**
   * After showing, push the panel to a comfortable distance from the anchor
   * (0.45 m to 1.4 m) so it remains readable without clipping.
   */
  _snapToComfortableDistance(panel) {
    const base = this._slotBase(panel);
    const offset = this._panelOffsets.get(panel);
    if (!offset) return;

    const current = new THREE.Vector3().copy(base).add(offset);
    const toAnchor = new THREE.Vector3().subVectors(current, this._anchor);
    const dist = toAnchor.length();
    const min = 0.45;
    const max = 1.4;
    if (dist >= min && dist <= max) return;

    const target = Math.min(Math.max(dist, min), max);
    const dir =
      toAnchor.lengthSq() > 0
        ? toAnchor.normalize()
        : new THREE.Vector3(0, 0, -1);
    const targetPos = this._anchor.clone().add(dir.multiplyScalar(target));
    offset.subVectors(targetPos, base);
    this._layoutPanel(panel);
  }

  /**
   * Apply a drag delta to a panel in local anchor space.
   * @param {import('./MovablePanel.js').MovablePanel} panel
   * @param {THREE.Vector3} delta
   */
  applyDragDelta(panel, delta) {
    if (this.freeFloating) return;
    if (!this.panels.includes(panel)) return;
    const offset = this._panelOffsets.get(panel);
    if (!offset) return;

    // MovablePanel reports deltas in world space; convert to the anchor's local
    // frame before accumulating so head/body motion does not drift the panel.
    if (this._analystAnchor) {
      this._analystAnchor.updateMatrixWorld(true);
      const localDelta = delta.clone().applyMatrix4(new THREE.Matrix4().copy(this._analystAnchor.matrixWorld).invert());
      offset.add(localDelta);
    } else {
      offset.add(delta);
    }

    this._snapToComfortableDistance(panel);
    this._layoutPanel(panel);
  }

  _createLauncher(panel) {
    const size = 0.14;
    const geom = new THREE.PlaneGeometry(size, size);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00ffcc,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.userData.panel = panel;
    this._launcherGroup.add(mesh);

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d') || this._createMockContext();
    ctx.fillStyle = 'rgba(0, 40, 60, 0.9)';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 120, 120);
    ctx.fillStyle = '#00ffcc';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(panel.title.slice(0, 10), 64, 64);

    const tex = new THREE.CanvasTexture(canvas);
    mat.map = tex;
    mat.needsUpdate = true;

    this._launchers.push({ panel, mesh, texture: tex });
  }

  _layoutLauncher() {
    // Arrange launcher icons in a gentle arc in front of the user.
    const count = this._launchers.length;
    const radius = 0.85;
    const angleStep = count > 1 ? Math.PI / 3 / (count - 1) : 0;
    const startAngle = -Math.PI / 6;
    for (let i = 0; i < count; i++) {
      const angle = startAngle + i * angleStep;
      const mesh = this._launchers[i].mesh;
      mesh.position.set(Math.sin(angle) * radius, 0.1, -Math.cos(angle) * radius);
      mesh.lookAt(0, 0.1, 0);
    }
  }

  /** Try to activate a launcher icon hit by the given raycaster. */
  handleLauncherHit(raycaster) {
    if (!this._launcherVisible) return null;
    const hits = raycaster.intersectObjects(this._launchers.map((l) => l.mesh), false);
    if (hits.length === 0) return null;
    const panel = hits[0].object.userData.panel;
    if (!panel) return null;
    this.togglePanel(panel);
    return panel;
  }

  /** Update loop hook: keep launcher oriented toward the viewer if desired. */
  update() {
    if (!this._launcherVisible) return;
  }

  _createMockContext() {
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
      set fillStyle(_) {},
      set strokeStyle(_) {},
      set lineWidth(_) {},
      set font(_) {},
      set textAlign(_) {},
    };
  }
}
