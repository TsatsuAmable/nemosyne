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

/** Explicit lifecycle boundary for a persistent investigator workspace surface. */
export interface WorkspaceSurface {
  panel: PanelLike;
  root: THREE.Object3D;
  isOpen(): boolean;
  open(): void;
  close(): void;
  recenter(): void;
}

/**
 * Sole lifecycle authority for persistent investigator-facing workspace panels.
 *
 * Rendering substrate is isolated at registration. Legacy canvas panels and
 * UIKit SpatialPanels are adapted once by registerPanel(); manager lifecycle
 * code thereafter depends only on the explicit WorkspaceSurface contract.
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
      surface: WorkspaceSurface;
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
    return [...this.entries.values()].map((entry) => entry.surface.panel);
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

  registerPanel(
    id: string,
    panel: PanelLike,
    options: WorkspaceSurfaceRegistrationOptions = {}
  ): void {
    if (!panel.mesh) throw new Error('Workspace surface [' + id + '] requires a mesh');
    const root = panel.mesh;
    this.register(
      id,
      {
        panel,
        root,
        isOpen: () => root.visible,
        open: () => {
          panel.show?.();
          root.visible = true;
          if (panel.isMinimized != null) panel.isMinimized = false;
          if (panel.tilt != null) root.rotation.x = -panel.tilt;
          panel.render?.();
        },
        close: () => {
          panel.hide?.();
          root.visible = false;
        },
        recenter: () => {
          if (options.recenter) options.recenter();
          else if (panel.resetToDefaultPosition) panel.resetToDefaultPosition();
          else if (panel.defaultPosition) {
            root.position.copy(panel.defaultPosition);
            if (panel.tilt != null) root.rotation.x = -panel.tilt;
            root.updateMatrixWorld(true);
          }
        },
      },
      options
    );
  }

  register(
    id: string,
    surface: WorkspaceSurface,
    options: WorkspaceSurfaceRegistrationOptions = {}
  ): void {
    if (!id) throw new Error('Workspace surface id is required');
    const panel = surface.panel;
    const existing = this.entries.get(id);
    if (existing?.surface === surface || existing?.surface.panel === panel) return;
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
      surface,
      persist: options.persist ?? true,
      priorOnHide,
      priorOnDragEnd,
    });
    this.idsByPanel.set(panel as object, id);
  }

  unregister(idOrPanel: string | PanelLike): void {
    const id = typeof idOrPanel === 'string' ? idOrPanel : this.idsByPanel.get(idOrPanel as object);
    if (!id) return;
    const entry = this.entries.get(id);
    if (!entry) return;
    const { surface, priorOnHide, priorOnDragEnd } = entry;
    const panel = surface.panel;
    panel.onHide = priorOnHide ?? null;
    panel.onDragEnd = priorOnDragEnd ?? null;
    this.entries.delete(id);
    this.idsByPanel.delete(panel as object);
  }

  isVisible(id: string): boolean {
    return this.entries.get(id)?.surface.isOpen() ?? false;
  }

  toggle(id: string): boolean {
    return this.isVisible(id) ? (this.hide(id), false) : this.show(id);
  }

  show(id: string): boolean {
    const entry = this.entries.get(id);
    if (!entry) return false;
    this._ensureReachable(entry);
    entry.surface.open();
    this._ensureReachable(entry);
    this._notifyChange();
    return entry.surface.isOpen();
  }

  hide(id: string): boolean {
    const entry = this.entries.get(id);
    if (!entry) return false;
    entry.surface.close();
    this._notifyChange();
    return !entry.surface.isOpen();
  }

  recenter(id: string): boolean {
    const entry = this.entries.get(id);
    if (!entry) return false;
    this._recenterEntry(entry);
    if (!this._isReachable(entry.surface)) this._clampIntoViewerEnvelope(entry);
    this._notifyChange();
    return true;
  }

  recenterAll(): void {
    for (const entry of this.entries.values()) {
      this._recenterEntry(entry);
      if (!this._isReachable(entry.surface)) this._clampIntoViewerEnvelope(entry);
    }
    this._notifyChange();
  }

  capturePositions(): WorkspaceSurfaceState[] {
    const states: WorkspaceSurfaceState[] = [];
    this.cameraGroup.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(this.cameraGroup.matrixWorld).invert();
    for (const [id, entry] of this.entries) {
      if (!entry.persist || !entry.surface.root) continue;
      const world = new THREE.Vector3();
      entry.surface.root.getWorldPosition(world);
      world.applyMatrix4(inv);
      states.push({
        id,
        title: entry.surface.panel.title,
        position: world.toArray(),
        visible: entry.surface.isOpen(),
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
      if (!entry) continue;
      if (
        Array.isArray(item.position) &&
        item.position.length === 3 &&
        item.position.every((value) => typeof value === 'number' && Number.isFinite(value))
      ) {
        const world = new THREE.Vector3().fromArray(item.position);
        world.applyMatrix4(this.cameraGroup.matrixWorld);
        const parent = entry.surface.root.parent;
        if (parent) {
          parent.updateMatrixWorld(true);
          world.applyMatrix4(new THREE.Matrix4().copy(parent.matrixWorld).invert());
        }
        entry.surface.root.position.copy(world);
      }
      const id = this.idsByPanel.get(entry.surface.panel as object);
      if (!id) continue;
      if (item.visible) this.show(id);
      else this.hide(id);
    }
  }

  dispose(): void {
    for (const id of [...this.entries.keys()]) this.unregister(id);
  }

  private _recenterEntry(entry: { surface: WorkspaceSurface }): void {
    entry.surface.recenter();
  }

  private _ensureReachable(entry: { surface: WorkspaceSurface }): void {
    if (this._isReachable(entry.surface)) return;
    this._recenterEntry(entry);
    if (this._isReachable(entry.surface)) return;
    this._clampIntoViewerEnvelope(entry);
  }

  private _isReachable(surface: WorkspaceSurface): boolean {
    const metrics = this._viewerMetrics(surface);
    if (!metrics) return false;
    return (
      metrics.distance >= MIN_VIEW_DISTANCE &&
      metrics.distance <= MAX_VIEW_DISTANCE &&
      metrics.viewDot >= MIN_VIEW_DOT
    );
  }

  private _viewerMetrics(surface: WorkspaceSurface): {
    viewerPos: THREE.Vector3;
    panelPos: THREE.Vector3;
    forward: THREE.Vector3;
    direction: THREE.Vector3;
    distance: number;
    viewDot: number;
  } | null {
    const mesh = surface.root;
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
    const direction = distance > 1e-6 ? toPanel.clone().normalize() : forward.clone().normalize();
    const viewDot = distance > 1e-6 ? forward.dot(direction) : -1;
    return { viewerPos, panelPos, forward, direction, distance, viewDot };
  }

  private _clampIntoViewerEnvelope(entry: { surface: WorkspaceSurface }): void {
    const mesh = entry.surface.root;
    const metrics = this._viewerMetrics(entry.surface);
    if (!metrics) return;
    const direction =
      metrics.viewDot >= 0.15 ? metrics.direction : metrics.forward.clone().normalize();
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
