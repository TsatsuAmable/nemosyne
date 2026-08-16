import * as THREE from 'three';
import type {
  AccessibilityOptions,
  FeedbackLike,
  HandLike,
  WheelMenuAction,
  WheelMenuCategory,
} from '../coordinators/types.ts';

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

interface HandWheelMenuEngine {
  camera?: THREE.Camera;
  cameraGroup?: THREE.Group;
  input?: { feedback?: FeedbackLike; pointers?: { getBestPointerRay(): THREE.Ray | null } };
}

interface HandWheelMenuOptions {
  actions?: WheelMenuAction[];
  menu?: WheelMenuCategory[];
  anchorToHand?: boolean;
  analystAnchor?: THREE.Group;
  offsetX?: number;
  offsetY?: number;
  offsetZ?: number;
  categoryRadius?: number;
  actionRadius?: number;
  nodeSize?: number;
  actionSpread?: number;
  openAngleThreshold?: number;
  closeAngleThreshold?: number;
  hoverDelayMs?: number;
  feedback?: FeedbackLike;
}

interface HoverTarget {
  categoryId: string;
  index: number;
}

export class HandWheelMenu {
  engine: HandWheelMenuEngine;
  hand: HandLike;
  group: THREE.Group;
  offset: THREE.Vector3;

  categoryRadius: number;
  actionRadius: number;
  nodeSize: number;
  actionSpread: number;
  openAngleThreshold: number;
  closeAngleThreshold: number;
  hoverDelayMs: number;
  feedback: FeedbackLike | null;

  selectedCategory: string | null;
  hoveredCategory: string | null;
  hoveredAction: HoverTarget | null;
  onVisibility: ((visible: boolean, via: 'toggle' | 'show' | 'hide') => void) | null = null;

  textScale: number;
  highContrast: boolean;
  colorblindMode: string | boolean;

  private _cameraPos: THREE.Vector3;
  private _pointerAngle: number | null;
  private _hoverStart: { category: string | null; action: HoverTarget | null; at: number };
  private _lastHovered: { category: string | null; action: HoverTarget | null };
  private _previousHoveredAction: WheelMenuAction | null;

  private _categories: WheelMenuCategory[];
  private _categoryMeshes: THREE.Mesh[];
  private _actionMeshes: THREE.Mesh[];
  private _connectorLines: THREE.LineSegments | null;
  private _connectorMaterial: THREE.LineBasicMaterial | null;
  private _raycaster: THREE.Raycaster;
  private _categoryMaterials: THREE.MeshBasicMaterial[];
  private _actionMaterials: THREE.MeshBasicMaterial[];

