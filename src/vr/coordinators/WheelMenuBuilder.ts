import { ANALYSIS_TEMPLATES } from '../../data/AnalysisTemplates.ts';
import type {
  CollaborationCoordinatorLike,
  PanelLike,
  WheelMenuCategory,
  WorldEngineLike,
  WorldUIManagerLike,
} from './types.ts';

export interface WheelMenuHost {
  uiManager: Pick<
    WorldUIManagerLike,
    | 'dashboard'
    | 'getOrCreateGestureConfidenceHUD'
    | 'getOrCreateInteractionCoach'
    | 'getOrCreateNarrativeStrip'
    | 'getOrCreateOperationLogPanel'
    | 'getOrCreateSchemaMappingPanel'
    | 'interactionCoach'
    | 'metricsPanel'
    | 'narrativeStrip'
    | 'networkPanel'
    | 'panelManager'
    | 'performancePanel'
    | 'recommendationPanel'
    | 'toggleFrustrationResponseManager'
    | 'toggleJITGestureHintManager'
    | 'toggleProgressiveDisclosure'
    | 'toggleRepresentationCarousel'
    | 'toggleTransientContextCards'
    | 'vrConsole'
  >;
  engine: Pick<WorldEngineLike, 'exitVR' | 'locomotion'>;
  collaborationCoordinator: CollaborationCoordinatorLike;
  portalsEnabled?: boolean;
  exitVR?(): Promise<boolean> | void;
  applyDataOperation(operation: string): void;
  previewDataOperation(operation: string): void;
  clearOperationPreview(): void;
  resetDataOperation(): void;
  undoAnalysis(): void;
  redoAnalysis(): void;
  saveSession(id: string): void;
  loadSession(id: string): void;
  deleteSession(id: string): void;
  exportScreenshot(): void;
  markMoment?(notes?: string): unknown;
  exportAnalysisStory(): void;
  loadTemplate(id: string): void;
  setPortalsEnabled(enabled: boolean): void;
  isLiveConnected(): boolean;
  connectLiveStream(): void;
  disconnectLiveStream(): void;
  startTour(): void;
  runLoadTest?(profile?: unknown): void;
  stopLoadTest?(): void;
  _cycleDataset(): void;
  _cycleThemePreset(): void;
  _toggleSettingsPanel(): void;
  _toggleMiniOverview(): void;
  _togglePeerPresenceHUD(): void;
  _toggleDesktopPreview(): void;
  _joinCollaborationRoom(): void;
  _leaveCollaborationRoom(): void;
  _toggleLoadTestPanel?(): void;
  _toggleStatisticalLens?(): void;
  _toggleDracoExplainer?(): void;
  _toggleDracoDiagnostic?(): void;
}

