import * as THREE from 'three';

/**
 * Meta Quest-native two-level constellation radial menu.
 *
 * Inspired by Google VR's Constellation Menu and Starblood Arena's circular HUD:
 * an inner ring holds categories, and an outer ring shows actions for the
 * hovered or selected category. A visual path (connector lines) links the
 * category node to its actions so users build spatial muscle memory.
 *
 * The wheel is anchored to the body (cameraGroup or an explicit analyst
 * anchor) rather than the wrist so it stays stable while the menu hand moves.
 * It faces the camera each frame. Segments are hit-tested by the InputRouter
 * using the other hand's pointer ray. Selecting an action fires its callback
 * and closes the wheel.
 *
 * Backward compatibility: setActions(flatList) is auto-wrapped into a single
 * "Actions" category so existing callers continue to work.
 */
export class HandWheelMenu {
  constructor(engine, hand, options = {}) {
    this.engine = engine;
    // `hand` is kept as the menu-toggle hand for InputRouter; the visual group
    // is no longer parented to it unless the legacy `anchorToHand` option is set.
    this.hand = hand;
    this.group = new THREE.Group();
    this.group.visible = false;

    if (options.anchorToHand && hand?.group) {
      hand.group.add(this.group);
      this.offset = new THREE.Vector3(
        options.offsetX ?? 0,
        options.offsetY ?? 0.08,
        options.offsetZ ?? 0.05
      );
    } else {
      const parent = options.analystAnchor ?? engine?.cameraGroup ?? engine?.camera;
      if (parent) parent.add(this.group);
      else if (hand?.group) hand.group.add(this.group);
      this.offset = new THREE.Vector3(
        options.offsetX ?? 0,
        options.offsetY ?? (engine?.camera ? 1.2 : 0.08),
        options.offsetZ ?? -0.55
      );
    }
    this.group.position.copy(this.offset);

    this.categoryRadius = options.categoryRadius ?? 0.07;
    this.actionRadius = options.actionRadius ?? 0.17;
    this.nodeSize = options.nodeSize ?? 0.045;
    this.actionSpread = options.actionSpread ?? Math.PI / 2.2;

    this.feedback = options.feedback ?? engine?.input?.feedback ?? null;

    this._cameraPos = new THREE.Vector3();
    this._categories = [];
    this._categoryMeshes = [];
    this._actionMeshes = [];
    this._connectorLines = null;
    this._connectorMaterial = null;
    this._raycaster = new THREE.Raycaster();

    this.selectedCategory = null;
    this.hoveredCategory = null;
    this.hoveredAction = null;
    this._lastHovered = { category: null, action: null };

    this._categoryMaterials = [];
    this._actionMaterials = [];

    this.textScale = 1;
    this.highContrast = false;
    this.colorblindMode = 'none';

    if (options.actions) this.setActions(options.actions);
    if (options.menu) this.setMenu(options.menu);
  }

  applyAccessibility({ textScale, highContrast, colorblindMode }) {
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
    if (changed) this._rebuildMenuTextures();
  }

  _rebuildMenuTextures() {
    for (const mesh of this._categoryMeshes) {
      const cat = this._categories[mesh.userData.categoryIndex];
      if (cat) {
        mesh.material.map?.dispose?.();
        mesh.material.map = this._createLabelTexture(cat.label);
      }
    }
    for (const mesh of this._actionMeshes) {
      const cat = this._categories.find((c) => c.id === mesh.userData.categoryId);
      const action = cat?.items?.[mesh.userData.actionIndex];
      if (action) {
        mesh.material.map?.dispose?.();
        mesh.material.map = this._createLabelTexture(action.label);
      }
    }
  }

  /**
   * Backward-compatible flat action list. Wrapped into one category.
   */
  setActions(actions) {
    this.setMenu([{ id: 'actions', label: 'Actions', items: actions.slice() }]);
  }

  /**
   * Define the two-level menu.
   * @param {Array<{ id: string, label: string, items: Array<{ id?, label, callback }> }>} categories
   */
  setMenu(categories) {
    this._clearMenu();
    this._categories = categories.slice();
    this.selectedCategory = null;
    this.hoveredCategory = null;
    this.hoveredAction = null;
    this._lastHovered = { category: null, action: null };
    this._buildMenu();
  }

  toggle() {
    this.group.visible = !this.group.visible;
    if (this.group.visible) {
      this.selectedCategory = null;
      this.hoveredCategory = null;
      this.hoveredAction = null;
    }
  }

  show() {
    this.group.visible = true;
    this.selectedCategory = null;
    this.hoveredCategory = null;
    this.hoveredAction = null;
  }

  hide() {
    this.group.visible = false;
  }

  isVisible() {
    return this.group.visible;
  }

  /**
   * Called by the engine each frame. Keeps the wheel facing the user's head
   * and updates hover visual feedback.
   */
  update() {
    if (!this.group.visible) return;
    if (!this.engine?.camera) return;

    this.engine.camera.getWorldPosition(this._cameraPos);
    this.group.lookAt(this._cameraPos);

    this._updateHover();
    this._updateVisibility();
  }

