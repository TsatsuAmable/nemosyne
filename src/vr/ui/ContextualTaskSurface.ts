import * as THREE from 'three';
import { Container, Text } from '@pmndrs/uikit';
import { SpatialPanel } from '../ui-system/SpatialPanel.ts';
import { Button } from '../ui-system/components/Button.ts';
import { COLOR_TOKENS, TYPOGRAPHY_TOKENS } from '../ui-system/tokens.ts';
import type { PanelBudgetController } from '../ui-system/PanelBudgetController.ts';
import type { EngineLike, PointerLike } from '../coordinators/types.ts';
import {
  INVESTIGATOR_TASKS,
  dispatchInvestigatorTask,
  type InvestigatorTaskCallbacks,
  type InvestigatorTaskIntent,
} from '../../app/intents/InvestigatorTaskIntent.ts';

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

/** @deprecated Prefer InvestigatorTaskCallbacks from the shared selected-task intent contract. */
export interface ContextualTaskSurfaceCallbacks extends InvestigatorTaskCallbacks {}

export interface InvestigatorTaskAvailability {
  available: boolean;
  reason?: string;
}

type EngineWithPanelBudget = EngineLike & {
  uiManager?: {
    panelBudgetController?: PanelBudgetController;
  };
};

const TASK_DEFINITION_BY_ID = new Map(
  INVESTIGATOR_TASKS.map((task) => [task.id, task] as const),
);

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
      id: InvestigatorTaskIntent,
      width: number,
      variant: 'primary' | 'secondary' | 'danger' = 'secondary',
    ) => {
      const task = TASK_DEFINITION_BY_ID.get(id);
      if (!task) throw new Error(`Unknown investigator task: ${id}`);
      const btn = new Button({
        label: task.label,
        width,
        height: 56,
        paddingX: 8,
        paddingY: 6,
        variant,
        onClick: () => {
          this.dispatchTask(id);
        },
      });
      parent.add(btn);
      this._buttons.set(id, btn);
    };

    addVerb(primaryRow, 'inspect', 94, 'primary');
    addVerb(primaryRow, 'compare', 94);
    addVerb(primaryRow, 'challenge', 94);
    addVerb(primaryRow, 'record', 94);
    addVerb(secondaryRow, 'navigate', 196);
    addVerb(secondaryRow, 'more', 196);
  }

  get activeNode(): THREE.Object3D | null {
    return this._activeNode;
  }

  /** Read-only selected payload used by the desktop parity projection. */
  get activeData(): Record<string, unknown> | null {
    return this._activeData;
  }

  taskAvailability(
    intent: InvestigatorTaskIntent,
    data: Record<string, unknown> | null = this._activeData,
  ): InvestigatorTaskAvailability {
    const topology = (data?.topology ?? this._currentTopology) as TopologyType;
    if (intent === 'more') return { available: true };
    if (!data) return { available: false, reason: 'Select an object' };
    if (intent === 'challenge' && topology === 'TABULAR') {
      return { available: false, reason: 'Needs linked structure' };
    }
    if (intent === 'navigate' && topology === 'TABULAR') {
      return { available: false, reason: 'No linked path' };
    }
    return { available: true };
  }

  /**
   * Shared transient task resolver for XR and desktop presentation.
   * The payload is captured before the contextual surface is cleared so both
   * modalities have identical single-shot selection semantics.
   */
  dispatchTask(
    intent: InvestigatorTaskIntent,
    data: Record<string, unknown> | null = this._activeData,
  ): boolean {
    const availability = this.taskAvailability(intent, data);
    if (!availability.available) return false;
    const payload = data;
    this.hide();
    return dispatchInvestigatorTask(this.callbacks, intent, payload);
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
    this._openInspectorBudgetSlot();

    const identity = data?.name ?? data?.label ?? data?.id ?? nodeMesh?.name ?? 'Selected object';
    this._selectionText.setProperties({ text: `Selected · ${String(identity).slice(0, 38)}` });

    this._updateAnchorTransform();
    this._updateButtonStates();
  }

  hide(): void {
    this.visible = false;
    this._activeData = null;
    this._activeNode = null;
    const budget = this._resolvedBudgetController();
    if (budget?.isOpen(this)) budget.close(this);
  }

  update(deltaSeconds: number): void {
    if (!this.visible) return;
    super.update(deltaSeconds);
    this._updateAnchorTransform();
  }

  private _resolvedBudgetController(): PanelBudgetController | null {
    if (this.budgetController) return this.budgetController;
    return (this.engine as EngineWithPanelBudget).uiManager?.panelBudgetController ?? null;
  }

  private _openInspectorBudgetSlot(): void {
    const budget = this._resolvedBudgetController();
    if (!budget) return;

    const occupant = budget
      .getOpenPanels()
      .find((panel) => panel !== this && budget.getRole(panel) === 'inspector');
    if (occupant) {
      const stateful = occupant as typeof occupant & { hide?: () => void };
      if (typeof stateful.hide === 'function') stateful.hide();
      else budget.close(occupant);
    }
    budget.open(this, 'inspector');
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
    for (const task of INVESTIGATOR_TASKS) {
      const button = this._buttons.get(task.id);
      if (!button) continue;
      const availability = this.taskAvailability(task.id);
      button.disabled = !availability.available;
      button.disabledReason = availability.reason;
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
