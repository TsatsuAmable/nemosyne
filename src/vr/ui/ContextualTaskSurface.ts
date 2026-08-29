import * as THREE from 'three';
import { Container, Text } from '@pmndrs/uikit';
import { SpatialPanel } from '../ui-system/SpatialPanel.ts';
import { Button } from '../ui-system/components/Button.ts';
import { COLOR_TOKENS, TYPOGRAPHY_TOKENS } from '../ui-system/tokens.ts';
import type { PanelBudgetController } from '../ui-system/PanelBudgetController.ts';
import type { EngineLike, PointerLike } from '../coordinators/types.ts';

export type TopologyType =
  | 'TABULAR'
  | 'GRAPH'
  | 'TIME_SERIES'
  | 'SPATIAL'
  | 'HIERARCHICAL'
  | 'STREAM';

export type TaskIntent = 'Data' | 'Analyse' | 'View' | 'Study' | 'Portals';

export interface TaskSurfaceAction {
  id: string;
  label: string;
  intent: TaskIntent;
  relevantTopologies: readonly TopologyType[];
  description: string;
}

export const TASK_SURFACE_ACTIONS: readonly TaskSurfaceAction[] = [
  // Data Intent
  { id: 'load_dataset', label: 'Load Dataset', intent: 'Data', relevantTopologies: ['TABULAR', 'GRAPH', 'TIME_SERIES', 'SPATIAL', 'HIERARCHICAL', 'STREAM'], description: 'Open dataset registry' },
  { id: 'connect_stream', label: 'Connect Live Source', intent: 'Data', relevantTopologies: ['STREAM', 'TIME_SERIES'], description: 'Connect WebSocket / Arrow telemetry feed' },
  { id: 'export_state', label: 'Export Snapshot', intent: 'Data', relevantTopologies: ['TABULAR', 'GRAPH', 'TIME_SERIES', 'SPATIAL', 'HIERARCHICAL', 'STREAM'], description: 'Save current spatial state' },

  // Analyse Intent
  { id: 'find_communities', label: 'Find Communities', intent: 'Analyse', relevantTopologies: ['GRAPH', 'HIERARCHICAL'], description: 'Detect modular network partitions' },
  { id: 'filter_range', label: 'Filter Range', intent: 'Analyse', relevantTopologies: ['TABULAR', 'TIME_SERIES', 'SPATIAL'], description: 'Apply numerical slice filter' },
  { id: 'detect_anomalies', label: 'Detect Anomalies', intent: 'Analyse', relevantTopologies: ['TABULAR', 'GRAPH', 'TIME_SERIES', 'STREAM'], description: 'Highlight statistical outliers' },
  { id: 'time_slice', label: 'Time Window Slice', intent: 'Analyse', relevantTopologies: ['TIME_SERIES', 'STREAM'], description: 'Step through temporal intervals' },
  { id: 'cluster_kmeans', label: 'K-Means Clustering', intent: 'Analyse', relevantTopologies: ['TABULAR', 'SPATIAL'], description: 'Cluster point coordinates' },

  // View Intent
  { id: 'layout_grid', label: 'Grid Matrix', intent: 'View', relevantTopologies: ['TABULAR'], description: 'Regular volumetric lattice' },
  { id: 'layout_force', label: 'Force Directed', intent: 'View', relevantTopologies: ['GRAPH', 'HIERARCHICAL'], description: 'Spring-embedder layout' },
  { id: 'layout_ribbon', label: 'Time Ribbon', intent: 'View', relevantTopologies: ['TIME_SERIES', 'STREAM'], description: 'Extruded temporal trajectory' },
  { id: 'layout_surface', label: 'Geo Surface', intent: 'View', relevantTopologies: ['SPATIAL'], description: 'Terrain elevation mapping' },

  // Study Intent
  { id: 'start_trial', label: 'Start Task Trial', intent: 'Study', relevantTopologies: ['TABULAR', 'GRAPH', 'TIME_SERIES', 'SPATIAL', 'HIERARCHICAL', 'STREAM'], description: 'Begin experimental condition trial' },
  { id: 'record_finding', label: 'Record Finding', intent: 'Study', relevantTopologies: ['TABULAR', 'GRAPH', 'TIME_SERIES', 'SPATIAL', 'HIERARCHICAL', 'STREAM'], description: 'Annotate analytical finding to ledger' },
  { id: 'pause_study', label: 'Pause / Resume', intent: 'Study', relevantTopologies: ['TABULAR', 'GRAPH', 'TIME_SERIES', 'SPATIAL', 'HIERARCHICAL', 'STREAM'], description: 'Toggle task clock' },

  // Portals Intent
  { id: 'spawn_portal', label: 'Spawn Collaboration Portal', intent: 'Portals', relevantTopologies: ['TABULAR', 'GRAPH', 'TIME_SERIES', 'SPATIAL', 'HIERARCHICAL', 'STREAM'], description: 'Share live workspace with observer' },
];

