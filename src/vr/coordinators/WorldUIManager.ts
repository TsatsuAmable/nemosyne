/**
 * Owns construction and lifecycle of all HUD panels, the dashboard, the hand
 * wheel menu, and the launcher ring. `World.js` keeps these objects reachable
 * through legacy facade properties so existing tests remain valid.
 */

import type { Group } from 'three';
import { InputTelemetry } from '../InputTelemetry.ts';
import { VRConsole } from '../ui/VRConsole.ts';
import { VRMenu } from '../ui/VRMenu.ts';
import { PanelManager } from '../ui/PanelManager.ts';
import { SettingsPanel } from '../ui/SettingsPanel.ts';
import { HandWheelMenu } from '../ui/HandWheelMenu.ts';
import { OperationLogPanel } from '../ui/OperationLogPanel.ts';
import { DashboardManager } from '../ui/DashboardManager.ts';
import { TelemetryPanel } from '../ui/TelemetryPanel.ts';
import { PerformancePanel } from '../ui/PerformancePanel.ts';
import { NetworkPanel } from '../ui/NetworkPanel.ts';
import { InteractionCoach } from '../ui/InteractionCoach.ts';
import { NarrativeStrip } from '../ui/NarrativeStrip.ts';
import { MiniOverview } from '../ui/MiniOverview.ts';
import { PeerPresenceHUD } from '../ui/PeerPresenceHUD.ts';
import { LoadTestPanel } from '../ui/LoadTestPanel.ts';
import type { LoadTestDriver } from '../scalability/LoadTestDriver.ts';
import type { Engine } from '../Engine.ts';
import type { WorldEventBusLike } from './types.ts';
import type {
  AccessibilityOptions,
  HandLike,
  HandWheelMenuLike,
  LooseOptions,
  PanelLike,
  PanelManagerLike,
  PerformanceBudgetLike,
  TelemetryCollectorLike,
  WheelMenuCategory,
  WorldUIManagerCallbacks,
} from './types.ts';
import { DEFAULT_ACCESSIBILITY } from './types.ts';

export class WorldUIManager {
  engine: Engine;
  analystAnchor: Group;
  eventBus: WorldEventBusLike;
  callbacks: WorldUIManagerCallbacks;

  telemetryPanel: InputTelemetry;
  vrConsole: VRConsole;
  vrMenu: VRMenu;
  panelManager: PanelManagerLike;
  miniOverview: MiniOverview;
  peerPresenceHUD: PeerPresenceHUD;
  dashboard: DashboardManager;
  handWheelMenu: HandWheelMenuLike;
  settingsPanel: PanelLike;
  operationLogPanel: PanelLike;
  metricsPanel: TelemetryPanel;
  performancePanel: PerformancePanel;
  networkPanel: NetworkPanel;
  interactionCoach: PanelLike;
  narrativeStrip: PanelLike;
  loadTestPanel: LoadTestPanel;