export function buildWheelMenuCategories(world: WheelMenuHost): WheelMenuCategory[] {
  // Legacy subsystem-oriented layout, retained for backwards compatibility only.
  // Production uses buildIntentWheelMenuCategories (UX spec §7 task orientation).
  const opItem = (id: string, label: string, icon: string, op: string) => ({
    id,
    label,
    icon,
    callback: () => world.applyDataOperation(op),
    onHover: () => world.previewDataOperation(op),
    onLeave: () => world.clearOperationPreview(),
  });
  // Panels and managers live on world.uiManager.
  const pm = world.uiManager?.panelManager;
  const dashboard = world.uiManager?.dashboard;
  const toggle = (panel: PanelLike | null | undefined) => {
    if (panel && pm) {
      pm.togglePanel(panel);
    }
  };

  return [
    {
      id: 'panels',
      label: 'Panels',
      icon: '🪟',
      items: [
        {
          id: 'launcher',
          label: 'Launcher',
          icon: '🚀',
          callback: () => pm?.toggleLauncher(),
        },
        {
          id: 'settings',
          label: 'Settings',
          icon: '⚙️',
          callback: () => world._toggleSettingsPanel(),
        },
        {
          id: 'draco-explainer',
          label: 'Explain',
          icon: '💡',
          callback: () => world._toggleDracoExplainer?.(),
        },
        {
          id: 'exit-vr',
          label: 'Exit VR',
          icon: '🚪',
          callback: () => (world.exitVR ? world.exitVR() : world.engine?.exitVR?.()),
        },
        {
          id: 'operation-log',
          label: 'Log',
          icon: '📝',
          callback: () => toggle(world.uiManager?.getOrCreateOperationLogPanel?.()),
        },
        {
          id: 'telemetry',
          label: 'Telemetry',
          icon: '📊',
          callback: () => toggle(world.uiManager?.metricsPanel),
        },
        {
          id: 'performance',
          label: 'Perf',
          icon: '⏱️',
          callback: () => toggle(world.uiManager?.performancePanel),
        },
        {
          id: 'interaction-coach',
          label: 'Coach',
          icon: '🎓',
          callback: () => toggle(world.uiManager?.getOrCreateInteractionCoach?.()),
        },
        { id: 'tour', label: 'Tour', icon: '📍', callback: () => world.startTour() },
        {
          id: 'narrative-strip',
          label: 'Timeline',
          icon: '🎞️',
          callback: () => toggle(world.uiManager?.getOrCreateNarrativeStrip?.()),
        },
        {
          id: 'recommendation',
          label: 'Guidance',
          icon: '🧭',
          callback: () => toggle(world.uiManager?.recommendationPanel),
        },
        {
          id: 'recenter',
          label: 'Recenter',
          icon: '🎯',
          callback: () => pm?.recenter(),
        },
        {
          id: 'scroll-dashboard-left',
          label: '◀ Dash',
          icon: '⬅️',
          callback: () => dashboard?.scrollBySlots(-1),
        },
        {
          id: 'scroll-dashboard-right',
          label: 'Dash ▶',
          icon: '➡️',
          callback: () => dashboard?.scrollBySlots(1),
        },
        {
          id: 'reset-dashboard',
          label: 'Reset Dash',
          icon: '↺',
          callback: () => dashboard?.resetDashboard(),
        },
        {
          id: 'save-session',
          label: 'Save',
          icon: '💾',
          callback: () => world.saveSession('manual'),
        },
        {
          id: 'load-session',
          label: 'Load',
          icon: '⏮️',
          callback: () => world.loadSession('autosave'),
        },
        {
          id: 'delete-autosave',
          label: 'New',
          icon: '🆕',
          callback: () => world.deleteSession('autosave'),
        },
        {
          id: 'export-screenshot',
          label: 'Screenshot',
          icon: '📸',
          callback: () => world.exportScreenshot(),
        },
        {
          id: 'mark-moment',
          label: 'Mark Moment',
          icon: '📍',
          callback: () => world.markMoment?.(),
        },
        {
          id: 'export-story',
          label: 'Story',
          icon: '📤',
          callback: () => world.exportAnalysisStory(),
        },
      ],
    },
    {
      id: 'templates',
      label: 'Templates',
      icon: '📖',
      items: ANALYSIS_TEMPLATES.map((t) => ({
        id: `template-${t.id}`,
        label: t.label,
        icon: t.icon,
        callback: () => world.loadTemplate(t.id),
      })),
    },
    {
      id: 'views',
      label: 'Views',
      icon: '👁️',
      items: [
        {
          id: 'portals',
          label: 'Portals',
          icon: '🌀',
          callback: () => world.setPortalsEnabled(!world.portalsEnabled),
        },
        { id: 'dataset', label: 'Dataset', icon: '💎', callback: () => world._cycleDataset() },
        {
          id: 'cycle-theme',
          label: 'Theme',
          icon: '🎨',
          callback: () => world._cycleThemePreset(),
        },
        {
          id: 'teleport-toggle',
          label: 'Teleport',
          icon: '📡',
          callback: () => world.engine.locomotion.toggleTeleport(),
        },
        {
          id: 'teleport-overview',
          label: 'Overview',
          icon: '🌍',
          callback: () => world.engine.locomotion.teleportToAnchor('overview'),
        },
        {
          id: 'teleport-detail',
          label: 'Detail',
          icon: '🔎',
          callback: () => world.engine.locomotion.teleportToAnchor('detail'),
        },
        {
          id: 'teleport-north',
          label: 'North',
          icon: '⬆️',
          callback: () => world.engine.locomotion.teleportToAnchor('north'),
        },
        {
          id: 'teleport-south',
          label: 'South',
          icon: '⬇️',
          callback: () => world.engine.locomotion.teleportToAnchor('south'),
        },
        {
          id: 'toggle-mini-overview',
          label: 'Overview',
          icon: '🗺️',
          callback: () => world._toggleMiniOverview(),
        },
        {
          id: 'toggle-peer-presence',
          label: 'Peers',
          icon: '👥',
          callback: () => world._togglePeerPresenceHUD(),
        },
        {
          id: 'toggle-desktop-preview',
          label: 'Preview',
          icon: '🖥️',
          callback: () => world._toggleDesktopPreview(),
        },
        {
          id: 'toggle-flight',
          label: 'Flight',
          icon: '🚀',
          callback: () => world.engine.locomotion.toggleFlight(),
        },
        {
          id: 'drop-to-floor',
          label: 'Floor',
          icon: '🧱',
          callback: () => world.engine.locomotion.dropToFloor(),
        },
        {
          // Statistical lens = TDA (persistence/mapper/betti) + correlation windows.
          // Hidden by default (progressive disclosure); this is the explicit on-demand
          // request path. Also reachable via the scoop-up gesture, the TechnoCore
          // landmark cycle, and the Settings panel toggle.
          id: 'toggle-lens',
          label: 'Lens',
          icon: '🔬',
          callback: () => world._toggleStatisticalLens?.(),
        },
        {
          id: 'explain-view',
          label: 'Why View?',
          icon: '💡',
          callback: () => world._toggleDracoExplainer?.(),
        },
      ],
    },
    {
      id: 'live',
      label: 'Live',
      icon: '📡',
      items: [
        {
          id: 'live-toggle',
          label: world.isLiveConnected() ? 'Stop' : 'Start',
          icon: world.isLiveConnected() ? '⏹️' : '▶️',
          callback: () =>
            world.isLiveConnected() ? world.disconnectLiveStream() : world.connectLiveStream(),
        },
      ],
    },
    {
      id: 'collab',
      label: 'Collab',
      icon: '👥',
      items: [
        {
          id: 'collab-toggle',
          label: world.collaborationCoordinator.isConnected() ? 'Leave' : 'Join',
          icon: world.collaborationCoordinator.isConnected() ? '🚪' : '🔗',
          callback: () =>
            world.collaborationCoordinator.isConnected()
              ? world._leaveCollaborationRoom()
              : world._joinCollaborationRoom(),
        },
        {
          id: 'collab-panel',
          label: 'Network',
          icon: '🌐',
          callback: () =>
            toggle(
              world.uiManager?.networkPanel ??
                (world as unknown as { networkPanel?: PanelLike }).networkPanel
            ),
        },
      ],
    },
    {
      id: 'ops',
      label: 'Ops',
      icon: '⚙️',
      items: [
        opItem('filter', 'Filter', '🔎', 'filter'),
        opItem('sort', 'Sort', '📶', 'sort'),
        opItem('aggregate', 'Aggregate', '📚', 'aggregate'),
        opItem('cluster', 'Cluster', '🔷', 'cluster'),
        opItem('hierarchical', 'Hierarchy', '🌳', 'hierarchical'),
        opItem('density', 'Density', '⚫', 'density'),
        opItem('anomaly', 'Anomaly', '⚡', 'anomaly'),
        opItem('timeSlice', 'Slice', '🕒', 'timeSlice'),
        { id: 'reset', label: 'Reset', icon: '↺', callback: () => world.resetDataOperation() },
        // Undo/Redo surface the analysis history to controller-only VR users who
        // cannot reliably perform the two-handed rotate gestures or know the
        // A/B-button mapping. `undoAnalysis`/`redoAnalysis` are safe no-ops when
        // the history has nothing to undo/redo, so these are always clickable.
        // A live disabled affordance (dimmed when canUndo/canRedo is false) is a
        // future enhancement — it requires dynamic menu state, since the wheel is
        // built once at init.
        { id: 'undo', label: 'Undo', icon: '⮌', callback: () => world.undoAnalysis() },
        { id: 'redo', label: 'Redo', icon: '⮎', callback: () => world.redoAnalysis() },
      ],
    },
    {
      id: 'loadtest',
      label: 'Load Test',
      icon: '🧪',
      items: [
        {
          id: 'loadtest-panel',
          label: 'Panel',
          icon: '📊',
          callback: () => world._toggleLoadTestPanel?.(),
        },
        {
          id: 'loadtest-start',
          label: 'Start',
          icon: '▶️',
          callback: () => world.runLoadTest?.(),
        },
        {
          id: 'loadtest-stop',
          label: 'Stop',
          icon: '⏹️',
          callback: () => world.stopLoadTest?.(),
        },
      ],
    },
    {
      id: 'superuser',
      label: 'Dev Lab',
      icon: '🔬',
      items: [
        {
          id: 'su-representation-carousel',
          label: 'Rep Carousel',
          icon: '🎠',
          callback: () => world.uiManager?.toggleRepresentationCarousel?.(),
        },
        {
          id: 'su-transient-context-cards',
          label: 'Context Cards',
          icon: '🃏',
          callback: () => world.uiManager?.toggleTransientContextCards?.(),
        },
        {
          id: 'su-progressive-disclosure',
          label: 'Disclosure',
          icon: '📂',
          callback: () => world.uiManager?.toggleProgressiveDisclosure?.(),
        },
        {
          id: 'su-schema-mapping',
          label: 'Schema Map',
          icon: '🗂️',
          callback: () => toggle(world.uiManager?.getOrCreateSchemaMappingPanel?.()),
        },
        {
          id: 'su-draco-diagnostic',
          label: 'Draco Diag',
          icon: '🩺',
          callback: () => world._toggleDracoDiagnostic?.(),
        },
        {
          id: 'su-gesture-confidence',
          label: 'Gest Conf',
          icon: '✋',
          callback: () => toggle(world.uiManager?.getOrCreateGestureConfidenceHUD?.()),
        },
        {
          id: 'su-frustration-response',
          label: 'Frustration',
          icon: '😤',
          callback: () => world.uiManager?.toggleFrustrationResponseManager?.(),
        },
        {
          id: 'su-jit-gesture-hints',
          label: 'JIT Hints',
          icon: '👻',
          callback: () => world.uiManager?.toggleJITGestureHintManager?.(),
        },
      ],
    },
  ];
}