  /**
   * HUD-compatible click handler used by InputRouter. Ray is in world space.
   * Returns true if a category or action was hit.
   */
  handlePointerClick(raycaster) {
    if (!this.group.visible) return false;

    const allMeshes = [...this._categoryMeshes, ...this._actionMeshes];
    if (allMeshes.length === 0) return false;

    const hits = raycaster.intersectObjects(allMeshes, false);
    if (hits.length === 0) return false;

    const hit = hits[0].object;
    const kind = hit.userData.kind;

    if (kind === 'category') {
      const catId = hit.userData.categoryId;
      if (this.selectedCategory === catId) {
        // Clicking the already-selected category returns to root selection.
        this.selectedCategory = null;
      } else {
        this.selectedCategory = catId;
      }
      this.hoveredCategory = catId;
      return true;
    }

    if (kind === 'action') {
      const { categoryId, actionIndex } = hit.userData;
      const category = this._categories.find((c) => c.id === categoryId);
      const action = category?.items?.[actionIndex];
      if (action?.callback) {
        this.feedback?.playSelect?.();
        action.callback();
      }
      this.hide();
      return true;
    }

    return false;
  }

  _buildMenu() {
    this._buildCategories();
    this._buildActions();
    this._buildConnectors();
    this._updateVisibility();
  }