export interface ContextualTaskSurfaceCallbacks {
  onInspect?: (data: Record<string, unknown> | null) => void;
  onCompare?: (data: Record<string, unknown> | null) => void;
  onChallenge?: (data: Record<string, unknown> | null) => void;
  onRecord?: (data: Record<string, unknown> | null) => void;
  onNavigate?: (data: Record<string, unknown> | null) => void;
  onMore?: (data: Record<string, unknown> | null) => void;
}

/**
 * Short-lived object-attached action rail for the canonical novice verbs.
 *
 * P1-UV2 deliberately keeps this surface compact and non-grabbable: it belongs
 * to the selected object, not to the user's persistent panel collection. Dense
 * work is promoted into the inspector or another precision surface.
 */
export class ContextualTaskSurface extends SpatialPanel {
  engine: EngineLike;
  budgetController: PanelBudgetController | null = null;

  private _currentTopology: TopologyType = 'TABULAR';
  private _activeIntent: TaskIntent = 'Analyse';
  private _selectionText: Text;
  private _buttons: Map<string, Button> = new Map();
  private _activeData: Record<string, unknown> | null = null;
  private _activeNode: THREE.Object3D | null = null;
  public callbacks: ContextualTaskSurfaceCallbacks;

  constructor(engine: EngineLike, callbacks: ContextualTaskSurfaceCallbacks = {}) {
    super({
      width: 420,
      height: 176,
      flexDirection: 'column',
      gap: 8,
      padding: 10,
      borderRadius: 10,
      backgroundColor: COLOR_TOKENS.surface.base,
      borderColor: COLOR_TOKENS.surface.border,
    });
    this.engine = engine;
    this.callbacks = callbacks;
    this.name = 'contextual-task-surface';
    this.visible = false;

    // Compact object ornament, roughly 0.52 m wide in world space.
    this.scale.setScalar(0.52 / 420);
    this.setGrabEnabled(false);
    this.setGrabRailVisible(false);

    const header = new Container({
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    });
    this._selectionText = new Text({
      text: 'Selected object',
      fontSize: TYPOGRAPHY_TOKENS.scale.label,
      color: COLOR_TOKENS.text.secondary,
      maxWidth: 320,
    });
    header.add(this._selectionText);
    header.add(
      new Button({
        label: 'Dismiss',
        width: 72,
        height: 34,
        paddingX: 8,
        paddingY: 4,
        onClick: () => this.hide(),
      }),
    );
    this.add(header);

    const primaryRow = new Container({
      flexDirection: 'row',
      gap: 8,
      width: '100%',
      justifyContent: 'space-between',
    });
    this.add(primaryRow);

    const secondaryRow = new Container({
      flexDirection: 'row',
      gap: 8,
      width: '100%',
      justifyContent: 'space-between',
    });
    this.add(secondaryRow);

    const addVerb = (
      parent: Container,
      id: string,
      label: string,
      callback: ((data: Record<string, unknown> | null) => void) | undefined,
      width: number,
      variant: 'primary' | 'secondary' | 'danger' = 'secondary',
    ) => {
      const btn = new Button({
        label,
        width,
        height: 56,
        paddingX: 8,
        paddingY: 6,
        variant,
        onClick: () => {
          const data = this._activeData;
          this.hide();
          callback?.(data);
        },
      });
      parent.add(btn);
      this._buttons.set(id, btn);
    };

    addVerb(primaryRow, 'inspect', 'Inspect', callbacks.onInspect, 94, 'primary');
    addVerb(primaryRow, 'compare', 'Compare', callbacks.onCompare, 94);
    addVerb(primaryRow, 'challenge', 'Challenge', callbacks.onChallenge, 94);
    addVerb(primaryRow, 'record', 'Record', callbacks.onRecord, 94);
    addVerb(secondaryRow, 'navigate', 'Navigate', callbacks.onNavigate, 196);
    addVerb(secondaryRow, 'more', 'More', callbacks.onMore, 196);
  }

  get activeNode(): THREE.Object3D | null {
    return this._activeNode;
  }

  /** Diagnostic/evidence helper: distance from the rail to its active object. */
  getActiveNodeDistance(): number | null {
    if (!this._activeNode || !this.visible) return null;
    const nodePosition = new THREE.Vector3();
    const surfacePosition = new THREE.Vector3();
    this._activeNode.getWorldPosition(nodePosition);
    this.getWorldPosition(surfacePosition);
    return nodePosition.distanceTo(surfacePosition);
  }

