import * as THREE from 'three';
import type { PanelLike } from '../coordinators/types.ts';

export interface WorkspaceSurfaceState {
  id: string;
  title?: string;
  position: number[];
  visible: boolean;
}

export interface WorkspaceSurfaceRegistrationOptions {
  recenter?: () => void;
  persist?: boolean;
}

/**
 * Sole lifecycle authority for persistent investigator-facing workspace panels.
 *
 * Rendering substrate is intentionally hidden behind PanelLike: legacy canvas
 * panels and UIKit SpatialPanels can coexist during migration, but callers use
 * one open/close/recenter/persistence contract.
 */
const MIN_VIEW_DISTANCE = 0.35;
const MAX_VIEW_DISTANCE = 2.5;
const RECOVERY_DISTANCE = 1.4;
const MIN_VIEW_DOT = -0.05;

export class WorkspaceSurfaceManager {
  private readonly cameraGroup: THREE.Group;
  private readonly viewer: THREE.Object3D;
  private readonly onChange: () => void;
  private readonly entries = new Map<
    string,
    {
      panel: PanelLike;
      recenter?: () => void;
      persist: boolean;
      priorOnHide?: (() => void) | null;
      priorOnDragEnd?: (() => void) | null;
    }
  >();
  private readonly idsByPanel = new WeakMap<object, string>();

  constructor(
    cameraGroup: THREE.Group,
    viewer: THREE.Object3D,
    options: { onChange?: () => void } = {}
  ) {
    this.cameraGroup = cameraGroup;
    this.viewer = viewer;
    this.onChange = options.onChange ?? (() => {});
  }

  get panels(): PanelLike[] {
    return [...this.entries.values()].map((entry) => entry.panel);
  }

  ids(): string[] {
    return [...this.entries.keys()];
  }

  has(id: string): boolean {
    return this.entries.has(id);
  }

  idFor(panel: PanelLike): string | null {
    return this.idsByPanel.get(panel as object) ?? null;
  }

  register(
    id: string,
    panel: PanelLike,
    options: WorkspaceSurfaceRegistrationOptions = {}
  ): void {
    if (!id) throw new Error('Workspace surface id is required');
    if (!panel.mesh) throw new Error(`Workspace surface [${id}] requires a mesh`);
    const existing = this.entries.get(id);
    if (existing?.panel === panel) return;
    if (existing) this.unregister(id);

    const priorOnHide = panel.onHide;
    const priorOnDragEnd = panel.onDragEnd;
    panel.onHide = () => {
      priorOnHide?.();
      this._notifyChange();
    };
    panel.onDragEnd = () => {
      priorOnDragEnd?.();
      this._notifyChange();
    };

    this.entries.set(id, {
      panel,
      recenter: options.recenter,
      persist: options.persist ?? true,
      priorOnHide,
      priorOnDragEnd,
    });
    this.idsByPanel.set(panel as object, id);
  }

  unregister(idOrPanel: string | PanelLike): void {
    const id =
      typeof idOrPanel === 'string'
        ? idOrPanel
        : this.idsByPanel.get(idOrPanel as object);
    if (!id) return;
    const entry = this.entries.get(id);
    if (!entry) return;
    const { panel, priorOnHide, priorOnDragEnd } = entry;
    panel.onHide = priorOnHide ?? null;
    panel.onDragEnd = priorOnDragEnd ?? null;
    this.entries.delete(id);
    this.idsByPanel.delete(panel as object);
  }

  isVisible(id: string): boolean {
    return !!this.entries.get(id)?.panel.mesh?.visible;
  }

  toggle(id: string): boolean {
    return this.isVisible(id) ? (this.hide(id), false) : this.show(id);
  }

  show(id: string): boolean {
    const entry = this.entries.get(id);
    if (!entry) return false;
    const panel = entry.panel;
    this._ensureReachable(entry);
    if (panel.show) panel.show();
    // SpatialPanel/UIKit surfaces intentionally do not expose MovablePanel's
    // show()/hide() lifecycle. Visibility therefore always has to be applied
    // to the common mesh contract, even when a legacy show() hook exists.
    if (panel.mesh) {
      panel.mesh.visible = true;
      if (panel.isMinimized != null) panel.isMinimized = false;
      if (panel.tilt != null) panel.mesh.rotation.x = -panel.tilt;
      panel.render?.();
    }
    this._ensureReachable(entry);
    this._notifyChange();
    return !!panel.mesh?.visible;
  }

  hide(id: string): boolean {
    const entry = this.entries.get(id);
    if (!entry) return false;
    const panel = entry.panel;
    if (panel.hide) panel.hide();
    // See show(): mesh visibility is the substrate-neutral lifecycle contract.
    if (panel.mesh) panel.mesh.visible = false;
    this._notifyChange();
    return !panel.mesh?.visible;
  }

  recenter(id: string): boolean {
    const entry = this.entries.get(id);
    if (!entry) return false;
    this._recenterEntry(entry);
    if (!this._isReachable(entry.panel)) this._clampIntoViewerEnvelope(entry);
    this._notifyChange();
    return true;
  }

  recenterAll(): void {
    for (const entry of this.entries.values()) {
      this._recenterEntry(entry);
      if (!this._isReachable(entry.panel)) this._clampIntoViewerEnvelope(entry);
    }
    this._notifyChange();
  }