  constructor(engine: Engine, analystAnchor: Group, eventBus: WorldEventBusLike, callbacks: WorldUIManagerCallbacks = {}) {
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
      onCompare: callbacks.onCompare,
      onReset: callbacks.onReset,
    } as LooseOptions);
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
    } as LooseOptions);
    this.miniOverview.setEnabled((callbacks.getSetting?.('miniOverview') as boolean | undefined) ?? true);
    this.engine.addUpdatable(this.miniOverview);

    // Peer-presence HUD for collaboration.
    this.peerPresenceHUD = new PeerPresenceHUD(engine.cameraGroup, {
      followAnchor: analystAnchor,
      getPeers: callbacks.getPeers,
      getLocalPeerId: callbacks.getLocalPeerId,
      position: [-0.9, 1.35, -0.7],
      size: 0.5,
    } as LooseOptions);
    this.peerPresenceHUD.setEnabled((callbacks.getSetting?.('peerPresence') as boolean | undefined) ?? true);
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
    const dominantHand = callbacks.getDominantHand?.() ??
      (engine.input.hands.find((hand) => hand.handedness === 'right') as unknown as HandLike | undefined);
    this.handWheelMenu = new HandWheelMenu(engine, dominantHand as HandLike, {
      feedback: engine.input.feedback,
      analystAnchor,
      openAngleThreshold: Math.PI / 8,
      closeAngleThreshold: Math.PI * 0.75,
      hoverDelayMs: 120,
    } as LooseOptions);
    this.engine.addUpdatable(this.handWheelMenu);
    this.engine.addHudObject(this.handWheelMenu);
    this.engine.input.setHandWheelMenu(this.handWheelMenu);

    // Settings panel.
    this.settingsPanel = new SettingsPanel(engine.cameraGroup, {
      onChange: callbacks.onSettingChanged,
      telemetryCollector: callbacks.telemetryCollector as TelemetryCollectorLike | undefined,
      performanceBudget: engine.performanceBudget as PerformanceBudgetLike,
      datasetTopology: '-',
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
      telemetry: callbacks.telemetryCollector as TelemetryCollectorLike | undefined,
      budget: engine.performanceBudget as PerformanceBudgetLike,
      datasetTopology: '-',
    });
    this.panelManager.register(this.metricsPanel);
    this.engine.input.addPanel(this.metricsPanel);
    this.engine.addUpdatable(this.metricsPanel);
    this.panelManager.hidePanel(this.metricsPanel);

    // Performance budget panel.
    this.performancePanel = new PerformancePanel(engine.cameraGroup, {
      budget: engine.performanceBudget as PerformanceBudgetLike,
      telemetry: callbacks.telemetryCollector as TelemetryCollectorLike | undefined,
    });
    this.panelManager.register(this.performancePanel);
    this.engine.input.addPanel(this.performancePanel);
    this.engine.addUpdatable(this.performancePanel);
    this.panelManager.hidePanel(this.performancePanel);

    // Collaboration network panel.
    this.networkPanel = new NetworkPanel(engine.cameraGroup, {
      roomId: '-',
    });
    this.panelManager.register(this.networkPanel);
    this.engine.input.addPanel(this.networkPanel);
    this.engine.addUpdatable(this.networkPanel);
    this.panelManager.hidePanel(this.networkPanel);

    // Interaction coach.
    this.interactionCoach = new InteractionCoach(engine.cameraGroup, {
      userMode: (callbacks.getSetting?.('userMode') as string | undefined) ?? 'novice',
    } as LooseOptions);
    this.panelManager.register(this.interactionCoach);
    this.engine.input.addPanel(this.interactionCoach);
    this.engine.addUpdatable(this.interactionCoach);
    this.panelManager.hidePanel(this.interactionCoach);

    // Narrative breadcrumb strip.
    this.narrativeStrip = new NarrativeStrip(engine.cameraGroup, {
      analystAnchor,
      history: callbacks.analysisHistory,
      onSeek: callbacks.onSeekHistory,
    } as LooseOptions);
    this.panelManager.register(this.narrativeStrip);
    this.engine.input.addPanel(this.narrativeStrip);
    this.engine.addUpdatable(this.narrativeStrip);
    this.panelManager.hidePanel(this.narrativeStrip);

    // Load-test panel (WASM command-buffer decision harness). Bound to the
    // driver + start/stop/flush callbacks owned by World.
    this.loadTestPanel = new LoadTestPanel(engine.cameraGroup, {
      driver: callbacks.loadTestDriver as LoadTestDriver,
      eventBus: eventBus,
      onStart: callbacks.onStartLoadTest,
      onStop: callbacks.onStopLoadTest,
      onFlush: callbacks.onFlushLoadTest,
    });
    this.panelManager.register(this.loadTestPanel);
    this.engine.input.addPanel(this.loadTestPanel);
    this.engine.addUpdatable(this.loadTestPanel);
    this.panelManager.hidePanel(this.loadTestPanel);
  }

  /**
   * Populate the hand wheel menu from a pre-built category/action list.
   */
  buildWheelMenu(categories: WheelMenuCategory[]): void {
    this.handWheelMenu.setMenu(categories);
  }

  /**
   * Forward accessibility options to all registered panels that support it.
   */
  applyAccessibility(options: Partial<AccessibilityOptions>): void {
    const full = { ...DEFAULT_ACCESSIBILITY, ...options } as AccessibilityOptions;
    for (const panel of this.panelManager.panels) {
      if (panel?.applyAccessibility) panel.applyAccessibility(full);
    }
    this.handWheelMenu?.applyAccessibility?.(full);
  }

  /** Toggle the settings panel through PanelManager. */
  toggleSettingsPanel(): void {
    this.panelManager.togglePanel(this.settingsPanel);
  }

  /** Return whether the settings panel mesh is currently visible. */
  get isSettingsPanelVisible(): boolean {
    return !!this.settingsPanel?.mesh?.visible;
  }

  /** Show a panel via PanelManager. */
  showPanel(panel: PanelLike): void {
    this.panelManager.showPanel(panel);
  }

  /** Hide a panel via PanelManager. */
  hidePanel(panel: PanelLike): void {
    this.panelManager.hidePanel(panel);
  }

  /** Recenter the panel layout. */
  recenterPanels(): void {
    this.panelManager.recenter();
  }

  /** Toggle the launcher ring. */
  toggleLauncher(): void {
    this.panelManager.toggleLauncher();
  }

  get isLauncherVisible(): boolean {
    return this.panelManager.isLauncherVisible();
  }
}