  showAtNode(
    nodeMesh: THREE.Object3D | null,
    data: Record<string, unknown> | null,
    _pointer: PointerLike | null = null
  ): void {
    this._activeNode = nodeMesh;
    this._activeData = data;
    this.visible = true;
    this.budgetController?.open(this, 'inspector');

    const identity = data?.name ?? data?.label ?? data?.id ?? nodeMesh?.name ?? 'Selected object';
    this._selectionText.setProperties({ text: `Selected · ${String(identity).slice(0, 38)}` });

    this._updateAnchorTransform();
    this._updateButtonStates();
  }

  hide(): void {
    this.visible = false;
    this._activeData = null;
    this._activeNode = null;
    this.budgetController?.close(this);
  }

  update(deltaSeconds: number): void {
    if (!this.visible) return;
    super.update(deltaSeconds);
    this._updateAnchorTransform();
  }

  private _updateAnchorTransform(): void {
    if (!this._activeNode) return;

    const nodeWorld = new THREE.Vector3();
    this._activeNode.getWorldPosition(nodeWorld);

    // Keep the rail just above the evidence and slightly toward the viewer so
    // it remains readable without sitting directly on top of the selected mark.
    const anchorWorld = nodeWorld.clone().add(new THREE.Vector3(0, 0.18, 0));
    const cameraWorld = new THREE.Vector3();
    if (this.engine.camera) {
      this.engine.camera.getWorldPosition(cameraWorld);
      const towardCamera = cameraWorld.clone().sub(nodeWorld);
      towardCamera.y = 0;
      if (towardCamera.lengthSq() > 1e-6) {
        anchorWorld.add(towardCamera.normalize().multiplyScalar(0.08));
      }
    }

    // The surface is parented beneath analystAnchor. Convert from the selected
    // node's world-space locus into the parent's local coordinates instead of
    // copying world coordinates into a moving local frame.
    if (this.parent) {
      this.parent.updateWorldMatrix(true, false);
      this.position.copy(this.parent.worldToLocal(anchorWorld.clone()));
    } else {
      this.position.copy(anchorWorld);
    }

    if (this.engine.camera) {
      this.lookAt(cameraWorld);
    }
  }

  private _updateButtonStates(): void {
    const data = this._activeData;
    const topology = (data?.topology ?? this._currentTopology) as TopologyType;

    const inspectBtn = this._buttons.get('inspect');
    if (inspectBtn) {
      const disabled = !data;
      inspectBtn.disabled = disabled;
      inspectBtn.disabledReason = disabled ? 'Select an object' : undefined;
    }

    const compareBtn = this._buttons.get('compare');
    if (compareBtn) {
      const disabled = !data;
      compareBtn.disabled = disabled;
      compareBtn.disabledReason = disabled ? 'Select an object' : undefined;
    }

    const challengeBtn = this._buttons.get('challenge');
    if (challengeBtn) {
      const disabled = !data || topology === 'TABULAR';
      challengeBtn.disabled = disabled;
      challengeBtn.disabledReason = !data
        ? 'Select an object'
        : disabled
          ? 'Needs linked structure'
          : undefined;
    }

    const recordBtn = this._buttons.get('record');
    if (recordBtn) {
      const disabled = !data;
      recordBtn.disabled = disabled;
      recordBtn.disabledReason = disabled ? 'Select an object' : undefined;
    }

    const navigateBtn = this._buttons.get('navigate');
    if (navigateBtn) {
      const disabled = !data || topology === 'TABULAR';
      navigateBtn.disabled = disabled;
      navigateBtn.disabledReason = !data
        ? 'Select an object'
        : disabled
          ? 'No linked path'
          : undefined;
    }

    const moreBtn = this._buttons.get('more');
    if (moreBtn) {
      moreBtn.disabled = false;
      moreBtn.disabledReason = undefined;
    }
  }

  // --- Legacy properties / backward-compatibility delegates ---
  setTopology(topology: TopologyType): void {
    this._currentTopology = topology;
    this._updateButtonStates();
  }

  get topology(): TopologyType {
    return this._currentTopology;
  }

  setIntent(intent: TaskIntent): void {
    this._activeIntent = intent;
  }

  get intent(): TaskIntent {
    return this._activeIntent;
  }

  getAvailableActions(): TaskSurfaceAction[] {
    return TASK_SURFACE_ACTIONS.filter(
      (action) =>
        action.intent === this._activeIntent &&
        action.relevantTopologies.includes(this._currentTopology)
    );
  }

  getAllRelevantActions(): TaskSurfaceAction[] {
    return TASK_SURFACE_ACTIONS.filter((action) =>
      action.relevantTopologies.includes(this._currentTopology)
    );
  }
}