  _buildCategories() {
    const count = this._categories.length;
    if (count === 0) return;

    const palette = [0x00ffcc, 0xff00cc, 0xccff00, 0x00ccff, 0xffcc00, 0xcc00ff];
    const angleStep = (Math.PI * 2) / count;

    for (let i = 0; i < count; i++) {
      const cat = this._categories[i];
      const angle = i * angleStep - Math.PI / 2;
      const material = new THREE.MeshBasicMaterial({
        color: palette[i % palette.length],
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
        map: this._createLabelTexture(cat.label),
      });
      this._categoryMaterials.push(material);

      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(this.nodeSize, this.nodeSize), material);
      mesh.position.set(
        Math.cos(angle) * this.categoryRadius,
        Math.sin(angle) * this.categoryRadius,
        0
      );
      mesh.userData.kind = 'category';
      mesh.userData.categoryId = cat.id;
      mesh.userData.categoryIndex = i;
      mesh.userData.baseScale = 1;
      this.group.add(mesh);
      this._categoryMeshes.push(mesh);
    }
  }

  _buildActions() {
    const size = this.nodeSize * 0.9;
    for (const cat of this._categories) {
      if (!cat.items?.length) continue;
      for (let i = 0; i < cat.items.length; i++) {
        const action = cat.items[i];
        const material = new THREE.MeshBasicMaterial({
          color: 0x88ccff,
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
          depthTest: false,
          depthWrite: false,
          map: this._createLabelTexture(action.label),
        });
        this._actionMaterials.push(material);

        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
        mesh.userData.kind = 'action';
        mesh.userData.categoryId = cat.id;
        mesh.userData.actionIndex = i;
        mesh.userData.baseScale = 1;
        mesh.visible = false;
        this.group.add(mesh);
        this._actionMeshes.push(mesh);
      }
    }
  }

  _buildConnectors() {
    if (this._connectorLines) {
      this.group.remove(this._connectorLines);
      this._connectorLines.geometry.dispose();
    }
    if (!this._connectorMaterial) {
      this._connectorMaterial = new THREE.LineBasicMaterial({
        color: 0x00ffcc,
        transparent: true,
        opacity: 0.35,
        depthTest: false,
        depthWrite: false,
      });
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(40 * 3), 3));
    this._connectorLines = new THREE.LineSegments(geometry, this._connectorMaterial);
    this._connectorLines.visible = false;
    this._connectorLines.frustumCulled = false;
    this.group.add(this._connectorLines);
  }

  _updateHover() {
    // Raycast in the menu's local space for stable hit testing.
    this.group.updateMatrixWorld();
    this._raycaster.ray.origin.copy(this.engine.camera.position);
    this.engine.camera.getWorldDirection(this._raycaster.ray.direction);
    this._raycaster.ray.applyMatrix4(new THREE.Matrix4().copy(this.group.matrixWorld).invert());

    const allMeshes = [...this._categoryMeshes, ...this._actionMeshes];
    const hits = this._raycaster.intersectObjects(allMeshes, false);

    let hitCategory = null;
    let hitAction = null;
    if (hits.length > 0) {
      const hit = hits[0].object;
      if (hit.userData.kind === 'category') {
        hitCategory = hit.userData.categoryId;
      } else if (hit.userData.kind === 'action') {
        hitAction = { categoryId: hit.userData.categoryId, index: hit.userData.actionIndex };
        hitCategory = hit.userData.categoryId;
      }
    }

    this.hoveredCategory = hitCategory ?? this.selectedCategory;
    this.hoveredAction = hitAction;

    if (
      hitCategory !== this._lastHovered.category ||
      hitAction?.categoryId !== this._lastHovered.action?.categoryId ||
      hitAction?.index !== this._lastHovered.action?.index
    ) {
      if (hitCategory || hitAction) {
        this.feedback?.playHover?.();
      }
      this._lastHovered.category = hitCategory;
      this._lastHovered.action = hitAction;
    }

    // Apply hover scale/opacity to all meshes.
    for (const mesh of this._categoryMeshes) {
      const isHover = mesh.userData.categoryId === this.hoveredCategory;
      this._applyHover(mesh, isHover);
    }
    for (const mesh of this._actionMeshes) {
      const isHover =
        mesh.userData.categoryId === this.hoveredAction?.categoryId &&
        mesh.userData.actionIndex === this.hoveredAction?.index;
      this._applyHover(mesh, isHover);
    }
  }

  _applyHover(mesh, isHover) {
    const targetScale = isHover ? 1.08 : 1;
    mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, 1), 0.25);
    mesh.material.opacity = isHover ? 1 : 0.85;
  }

  _updateVisibility() {
    const activeCategory = this.hoveredCategory || this.selectedCategory;

    // Categories always visible; dim non-hovered ones slightly.
    for (const mesh of this._categoryMeshes) {
      mesh.visible = true;
    }

    // Position and show action nodes for the active category.
    for (const mesh of this._actionMeshes) {
      const isActive = mesh.userData.categoryId === activeCategory;
      mesh.visible = isActive;
      if (isActive) {
        this._positionActionMesh(mesh);
      }
    }

    // Draw connector lines for the active category.
    if (activeCategory && this._connectorLines) {
      this._updateConnectors(activeCategory);
      this._connectorLines.visible = true;
    } else if (this._connectorLines) {
      this._connectorLines.visible = false;
    }
  }

  _positionActionMesh(mesh) {
    const catMesh = this._categoryMeshes.find(
      (m) => m.userData.categoryId === mesh.userData.categoryId
    );
    if (!catMesh) return;

    const categoryAngle = Math.atan2(catMesh.position.y, catMesh.position.x);
    const items = this._categories.find((c) => c.id === mesh.userData.categoryId)?.items ?? [];
    const count = items.length;
    const index = mesh.userData.actionIndex;
    const spread = Math.min(this.actionSpread, ((Math.PI * 2) / this._categories.length) * 0.9);
    const angle = categoryAngle - spread / 2 + (count > 1 ? (index / (count - 1)) * spread : 0);

    mesh.position.set(Math.cos(angle) * this.actionRadius, Math.sin(angle) * this.actionRadius, 0);
  }

  _updateConnectors(activeCategoryId) {
    const catMesh = this._categoryMeshes.find((m) => m.userData.categoryId === activeCategoryId);
    if (!catMesh) return;

    const activeActions = this._actionMeshes.filter(
      (m) => m.userData.categoryId === activeCategoryId
    );
    const positions = this._connectorLines.geometry.attributes.position.array;
    let idx = 0;
    for (const actionMesh of activeActions) {
      if (idx >= positions.length) break;
      positions[idx++] = catMesh.position.x;
      positions[idx++] = catMesh.position.y;
      positions[idx++] = catMesh.position.z;
      positions[idx++] = actionMesh.position.x;
      positions[idx++] = actionMesh.position.y;
      positions[idx++] = actionMesh.position.z;
    }
    // Zero out unused slots.
    for (let i = idx; i < positions.length; i++) positions[i] = 0;
    this._connectorLines.geometry.attributes.position.needsUpdate = true;
    this._connectorLines.geometry.setDrawRange(0, idx / 3);
  }

  _createLabelTexture(label) {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d') || this._createMockContext();

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = this.highContrast ? '#000000' : 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(0, 0, size, size);

    const fontSize = 28 * this.textScale;
    ctx.fillStyle = this.highContrast ? '#ffffff' : '#ffffff';
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const text = String(label ?? '').slice(0, 14);
    ctx.fillText(text, size / 2, size / 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }

  _clearMenu() {
    for (const mesh of this._categoryMeshes) {
      this.group.remove(mesh);
      mesh.geometry.dispose();
    }
    for (const mesh of this._actionMeshes) {
      this.group.remove(mesh);
      mesh.geometry.dispose();
    }
    for (const mat of this._categoryMaterials) {
      mat.map?.dispose();
      mat.dispose();
    }
    for (const mat of this._actionMaterials) {
      mat.map?.dispose();
      mat.dispose();
    }
    this._categoryMeshes = [];
    this._actionMeshes = [];
    this._categoryMaterials = [];
    this._actionMaterials = [];

    if (this._connectorLines) {
      this.group.remove(this._connectorLines);
      this._connectorLines.geometry.dispose();
      this._connectorLines = null;
    }
  }

  dispose() {
    this._clearMenu();
    if (this._connectorMaterial) {
      this._connectorMaterial.dispose();
      this._connectorMaterial = null;
    }
    if (this.group.parent) this.group.parent.remove(this.group);
  }

  _createMockContext() {
    const noOp = () => {};
    return {
      clearRect: noOp,
      fillRect: noOp,
      fillText: noOp,
      measureText: () => ({ width: 0 }),
      set fillStyle(_) {},
      set font(_) {},
      set textAlign(_) {},
      set textBaseline(_) {},
    };
  }
}
