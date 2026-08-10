import { ANALYSIS_TEMPLATES } from '../../data/AnalysisTemplates.ts';
import type { PanelLike, WheelMenuCategory, WorldLike } from './types.ts';

export function buildWheelMenuCategories(world: WorldLike): WheelMenuCategory[] {
  const opItem = (id: string, label: string, icon: string, op: string) => ({
    id,
    label,
    icon,
    callback: () => world.applyDataOperation(op),
    onHover: () => world.previewDataOperation(op),
    onLeave: () => world.clearOperationPreview(),
  });
  // Panels are optional on the World facade (created lazily during World init);
  // toggle only when the target actually exists.
  const toggle = (panel: PanelLike | undefined) => {
    if (panel) world.panelManager.togglePanel(panel);
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
          callback: () => world.panelManager.toggleLauncher(),
        },
        {
          id: 'settings',
          label: 'Settings',
          icon: '⚙️',
          callback: () => world._toggleSettingsPanel(),
        },
        {
          id: 'operation-log',
          label: 'Log',
          icon: '📝',
          callback: () => toggle(world.operationLogPanel),
        },
        {
          id: 'telemetry',
          label: 'Telemetry',
          icon: '📊',
          callback: () => toggle(world.metricsPanel),
        },
        {
          id: 'performance',
          label: 'Perf',
          icon: '⏱️',
          callback: () => toggle(world.performancePanel),
        },
        {
          id: 'interaction-coach',
          label: 'Coach',
          icon: '🎓',
          callback: () => toggle(world.interactionCoach),
        },
        { id: 'tour', label: 'Tour', icon: '📍', callback: () => world.startTour() },
        {
          id: 'narrative-strip',
          label: 'Timeline',
          icon: '🎞️',
          callback: () => toggle(world.narrativeStrip),
        },
        {
          id: 'recenter',
          label: 'Recenter',
          icon: '🎯',
          callback: () => world.panelManager.recenter(),
        },
        {
          id: 'scroll-dashboard-left',
          label: '◀ Dash',
          icon: '⬅️',
          callback: () => world.dashboard.scrollBySlots(-1),
        },
        {
          id: 'scroll-dashboard-right',
          label: 'Dash ▶',
          icon: '➡️',
          callback: () => world.dashboard.scrollBySlots(1),
        },
        {
          id: 'reset-dashboard',
          label: 'Reset Dash',
          icon: '↺',
          callback: () => world.dashboard.resetDashboard(),
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
          callback: () => toggle(world.networkPanel),
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
  ];
}
