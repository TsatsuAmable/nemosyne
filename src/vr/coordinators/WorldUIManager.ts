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
import { RecommendationPanel } from '../ui/RecommendationPanel.ts';
import { DracoExplainerPanel } from '../ui/DracoExplainerPanel.ts';
import { RepresentationCarousel } from '../ui/RepresentationCarousel.ts';
import { TransientContextCardManager } from '../ui/TransientContextCards.ts';
import { SchemaMappingPanel } from '../ui/SchemaMappingPanel.ts';
import { GestureConfidenceHUD } from '../ui/GestureConfidenceHUD.ts';
import { FrustrationResponseManager } from '../ui/FrustrationResponseManager.ts';
import { JITGestureHintManager } from '../ui/JITGestureHintManager.ts';
import { ProgressiveDisclosureController } from '../ui/ProgressiveDisclosure.ts';
import { StatusStripController } from '../ui/StatusStripController.ts';
import { PanelRolesManager, type UIMode } from '../ui/PanelRolesManager.ts';
import { ContextualTaskSurface } from '../ui/ContextualTaskSurface.ts';
import type { LoadTestDriver } from '../scalability/LoadTestDriver.ts';
import type { Dataset } from '../../data/Dataset.ts';
import { Dataset as DatasetClass } from '../../data/Dataset.ts';
import type { UXFrustrationAnalyzer } from '../../utils/UXFrustrationAnalyzer.ts';
import type { Engine } from '../Engine.ts';
import type { WorldEventBusLike } from './types.ts';
import type {
  AccessibilityOptions,
  HandLike,
  LooseOptions,
  PanelLike,
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

  statusStrip: StatusStripController;
  panelRolesManager: PanelRolesManager;
  contextualTaskSurface: ContextualTaskSurface;

  telemetryPanel: InputTelemetry;
  vrConsole: VRConsole;
  vrMenu: VRMenu;
  panelManager: PanelManager;
  miniOverview: MiniOverview;
  peerPresenceHUD: PeerPresenceHUD;
  dashboard: DashboardManager;
  handWheelMenu: HandWheelMenu;
  settingsPanel: SettingsPanel;
  operationLogPanel: OperationLogPanel | null = null;
  metricsPanel: TelemetryPanel;
  performancePanel: PerformancePanel;
  networkPanel: NetworkPanel;
  interactionCoach: InteractionCoach | null = null;
  narrativeStrip: NarrativeStrip | null = null;
  loadTestPanel: LoadTestPanel | null = null;
  recommendationPanel: RecommendationPanel;
  dracoExplainerPanel: DracoExplainerPanel;

  // Superuser / Dev Lab — panel subclasses (wired into PanelManager on first access)
  schemaMappingPanel: SchemaMappingPanel | null = null;
  gestureConfidenceHUD: GestureConfidenceHUD | null = null;

  // Superuser service classes (not PanelLike — stored for programmatic access only)
  representationCarousel: RepresentationCarousel | null = null;
  transientContextCardManager: TransientContextCardManager | null = null;
  frustrationResponseManager: FrustrationResponseManager | null = null;
  jitGestureHintManager: JITGestureHintManager | null = null;
  progressiveDisclosureController: ProgressiveDisclosureController | null = null;

  constructor(engine: Engine, analystAnchor: Group, eventBus: WorldEventBusLike, callbacks: WorldUIManagerCallbacks = {}) {
    this.engine = engine;
    this.analystAnchor = analystAnchor;
    this.eventBus = eventBus;
    this.callbacks = callbacks;

    // Persistent status grounding & context spotlight
    this.statusStrip = new StatusStripController();

    // Panel roles taxonomy & diagnostic gating
    const initialMode: UIMode =
      (callbacks.getSetting?.('userMode') as string) === 'expert' ? 'DEVELOPER' : 'ANALYST';
    this.panelRolesManager = new PanelRolesManager(initialMode);

    // Contextual task-oriented action filter
    this.contextualTaskSurface = new ContextualTaskSurface();

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
      onExitVR: callbacks.onExitVR,
      telemetryCollector: callbacks.telemetryCollector as TelemetryCollectorLike | undefined,
      performanceBudget: engine.performanceBudget as PerformanceBudgetLike,
      datasetTopology: '-',
    });
    this.engine.addUpdatable(this.settingsPanel);
    this.panelManager.register(this.settingsPanel);
    this.engine.input.addPanel(this.settingsPanel);

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

    // OperationLogPanel, InteractionCoach, NarrativeStrip, and LoadTestPanel are
    // lazy — constructed on first access via getOrCreate*() to avoid unconditional
    // boot-time GPU overhead for panels hidden in normal analyst sessions.
    this.panelRolesManager.registerPanel('operationLog', 'Operation Log', 'diagnostic');
    this.panelRolesManager.registerPanel('interactionCoach', 'Interaction Coach', 'system');
    this.panelRolesManager.registerPanel('narrative', 'Narrative Strip', 'context');
    this.panelRolesManager.registerPanel('loadTest', 'Load Test Panel', 'diagnostic');

    this.recommendationPanel = new RecommendationPanel(engine.cameraGroup, {
      getRecommendation: () => callbacks.getRecommendation?.() ?? null,
      onAccept: callbacks.onAcceptRecommendation,
      onReject: callbacks.onRejectRecommendation,
      onOverride: callbacks.onOverrideRecommendation,
      onGenerate: callbacks.onGenerateRecommendation,
    });
    this.panelManager.register(this.recommendationPanel);
    this.engine.input.addPanel(this.recommendationPanel);
    this.engine.addUpdatable(this.recommendationPanel);
    this.panelManager.hidePanel(this.recommendationPanel);

    // Draco explainer panel ("Why this palace?").
    this.dracoExplainerPanel = new DracoExplainerPanel(engine.cameraGroup);
    this.panelManager.register(this.dracoExplainerPanel);
    this.engine.input.addPanel(this.dracoExplainerPanel);
    this.engine.addUpdatable(this.dracoExplainerPanel);
    this.panelManager.hidePanel(this.dracoExplainerPanel);

    // Register eagerly-constructed panels into PanelRolesManager with semantic roles.
    // Lazy panels (operationLog, interactionCoach, narrative, loadTest) pre-register
    // their roles here so the launcher ring can list them before first construction.
    this.panelRolesManager.registerPanel('telemetry', 'Input Telemetry', 'diagnostic');
    this.panelRolesManager.registerPanel('vrConsole', 'VR Console', 'diagnostic');
    this.panelRolesManager.registerPanel('vrMenu', 'Main Menu', 'workspace');
    this.panelRolesManager.registerPanel('settings', 'Settings', 'system');
    this.panelRolesManager.registerPanel('metrics', 'Telemetry Metrics', 'diagnostic');
    this.panelRolesManager.registerPanel('performance', 'Performance Budget', 'diagnostic');
    this.panelRolesManager.registerPanel('network', 'Collaboration Network', 'diagnostic');
    this.panelRolesManager.registerPanel('recommendation', 'Recommendation Panel', 'task');
    this.panelRolesManager.registerPanel('dracoExplainer', 'Draco Explainer Panel', 'task');

    // Superuser / Dev Lab panels — gated to DEVELOPER mode only. Pre-registered
    // so the Super User wheel category can list them before first construction.
    // DracoDiagnosticHUD is owned by World (rebuilt per palace) and toggled via
    // world._toggleDracoDiagnostic, so it is not registered here.
    this.panelRolesManager.registerPanel('su-schema-mapping', 'Schema Mapping Panel', 'superuser');
    this.panelRolesManager.registerPanel('su-gesture-confidence', 'Gesture Confidence HUD', 'superuser');
  }

  getOrCreateOperationLogPanel(): OperationLogPanel {
    if (!this.operationLogPanel) {
      this.operationLogPanel = new OperationLogPanel(this.engine.cameraGroup);
      this.panelManager.register(this.operationLogPanel);
      this.engine.input.addPanel(this.operationLogPanel);
      this.panelManager.hidePanel(this.operationLogPanel);
    }
    return this.operationLogPanel;
  }

  getOrCreateInteractionCoach(): InteractionCoach {
    if (!this.interactionCoach) {
      this.interactionCoach = new InteractionCoach(this.engine.cameraGroup, {
        userMode: (this.callbacks.getSetting?.('userMode') as string | undefined) ?? 'novice',
      } as LooseOptions);
      this.panelManager.register(this.interactionCoach);
      this.engine.input.addPanel(this.interactionCoach);
      this.engine.addUpdatable(this.interactionCoach);
      this.panelManager.hidePanel(this.interactionCoach);
    }
    return this.interactionCoach;
  }

  getOrCreateNarrativeStrip(): NarrativeStrip {
    if (!this.narrativeStrip) {
      this.narrativeStrip = new NarrativeStrip(this.engine.cameraGroup, {
        analystAnchor: this.analystAnchor,
        history: this.callbacks.analysisHistory,
        onSeek: this.callbacks.onSeekHistory,
      } as LooseOptions);
      this.panelManager.register(this.narrativeStrip);
      this.engine.input.addPanel(this.narrativeStrip);
      this.engine.addUpdatable(this.narrativeStrip);
      this.panelManager.hidePanel(this.narrativeStrip);
    }
    return this.narrativeStrip;
  }

  getOrCreateLoadTestPanel(): LoadTestPanel {
    if (!this.loadTestPanel) {
      this.loadTestPanel = new LoadTestPanel(this.engine.cameraGroup, {
        driver: this.callbacks.loadTestDriver as LoadTestDriver,
        eventBus: this.eventBus,
        onStart: this.callbacks.onStartLoadTest,
        onStop: this.callbacks.onStopLoadTest,
        onFlush: this.callbacks.onFlushLoadTest,
      });
      this.panelManager.register(this.loadTestPanel);
      this.engine.input.addPanel(this.loadTestPanel);
      this.engine.addUpdatable(this.loadTestPanel);
      this.panelManager.hidePanel(this.loadTestPanel);
    }
    return this.loadTestPanel;
  }

  getOrCreateSchemaMappingPanel(): SchemaMappingPanel {
    if (!this.schemaMappingPanel) {
      // Schema mapping requires a Dataset; fall back to an empty placeholder so
      // the panel chrome can be reviewed in the Dev Lab even before a dataset
      // is loaded. A real dataset, when available, is wired via getDataset.
      const ds = (this.callbacks.getDataset?.() as Dataset | null | undefined) ?? this._emptyDataset();
      this.schemaMappingPanel = new SchemaMappingPanel(this.engine.cameraGroup, {
        dataset: ds,
        onApplyMapping: () => {},
      });
      this.panelManager.register(this.schemaMappingPanel);
      this.engine.input.addPanel(this.schemaMappingPanel);
      this.panelManager.hidePanel(this.schemaMappingPanel);
    }
    return this.schemaMappingPanel;
  }

  getOrCreateGestureConfidenceHUD(): GestureConfidenceHUD {
    if (!this.gestureConfidenceHUD) {
      this.gestureConfidenceHUD = new GestureConfidenceHUD(this.engine.cameraGroup);
      this.panelManager.register(this.gestureConfidenceHUD);
      this.engine.input.addPanel(this.gestureConfidenceHUD);
      this.engine.addUpdatable(this.gestureConfidenceHUD);
      this.panelManager.hidePanel(this.gestureConfidenceHUD);
    }
    return this.gestureConfidenceHUD;
  }

  /** Build a minimal empty Dataset so SchemaMappingPanel chrome renders for review. */
  private _emptyDataset(): Dataset {
    return new DatasetClass('empty', [], []);
  }

  /**
   * Superuser service-class toggles. These managers are not MovablePanels and are
   * not registered with PanelManager; they are constructed on first toggle and
   * logged to the VR console so a developer can review their state. Full visual
   * integration is deferred (see Dev Lab roadmap item).
   */

  toggleRepresentationCarousel(): void {
    if (!this.representationCarousel) {
      this.representationCarousel = new RepresentationCarousel({ onWeightChange: () => {} });
    }
    this.representationCarousel.enabled = !this.representationCarousel.enabled;
    this.vrConsole?.log?.('log', [
      `Representation Carousel ${this.representationCarousel.enabled ? 'enabled' : 'disabled'} (review mode)`,
    ]);
  }

  toggleTransientContextCards(): void {
    if (!this.transientContextCardManager) {
      this.transientContextCardManager = new TransientContextCardManager();
    }
    // Spawn a sample review card so the manager's data shape is inspectable.
    this.transientContextCardManager.spawnDatasetLoadedCard('review', 0, 'review');
    this.vrConsole?.log?.('log', [
      `Transient Context Cards active (${this.transientContextCardManager.activeCards.length} card/s)`,
    ]);
  }

  toggleProgressiveDisclosure(): void {
    if (!this.progressiveDisclosureController) {
      this.progressiveDisclosureController = new ProgressiveDisclosureController('ANALYST');
    }
    const profiles: Array<'NOVICE' | 'ANALYST' | 'RESEARCHER' | 'DEVELOPER'> = [
      'ANALYST',
      'DEVELOPER',
      'RESEARCHER',
      'NOVICE',
    ];
    const cur = this.progressiveDisclosureController.profile;
    const next = profiles[(profiles.indexOf(cur) + 1) % profiles.length];
    this.progressiveDisclosureController.setProfile(next);
    this.vrConsole?.log?.('log', [`Progressive Disclosure profile: ${next}`]);
  }

  toggleFrustrationResponseManager(): void {
    if (!this.frustrationResponseManager) {
      const analyzer = (this.callbacks.frustrationAnalyzer as UXFrustrationAnalyzer | null | undefined) ?? null;
      if (!analyzer) {
        this.vrConsole?.log?.('warn', ['Frustration Response Manager requires a UXFrustrationAnalyzer (none wired).']);
        return;
      }
      this.frustrationResponseManager = new FrustrationResponseManager(this.engine.cameraGroup, analyzer);
    }
    this.vrConsole?.log?.('log', ['Frustration Response Manager constructed (review mode).']);
  }

  toggleJITGestureHintManager(): void {
    if (!this.jitGestureHintManager) {
      this.jitGestureHintManager = new JITGestureHintManager({ enabled: true });
    }
    this.jitGestureHintManager.enabled = !this.jitGestureHintManager.enabled;
    this.vrConsole?.log?.('log', [
      `JIT Gesture Hints ${this.jitGestureHintManager.enabled ? 'enabled' : 'disabled'} (review mode)`,
    ]);
  }

  /**
   * Toggle a panel while respecting its registered panel role (e.g. max 2 task panels,
   * diagnostic panel UI mode gating).
   */
  togglePanelWithRole(id: string, panel: PanelLike): boolean {
    const isCurrentlyOpen = this.panelRolesManager.isPanelOpen(id);
    if (isCurrentlyOpen) {
      this.panelRolesManager.closePanel(id);
      this.panelManager.hidePanel(panel);
      return false;
    }

    const allowed = this.panelRolesManager.openPanel(id);
    if (!allowed) {
      this.vrConsole?.log?.('warn', [`Panel [${id}] not permitted in mode ${this.panelRolesManager.uiMode}`]);
      return false;
    }

    // Synchronize visibility of registered panels if any were auto-dismissed (e.g. max task panels rule)
    this._syncPanelVisibilityWithRoles();
    this.panelManager.showPanel(panel);
    return true;
  }

  private _syncPanelVisibilityWithRoles(): void {
    const rolePanelMap: Record<string, PanelLike | null> = {
      recommendation: this.recommendationPanel,
      dracoExplainer: this.dracoExplainerPanel,
      telemetry: this.telemetryPanel,
      vrConsole: this.vrConsole,
      operationLog: this.operationLogPanel,
      metrics: this.metricsPanel,
      performance: this.performancePanel,
      network: this.networkPanel,
      'su-schema-mapping': this.schemaMappingPanel,
      'su-gesture-confidence': this.gestureConfidenceHUD,
    };

    for (const [id, p] of Object.entries(rolePanelMap)) {
      if (!this.panelRolesManager.isPanelOpen(id) && p?.mesh?.visible) {
        this.panelManager.hidePanel(p);
      }
    }
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
