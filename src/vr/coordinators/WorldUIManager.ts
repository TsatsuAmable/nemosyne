/**
 * Owns construction and lifecycle of all HUD panels, the dashboard, the hand
 * wheel menu, and the launcher ring. `World.js` keeps these objects reachable
 * through legacy facade properties so existing tests remain valid.
 */

import type { Group, Mesh } from 'three';
import { InputTelemetry } from '../InputTelemetry.ts';
import { VRConsole } from '../ui/VRConsole.ts';
import { VRMenu } from '../ui/VRMenu.ts';
import { PanelManager } from '../ui/PanelManager.ts';
import { SettingsPanel } from '../ui/SettingsPanel.ts';
import { PanelBudgetController } from '../ui-system/PanelBudgetController.ts';
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
import { RecommendationPanel } from '../ui/RecommendationPanel.ts';
import { DracoExplainerPanel } from '../ui/DracoExplainerPanel.ts';
import { RepresentationCarousel } from '../ui/RepresentationCarousel.ts';
import { TransientContextCardManager } from '../ui/TransientContextCards.ts';
import { SchemaMappingPanel } from '../ui/SchemaMappingPanel.ts';
import { VaultPanel } from '../ui/VaultPanel.ts';
import type { ArchiveEntry } from '../../session/VaultArchiveStore.ts';
import { GestureConfidenceHUD } from '../ui/GestureConfidenceHUD.ts';
import { FrustrationResponseManager } from '../ui/FrustrationResponseManager.ts';
import { JITGestureHintManager } from '../ui/JITGestureHintManager.ts';
import { ProgressiveDisclosureController } from '../ui/ProgressiveDisclosure.ts';
import { StatusStripController } from '../ui/StatusStripController.ts';
import { StatusStripPanel } from '../ui/StatusStripPanel.ts';
import { PanelRolesManager, type UIMode } from '../ui/PanelRolesManager.ts';
import { PANEL_LAYOUT, type Vec3 } from '../ui/panelLayout.ts';
import { ContextualTaskSurface } from '../ui/ContextualTaskSurface.ts';
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
} from './types.ts';
import { DEFAULT_ACCESSIBILITY } from './types.ts';

export interface WorldUIManagerCallbacks {
  onLoadDataset?: (entry: unknown) => void;
  onTogglePortals?: (enabled: boolean) => void;
  onConnectStream?: () => void;
  onDisconnectStream?: () => void;
  onSelectLiveSource?: (sourceKey: string) => void;
  onFilter?: () => void;
  onSort?: () => void;
  onAggregate?: () => void;
  onCluster?: () => void;
  onHierarchicalCluster?: () => void;
  onDensityCluster?: () => void;
  onAnomaly?: () => void;
  onTimeSlice?: () => void;
  onCompare?: () => void;
  onReset?: () => void;
  onPanelChange?: () => void;
  onSettingChanged?: (key: string, value: unknown) => void;
  onSeekHistory?: (index: number) => void;
  getNodeMeshes?: () => Mesh[];
  getDominantHand?: () => HandLike | null;
  getPeers?: () => unknown[];
  getLocalPeerId?: () => string | null;
  getSetting?: (key: string) => unknown;
  telemetryCollector?: unknown;
  analysisHistory?: unknown;
  getRecommendation?: () => import('../../atlas/types.ts').AtlasRecommendation | null;
  getOutcome?: () => import('../../moneta/representation/ActionableNil.ts').InvestigatorActionableOutcome | null;
  onAcceptRecommendation?: () => void;
  onRejectRecommendation?: () => void;
  onOverrideRecommendation?: () => void;
  onGenerateRecommendation?: () => void;
  onApplyRemediation?: (action: import('../../moneta/representation/ActionableNil.ts').RemedialAction) => void;
  onPreviewRemediation?: (action: import('../../moneta/representation/ActionableNil.ts').RemedialAction) => boolean;
  getPreviewDecision?: () => import('../../moneta/representation/RepresentationDecision.ts').RepresentationDecision | null;
  onCommitRemediation?: (action: import('../../moneta/representation/ActionableNil.ts').RemedialAction) => void;
  onCancelRemediationPreview?: () => void;
  onExitVR?: () => void;
  uiMode?: UIMode;
  onStatusUpdate?: (statusText: string) => void;
  frustrationAnalyzer?: UXFrustrationAnalyzer | null;
  getDataset?: () => Dataset | null;
  /** Apply a schema-mapping edit by reloading the dataset with new column types. */
  applySchemaMapping?: (updated: Dataset) => void;
  onInspectNode?: (data: Record<string, unknown> | null) => void;
  onRecordFinding?: (data: Record<string, unknown> | null) => void;
  onNavigateNode?: (data: Record<string, unknown> | null) => void;
  onFreezeInvestigation?: () => Promise<void>;
  onRestoreArchive?: (archiveId: string) => void;
  onExportArchive?: (archiveId: string) => void;
  onDeleteArchive?: (archiveId: string) => void;
  getArchiveList?: () => Promise<ArchiveEntry[]>;
  onShowConstraints?: () => void;
}

