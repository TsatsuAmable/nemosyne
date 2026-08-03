/**
 * Owns construction and lifecycle of all HUD panels, the dashboard, the hand
 * wheel menu, and the launcher ring. `World.js` keeps these objects reachable
 * through legacy facade properties so existing tests remain valid.
 */

import { InputTelemetry } from '../InputTelemetry.js';
import { VRConsole } from '../ui/VRConsole.js';
import { VRMenu } from '../ui/VRMenu.js';
import { PanelManager } from '../ui/PanelManager.js';
import { SettingsPanel } from '../ui/SettingsPanel.js';
import { HandWheelMenu } from '../ui/HandWheelMenu.js';
import { OperationLogPanel } from '../ui/OperationLogPanel.js';
import { DashboardManager } from '../ui/DashboardManager.js';
import { TelemetryPanel } from '../ui/TelemetryPanel.js';
import { PerformancePanel } from '../ui/PerformancePanel.js';
import { NetworkPanel } from '../ui/NetworkPanel.js';
import { InteractionCoach } from '../ui/InteractionCoach.js';
import { NarrativeStrip } from '../ui/NarrativeStrip.js';
import { MiniOverview } from '../ui/MiniOverview.js';
import { PeerPresenceHUD } from '../ui/PeerPresenceHUD.js';

export class WorldUIManager {
  /**
   * @param {import('../Engine.js').Engine} engine
   * @param {import('three').Group} analystAnchor
   * @param {import('../../utils/EventBus.js').WorldEventBus} eventBus
   * @param {object} callbacks
   */
  constructor(engine, analystAnchor, eventBus, callbacks = {}) {
    this.engine = engine;
    this.analystAnchor = analystAnchor;
    this.eventBus = eventBus;
    this.callbacks = callbacks;

    // DOM telemetry overlay panel.
    this.telemetryPanel = new InputTelemetry(engine);
    this.engine.addUpdatable(this.telemetryPanel);

    // In-VR console log.
    this.vrConsole = new VRConsole(engine.cameraGroup);
    this.engine.addUpdatable(this.vrConsole);

    // Main operation / dataset menu.
    this.vrMenu = new VRMenu(engine.cameraGroup, {
      onLoadDataset: callbacks.onLoadDataset,
      onTogglePortals: callbacks.onTogglePortals,
      onConnectStream: callbacks.onConnectStream,
      onDisconnectStream: callbacks.onDisconnectStream,
      onSelectLiveSource: callbacks.onSelectLiveSource,
      onFilter: callbacks.onFilter,
      onSort: callbacks.onSort,
      onAggregate: callbacks.onAggregate,
      onCluster: callbacks.onCluster,
      onHierarchicalCluster: callbacks.onHierarchicalCluster,
      onDensityCluster: callbacks.onDensityCluster,
      onAnomaly: callbacks.onAnomaly,
      onTimeSlice: callbacks.onTimeSlice,
      onReset: callbacks.onReset,
    });
    this.engine.addUpdatable(this.vrMenu);

    // Panel manager owns the launcher ring and per-panel visibility.
    this.panelManager = new PanelManager(engine.cameraGroup, {
      analystAnchor,
      freeFloating: true,
      onChange: callbacks.onPanelChange,
    });
    this.panelManager.register(this.telemetryPanel);
    this.panelManager.register(this.vrConsole);
    this.panelManager.register(this.vrMenu);
    this.engine.input.setPanelManager(this.panelManager);
    this.engine.input.addPanel(this.telemetryPanel);
    this.engine.input.addPanel(this.vrConsole);
    this.engine.input.addPanel(this.vrMenu);

    // Mini-overview / mini-map showing palace and camera frustum.
    this.miniOverview = new MiniOverview(engine.cameraGroup, {
      followAnchor: analystAnchor,
      getNodeMeshes: callbacks.getNodeMeshes,
      getCamera: () => engine.camera,
      position: [0.9, 1.35, -0.7],
      size: 0.5,
    });
    this.miniOverview.setEnabled(callbacks.getSetting?.('miniOverview') ?? true);
    this.engine.addUpdatable(this.miniOverview);

    // Peer-presence HUD for collaboration.
    this.peerPresenceHUD = new PeerPresenceHUD(engine.cameraGroup, {
      followAnchor: analystAnchor,
      getPeers: callbacks.getPeers,
      getLocalPeerId: callbacks.getLocalPeerId,
      position: [-0.9, 1.35, -0.7],
      size: 0.5,
    });
    this.peerPresenceHUD.setEnabled(callbacks.getSetting?.('peerPresence') ?? true);
    this.engine.addUpdatable(this.peerPresenceHUD);

    // Curved analyst dashboard.
    this.dashboard = new DashboardManager(engine.cameraGroup, {
      analystAnchor,
      layoutMode: 'semicircle',
      columns: 7,
      visibleColumns: 5,
      rows: 2,
      radius: 1.35,
      arcSpan: Math.PI,
      centerAngle: 0,
      heightY: 1.45,
      rowPitch: 0.75,
      cellWidth: 0.75,
      cellHeight: 0.55,
      snapDistance: 0.5,
      autoScale: true,
    });
    this.engine.addUpdatable(this.dashboard);

    // Hand-attached radial wheel menu.
    this.handWheelMenu = new HandWheelMenu(engine, engine.input.hands[0], {
      feedback: engine.input.feedback,
      analystAnchor,
      openAngleThreshold: Math.PI / 8,
      closeAngleThreshold: Math.PI * 0.75,
      hoverDelayMs: 120,
    });
    this.engine.addUpdatable(this.handWheelMenu);
    this.engine.addHudObject(this.handWheelMenu);
    this.engine.input.setHandWheelMenu(this.handWheelMenu);

    // Settings panel.
    this.settingsPanel = new SettingsPanel(engine.cameraGroup, {
      onChange: callbacks.onSettingChanged,
    });
    this.engine.addUpdatable(this.settingsPanel);
    this.panelManager.register(this.settingsPanel);
    this.engine.input.addPanel(this.settingsPanel);

    // Operation log panel.
    this.operationLogPanel = new OperationLogPanel(engine.cameraGroup);
    this.panelManager.register(this.operationLogPanel);
    this.engine.input.addPanel(this.operationLogPanel);
    this.panelManager.hidePanel(this.operationLogPanel);

    // Telemetry metrics panel.
    this.metricsPanel = new TelemetryPanel(engine.cameraGroup, {
      telemetry: callbacks.telemetryCollector,
    });
    this.panelManager.register(this.metricsPanel);
    this.engine.input.addPanel(this.metricsPanel);
    this.engine.addUpdatable(this.metricsPanel);
    this.panelManager.hidePanel(this.metricsPanel);

    // Performance budget panel.
    this.performancePanel = new PerformancePanel(engine.cameraGroup, {
      budget: engine.performanceBudget,
      telemetry: callbacks.telemetryCollector,
    });
    this.panelManager.register(this.performancePanel);
    this.engine.input.addPanel(this.performancePanel);
    this.engine.addUpdatable(this.performancePanel);
    this.panelManager.hidePanel(this.performancePanel);

    // Collaboration network panel.
    this.networkPanel = new NetworkPanel(engine.cameraGroup, {
      telemetry: callbacks.telemetryCollector,
    });
    this.panelManager.register(this.networkPanel);
    this.engine.input.addPanel(this.networkPanel);
    this.engine.addUpdatable(this.networkPanel);
    this.panelManager.hidePanel(this.networkPanel);

    // Interaction coach.
    this.interactionCoach = new InteractionCoach(engine.cameraGroup, {
      userMode: callbacks.getSetting?.('userMode') ?? 'novice',
    });
    this.panelManager.register(this.interactionCoach);
    this.engine.input.addPanel(this.interactionCoach);
    this.engine.addUpdatable(this.interactionCoach);
    this.panelManager.hidePanel(this.interactionCoach);

    // Narrative breadcrumb strip.
    this.narrativeStrip = new NarrativeStrip(engine.cameraGroup, {
      analystAnchor,
      history: callbacks.analysisHistory,
      onSeek: callbacks.onSeekHistory,
    });
    this.panelManager.register(this.narrativeStrip);
    this.engine.input.addPanel(this.narrativeStrip);
    this.engine.addUpdatable(this.narrativeStrip);
    this.panelManager.hidePanel(this.narrativeStrip);
  }