  constructor(engine: HandWheelMenuEngine, hand: HandLike, options: HandWheelMenuOptions = {}) {
    this.engine = engine;
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
        options.offsetY ?? -0.1,
        options.offsetZ ?? -0.42
      );
    }
    this.group.position.copy(this.offset);

    this.categoryRadius = options.categoryRadius ?? 0.095;
    this.actionRadius = options.actionRadius ?? 0.22;
    this.nodeSize = options.nodeSize ?? 0.065;
    this.actionSpread = options.actionSpread ?? Math.PI / 2.2;

    this.openAngleThreshold = options.openAngleThreshold ?? 0;
    this.closeAngleThreshold = options.closeAngleThreshold ?? Infinity;
    this.hoverDelayMs = options.hoverDelayMs ?? 0;

    this.feedback = options.feedback ?? engine?.input?.feedback ?? null;

    this._cameraPos = new THREE.Vector3();
    this._pointerAngle = null;
    this._hoverStart = { category: null, action: null, at: 0 };
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
    this._previousHoveredAction = null;

    if (options.actions) this.setActions(options.actions);
    if (options.menu) this.setMenu(options.menu);
  }

  applyAccessibility({
    textScale,
    highContrast,
    colorblindMode,
  }: Partial<AccessibilityOptions>): void {
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

  _rebuildMenuTextures(): void {
    for (const mesh of this._categoryMeshes) {
      const cat = this._categories[mesh.userData.categoryIndex];
      if (cat) {
        const material = mesh.material as THREE.MeshBasicMaterial;
        material.map?.dispose?.();
        material.map = this._createLabelTexture(cat);
      }
    }
    for (const mesh of this._actionMeshes) {
      const cat = this._categories.find((c) => c.id === mesh.userData.categoryId);
      const action = cat?.items?.[mesh.userData.actionIndex];
      if (action) {
        const material = mesh.material as THREE.MeshBasicMaterial;
        material.map?.dispose?.();
        material.map = this._createLabelTexture(action);
      }
    }
  }

  /**
   * Backward-compatible flat action list. Wrapped into one category.
   */
  setActions(actions: WheelMenuAction[]): void {
    this.setMenu([{ id: 'actions', label: 'Actions', items: actions.slice() }]);
  }

  /**
   * Define the two-level menu.
   */
  setMenu(categories: WheelMenuCategory[]): void {
    this._clearMenu();
    this._categories = categories.slice();
    this.selectedCategory = null;
    this.hoveredCategory = null;
    this.hoveredAction = null;
    this._lastHovered = { category: null, action: null };
    this._buildMenu();
  }

  toggle(): void {
    const wasVisible = this.group.visible;
    this.group.visible = !this.group.visible;
    if (wasVisible) {
      this._clearHoveredActionCallbacks();
    } else {
      this.selectedCategory = null;
      this.hoveredCategory = null;
      this.hoveredAction = null;
    }
    this.onVisibility?.(this.group.visible, 'toggle');
  }

  show(): void {
    this.group.visible = true;
    this.selectedCategory = null;
    this.hoveredCategory = null;
    this.hoveredAction = null;
    this.onVisibility?.(true, 'show');
  }

  hide(): void {
    this.group.visible = false;
    this._clearHoveredActionCallbacks();
    this.onVisibility?.(false, 'hide');
  }

  isVisible(): boolean {
    return this.group.visible;
  }

  private _findAction(categoryId: string, actionIndex: number): WheelMenuAction | null {
    const category = this._categories.find((c) => c.id === categoryId);
    return category?.items?.[actionIndex] ?? null;
  }

  private _clearHoveredActionCallbacks(): void {
    const prevAction = this._previousHoveredAction;
    if (prevAction?.onLeave) {
      try {
        prevAction.onLeave();
      } catch (e) {
        console.error('[HandWheelMenu] onLeave error', e);
      }
    }
    this._previousHoveredAction = null;
  }

  /**
   * Called by the engine each frame. Keeps the wheel facing the user's head
   * and updates hover visual feedback.
   */
  update(_delta?: number, _time?: number): void {
    if (!this.group.visible) return;
    if (!this.engine?.camera) return;

    this.engine.camera.getWorldPosition(this._cameraPos);
    this.group.lookAt(this._cameraPos);

    this._updatePointerAngle();
    this._updateHover();
    this._updateVisibility();
  }

  /**
   * Record the current pointer angle relative to the wheel center.
   *
   * Sources the ray from the active pointer (controller/hand ray via
   * `engine.input.pointers.getBestPointerRay()`) — the same ray used for click
   * selection — so the open/close zone logic agrees with where the user is
   * pointing rather than where they are looking. When no pointer is active the
   * angle is cleared (null), which the zone helpers treat as "no constraint".
   */
  _updatePointerAngle(): void {
    if (!this.group || !this.engine || !this.engine.camera) return;
    this.group.updateMatrixWorld();
    const ray = this.engine.input?.pointers?.getBestPointerRay?.();
    if (!ray) {
      this._pointerAngle = null;
      return;
    }
    this._raycaster.ray.origin.copy(ray.origin);
    this._raycaster.ray.direction.copy(ray.direction);
    this._raycaster.ray.applyMatrix4(new THREE.Matrix4().copy(this.group.matrixWorld).invert());
    this._pointerAngle = Math.atan2(
      this._raycaster.ray.direction.y,
      this._raycaster.ray.direction.x
    );
  }

  /**
   * HUD-compatible click handler used by InputRouter. Ray is in world space.
   * Returns true if a category or action was hit.
   */
  handlePointerClick(raycaster: THREE.Raycaster): boolean {
    if (!this.group.visible) return false;

    const allMeshes = [...this._categoryMeshes, ...this._actionMeshes];
    if (allMeshes.length === 0) return false;

    this.group.updateMatrixWorld(true);
    const hits = raycaster.intersectObjects(allMeshes, false);
    if (hits.length === 0) return false;

    const hit = hits[0].object as THREE.Mesh;
    const kind = hit.userData.kind;

    if (kind === 'category') {
      const catId: string = hit.userData.categoryId;
      if (this.selectedCategory === catId) {
        this.selectedCategory = null;
      } else {
        this.selectedCategory = catId;
      }
      this.hoveredCategory = catId;
      return true;
    }

    if (kind === 'action') {
      const { categoryId, actionIndex } = hit.userData as { categoryId: string; actionIndex: number };
      const category = this._categories.find((c) => c.id === categoryId);
      const action = category?.items?.[actionIndex];
      if (action) {
        const name = action.label || action.id || 'menu-action';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (typeof (this.engine as any)?.telemetry?.recordMenuAction === 'function') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (this.engine as any).telemetry.recordMenuAction(name);
        }
        this.feedback?.playSelect?.();
        if (action.callback) action.callback();
      }
      this.hide();
      return true;
    }

    return false;
  }

  private _buildMenu(): void {
    this._buildCategories();
    this._buildActions();
    this._buildConnectors();
    this._updateVisibility();
  }

  private _buildCategories(): void {
    const count = this._categories.length;
    if (count === 0) return;

    const palette = [0x00ffcc, 0xff00cc, 0xccff00, 0x00ccff, 0xffcc00, 0xcc00ff];
    const half = Math.ceil(count / 2);

    for (let i = 0; i < count; i++) {
      const cat = this._categories[i];
      const isLeft = i < half;
      const colIndex = isLeft ? i : i - half;
      const colTotal = isLeft ? half : count - half;

      // Vertical position calculation: centered vertically around y = 0
      const posX = isLeft ? -0.36 : 0.36;
      const posY = (colTotal > 1 ? (colIndex - (colTotal - 1) / 2) : 0) * 0.085;

      const colorHex = palette[i % palette.length];
      const material = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
        map: this._createLabelTexture(cat, colorHex),
      });
      this._categoryMaterials.push(material);

      // Wide rectangular pill geometry for clear, unbunched text
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.075), material);
      mesh.position.set(posX, posY, 0);
      mesh.userData.kind = 'category';
      mesh.userData.categoryId = cat.id;
      mesh.userData.categoryIndex = i;
      mesh.userData.isLeft = isLeft;
      mesh.userData.baseScale = 1;
      this.group.add(mesh);
      this._categoryMeshes.push(mesh);
    }
  }

  private _buildActions(): void {
    for (const cat of this._categories) {
      if (!cat.items?.length) continue;
      for (let i = 0; i < cat.items.length; i++) {
        const action = cat.items[i];
        const material = new THREE.MeshBasicMaterial({
          color: 0x00ffcc,
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide,
          depthTest: false,
          depthWrite: false,
          map: this._createLabelTexture(action, 0x00ffcc),
        });
        this._actionMaterials.push(material);

        // Wide action pill geometry
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.065), material);
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

  private _buildConnectors(): void {
    if (this._connectorLines) {
      this.group.remove(this._connectorLines);
      this._connectorLines.geometry.dispose();
    }
    if (!this._connectorMaterial) {
      this._connectorMaterial = new THREE.LineBasicMaterial({
        color: 0x00ffcc,
        transparent: true,
        opacity: 0.6,
        linewidth: 2,
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

  _updateHover(): void {
    // Raycast in the menu's local space for stable hit testing. The ray is
    // sourced from the active pointer (controller/hand ray via
    // `engine.input.pointers.getBestPointerRay()`) — the same ray used for click
    // selection — so the highlighted item is the one a pinch will actually
    // activate. Previously this used head gaze, so the highlight could sit on a
    // different item than the pointer-select (misselection). When no pointer is
    // active, no hit is recorded and `hoveredCategory` falls back to the selected
    // category (see below), keeping that category's actions visible.
    if (!this.group || !this.engine || !this.engine.camera) return;
    this.group.updateMatrixWorld();
    const ray = this.engine.input?.pointers?.getBestPointerRay?.();

    let hitCategory: string | null = null;
    let hitAction: HoverTarget | null = null;
    if (ray) {
      this._raycaster.ray.origin.copy(ray.origin);
      this._raycaster.ray.direction.copy(ray.direction);
      this._raycaster.ray.applyMatrix4(new THREE.Matrix4().copy(this.group.matrixWorld).invert());
      const allMeshes = [...this._categoryMeshes, ...this._actionMeshes];
      const hits = this._raycaster.intersectObjects(allMeshes, false);
      if (hits.length > 0) {
        const hit = hits[0].object as THREE.Mesh;
        if (hit.userData.kind === 'category') {
          hitCategory = hit.userData.categoryId;
        } else if (hit.userData.kind === 'action') {
          hitAction = { categoryId: hit.userData.categoryId, index: hit.userData.actionIndex };
          hitCategory = hit.userData.categoryId;
        }
      }
    }

    const now = performance.now();
    const isSameHover =
      hitCategory === this._lastHovered.category &&
      hitAction?.categoryId === this._lastHovered.action?.categoryId &&
      hitAction?.index === this._lastHovered.action?.index;

    if (!isSameHover) {
      this._hoverStart = { category: hitCategory, action: hitAction, at: now };
      this._lastHovered = { category: hitCategory, action: hitAction };
    }

    const elapsed = now - this._hoverStart.at;
    const hoverConfirmed = hitCategory != null && elapsed >= this.hoverDelayMs;

    this.hoveredCategory = hitCategory ?? this.selectedCategory;
    this.hoveredAction = hoverConfirmed ? hitAction : null;

    if (hoverConfirmed && (hitCategory || hitAction)) {
      this.feedback?.playHover?.();
    }

    // Fire optional item hover/leave callbacks when the confirmed action changes.
    const prevAction = this._previousHoveredAction;
    const nextAction = this.hoveredAction
      ? this._findAction(this.hoveredAction.categoryId, this.hoveredAction.index)
      : null;
    if (prevAction !== nextAction) {
      if (prevAction?.onLeave) {
        try {
          prevAction.onLeave();
        } catch (e) {
          console.error('[HandWheelMenu] onLeave error', e);
        }
      }
      if (nextAction?.onHover) {
        try {
          nextAction.onHover();
        } catch (e) {
          console.error('[HandWheelMenu] onHover error', e);
        }
      }
      this._previousHoveredAction = nextAction;
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

  _applyHover(mesh: THREE.Mesh, isHover: boolean): void {
    const targetScale = isHover ? 1.08 : 1;
    mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, 1), 0.25);
    const material = mesh.material as THREE.MeshBasicMaterial;
    material.opacity = isHover ? 1 : 0.85;
  }

  _updateVisibility(): void {
    const activeCategory = this.hoveredCategory || this.selectedCategory;

    for (const mesh of this._categoryMeshes) {
      mesh.visible = true;
    }

    for (const mesh of this._actionMeshes) {
      const isActive = mesh.userData.categoryId === activeCategory;
      mesh.visible = isActive;
      if (isActive) {
        this._positionActionMesh(mesh);
      }
    }

    if (activeCategory && this._connectorLines) {
      this._updateConnectors(activeCategory);
      this._connectorLines.visible = true;
    } else if (this._connectorLines) {
      this._connectorLines.visible = false;
    }
  }

  private _positionActionMesh(mesh: THREE.Mesh): void {
    const catMesh = this._categoryMeshes.find(
      (m) => m.userData.categoryId === mesh.userData.categoryId
    );
    if (!catMesh) return;

    const isLeft = catMesh.userData.isLeft;
    const items = this._categories.find((c) => c.id === mesh.userData.categoryId)?.items ?? [];
    const count = items.length;
    const index: number = mesh.userData.actionIndex;

    // Expand action pills horizontally outward (left to the left, right to the right)
    const offsetX = isLeft ? -0.25 : +0.25;
    const offsetY = (count > 1 ? (index - (count - 1) / 2) : 0) * 0.075;

    mesh.position.set(catMesh.position.x + offsetX, catMesh.position.y + offsetY, 0);
  }

  private _updateConnectors(activeCategoryId: string): void {
    const catMesh = this._categoryMeshes.find((m) => m.userData.categoryId === activeCategoryId);
    if (!catMesh || !this._connectorLines) return;

    const activeActions = this._actionMeshes.filter(
      (m) => m.userData.categoryId === activeCategoryId
    );
    const positions = this._connectorLines.geometry.attributes.position.array as Float32Array;
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

  private _createLabelTexture(
    item: WheelMenuCategory | WheelMenuAction | { label?: string; icon?: string } | string,
    accentColor: number = 0x00ffcc
  ): THREE.CanvasTexture {
    const { label = '', icon = null } =
      item != null && typeof item === 'object' ? (item as { label?: string; icon?: string }) : { label: item };
    
    const width = 512;
    const height = 160;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d') || this._createMockContext();

    ctx.clearRect(0, 0, width, height);

    // Dark pill background with vibrant category accent border
    const hexStr = '#' + accentColor.toString(16).padStart(6, '0');
    ctx.fillStyle = this.highContrast ? '#050a12' : 'rgba(10, 18, 32, 0.94)';
    
    if (typeof ctx?.beginPath === 'function') {
      ctx.beginPath();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (typeof (ctx as any).roundRect === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ctx as any).roundRect(8, 8, width - 16, height - 16, 24);
      } else {
        ctx.rect(8, 8, width - 16, height - 16);
      }
      ctx.fill();

      ctx.strokeStyle = this.highContrast ? '#00ffff' : hexStr;
      ctx.lineWidth = 8;
      ctx.stroke();
    }

    const text = String(label ?? '').slice(0, 24);

    if (icon) {
      const iconSize = 72 * this.textScale;
      ctx.font = `${iconSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = this.highContrast ? '#ffffff' : hexStr;
      ctx.fillText(icon, 70, height / 2);

      ctx.font = `bold 32px sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, 130, height / 2);
    } else {
      const fontSize = 34 * this.textScale;
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, width / 2, height / 2);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }

  private _clearMenu(): void {
    for (const mesh of this._categoryMeshes) {
      this.group.remove(mesh);
      mesh.geometry.dispose();
    }
    for (const mesh of this._actionMeshes) {
      this.group.remove(mesh);
      mesh.geometry.dispose();
    }
    for (const mat of this._categoryMaterials) {
      mat.map?.dispose?.();
      mat.dispose();
    }
    for (const mat of this._actionMaterials) {
      mat.map?.dispose?.();
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

  dispose(): void {
    this._clearMenu();
    if (this._connectorMaterial) {
      this._connectorMaterial.dispose();
      this._connectorMaterial = null;
    }
    if (this.group.parent) this.group.parent.remove(this.group);
  }

  private _createMockContext(): CanvasRenderingContext2D {
    const noOp = () => {};
    return {
      clearRect: noOp,
      fillRect: noOp,
      fillText: noOp,
      measureText: () => ({ width: 0 }),
      set fillStyle(_value: unknown) {},
      set font(_value: unknown) {},
      set textAlign(_value: unknown) {},
      set textBaseline(_value: unknown) {},
    } as unknown as CanvasRenderingContext2D;
  }
}