interface AdaptiveAssistLike {
  confidenceHUD: GestureConfidenceHUD;
  frustrationResponse: FrustrationResponseManager;
  jitHints: JITGestureHintManager;
}

/**
 * Apply a PANEL_LAYOUT default to a constructed panel: both the live mesh
 * position and MovablePanel's `defaultPosition` (reset-to-home) follow the
 * layout. See docs/decisions/VR_PANEL_SPATIAL_LAYOUT.md.
 */
function applyPanelLayout(
  panel: { mesh: { position: { set(x: number, y: number, z: number): unknown } } },
  position: Vec3
): void {
  panel.mesh.position.set(position[0], position[1], position[2]);
  const movable = panel as unknown as {
    defaultPosition?: { set(x: number, y: number, z: number): unknown };
  };
  movable.defaultPosition?.set(position[0], position[1], position[2]);
}

export class WorldUIManager {
  engine: Engine;
  analystAnchor: Group;
  eventBus: WorldEventBusLike;
  callbacks: WorldUIManagerCallbacks;

  statusStrip: StatusStripController;
  panelRolesManager: PanelRolesManager;
  contextualTaskSurface: ContextualTaskSurface;
  /**
   * Enforces the analyst workspace panel budget for SpatialPanel-based surfaces
   * (HolographicInspector, SettingsPanel, and future migrated precision
   * surfaces). Legacy MovablePanel surfaces remain under `panelManager` /
   * `panelRolesManager` until they migrate.
   */
  panelBudgetController: PanelBudgetController;

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
  recommendationPanel: RecommendationPanel;
  dracoExplainerPanel: DracoExplainerPanel;
  vaultPanel: VaultPanel;
  statusStripPanel: StatusStripPanel;

  // Superuser / Dev Lab — panel subclasses (wired into PanelManager on first access)
  schemaMappingPanel: SchemaMappingPanel | null = null;
  gestureConfidenceHUD: GestureConfidenceHUD | null = null;

  // Superuser service classes (not PanelLike — stored for programmatic access only)
  representationCarousel: RepresentationCarousel | null = null;
  transientContextCardManager: TransientContextCardManager | null = null;
  frustrationResponseManager: FrustrationResponseManager | null = null;
  jitGestureHintManager: JITGestureHintManager | null = null;
  progressiveDisclosureController: ProgressiveDisclosureController | null = null;
  private _borrowedResources = new Set<object>();
  private _disposed = false;