/**
 * Builds the production HandWheel, aligned with the 6 core intent taxonomy
 * (ANALYSE | VIEW | DATA | STUDY | COLLABORATE | SYSTEM — UX spec §7
 * "task-oriented rather than subsystem-oriented") plus an explicit SUPERUSER
 * annex so observer/diagnostic tooling stays out of the participant command
 * surface (vr_engineer skill §24). Novice vocabulary coverage per UX spec §6.1:
 * Move → VIEW; Undo/Redo → ANALYSE; Return → VIEW.
 */
export function buildIntentWheelMenuCategories(world: WheelMenuHost): WheelMenuCategory[] {
  const opItem = (id: string, label: string, icon: string, op: string) => ({
    id,
    label,
    icon,
    callback: () => world.applyDataOperation(op),
    onHover: () => world.previewDataOperation(op),
    onLeave: () => world.clearOperationPreview(),
  });
  const pm = world.uiManager?.panelManager;
  const dashboard = world.uiManager?.dashboard;
  const toggle = (panel: PanelLike | null | undefined) => {
    if (panel && pm) {
      pm.togglePanel(panel);
    }
  };

  return [
    {
      id: 'ANALYSE',
      label: 'Analyse',
      icon: '🔎',
      items: [
        opItem('filter', 'Filter', '🔎', 'filter'),
        opItem('sort', 'Sort', '📶', 'sort'),
        opItem('aggregate', 'Aggregate', '📚', 'aggregate'),
        opItem('cluster', 'Cluster', '🔷', 'cluster'),
        opItem('hierarchical', 'Hierarchy', '🌳', 'hierarchical'),
        opItem('density', 'Density', '⚫', 'density'),
        opItem('anomaly', 'Anomaly', '⚡', 'anomaly'),
        opItem('timeSlice', 'Slice', '🕒', 'timeSlice'),
        { id: 'reset', label: 'Reset', icon: '↺', callback: () => world.resetDataOperation() },
        // Undo/Return are required novice vocabulary (UX spec §6.1). These are
        // safe no-ops when history is empty; see legacy note in buildWheelMenu.
        { id: 'undo', label: 'Undo', icon: '⮌', callback: () => world.undoAnalysis() },
        { id: 'redo', label: 'Redo', icon: '⮎', callback: () => world.redoAnalysis() },
      ],
    },
    {
      id: 'VIEW',
      label: 'View',
      icon: '👁️',
      items: [
        {
          id: 'return-overview',
          label: 'Return',
          icon: '🎯',
          callback: () => world.engine.locomotion.teleportToAnchor('overview'),
        },
        {
          id: 'portals',
          label: 'Portals',
          icon: '🌀',
          callback: () => world.setPortalsEnabled(!world.portalsEnabled),
        },
        { id: 'theme', label: 'Theme', icon: '🎨', callback: () => world._cycleThemePreset() },
        {
          id: 'overview',
          label: 'Overview Map',
          icon: '🗺️',
          callback: () => world._toggleMiniOverview(),
        },
        {
          id: 'lens',
          label: 'Statistical Lens',
          icon: '🔬',
          callback: () => world._toggleStatisticalLens?.(),
        },
        {
          id: 'explain',
          label: 'Why View?',
          icon: '💡',
          callback: () => world._toggleDracoExplainer?.(),
        },
        { id: 'recenter', label: 'Recenter Panels', icon: '🧲', callback: () => pm?.recenter() },
        {
          id: 'dash-left',
          label: '◀ Dash',
          icon: '⬅️',
          callback: () => dashboard?.scrollBySlots(-1),
        },
        {
          id: 'dash-right',
          label: 'Dash ▶',
          icon: '➡️',
          callback: () => dashboard?.scrollBySlots(1),
        },
        {
          id: 'dash-reset',
          label: 'Reset Dash',
          icon: '↺',
          callback: () => dashboard?.resetDashboard(),
        },
        {
          id: 'teleport-toggle',
          label: 'Teleport',
          icon: '📡',
          callback: () => world.engine.locomotion.toggleTeleport(),
        },
        {
          id: 'teleport-detail',
          label: 'Go Detail',
          icon: '🔎',
          callback: () => world.engine.locomotion.teleportToAnchor('detail'),
        },
        {
          id: 'teleport-north',
          label: 'Go North',
          icon: '⬆️',
          callback: () => world.engine.locomotion.teleportToAnchor('north'),
        },
        {
          id: 'teleport-south',
          label: 'Go South',
          icon: '⬇️',
          callback: () => world.engine.locomotion.teleportToAnchor('south'),
        },
        {
          id: 'toggle-flight',
          label: 'Flight',
          icon: '🚀',
          callback: () => world.engine.locomotion.toggleFlight(),
        },
        {
          id: 'drop-to-floor',
          label: 'Floor',
          icon: '🧱',
          callback: () => world.engine.locomotion.dropToFloor(),
        },
        {
          id: 'desktop-preview',
          label: 'Preview',
          icon: '🖥️',
          callback: () => world._toggleDesktopPreview(),
        },
      ],
    },
    {
      id: 'DATA',
      label: 'Data',
      icon: '💎',
      items: [
        {
          id: 'dataset-cycle',
          label: 'Next Dataset',
          icon: '💎',
          callback: () => world._cycleDataset(),
        },
        {
          id: 'live-stream',
          label: world.isLiveConnected() ? 'Stop Stream' : 'Live Ingest',
          icon: world.isLiveConnected() ? '⏹️' : '📡',
          callback: () =>
            world.isLiveConnected() ? world.disconnectLiveStream() : world.connectLiveStream(),
        },
        {
          id: 'save-session',
          label: 'Save State',
          icon: '💾',
          callback: () => world.saveSession('manual'),
        },
        {
          id: 'load-session',
          label: 'Restore Auto',
          icon: '⏮️',
          callback: () => world.loadSession('autosave'),
        },
        {
          id: 'new-session',
          label: 'New Session',
          icon: '🆕',
          callback: () => world.deleteSession('autosave'),
        },
      ],
    },
    {
      id: 'STUDY',
      label: 'Study',
      icon: '📋',
      items: [
        {
          id: 'mark-moment',
          label: 'Mark Moment',
          icon: '📍',
          callback: () => world.markMoment?.(),
        },
        { id: 'tour', label: 'Start Tour', icon: '🧭', callback: () => world.startTour() },
        {
          id: 'coach',
          label: 'Coach',
          icon: '🎓',
          callback: () => toggle(world.uiManager?.getOrCreateInteractionCoach?.()),
        },
        {
          id: 'timeline',
          label: 'Timeline Strip',
          icon: '🎞️',
          callback: () => toggle(world.uiManager?.getOrCreateNarrativeStrip?.()),
        },
        {
          id: 'guidance',
          label: 'Guidance',
          icon: '🧭',
          callback: () => toggle(world.uiManager?.recommendationPanel),
        },
        {
          id: 'story',
          label: 'Export Story',
          icon: '📤',
          callback: () => world.exportAnalysisStory(),
        },
        {
          id: 'screenshot',
          label: 'Screenshot',
          icon: '📸',
          callback: () => world.exportScreenshot(),
        },
      ],
    },
    {
      id: 'COLLABORATE',
      label: 'Collab',
      icon: '👥',
      items: [
        {
          id: 'collab-toggle',
          label: world.collaborationCoordinator.isConnected() ? 'Leave Room' : 'Join Room',
          icon: world.collaborationCoordinator.isConnected() ? '🚪' : '🔗',
          callback: () =>
            world.collaborationCoordinator.isConnected()
              ? world._leaveCollaborationRoom()
              : world._joinCollaborationRoom(),
        },
        {
          id: 'peers',
          label: 'Peer HUD',
          icon: '👥',
          callback: () => world._togglePeerPresenceHUD(),
        },
        {
          id: 'network-panel',
          label: 'Network Panel',
          icon: '🌐',
          callback: () => toggle(world.uiManager?.networkPanel),
        },
      ],
    },
    {
      id: 'SYSTEM',
      label: 'System',
      icon: '⚙️',
      items: [
        {
          id: 'settings',
          label: 'Settings',
          icon: '⚙️',
          callback: () => world._toggleSettingsPanel(),
        },
        {
          id: 'launcher',
          label: 'Launcher',
          icon: '🚀',
          callback: () => pm?.toggleLauncher(),
        },
        {
          id: 'operation-log',
          label: 'Operation Log',
          icon: '📝',
          callback: () => toggle(world.uiManager?.getOrCreateOperationLogPanel?.()),
        },
        {
          id: 'console',
          label: 'VR Console',
          icon: '🖥️',
          callback: () => toggle(world.uiManager?.vrConsole as unknown as PanelLike),
        },
        {
          id: 'perf',
          label: 'Perf Budget',
          icon: '⏱️',
          callback: () => toggle(world.uiManager?.performancePanel),
        },
        {
          id: 'telemetry',
          label: 'Telemetry',
          icon: '📊',
          callback: () => toggle(world.uiManager?.metricsPanel),
        },
        {
          id: 'exit-vr',
          label: 'Exit VR',
          icon: '🚪',
          callback: () => (world.exitVR ? world.exitVR() : world.engine?.exitVR?.()),
        },
      ],
    },
    {
      // Superuser/observer annex (skill §24): diagnostics and load tooling that
      // must never sit in the participant command surface. Hidden by default via
      // progressive disclosure; also reachable through Settings.
      id: 'SUPERUSER',
      label: 'Dev Lab',
      icon: '🔬',
      items: [
        {
          id: 'su-representation-carousel',
          label: 'Rep Carousel',
          icon: '🎠',
          callback: () => world.uiManager?.toggleRepresentationCarousel?.(),
        },
        {
          id: 'su-transient-context-cards',
          label: 'Context Cards',
          icon: '🃏',
          callback: () => world.uiManager?.toggleTransientContextCards?.(),
        },
        {
          id: 'su-progressive-disclosure',
          label: 'Disclosure',
          icon: '📂',
          callback: () => world.uiManager?.toggleProgressiveDisclosure?.(),
        },
        {
          id: 'su-schema-mapping',
          label: 'Schema Map',
          icon: '🗂️',
          callback: () => toggle(world.uiManager?.getOrCreateSchemaMappingPanel?.()),
        },
        {
          id: 'su-draco-diagnostic',
          label: 'Draco Diag',
          icon: '🩺',
          callback: () => world._toggleDracoDiagnostic?.(),
        },
        {
          id: 'su-gesture-confidence',
          label: 'Gest Conf',
          icon: '✋',
          callback: () => toggle(world.uiManager?.getOrCreateGestureConfidenceHUD?.()),
        },
        {
          id: 'su-frustration-response',
          label: 'Frustration',
          icon: '😤',
          callback: () => world.uiManager?.toggleFrustrationResponseManager?.(),
        },
        {
          id: 'su-jit-gesture-hints',
          label: 'JIT Hints',
          icon: '👻',
          callback: () => world.uiManager?.toggleJITGestureHintManager?.(),
        },
        {
          id: 'su-loadtest-panel',
          label: 'Load Panel',
          icon: '📊',
          callback: () => world._toggleLoadTestPanel?.(),
        },
        {
          id: 'su-loadtest-start',
          label: 'Load Start',
          icon: '▶️',
          callback: () => world.runLoadTest?.(),
        },
        {
          id: 'su-loadtest-stop',
          label: 'Load Stop',
          icon: '⏹️',
          callback: () => world.stopLoadTest?.(),
        },
      ],
    },
  ];
}
