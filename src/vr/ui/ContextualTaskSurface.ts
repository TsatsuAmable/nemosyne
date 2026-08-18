/**
 * Task-Oriented Contextual Surface Decomposition (Sprint 24.3).
 *
 * Decomposes monolithic 29-button command walls into intent-driven surfaces
 * filtered dynamically by active dataset topology (e.g. GRAPH -> community/anomaly;
 * TIME_SERIES -> temporal slices; TABULAR -> multidimensional projection).
 */

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

export class ContextualTaskSurface {
  private _currentTopology: TopologyType = 'TABULAR';
  private _activeIntent: TaskIntent = 'Analyse';

  setTopology(topology: TopologyType): void {
    this._currentTopology = topology;
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