  /**
   * Populate the hand wheel menu from a pre-built category/action list.
   * @param {Array} actions
   */
  buildWheelMenu(actions) {
    this.handWheelMenu.setMenu(actions);
  }

  /**
   * Forward accessibility options to all registered panels that support it.
   * @param {object} options
   */
  applyAccessibility(options) {
    for (const panel of this.panelManager.panels) {
      if (panel?.applyAccessibility) panel.applyAccessibility(options);
    }
    this.handWheelMenu?.applyAccessibility?.(options);
  }

  /** Toggle the settings panel through PanelManager. */
  toggleSettingsPanel() {
    this.panelManager.togglePanel(this.settingsPanel);
  }

  /** Return whether the settings panel mesh is currently visible. */
  get isSettingsPanelVisible() {
    return !!this.settingsPanel?.mesh?.visible;
  }

  /** Show a panel via PanelManager. */
  showPanel(panel) {
    this.panelManager.showPanel(panel);
  }

  /** Hide a panel via PanelManager. */
  hidePanel(panel) {
    this.panelManager.hidePanel(panel);
  }

  /** Recenter the panel layout. */
  recenterPanels() {
    this.panelManager.recenter();
  }

  /** Toggle the launcher ring. */
  toggleLauncher() {
    this.panelManager.toggleLauncher();
  }

  /** @returns {boolean} */
  get isLauncherVisible() {
    return this.panelManager.isLauncherVisible();
  }
}