  constructor(
    engine: Engine,
    analystAnchor: Group,
    eventBus: WorldEventBusLike,
    callbacks: WorldUIManagerCallbacks = {}
  ) {
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
    this.contextualTaskSurface = new ContextualTaskSurface(engine, {
      onInspect: (data) => callbacks.onInspectNode?.(data),
      onCompare: (data) => {
        if (data && callbacks.onCompare) callbacks.onCompare();
      },
      onChallenge: () => {
        if (callbacks.onAnomaly) callbacks.onAnomaly();
      },
      onRecord: (data) => callbacks.onRecordFinding?.(data),
      onNavigate: (data) => callbacks.onNavigateNode?.(data),
      onMore: () => {
        callbacks.onShowConstraints?.();
      },
    });
    this.analystAnchor.add(this.contextualTaskSurface);
    this.engine.addUpdatable(this.contextualTaskSurface);
    this.engine.input.addPanel(this.contextualTaskSurface);

    // SpatialPanel workspace budget (governs inspector/settings/future surfaces).
    this.panelBudgetController = new PanelBudgetController();

    // DOM telemetry overlay panel.
    this.telemetryPanel = new InputTelemetry(engine, this.analystAnchor);
    applyPanelLayout(this.telemetryPanel, PANEL_LAYOUT.inputTelemetry);
    this.engine.addUpdatable(this.telemetryPanel);

    // In-VR console log.
    this.vrConsole = new VRConsole(this.analystAnchor);
    applyPanelLayout(this.vrConsole, PANEL_LAYOUT.vrConsole);
    this.engine.addUpdatable(this.vrConsole);

    // Persistent status strip showing dataset, mode, focus, and last action.
    this.statusStripPanel = new StatusStripPanel(this.engine.cameraGroup, {
      statusStrip: this.statusStrip,
      position: [0, 1.75, -1.1],
      worldSize: [0.72, 0.08],
    });
    this.engine.addUpdatable(this.statusStripPanel);


    // Main operation / dataset menu — retired as primary navigation per P1-U8.
    // Functionality folded into TechnoCore, ContextualTaskSurface, and HandWheelMenu.
    // Kept for advanced users but hidden by default.
    this.vrMenu = new VRMenu(this.analystAnchor, {
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
    // Apply layout but keep hidden by default (retired as primary navigation)
    applyPanelLayout(this.vrMenu, PANEL_LAYOUT.legacyMenu);
    this.vrMenu.hide();

    // Panel manager owns the launcher ring and per-panel visibility.
    this.panelManager = new PanelManager(engine.cameraGroup, {
      analystAnchor,
      freeFloating: true,
      onChange: callbacks.onPanelChange,
    });
    this.panelManager.register(this.telemetryPanel);
    this.panelManager.register(this.vrConsole);
    // VRMenu registered but hidden by default (retired as primary navigation)
    this.panelManager.register(this.vrMenu);
    this.engine.input.setPanelManager(this.panelManager);
    this.engine.input.addPanel(this.telemetryPanel);
    this.engine.input.addPanel(this.vrConsole);
    this.engine.input.addPanel(this.vrMenu);

    // Mini-overview / mini-map showing palace and camera frustum.
    // Position is anchor-local (near tier); see finding F1 in the decision record.
    this.miniOverview = new MiniOverview(this.analystAnchor, {
      followAnchor: analystAnchor,
      getNodeMeshes: callbacks.getNodeMeshes,
      getCamera: () => engine.camera,
      position: [...PANEL_LAYOUT.miniOverview],
      size: 0.5,
    } as LooseOptions);
    this.miniOverview.setEnabled(
      (callbacks.getSetting?.('miniOverview') as boolean | undefined) ?? true
    );
    this.engine.addUpdatable(this.miniOverview);

    // Peer-presence HUD for collaboration.
    this.peerPresenceHUD = new PeerPresenceHUD(this.analystAnchor, {
      followAnchor: analystAnchor,
      getPeers: callbacks.getPeers,
      getLocalPeerId: callbacks.getLocalPeerId,
      position: [...PANEL_LAYOUT.peerPresenceHUD],
      size: 0.5,
    } as LooseOptions);
    this.peerPresenceHUD.setEnabled(
      (callbacks.getSetting?.('peerPresence') as boolean | undefined) ?? true
    );
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
    const dominantHand =
      callbacks.getDominantHand?.() ??
      (engine.input.hands.find((hand) => hand.handedness === 'right') as unknown as
        HandLike | undefined);
    this.handWheelMenu = new HandWheelMenu(
      engine,
      dominantHand as HandLike,
      {
        feedback: engine.input.feedback,
        analystAnchor,
        hoverDelayMs: 120,
      } as LooseOptions
    );
    this.engine.addUpdatable(this.handWheelMenu);
    this.engine.addHudObject(this.handWheelMenu);
    this.engine.input.setHandWheelMenu(this.handWheelMenu);
    this.engine.input.addPanel(this.handWheelMenu);

    // Settings panel (SpatialPanel/UIKit substrate; not registered with the
    // MovablePanel-only PanelManager — pointer routing is via engine.input).
    this.settingsPanel = new SettingsPanel({
      torsoAnchor: this.analystAnchor,
      worldScene: engine.scene,
      onChange: callbacks.onSettingChanged,
      onExitVR: callbacks.onExitVR,
      telemetryCollector: callbacks.telemetryCollector as TelemetryCollectorLike | undefined,
      performanceBudget: engine.performanceBudget as PerformanceBudgetLike,
      datasetTopology: '-',
      panelBudgetController: this.panelBudgetController,
    });
    this.engine.addUpdatable(this.settingsPanel);
    applyPanelLayout(this.settingsPanel, PANEL_LAYOUT.settingsPanel);
    this.engine.input.addPanel(this.settingsPanel);

    // Telemetry metrics panel.
    this.metricsPanel = new TelemetryPanel(this.analystAnchor, {
      telemetry: callbacks.telemetryCollector as TelemetryCollectorLike | undefined,
      budget: engine.performanceBudget as PerformanceBudgetLike,
      datasetTopology: '-',
    });
    this.panelManager.register(this.metricsPanel);
    this.engine.input.addPanel(this.metricsPanel);
    this.engine.addUpdatable(this.metricsPanel);
    this.panelManager.hidePanel(this.metricsPanel);
    applyPanelLayout(this.metricsPanel, PANEL_LAYOUT.telemetryPanel);

    // Performance budget panel.
    this.performancePanel = new PerformancePanel(this.analystAnchor, {
      budget: engine.performanceBudget as PerformanceBudgetLike,
      telemetry: callbacks.telemetryCollector as TelemetryCollectorLike | undefined,
    });
    this.panelManager.register(this.performancePanel);
    this.engine.input.addPanel(this.performancePanel);
    this.engine.addUpdatable(this.performancePanel);
    this.panelManager.hidePanel(this.performancePanel);
    applyPanelLayout(this.performancePanel, PANEL_LAYOUT.performancePanel);

    // Collaboration network panel.
    this.networkPanel = new NetworkPanel(this.analystAnchor, {
      roomId: '-',
    });
    this.panelManager.register(this.networkPanel);
    this.engine.input.addPanel(this.networkPanel);
    this.engine.addUpdatable(this.networkPanel);
    this.panelManager.hidePanel(this.networkPanel);
    applyPanelLayout(this.networkPanel, PANEL_LAYOUT.networkPanel);

    // Core secondary panels are lazy to avoid unconditional boot-time GPU
    // overhead. Dev-only panels are composed by their external installer.
    this.panelRolesManager.registerPanel('operationLog', 'Operation Log', 'diagnostic');
    this.panelRolesManager.registerPanel('interactionCoach', 'Interaction Coach', 'system');
    this.panelRolesManager.registerPanel('narrative', 'Narrative Strip', 'secondary');

    this.recommendationPanel = new RecommendationPanel(this.analystAnchor, {
      getRecommendation: () => callbacks.getRecommendation?.() ?? null,
      getOutcome: () => callbacks.getOutcome?.() ?? null,
      onAccept: callbacks.onAcceptRecommendation,
      onReject: callbacks.onRejectRecommendation,
      onOverride: callbacks.onOverrideRecommendation,
      onGenerate: callbacks.onGenerateRecommendation,
      onApplyRemediation: callbacks.onApplyRemediation,
      onPreviewRemediation: callbacks.onPreviewRemediation,
      getPreviewDecision: callbacks.getPreviewDecision,
      onCommitRemediation: callbacks.onCommitRemediation,
      onCancelRemediationPreview: callbacks.onCancelRemediationPreview,
    });
    this.panelManager.register(this.recommendationPanel);
    this.engine.input.addPanel(this.recommendationPanel);
    this.engine.addUpdatable(this.recommendationPanel);
    this.panelManager.hidePanel(this.recommendationPanel);
    applyPanelLayout(this.recommendationPanel, PANEL_LAYOUT.recommendationPanel);

    // Draco explainer panel ("Why this palace?").
    this.dracoExplainerPanel = new DracoExplainerPanel(this.analystAnchor);
    applyPanelLayout(this.dracoExplainerPanel, PANEL_LAYOUT.monetaExplainerPanel);
    this.panelManager.register(this.dracoExplainerPanel);
    this.engine.input.addPanel(this.dracoExplainerPanel);
    this.engine.addUpdatable(this.dracoExplainerPanel);
    this.panelManager.hidePanel(this.dracoExplainerPanel);

    // Evidence Vault panel — archive/restore investigation snapshots.
    this.vaultPanel = new VaultPanel(this.analystAnchor, {
      onFreeze: callbacks.onFreezeInvestigation,
      onRestore: callbacks.onRestoreArchive,
      onExport: callbacks.onExportArchive,
      onDelete: callbacks.onDeleteArchive,
    });
    this.panelManager.register(this.vaultPanel);
    this.engine.input.addPanel(this.vaultPanel);
    this.engine.addUpdatable(this.vaultPanel);
    this.panelManager.hidePanel(this.vaultPanel);
    applyPanelLayout(this.vaultPanel, PANEL_LAYOUT.vaultPanel);

    // Register eagerly-constructed panels into PanelRolesManager with semantic roles.
    // Lazy core panels pre-register roles so policy does not depend on allocation.
    // Extensions register their own roles when installed.
    this.panelRolesManager.registerPanel('telemetry', 'Input Telemetry', 'diagnostic');
    this.panelRolesManager.registerPanel('vrConsole', 'VR Console', 'diagnostic');
    // VRMenu retired as primary navigation per P1-U8; reclassified as diagnostic.
    this.panelRolesManager.registerPanel('vrMenu', 'Legacy Menu', 'diagnostic');
    this.panelRolesManager.registerPanel('settings', 'Settings', 'system');
    this.panelRolesManager.registerPanel('metrics', 'Telemetry Metrics', 'diagnostic');
    this.panelRolesManager.registerPanel('performance', 'Performance Budget', 'diagnostic');
    this.panelRolesManager.registerPanel('network', 'Collaboration Network', 'diagnostic');
    this.panelRolesManager.registerPanel('recommendation', 'Recommendation Panel', 'primary');
    this.panelRolesManager.registerPanel('dracoExplainer', 'Draco Explainer Panel', 'primary');
    this.panelRolesManager.registerPanel('vault', 'Evidence Vault', 'primary');

    // Superuser / Dev Lab panels — gated to DEVELOPER mode only. Pre-registered
    // so the Super User wheel category can list them before first construction.
    // DracoDiagnosticHUD is owned by World (rebuilt per palace) and toggled via
    // world._toggleDracoDiagnostic, so it is not registered here.
    // SchemaMappingPanel migrated to a SpatialPanel lifecycle (P1-U3) and is
    // toggled via `toggleSchemaMappingPanel` (not `panelManager.togglePanel`),
    // so it is no longer pre-registered with the role manager.
    this.panelRolesManager.registerPanel(
      'su-gesture-confidence',
      'Gesture Confidence HUD',
      'diagnostic'
    );
  }

  getOrCreateOperationLogPanel(): OperationLogPanel {
    if (!this.operationLogPanel) {
      this.operationLogPanel = new OperationLogPanel(this.analystAnchor);
      applyPanelLayout(this.operationLogPanel, PANEL_LAYOUT.operationLogPanel);
      this.panelManager.register(this.operationLogPanel);
      this.engine.input.addPanel(this.operationLogPanel);
      this.panelManager.hidePanel(this.operationLogPanel);
    }
    return this.operationLogPanel;
  }

  getOrCreateInteractionCoach(): InteractionCoach {
    if (!this.interactionCoach) {
      this.interactionCoach = new InteractionCoach(this.analystAnchor, {
        userMode: (this.callbacks.getSetting?.('userMode') as string | undefined) ?? 'novice',
      } as LooseOptions);
      this.panelManager.register(this.interactionCoach);
      applyPanelLayout(this.interactionCoach, PANEL_LAYOUT.interactionCoach);
      this.engine.input.addPanel(this.interactionCoach);
      this.engine.addUpdatable(this.interactionCoach);
      this.panelManager.hidePanel(this.interactionCoach);
    }
    return this.interactionCoach;
  }

  getOrCreateNarrativeStrip(): NarrativeStrip {
    if (!this.narrativeStrip) {
      this.narrativeStrip = new NarrativeStrip(this.analystAnchor, {
        analystAnchor: this.analystAnchor,
        history: this.callbacks.analysisHistory,
        onSeek: this.callbacks.onSeekHistory,
      } as LooseOptions);
      this.panelManager.register(this.narrativeStrip);
      // Anchor-parented: place via anchor-local near-low slot (finding F1).
      applyPanelLayout(this.narrativeStrip, PANEL_LAYOUT.narrativeStrip);
      this.engine.input.addPanel(this.narrativeStrip);
      this.engine.addUpdatable(this.narrativeStrip);
      this.panelManager.hidePanel(this.narrativeStrip);
    }
    return this.narrativeStrip;
  }

  getOrCreateSchemaMappingPanel(): SchemaMappingPanel {
    if (!this.schemaMappingPanel) {
      // Schema mapping requires a Dataset; fall back to an empty placeholder so
      // the panel chrome can be reviewed in the Dev Lab even before a dataset
      // is loaded. A real dataset, when available, is wired via getDataset and
      // refreshed on every `show()` so the panel never shows a stale schema.
      const ds =
        (this.callbacks.getDataset?.() as Dataset | null | undefined) ?? this._emptyDataset();
      this.schemaMappingPanel = new SchemaMappingPanel({
        torsoAnchor: this.analystAnchor,
        worldScene: this.engine.scene,
        dataset: ds,
        getDataset: () => (this.callbacks.getDataset?.() as Dataset | null | undefined) ?? null,
        onApplyMapping: (updated) => this.callbacks.applySchemaMapping?.(updated),
        panelBudgetController: this.panelBudgetController,
      });
      // SpatialPanel lifecycle: NOT registered with the MovablePanel-only
      // PanelManager. Pointer routing is via engine.input; workspace budget is
      // mediated by panelBudgetController (role: 'reference'), mirroring the
      // SettingsPanel migration.
      applyPanelLayout(this.schemaMappingPanel, PANEL_LAYOUT.schemaMappingPanel);
      this.engine.input.addPanel(this.schemaMappingPanel);
      this.schemaMappingPanel.hide();
    }
    return this.schemaMappingPanel;
  }

  /** Toggle the schema-mapping panel (SpatialPanel lifecycle, mirrors settings). */
  toggleSchemaMappingPanel(): void {
    this.getOrCreateSchemaMappingPanel().toggle();
  }

  getOrCreateGestureConfidenceHUD(): GestureConfidenceHUD {
    if (!this.gestureConfidenceHUD) {
      this.gestureConfidenceHUD = new GestureConfidenceHUD(this.analystAnchor);
      applyPanelLayout(this.gestureConfidenceHUD, PANEL_LAYOUT.gestureConfidenceHUD);
      this.panelManager.register(this.gestureConfidenceHUD);
      this.engine.input.addPanel(this.gestureConfidenceHUD);
      this.engine.addUpdatable(this.gestureConfidenceHUD);
      this.panelManager.hidePanel(this.gestureConfidenceHUD);
    }
    return this.gestureConfidenceHUD;
  }

  bindAdaptiveAssist(controller: AdaptiveAssistLike): void {
    this.gestureConfidenceHUD = controller.confidenceHUD;
    this.frustrationResponseManager = controller.frustrationResponse;
    this.jitGestureHintManager = controller.jitHints;
    this._borrowedResources.add(controller.confidenceHUD);
    this._borrowedResources.add(controller.frustrationResponse);
    this._borrowedResources.add(controller.jitHints);
    this.panelManager.register(controller.confidenceHUD);
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
      const analyzer =
        (this.callbacks.frustrationAnalyzer as UXFrustrationAnalyzer | null | undefined) ?? null;
      if (!analyzer) {
        this.vrConsole?.log?.('warn', [
          'Frustration Response Manager requires a UXFrustrationAnalyzer (none wired).',
        ]);
        return;
      }
      this.frustrationResponseManager = new FrustrationResponseManager(
        this.analystAnchor,
        analyzer
      );
    }
    this.vrConsole?.log?.('log', ['Frustration Response Manager active.']);
  }

  toggleJITGestureHintManager(): void {
    if (!this.jitGestureHintManager) {
      this.jitGestureHintManager = new JITGestureHintManager({ enabled: true });
    }
    this.jitGestureHintManager.enabled = !this.jitGestureHintManager.enabled;
    this.vrConsole?.log?.('log', [
      `JIT Gesture Hints ${this.jitGestureHintManager.enabled ? 'enabled' : 'disabled'}`,
    ]);
  }

  /**
   * Show the RecommendationPanel with the Constraints tab active.
   * Used to surface counterevidence/blocking constraints from the contextual task surface.
   */
  showConstraintsPanel(): void {
    const allowed = this.panelRolesManager.openPanel('recommendation');
    if (!allowed) {
      this.vrConsole?.log?.('warn', [
        `Recommendation Panel not permitted in mode ${this.panelRolesManager.uiMode}`,
      ]);
      return;
    }
    this._syncPanelVisibilityWithRoles();
    this.panelManager.showPanel(this.recommendationPanel);
    this.recommendationPanel.setActiveTab('constraints');
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
      this.vrConsole?.log?.('warn', [
        `Panel [${id}] not permitted in mode ${this.panelRolesManager.uiMode}`,
      ]);
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
    // The settings panel is a SpatialPanel (not a MovablePanel), so it is not in
    // panelManager.panels; theme it explicitly so it stays in sync.
    this.settingsPanel?.applyAccessibility(full);
    this.handWheelMenu?.applyAccessibility?.(full);
  }

  /** Toggle the settings panel directly (SpatialPanel lifecycle). */
  toggleSettingsPanel(): void {
    this.settingsPanel.toggle();
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

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;

    const panels = new Set(this.panelManager.panels);
    for (const panel of panels) {
      this.engine.removeUpdatable(panel);
      this.engine.input.removePanel(panel);
      this.panelManager.unregister(panel);
      if (!this._borrowedResources.has(panel)) panel.dispose?.();
    }

    // The settings panel is a SpatialPanel (not registered with the
    // MovablePanel-only PanelManager) but is tracked by engine.input; detach
    // and dispose it explicitly so no owned resource leaks past dispose.
    this.engine.removeUpdatable(this.settingsPanel);
    this.engine.input.removePanel(this.settingsPanel);
    if (!this._borrowedResources.has(this.settingsPanel)) this.settingsPanel.dispose?.();

    // The schema-mapping panel is likewise a SpatialPanel tracked only by
    // engine.input + the budget controller; detach it explicitly when it has
    // been lazily constructed.
    if (this.schemaMappingPanel) {
      this.engine.input.removePanel(this.schemaMappingPanel);
      this.panelBudgetController.close(this.schemaMappingPanel);
      if (!this._borrowedResources.has(this.schemaMappingPanel)) this.schemaMappingPanel.dispose?.();
      this.schemaMappingPanel = null;
    }

    // Untrack any SpatialPanels still held by the budget controller (e.g. the
    // borrowed HolographicInspector, owned by the scene composer) so the
    // controller does not retain stale references. Close (untrack) only — the
    // composer owns and disposes the inspector itself.
    for (const panel of this.panelBudgetController.getOpenPanels()) {
      this.panelBudgetController.close(panel);
    }

    this.engine.removeUpdatable(this.miniOverview);
    this.engine.removeUpdatable(this.peerPresenceHUD);
    this.engine.removeUpdatable(this.dashboard);
    this.engine.removeUpdatable(this.handWheelMenu);
    this.engine.removeUpdatable(this.contextualTaskSurface);
    this.engine.removeUpdatable(this.statusStripPanel);
    this.engine.removeHudObject(this.handWheelMenu);
    this.engine.input.removePanel(this.handWheelMenu);
    this.engine.input.removePanel(this.contextualTaskSurface);
    this.engine.input.setHandWheelMenu(null);
    this.engine.input.setPanelManager(null);

    this.miniOverview.dispose();
    this.peerPresenceHUD.dispose();
    this.dashboard.dispose();
    this.handWheelMenu.dispose();
    this.statusStripPanel.dispose?.();
    if (!this._borrowedResources.has(this.contextualTaskSurface)) {
      this.contextualTaskSurface.dispose?.();
    }
    this.panelManager.dispose();

    if (this.representationCarousel && !this._borrowedResources.has(this.representationCarousel)) {
      this.representationCarousel.dispose();
    }
    if (
      this.frustrationResponseManager &&
      !this._borrowedResources.has(this.frustrationResponseManager)
    ) {
      this.frustrationResponseManager.dispose();
    }
    if (this.jitGestureHintManager && !this._borrowedResources.has(this.jitGestureHintManager)) {
      this.jitGestureHintManager.dispose();
    }

    if (this.engine.uiManager === this) this.engine.uiManager = null;
    this._borrowedResources.clear();
  }
}
