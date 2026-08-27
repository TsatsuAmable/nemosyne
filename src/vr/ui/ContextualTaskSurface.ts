import * as THREE from 'three';
import { Container } from '@pmndrs/uikit';
import { SpatialPanel } from '../ui-system/SpatialPanel.ts';
import { PanelChrome } from '../ui-system/components/PanelChrome.ts';
import { Button } from '../ui-system/components/Button.ts';
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

export class ContextualTaskSurface extends SpatialPanel {
  engine: EngineLike;
  private _currentTopology: TopologyType = 'TABULAR';
  private _activeIntent: TaskIntent = 'Analyse';

  private _chrome: PanelChrome;
  private _gridContainer: Container;
  private _buttons: Map<string, Button> = new Map();

  private _activeData: Record<string, unknown> | null = null;
  public callbacks: ContextualTaskSurfaceCallbacks;

  constructor(engine: EngineLike, callbacks: ContextualTaskSurfaceCallbacks = {}) {
    super({
      width: 400,
      height: 300,
      flexDirection: 'column',
      gap: 12,
      padding: 16,
    });
    this.engine = engine;
    this.callbacks = callbacks;
    this.name = 'contextual-task-surface';
    this.visible = false;

    // Apply scaling factor matching other SpatialPanel components
    this.scale.setScalar(0.6 / 400);

    // Chrome title and control
    this._chrome = new PanelChrome({
      title: 'CONTEXT ACTIONS',
      onClose: () => this.hide(),
    });
    this.add(this._chrome);

    // 2x3 Grid Layout container for the 6 novice verbs
    this._gridContainer = new Container({
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      width: '100%',
      justifyContent: 'space-between',
    });
    this.add(this._gridContainer);

    const verbProps = [
      { id: 'inspect', label: 'Inspect', callback: callbacks.onInspect },
      { id: 'compare', label: 'Compare', callback: callbacks.onCompare },
      { id: 'challenge', label: 'Challenge', callback: callbacks.onChallenge },
      { id: 'record', label: 'Record', callback: callbacks.onRecord },
      { id: 'navigate', label: 'Navigate', callback: callbacks.onNavigate },
      { id: 'more', label: 'More', callback: callbacks.onMore },
    ];

    for (const item of verbProps) {
      const btn = new Button({
        label: item.label,
        width: 175,
        height: 60,
        onClick: () => item.callback?.(this._activeData),
      });
      this._gridContainer.add(btn);
      this._buttons.set(item.id, btn);
    }
  }

  showAtNode(
    nodeMesh: THREE.Object3D | null,
    data: Record<string, unknown> | null,
    _pointer: PointerLike | null = null
  ): void {
    this._activeData = data;
    this.visible = true;

    if (nodeMesh) {
      const pos = new THREE.Vector3();
      nodeMesh.getWorldPosition(pos);
      // Anchor near the node with a slight offset
      this.position.copy(pos).add(new THREE.Vector3(0, 0.25, 0.15));
      if (this.engine.camera) {
        this.lookAt(this.engine.camera.position);
      }
    }

    this._updateButtonStates();
  }

  hide(): void {
    this.visible = false;
    this._activeData = null;
  }

  private _updateButtonStates(): void {
    const data = this._activeData;
    const topology = (data?.topology ?? this._currentTopology) as TopologyType;

    // Verb 1: Inspect
    const inspectBtn = this._buttons.get('inspect');
    if (inspectBtn) {
      const disabled = !data;
      inspectBtn.disabled = disabled;
      inspectBtn.disabledReason = disabled ? 'No active selection to inspect' : undefined;
    }

    // Verb 2: Compare
    const compareBtn = this._buttons.get('compare');
    if (compareBtn) {
      const disabled = !data;
      compareBtn.disabled = disabled;
      compareBtn.disabledReason = disabled ? 'Select a second node to compare' : undefined;
    }

    // Verb 3: Challenge
    const challengeBtn = this._buttons.get('challenge');
    if (challengeBtn) {
      const disabled = !data || topology === 'TABULAR';
      challengeBtn.disabled = disabled;
      challengeBtn.disabledReason = !data
        ? 'No active selection to challenge'
        : disabled
          ? 'Challenge requires network/hierarchical model'
          : undefined;
    }

    // Verb 4: Record
    const recordBtn = this._buttons.get('record');
    if (recordBtn) {
      const disabled = !data;
      recordBtn.disabled = disabled;
      recordBtn.disabledReason = disabled ? 'No active selection to record' : undefined;
    }

    // Verb 5: Navigate
    const navigateBtn = this._buttons.get('navigate');
    if (navigateBtn) {
      const disabled = !data || topology === 'TABULAR';
      navigateBtn.disabled = disabled;
      navigateBtn.disabledReason = !data
        ? 'No active selection to navigate'
        : disabled
          ? 'No linked structures or paths'
          : undefined;
    }

    // Verb 6: More
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
