/**
 * Three-Level HandWheel Categorization & Forgiving Confirm (Sprint 24.2).
 *
 * Implements:
 * - Intent-centric top-level categories: ANALYSE | VIEW | DATA | STUDY | COLLABORATE | SYSTEM.
 * - Forgiving confirmation state machine: REST -> CATEGORY FOCUS -> ACTION CONFIRM.
 * - Gaze + Hand intent redundancy (allowing gaze target acquisition + pinch anywhere).
 */

export type WheelCategory =
  | 'ANALYSE'
  | 'VIEW'
  | 'DATA'
  | 'STUDY'
  | 'COLLABORATE'
  | 'SYSTEM';

export type WheelConfirmState = 'REST' | 'CATEGORY_FOCUS' | 'ACTION_CONFIRM';

export interface WheelAction {
  id: string;
  label: string;
  category: WheelCategory;
  shortcut?: string;
  description: string;
}

export const WHEEL_CATEGORIES: readonly WheelCategory[] = [
  'ANALYSE',
  'VIEW',
  'DATA',
  'STUDY',
  'COLLABORATE',
  'SYSTEM',
] as const;

export const DEFAULT_CATEGORY_ACTIONS: Record<WheelCategory, WheelAction[]> = {
  ANALYSE: [
    { id: 'filter', label: 'Filter Slice', category: 'ANALYSE', description: 'Filter data points by attributes' },
    { id: 'cluster', label: 'Cluster Groups', category: 'ANALYSE', description: 'Discover topological community clusters' },
    { id: 'anomaly', label: 'Detect Anomalies', category: 'ANALYSE', description: 'Highlight statistical and structural outliers' },
    { id: 'aggregate', label: 'Aggregate Metric', category: 'ANALYSE', description: 'Compute summary metrics across dimensions' },
  ],
  VIEW: [
    { id: 'layout_grid', label: 'Grid Layout', category: 'VIEW', description: 'Arrange points in a regular 3D grid' },
    { id: 'layout_force', label: 'Force Directed', category: 'VIEW', description: 'Physical force-directed graph embedding' },
    { id: 'lens_statistical', label: 'Statistical Lens', category: 'VIEW', description: 'Overlay density and distribution halo' },
    { id: 'reset_view', label: 'Reset Camera', category: 'VIEW', description: 'Return observer position to origin' },
  ],
  DATA: [
    { id: 'load_dataset', label: 'Switch Dataset', category: 'DATA', description: 'Select active dataset from registry' },
    { id: 'live_stream', label: 'Live Ingest', category: 'DATA', description: 'Connect real-time streaming data feed' },
    { id: 'export_view', label: 'Export Snapshot', category: 'DATA', description: 'Save current spatial state to session' },
  ],
  STUDY: [
    { id: 'start_trial', label: 'Start Task Trial', category: 'STUDY', description: 'Begin guided research task' },
    { id: 'record_observation', label: 'Record Finding', category: 'STUDY', description: 'Annotate analytical evidence' },
    { id: 'export_bundle', label: 'Export Replay Bundle', category: 'STUDY', description: 'Package session ledger and audit logs' },
  ],
  COLLABORATE: [
    { id: 'share_portal', label: 'Open Portal', category: 'COLLABORATE', description: 'Spawn spatial portal for remote participant' },
    { id: 'follow_analyst', label: 'Follow Anchor', category: 'COLLABORATE', description: 'Synchronize viewport with lead researcher' },
  ],
  SYSTEM: [
    { id: 'toggle_console', label: 'VR Console', category: 'SYSTEM', description: 'Toggle developer debug console' },
    { id: 'toggle_perf', label: 'Performance HUD', category: 'SYSTEM', description: 'Toggle frame rate and GPU telemetry' },
    { id: 'settings', label: 'Experience Settings', category: 'SYSTEM', description: 'Configure comfort, audio and interaction' },
  ],
};

export interface WheelControllerOptions {
  onActionTriggered?: (action: WheelAction) => void;
  dwellThresholdMs?: number;
}

export class HandWheelCategorizer {
  private _state: WheelConfirmState = 'REST';
  private _activeCategory: WheelCategory | null = null;
  private _hoveredAction: WheelAction | null = null;
  private _gazeTargetCategory: WheelCategory | null = null;
  private _dwellTimer = 0;
  private _dwellThresholdMs: number;
  private _onActionTriggered?: (action: WheelAction) => void;

  constructor(options: WheelControllerOptions = {}) {
    this._dwellThresholdMs = options.dwellThresholdMs ?? 150;
    this._onActionTriggered = options.onActionTriggered;
  }

  get state(): WheelConfirmState {
    return this._state;
  }

  get activeCategory(): WheelCategory | null {
    return this._activeCategory;
  }

  get hoveredAction(): WheelAction | null {
    return this._hoveredAction;
  }

  focusCategory(category: WheelCategory): void {
    this._activeCategory = category;
    this._state = 'CATEGORY_FOCUS';
    this._hoveredAction = null;
  }

  focusAction(action: WheelAction): void {
    this._hoveredAction = action;
    this._state = 'ACTION_CONFIRM';
  }

  setGazeCategory(category: WheelCategory | null): void {
    this._gazeTargetCategory = category;
    if (category && this._state === 'REST') {
      this._activeCategory = category;
      this._state = 'CATEGORY_FOCUS';
    }
  }

  confirmAction(isPinching: boolean, deltaMs = 16): boolean {
    if (!this._hoveredAction) {
      if (this._gazeTargetCategory && isPinching && this._state === 'CATEGORY_FOCUS') {
        const firstAction = DEFAULT_CATEGORY_ACTIONS[this._gazeTargetCategory]?.[0];
        if (firstAction) {
          this._hoveredAction = firstAction;
          this._onActionTriggered?.(firstAction);
          this.reset();
          return true;
        }
      }
      return false;
    }

    if (isPinching) {
      const action = this._hoveredAction;
      this._onActionTriggered?.(action);
      this.reset();
      return true;
    }

    this._dwellTimer += deltaMs;
    if (this._dwellTimer >= this._dwellThresholdMs && this._state === 'ACTION_CONFIRM') {
      // Dwell confirmation affordance
    }

    return false;
  }

  getAvailableActions(category: WheelCategory): WheelAction[] {
    return DEFAULT_CATEGORY_ACTIONS[category] ?? [];
  }

  reset(): void {
    this._state = 'REST';
    this._activeCategory = null;
    this._hoveredAction = null;
    this._gazeTargetCategory = null;
    this._dwellTimer = 0;
  }
}