  capturePositions(): WorkspaceSurfaceState[] {
    const states: WorkspaceSurfaceState[] = [];
    this.cameraGroup.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(this.cameraGroup.matrixWorld).invert();
    for (const [id, entry] of this.entries) {
      if (!entry.persist || !entry.panel.mesh) continue;
      const world = new THREE.Vector3();
      entry.panel.mesh.getWorldPosition(world);
      world.applyMatrix4(inv);
      states.push({
        id,
        title: entry.panel.title,
        position: world.toArray(),
        visible: !!entry.panel.mesh.visible,
      });
    }
    return states;
  }

  restorePositions(
    data: Array<{ id: string; title?: string; position?: number[]; visible?: boolean }> = []
  ): void {
    this.cameraGroup.updateMatrixWorld(true);
    for (const item of data) {
      const entry = this.entries.get(item.id);
      if (!entry?.panel.mesh) continue;
      if (
        Array.isArray(item.position) &&
        item.position.length === 3 &&
        item.position.every((value) => typeof value === 'number' && Number.isFinite(value))
      ) {
        const world = new THREE.Vector3().fromArray(item.position);
        world.applyMatrix4(this.cameraGroup.matrixWorld);
        const parent = entry.panel.mesh.parent;
        if (parent) {
          parent.updateMatrixWorld(true);
          world.applyMatrix4(new THREE.Matrix4().copy(parent.matrixWorld).invert());
        }
        entry.panel.mesh.position.copy(world);
      }
      const id = this.idsByPanel.get(entry.panel as object);
      if (!id) continue;
      if (item.visible) this.show(id);
      else this.hide(id);
    }
  }

  dispose(): void {
    for (const id of [...this.entries.keys()]) this.unregister(id);
  }

  private _recenterEntry(entry: { panel: PanelLike; recenter?: () => void }): void {
    if (entry.recenter) {
      entry.recenter();
      return;
    }
    const panel = entry.panel;
    if (panel.resetToDefaultPosition) {
      panel.resetToDefaultPosition();
      return;
    }
    if (panel.mesh && panel.defaultPosition) {
      panel.mesh.position.copy(panel.defaultPosition);
      if (panel.tilt != null) panel.mesh.rotation.x = -panel.tilt;
      panel.mesh.updateMatrixWorld(true);
    }
  }

  private _ensureReachable(entry: { panel: PanelLike; recenter?: () => void }): void {
    if (this._isReachable(entry.panel)) return;
    this._recenterEntry(entry);
    if (this._isReachable(entry.panel)) return;
    this._clampIntoViewerEnvelope(entry);
  }

  private _isReachable(panel: PanelLike): boolean {
    const metrics = this._viewerMetrics(panel);
    if (!metrics) return false;
    return (
      metrics.distance >= MIN_VIEW_DISTANCE &&
      metrics.distance <= MAX_VIEW_DISTANCE &&
      metrics.viewDot >= MIN_VIEW_DOT
    );
  }

  private _viewerMetrics(panel: PanelLike): {
    viewerPos: THREE.Vector3;
    panelPos: THREE.Vector3;
    forward: THREE.Vector3;
    direction: THREE.Vector3;
    distance: number;
    viewDot: number;
  } | null {
    const mesh = panel.mesh;
    if (!mesh) return null;
    this.viewer.updateMatrixWorld(true);
    mesh.updateMatrixWorld(true);

    const viewerPos = new THREE.Vector3();
    const panelPos = new THREE.Vector3();
    const forward = new THREE.Vector3();
    this.viewer.getWorldPosition(viewerPos);
    mesh.getWorldPosition(panelPos);
    this.viewer.getWorldDirection(forward);
    const toPanel = panelPos.clone().sub(viewerPos);
    const distance = toPanel.length();
    const direction =
      distance > 1e-6 ? toPanel.clone().normalize() : forward.clone().normalize();
    const viewDot = distance > 1e-6 ? forward.dot(direction) : -1;
    return { viewerPos, panelPos, forward, direction, distance, viewDot };
  }

  private _clampIntoViewerEnvelope(entry: { panel: PanelLike }): void {
    const mesh = entry.panel.mesh;
    const metrics = this._viewerMetrics(entry.panel);
    if (!mesh || !metrics) return;

    const direction =
      metrics.viewDot >= 0.15
        ? metrics.direction
        : metrics.forward.clone().normalize();
    const targetDistance =
      metrics.distance < MIN_VIEW_DISTANCE
        ? 0.8
        : Math.min(RECOVERY_DISTANCE, MAX_VIEW_DISTANCE - 0.1);
    const targetWorld = metrics.viewerPos.clone().add(direction.multiplyScalar(targetDistance));

    const parent = mesh.parent;
    if (parent) {
      parent.updateMatrixWorld(true);
      targetWorld.applyMatrix4(new THREE.Matrix4().copy(parent.matrixWorld).invert());
    }
    mesh.position.copy(targetWorld);
    // resetToDefaultPosition cannot be used here: it would restore the invalid
    // default that triggered recovery. Re-orientation remains panel-owned via
    // show()/update(); this manager owns only reachability.
    mesh.updateMatrixWorld(true);
  }

  private _notifyChange(): void {
    try {
      this.onChange();
    } catch {
      // Presentation persistence must never break interaction.
    }
  }
}
