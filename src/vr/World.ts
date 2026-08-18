import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Engine } from './Engine.ts';
import { DracoTopologyNode } from '../draco/DracoTopologyNode.ts';
import { DracoDiagnosticHUD } from './ui/DracoDiagnosticHUD.ts';
import { TooltipManager } from './ui/TooltipManager.ts';
import { ChartPlanePanel } from './ui/ChartPlanePanel.ts';
import { FileLoaderUI } from '../ui/FileLoader.ts';
import {
  supplyChainHierarchy,
  allSampleDatasets,
  getDefaultEncodings,
} from '../data/SampleDatasets.ts';
import { resolveTemplate } from '../data/AnalysisTemplates.ts';
import { TopologyTypes } from '../draco/ConstraintEngine.ts';
import { disposeObject } from '../utils/Dispose.ts';
import { LiveStreamCoordinator } from './coordinators/LiveStreamCoordinator.ts';
import {
  applyFilter,
  applySort,
  applyAggregate,
  applyCluster,
  applyHierarchicalCluster,
  applyDensityCluster,
  applyAnomaly,
  applySlice,
  resetTransforms,
  isolateRowIndices,
  resetVisibility,
} from './interactions/DataOperations.ts';
import { ControllerGestureMapper } from './interactions/ControllerGestureMapper.ts';
import { WorldInputCoordinator } from './coordinators/WorldInputCoordinator.ts';
import { UserModeController } from './coordinators/UserModeController.ts';
import { ComfortSettingsController } from './coordinators/ComfortSettingsController.ts';
import { AdaptiveAssistController } from './coordinators/AdaptiveAssistController.ts';
import { AnalysisHistory } from '../data/AnalysisHistory.ts';
import { SessionStore } from '../data/SessionStore.ts';
import { Dataset } from '../data/Dataset.ts';
import { GuidedTour, type TourStep } from './ui/GuidedTour.ts';
import { FIRST_DATASET_TOUR } from '../data/DefaultTour.ts';
import { WorldTheme } from './WorldTheme.ts';
import { TelemetryCollector } from '../utils/Telemetry.ts';
import { InPlaceOperationHandles } from './interactions/InPlaceOperationHandles.ts';
import { LivePreview } from './interactions/LivePreview.ts';
import { CollaborationCoordinator } from './coordinators/CollaborationCoordinator.ts';
import { DataOperationController } from './coordinators/DataOperationController.ts';
import { WorldUIManager } from './coordinators/WorldUIManager.ts';
import { WorldSceneComposer } from './coordinators/WorldSceneComposer.ts';
import { WorldSessionController } from './coordinators/WorldSessionController.ts';
import { GuidedTourController } from './coordinators/GuidedTourController.ts';
import { WorldLandmarkController } from './coordinators/WorldLandmarkController.ts';
import { AnalysisStoryExporter } from './coordinators/AnalysisStoryExporter.ts';
import { buildWheelMenuCategories } from './coordinators/WheelMenuBuilder.ts';
import { WorldEventBus, WorldTopics } from '../utils/EventBus.ts';
import { SceneGraphController } from './coordinators/SceneGraphController.ts';
import { WorkspaceManager } from './coordinators/WorkspaceManager.ts';
import { WorldRendererLifecycle } from './coordinators/WorldRendererLifecycle.ts';
import { InputTelemetry } from './InputTelemetry.ts';
import { PanelManager } from './ui/PanelManager.ts';
import { DashboardManager } from './ui/DashboardManager.ts';
import { HandWheelMenu } from './ui/HandWheelMenu.ts';
import { VRMenu } from './ui/VRMenu.ts';
import { VRConsole } from './ui/VRConsole.ts';
import { SettingsPanel } from './ui/SettingsPanel.ts';
import { OperationLogPanel } from './ui/OperationLogPanel.ts';
import { TelemetryPanel } from './ui/TelemetryPanel.ts';
import { PerformancePanel } from './ui/PerformancePanel.ts';
import { NetworkPanel } from './ui/NetworkPanel.ts';
import { InteractionCoach } from './ui/InteractionCoach.ts';
import { NarrativeStrip } from './ui/NarrativeStrip.ts';
import { MiniOverview } from './ui/MiniOverview.ts';
import { PeerPresenceHUD } from './ui/PeerPresenceHUD.ts';
import { LoadTestPanel } from './ui/LoadTestPanel.ts';
import { LoadTestDriver, type LoadTestProfile, type LoadTestSummary } from './scalability/LoadTestDriver.ts';
import { DatumPlane } from './artifacts/DatumPlane.ts';
import { TechnoCoreNode } from './artifacts/TechnoCoreNode.ts';
import { IceVaultNode } from './artifacts/IceVaultNode.ts';
import { FarcasterPortal } from './artifacts/FarcasterPortal.ts';
import { HolographicInspector } from './artifacts/HolographicInspector.ts';
import type { TopologyType } from '../data/types.ts';
import { DatasetSpace } from '../atlas/DatasetSpace.ts';
import { AtlasCore } from '../atlas/AtlasCore.ts';
import { NemosyneSession } from '../session/NemosyneSession.ts';
import type {
  ArtifactRef,
  DatasetLoadEntry,
  HandLike,
  LiveConnectorLike,
  LiveStreamOptions,
  NetworkManagerLike,
  SettingsMap,
  TelemetryCollectorLike,
  WasmRuntimeBridge,
  WorldEventBusLike,
} from './coordinators/types.ts';

// Map sample-dataset keys to atmospheric presets so each dataset has a distinct mood.
const DATASET_THEME_MAP: Record<string, string> = {
  'supply-chain': 'neonMidnight',
  'fraud-graph': 'warmAnomaly',
  'sensor-stream': 'coolDepth',
  'sales-table': 'daylightGlobe',
  'org-chart': 'neonMidnight',
  'wind-field': 'deepNet',
  'social-graph': 'deepNet',
  'financial-series': 'daylightGlobe',
  'geo-cities': 'coolDepth',
  'flow-process': 'deepNet',
};

const DEFAULT_DATASET_ENTRY: DatasetLoadEntry = {
  key: 'supply-chain',
  label: 'Supply Chain Hierarchy',
  topology: TopologyTypes.HIERARCHY,
  dataset: supplyChainHierarchy,
  maxDepth: 3,
  encodings: { color: 'region', size: 'inventory', pulse: 'riskScore' },
};

/**
 * Composes the Nemosyne scene: datumplane, landmark, Draco data palace,
 * diagnostic HUD, telemetry panel, Farcaster portals, data-card inspection,
 * and dataset switching.
 */
export class World {
  engine: Engine;
  eventBus: WorldEventBusLike;
  atlas: AtlasCore;
  session: NemosyneSession;
  dataOperationController: DataOperationController;
  sceneComposer: WorldSceneComposer;
  analystAnchor: THREE.Group;
  datum: DatumPlane;
  core: TechnoCoreNode;
  iceVault: IceVaultNode;
  inspector: HolographicInspector;
  portalA: FarcasterPortal;
  portalB: FarcasterPortal;
  telemetryCollector: TelemetryCollectorLike;
  uiManager: WorldUIManager;
  /** @deprecated Access via `uiManager.panelManager` */
  panelManager: PanelManager;
  /** @deprecated Access via `uiManager.dashboard` */
  dashboard: DashboardManager;
  /** @deprecated Access via `uiManager.handWheelMenu` */
  handWheelMenu: HandWheelMenu;
  /** @deprecated Access via `uiManager.vrMenu` */
  vrMenu: VRMenu;
  /** @deprecated Access via `uiManager.vrConsole` */
  vrConsole: VRConsole;
  /** @deprecated Access via `uiManager.telemetryPanel` */
  telemetryPanel: InputTelemetry;
  /** @deprecated Access via `uiManager.settingsPanel` */
  settingsPanel: SettingsPanel;
  /** @deprecated Access via `uiManager.operationLogPanel` */
  operationLogPanel: OperationLogPanel;
  /** @deprecated Access via `uiManager.metricsPanel` */
  metricsPanel: TelemetryPanel;
  /** @deprecated Access via `uiManager.performancePanel` */
  performancePanel: PerformancePanel;
  /** @deprecated Access via `uiManager.networkPanel` */
  networkPanel: NetworkPanel;
  /** @deprecated Access via `uiManager.interactionCoach` */
  interactionCoach: InteractionCoach;
  /** @deprecated Access via `uiManager.narrativeStrip` */
  narrativeStrip: NarrativeStrip;
  /** @deprecated Access via `uiManager.miniOverview` */
  miniOverview: MiniOverview;
  /** @deprecated Access via `uiManager.peerPresenceHUD` */
  peerPresenceHUD: PeerPresenceHUD;
  loadTestDriver!: LoadTestDriver;
  /** @deprecated Access via `uiManager.loadTestPanel` */
  loadTestPanel!: LoadTestPanel;
  /** @deprecated Access via `uiManager.recommendationPanel` */
  recommendationPanel!: import('./ui/RecommendationPanel.ts').RecommendationPanel;
  inputCoordinator: WorldInputCoordinator;
  userModeController: UserModeController;
  comfortSettingsController: ComfortSettingsController;
  adaptiveAssist: AdaptiveAssistController;
  tooltipManager: TooltipManager;
  inPlaceHandles: InPlaceOperationHandles;
  livePreview: LivePreview;
  portalsEnabled: boolean;
  _datasetCycleIndex: number;
  _wasmCapabilities: number;
  _wasmRuntime: WasmRuntimeBridge | null;
  _wasmUnavailable: boolean;
  liveStreamCoordinator: LiveStreamCoordinator;
  collaborationCoordinator: CollaborationCoordinator;
  landmarkController!: WorldLandmarkController;
  tourController!: GuidedTourController;
  sessionController!: WorldSessionController;
  loader: FileLoaderUI;
  telemetry: HTMLElement | null;
  _dashboardTooltipTargets: THREE.Mesh[];
  analysisHistory!: AnalysisHistory;
  _originalDataset!: Dataset | null;
  _transformedDataset!: Dataset | null;
  _inputPaused!: boolean;
  _handNearArtefact!: boolean;
  _handNearWheelMenu!: boolean;
  sessionStore: SessionStore;
  _initPromises: Promise<unknown>[];
  _disposed: boolean;
  _statisticalLensEnabled: boolean;
  controllerGestureMapper: ControllerGestureMapper;
  guidedTour: GuidedTour;
  _tourAutoStarted: boolean;
  _lastCameraPosition!: THREE.Vector3 | null;
  _desktopPreviewEnabled!: boolean;
  sceneGraphController: SceneGraphController;
  workspaceManager: WorkspaceManager;
  rendererLifecycle: WorldRendererLifecycle;
  _desktopPreviewSavedPose!: { position: THREE.Vector3; yaw: number; pitch: number } | null;
  _orbitControls!: OrbitControls | null;
  dracoNode!: DracoTopologyNode | null;
  diagnostic!: DracoDiagnosticHUD | null;
  currentEntry!: DatasetLoadEntry | null;
  tdaGroup!: THREE.Group | null;
  tdaRecompute!: (() => void) | null;
  dashboardPanels!: { panel: ChartPlanePanel }[];
  _lastLoadTestSummary: LoadTestSummary | null = null;
  _telemetryConsentBeforeRun: boolean | null = null;

  constructor() {
    this.engine = new Engine();

    // Lightweight event bus for cross-cutting UI/UX concerns. Anything that
    // needs to react to operations, settings changes, or session events can
    // subscribe without hard-wiring into `World`. Reuse the engine's bus so
    // the AdaptiveFrameGovernor's PERFORMANCE_THROTTLE events reach all
    // subscribers on the same bus.
    this.eventBus = this.engine.eventBus;

    this.sceneGraphController = new SceneGraphController({
      renderer: this.engine.renderer,
      scene: this.engine.scene,
      camera: this.engine.camera,
      cameraGroup: this.engine.cameraGroup,
    });
    this.workspaceManager = new WorkspaceManager(this.engine.scene);

    // AtlasCore is the single analytical authority for the operation path
    // (Wave 4). It owns the kernel handle, the provenance ledger, the analysis
    // results chain, and the AnalysisHistory undo/redo cursor. The kernel is
    // bound later in `_initWasmRuntime`.
    this.atlas = new AtlasCore({ kernel: null, eventBus: this.eventBus as WorldEventBus });

    // Data-operation controller owns dataset mutation, analysis history, and
    // the operation → visual-transform mapping. It issues typed AnalysisSpec
    // commands to AtlasCore instead of calling the kernel directly.
    this.dataOperationController = new DataOperationController({
      eventBus: this.eventBus as WorldEventBus,
      getArtifact: () => this.dracoNode?.artifact ?? null,
      atlas: this.atlas,
    });

    // Explicit analyst anchor: all HUD panels, dashboard, and wheel menu are
    // parented here so the workspace clusters around the user rather than the
    // world origin. It sits at the camera rig origin by default so local
    // coordinates remain compatible with existing panel defaults.
    // Scene composer creates persistent landmarks and the analyst anchor that
    // all HUD panels are parented to.
    this.sceneComposer = new WorldSceneComposer(this.engine, {
      onWarp: (zone, pos, operation) => this._warpToZone(zone, pos, operation),
    });
    this.analystAnchor = this.sceneComposer.analystAnchor;
    this.datum = this.sceneComposer.datum;
    this.core = this.sceneComposer.core;
    this.iceVault = this.sceneComposer.iceVault;
    this.inspector = this.sceneComposer.inspector;
    this.portalA = this.sceneComposer.portalA;
    this.portalB = this.sceneComposer.portalB;

    // Opt-in telemetry collector. Local-only until explicitly exported.
    this.telemetryCollector = new TelemetryCollector();
    this.telemetryCollector.loadConsent?.();

    // Load-test driver for the WASM command-buffer decision. Runs a synthetic
    // staircase through the real loadDataset path and captures per-frame frame
    // times + GPU counters. Created before the UI manager so the panel can bind
    // to it. It is an Engine updatable but returns early when IDLE/COMPLETE.
    this.loadTestDriver = new LoadTestDriver(
      {
        loadDataset: (entry) => this.loadDataset(entry),
        getActiveSpecInfo: () => this._getActiveSpecInfo(),
        eventBus: this.eventBus as WorldEventBusLike,
      },
      this.engine
    );
    this.engine.addUpdatable(this.loadTestDriver);
    this.engine.telemetry = this.telemetryCollector;

    // UI manager owns all HUD panels, dashboard, and wheel menu. It is created
    // early so later code can access panel references through the facade.
    this.uiManager = new WorldUIManager(this.engine, this.analystAnchor, this.eventBus, {
      onLoadDataset: (entry) => this.loadDataset(entry as DatasetLoadEntry),
      onTogglePortals: (enabled) => this.setPortalsEnabled(enabled),
      onConnectStream: () => this.connectLiveStream(),
      onDisconnectStream: () => this.disconnectLiveStream(),
      onSelectLiveSource: (sourceKey) => this.connectLiveSource(sourceKey),
      onFilter: () => this.dataOperationController.apply('filter'),
      onSort: () => this.dataOperationController.apply('sort'),
      onAggregate: () => this.dataOperationController.apply('aggregate'),
      onCluster: () => this.dataOperationController.apply('cluster'),
      onHierarchicalCluster: () => this.dataOperationController.apply('hierarchical'),
      onDensityCluster: () => this.dataOperationController.apply('density'),
      onAnomaly: () => this.dataOperationController.apply('anomaly'),
      onTimeSlice: () => this.dataOperationController.apply('timeSlice'),
      onCompare: () => this.dataOperationController.apply('compare'),
      onReset: () => this.resetDataOperation(),
      onPanelChange: () => this._requestAutoSave(),
      onSettingChanged: (key, value) => this._onSettingChanged(key, value),
      onSeekHistory: (index) => this._seekAnalysisHistory(index),
       getNodeMeshes: () => this.dracoNode?.artifact?.nodeMeshes ?? [],
       getDominantHand: () => {
         const index = this.inputCoordinator?.gestureRecognizer?.dominantHandIndex;
         return this.engine.input.hands[index ?? 0] as unknown as HandLike | null;
       },
       getPeers: () => this.networkManager?.room?.getRemoteSnapshot() ?? [],
      getLocalPeerId: () => this.networkManager?.peerId ?? null,
      getSetting: (key) => this.uiManager?.settingsPanel?.getSetting?.(key),
      telemetryCollector: this.telemetryCollector,
      analysisHistory: this.dataOperationController.analysisHistory,
      loadTestDriver: this.loadTestDriver,
       onStartLoadTest: (profile) => this.runLoadTest(profile),
       onStopLoadTest: () => this.stopLoadTest(),
       onFlushLoadTest: () => this.flushLastLoadTestSummary(),
       getRecommendation: () => this.atlas.activeRecommendation ?? null,
       onAcceptRecommendation: () => this._acceptRecommendation(),
       onRejectRecommendation: () => this._rejectRecommendation(),
       onOverrideRecommendation: () => this._overrideRecommendation(),
       onGenerateRecommendation: () => this._generateRecommendation(),
       onExitVR: () => this.exitVR(),
     });

    // Legacy facade properties: tests and internal code access panels through
    // `world.*` directly.
    this.panelManager = this.uiManager.panelManager as PanelManager;
    this.dashboard = this.uiManager.dashboard;
    this.handWheelMenu = this.uiManager.handWheelMenu as HandWheelMenu;
    this.vrMenu = this.uiManager.vrMenu;
    this.vrConsole = this.uiManager.vrConsole;
    this.telemetryPanel = this.uiManager.telemetryPanel;
    this.settingsPanel = this.uiManager.settingsPanel as SettingsPanel;
    this.operationLogPanel = this.uiManager.operationLogPanel as OperationLogPanel;
    this.metricsPanel = this.uiManager.metricsPanel;
    this.performancePanel = this.uiManager.performancePanel;
    this.networkPanel = this.uiManager.networkPanel;
    this.interactionCoach = this.uiManager.interactionCoach as InteractionCoach;
    this.narrativeStrip = this.uiManager.narrativeStrip as NarrativeStrip;
    this.miniOverview = this.uiManager.miniOverview;
    this.peerPresenceHUD = this.uiManager.peerPresenceHUD;
    this.loadTestPanel = this.uiManager.loadTestPanel;
    this.recommendationPanel = this.uiManager.recommendationPanel;

    // Input coordinator owns gesture recognition, context-aware suppression, and
    // the mapping from gestures/commands to world actions.
    this.inputCoordinator = new WorldInputCoordinator(this.engine, this.eventBus, {
      getSetting: (key) => this.settingsPanel?.getSetting?.(key),
      getDracoGroup: () => this.dracoNode?.group ?? null,
      getArtifact: () => this.dracoNode?.artifact ?? null,
      getHandWheelMenu: () => this.handWheelMenu,
      callbacks: {
        onApplyOperation: (op) => this.dataOperationController.apply(op),
        onCycleDataset: (delta) => this._cycleDataset(delta),
        onResetData: () => this.resetDataOperation(),
        onUndo: () => this.undoAnalysis(),
        onRedo: () => this.redoAnalysis(),
        onToggleStatisticalLens: () => this._toggleStatisticalLens(),
        onToggleSettingsPanel: () => this._toggleSettingsPanel(),
        onTogglePanels: () => this._togglePanels(),
        onToggleMiniOverview: () => this._toggleMiniOverview(),
        onTogglePeerPresence: () => this._togglePeerPresenceHUD(),
        onToggleDesktopPreview: () => this._toggleDesktopPreview(),
        onLoadTemplate: (id) => this.loadTemplate(id),
        onLog: (msg) => this.vrConsole?.log?.('log', Array.isArray(msg) ? msg : [msg]),
        onCaptureSession: () => this._requestAutoSave(),
      },
    });

    // User-mode controller applies novice/intermediate/expert policies to the
    // coach, tour, and tooltips.
    this.userModeController = new UserModeController(this.eventBus as WorldEventBus, {
      getUserMode: () => this.settingsPanel?.getSetting?.('userMode') ?? 'novice',
      getTourState: () => ({
        isActive: this.guidedTour?.isActive ?? false,
        isFinished: this.guidedTour?.isFinished ?? false,
      }),
      startTour: () => this.startTour(),
      skipTour: () => this.guidedTour?.skip?.(),
      setCoachMode: (mode) => this.interactionCoach?.setUserMode?.(mode),
      setTourMode: (mode) => this.guidedTour?.setUserMode?.(mode),
      setTooltipEnabled: (enabled) => this.tooltipManager?.setEnabled?.(enabled),
      hideCoachPanel: () => this.panelManager?.hidePanel?.(this.interactionCoach),
    });

    // Comfort settings controller applies snap turn, vignette, seated height,
    // and panel distance to the engine/locomotion and analyst anchor.
    this.comfortSettingsController = new ComfortSettingsController(this.engine, this.analystAnchor, this.sceneComposer);

    this.adaptiveAssist = new AdaptiveAssistController({
      engine: this.engine,
      eventBus: this.eventBus,
      analystAnchor: this.analystAnchor,
      scene: this.engine.scene,
      analyzer: this.telemetryCollector.frustrationAnalyzer,
      isAssistEnabled: () => this.telemetryCollector.enabled,
    });

    this.tooltipManager = new TooltipManager(this.engine.camera);
    this.tooltipManager.mount(this.engine.scene);
    this.tooltipManager.setPointerRaycaster(this.engine.input.raycaster);
    this.engine.addUpdatable(this.tooltipManager);

    this.rendererLifecycle = new WorldRendererLifecycle({
      engine: this.engine,
      dashboard: this.dashboard,
      tooltipManager: this.tooltipManager,
      getOriginalDataset: () => this._originalDataset,
      getDracoNode: () => this.dracoNode,
      getAtlas: () => this.atlas,
    });

    // In-place operation handles near data artefacts for direct manipulation.
    this.inPlaceHandles = new InPlaceOperationHandles(this.engine.scene, this.engine.camera, {
      userMode: (this.settingsPanel?.getSetting?.('userMode') as 'novice' | 'expert') ?? 'novice',
      onOperation: (op) => this.dataOperationController.apply(op),
      onOperationHover: (op) => this.dataOperationController.preview(op),
      onOperationLeave: () => this.dataOperationController.clearPreview(),
      onStructureCommand: (structureId, action) => this._executeStructureCommand(structureId, action),
    });
    this.engine.addUpdatable({
      update: (delta: number, time: number) =>
        this.inPlaceHandles.update(delta, time, this.engine.input.raycaster.ray),
    });

    // Live preview of data operations before they are committed.
    this.livePreview = new LivePreview(this.engine.scene, this.engine.camera);
    this.engine.addUpdatable({
      update: () => this.livePreview.update(),
    });

    // Register functional landmarks as interactables: core cycles the lens hub,
    // portals are triggered by walking through them.
    this.landmarkController = new WorldLandmarkController(this);
    this.landmarkController.registerLandmarkInteractions();

    // Per-frame hook: portal trigger checks and core activity sync.
    this.engine.addUpdatable({
      update: (delta: number, time: number) => this._updateWorld(delta, time),
    });

    // Register visual elements for gaze/pointer tooltips.
    this.landmarkController.registerTooltipTargets();

    this.portalsEnabled = true;
    this._datasetCycleIndex = -1;
    this._wasmCapabilities = 0;
    this._wasmRuntime = null;
    this._wasmUnavailable = false;

    // Live-streaming and collaboration state.
    this.liveStreamCoordinator = new LiveStreamCoordinator({ world: this });
    this.collaborationCoordinator = new CollaborationCoordinator({ world: this });

    this._buildWheelMenu();

    // DOM telemetry overlay (legacy 2D status line).
    this.telemetry = document.getElementById('telemetry');
    this.engine.addUpdatable({
      update: () => this._updateTelemetry(),
    });

    // Loader UI.
    this.loader = new FileLoaderUI({
      onLoad: (entry: unknown) => this.loadDataset(this._maybeLoadSampleFromWasm(entry as DatasetLoadEntry)),
      atlas: this.atlas,
    });

    // Teleport anchors around the palace.
    this._setupTeleportAnchors();

    // System gesture (controller grip or two-hand pinch) toggles launcher ring.
    this.engine.input.onSystemToggle = () => this._togglePanels();

    // Tell the tooltip manager about any dashboard panels created later.
    this._dashboardTooltipTargets = [];

    // Analysis history is owned by AtlasCore; expose it as a live getter so
    // legacy consumers (narrative strip, session restore, tests) stay in sync.
    Object.defineProperty(this, 'analysisHistory', {
      get: () => this.atlas.analysisHistory,
      configurable: true,
    });

    // Facade getters for the dataset state owned by AtlasCore. Tests and
    // session code still access `world._originalDataset` and
    // `world._transformedDataset` directly.
    Object.defineProperty(this, '_originalDataset', {
      get: () => this.atlas.originalDataset,
      set: (value) => {
        this.atlas.setOriginalDataset(value);
      },
      configurable: true,
    });
    Object.defineProperty(this, '_transformedDataset', {
      get: () => this.atlas.dataset,
      set: (value) => {
        this.atlas.setCurrentDataset(value);
      },
      configurable: true,
    });

    // Facade getters for input state owned by the input coordinator. Tests read
    // these directly and sometimes set `_inputPaused` to simulate pause.
    Object.defineProperty(this, '_inputPaused', {
      get: () => this.inputCoordinator.inputPaused,
      set: (value) => {
        this.inputCoordinator._inputPaused = !!value;
      },
    });
    Object.defineProperty(this, '_handNearArtefact', {
      get: () => this.inputCoordinator.handNearArtefact,
    });
    Object.defineProperty(this, '_handNearWheelMenu', {
      get: () => this.inputCoordinator.handNearWheelMenu,
    });

    // Persistent session store (IndexedDB). Auto-saves the world state so the
    // user can resume after a page reload.
    this.sessionStore = new SessionStore();

    // Track async initialization work so tests can wait for it during teardown.
    this._initPromises = [];
    this._disposed = false;

    // Wire desktop/VR keyboard undo/redo to the analysis history.
    this.engine.onUndo = () => this.undoAnalysis();
    this.engine.onRedo = () => this.redoAnalysis();
    this.engine.onPauseInput = () => this.inputCoordinator.togglePauseInput();
    this.engine.onResetView = () => this.inputCoordinator.resetView();
    this.engine.onToggleLoadTestPanel = () => this._toggleLoadTestPanel();
    this.engine.onStartLoadTest = () => this.runLoadTest();

    // Gesture recognition and context routing is owned by the input coordinator.

    // Statistical-lens visibility state. Off by default (progressive disclosure):
    // TDA + correlation windows are hidden until the analyst explicitly requests the
    // lens via the wheel-menu Views → Lens item, the scoop-up gesture, the TechnoCore
    // landmark cycle, or the Settings panel toggle.
    this._statisticalLensEnabled = false;

    // Subscribe to data-operation events so World can keep rendering, logging,
    // auto-save, and telemetry in sync without the controller knowing about them.
    this._subscribeDataOperationEvents();

    // Controller gesture mapper: emits the same gesture names as hand tracking.
    this.controllerGestureMapper = new ControllerGestureMapper({
      onGesture: (name, ctx) => this.inputCoordinator.onGesture(name, ctx),
    });
    this.engine.input.setControllerGestureMapper(this.controllerGestureMapper);

    // Apply initial settings to feedback.
    this._applyFeedbackSettings(this.settingsPanel.getAllSettings());
    // The settings panel is toggled on demand; do not show it at startup.
    this.panelManager.hidePanel(this.settingsPanel);

    // Guided tour: step-by-step spatial onboarding.
    this.tourController = new GuidedTourController(this);
    this.guidedTour = new GuidedTour(this.engine, {
      analystAnchor: this.analystAnchor,
      feedback: this.engine.input.feedback,
      tour: FIRST_DATASET_TOUR,
      resolveTarget: (target: string) => this.tourController.resolveTarget(target),
      checkCondition: (step: TourStep) => this.tourController.checkCondition(step),
      onComplete: () => this.vrConsole?.log?.('log', ['Tour complete']),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    this.engine.addUpdatable(this.guidedTour);
    this.engine.addHudObject(this.guidedTour);

    // Authoritative logical session (Wave 4): wraps AtlasCore + presentation
    // state and owns the schemaVersion-2 snapshot. Constructed before the
    // session controller so it can read `this.session`.
    this.session = new NemosyneSession({ atlas: this.atlas });

    // Session save/load/autosave coordinator (reads facade members lazily).
    this.sessionController = new WorldSessionController(this);

    // Track whether the guided tour has been auto-started for novice users.
    this._tourAutoStarted = false;

    // Load default sample, then restore an autosave if one exists.
    this.loadDataset(DEFAULT_DATASET_ENTRY);
    this._initPromises.push(this._restoreAutoSave());

    // Apply the initial user mode (novice by default) to the coach, tooltips,
    // and tour visibility.
    this.userModeController.apply();

    // Apply initial comfort and panel-distance settings from the saved/default
    // settings panel values.
    this.comfortSettingsController.apply(this.settingsPanel.getAllSettings());
    this.comfortSettingsController.applyPanelDistance(
      this.settingsPanel.getAllSettings().defaultPanelDistance
    );

    // Restore cross-platform shared settings asynchronously after the baseline
    // defaults have been applied.
    this._initPromises.push(this._loadSharedSettings());
  }

  startTour(): boolean {
    return this.tourController.startTour();
  }

  _onCoreSelect(): void {
    this.landmarkController.onCoreSelect();
  }

  /**
   * Capture the current world state as a JSON snapshot and save it.
   */
  async saveSession(id: string = 'autosave'): Promise<void> {
    return this.sessionController.saveSession(id);
  }

  /**
   * Restore a saved session. Rebuilds the dataset, palace, camera pose, history,
   * settings, and tour progress from the snapshot.
   */
  async loadSession(id: string = 'autosave'): Promise<boolean> {
    return this.sessionController.loadSession(id);
  }

  async deleteSession(id: string): Promise<void> {
    return this.sessionController.deleteSession(id);
  }

  /**
   * Queue an automatic save after a short debounce. Called from actions that
   * mutate the world state.
   */
  _requestAutoSave(): void {
    this.sessionController.requestAutoSave();
  }

  async _restoreAutoSave(): Promise<unknown> {
    return this.sessionController.restoreAutoSave();
  }

  _captureSession(): void {
    this.eventBus.emit(WorldTopics.SESSION_CAPTURE);
  }

  /**
   * Capture the current renderer output as a PNG/JPEG screenshot and trigger a
   * browser download.
   */
  exportScreenshot(format: string = 'png'): void {
    AnalysisStoryExporter.exportScreenshot(this.engine, this.vrConsole, this._logInteraction, format);
  }

  /**
   * Build a JSON "analysis story" describing the current dataset, applied
   * operations, camera position, and theme.
   */
  _buildAnalysisStory(): Record<string, unknown> {
    return AnalysisStoryExporter.buildAnalysisStory(this);
  }

  /**
   * Export the analysis story as a downloadable JSON file.
   */
  exportAnalysisStory(): Record<string, unknown> {
    return AnalysisStoryExporter.exportAnalysisStory(this);
  }

  /**
   * Download a previously-built analysis story, or build one if none provided.
   */
  downloadAnalysisStory(story: Record<string, unknown> | null = null): void {
    AnalysisStoryExporter.downloadAnalysisStory(this, story);
  }

  _updateWorld(_delta: number, _time: number): void {
    // Sync core pulse to the amount of analysis history in the session.
    if (this.core?.setDataActivity) {
      const activity = this.analysisHistory
        ? this.analysisHistory.length / Math.max(1, this.analysisHistory.maxFrames)
        : 0;
      this.core.setDataActivity(activity);
    }

    // Trigger warps by walking through portals.
    const headPos = this.engine.headWorldPos;
    if (this.portalsEnabled) {
      this.portalA?.checkTrigger?.(headPos);
      this.portalB?.checkTrigger?.(headPos);
    }

    // Brighten a portal when the user is close to it.
    const previewDistance = 2.5;
    [this.portalA, this.portalB].forEach((portal) => {
      if (!portal?.group) return;
      portal.group.getWorldPosition(portal.worldPos);
      const near = portal.worldPos.distanceTo(headPos) < previewDistance;
      portal.preview(near);
    });

    // Auto-save when the camera has moved.
    this._trackCameraForAutoSave();

    // Broadcast analyst camera pose to collaboration peers.
    this._broadcastPresence();
  }

  _broadcastPresence(): void {
    const nm = this.collaborationCoordinator.networkManager;
    if (!nm?.isConnected) return;
    const pos = this.engine.cameraGroup.position;
    nm.setLocalState({
      position: { x: pos.x, y: pos.y, z: pos.z },
      rotationY: this.engine.cameraGroup.rotation.y,
      dataset: this.currentEntry?.name ?? this.currentEntry?.label ?? '-',
    });
  }

  _logInteraction(
    action: string,
    { gesture, controller, result }: { gesture?: string; controller?: string; result?: string } = {}
  ): void {
    this.eventBus.emit(WorldTopics.INTERACTION_LOG, { action, gesture, controller, result });
  }

  _trackCameraForAutoSave(): void {
    if (!this._lastCameraPosition) {
      this._lastCameraPosition = this.engine.cameraGroup.position.clone();
      return;
    }
    if (this.engine.cameraGroup.position.distanceToSquared(this._lastCameraPosition) > 0.01) {
      this._lastCameraPosition.copy(this.engine.cameraGroup.position);
      this._captureSession();
    }
  }

  _setupTeleportAnchors(): void {
    this.engine.locomotion.addAnchor('overview', [0, 0, -6], 0, 'Overview');
    this.engine.locomotion.addAnchor('detail', [0, 0, -3], 0, 'Detail');
    this.engine.locomotion.addAnchor('north', [-4, 0, -6], Math.PI / 4, 'North');
    this.engine.locomotion.addAnchor('south', [4, 0, -6], -Math.PI / 4, 'South');
  }

  /**
   * Load a ready-made analysis template: dataset, theme, and tour in one step.
   * @param {string} templateId
   */
  loadTemplate(templateId: string): boolean {
    const resolved = resolveTemplate(templateId, allSampleDatasets);
    if (!resolved) {
      this.vrConsole?.log?.('warn', [`Unknown analysis template: ${templateId}`]);
      return false;
    }
    const { entry, theme, tourId } = resolved;
    const fullEntry: DatasetLoadEntry = {
      key: entry.key,
      name: entry.label,
      topology:
        TopologyTypes[entry.topology as keyof typeof TopologyTypes] ?? entry.topology,
      dataset: entry.dataset,
      maxDepth: entry.depth ?? 1,
      encodings: getDefaultEncodings({
        dataset: entry.dataset,
        topology: entry.topology,
      }),
    };

    this.loadDataset(fullEntry);

    // Apply the template's atmosphere after loadDataset so the story has a
    // predictable mood regardless of the default dataset mapping.
    if (theme && WorldTheme.PRESETS[theme]) {
      this.engine.theme.applyPreset(theme);
    }

    if (tourId === 'first-dataset' && this.guidedTour && !this.guidedTour.isActive) {
      this.startTour();
    }

    this.vrConsole?.log?.('log', [`Template loaded: ${templateId}`]);
    this._logInteraction('Analysis template', { result: templateId });
    this._captureSession();
    return true;
  }

  /**
   * Switch the active data palace. `entry` should contain:
   * { name, topology, dataset, maxDepth?, encodings? }
   *
   * The heavy scene-graph work is deferred by one task (setTimeout 0) so that
   * the XR render frame that triggered the load is not blocked, preventing the
   * "PerformanceBudget critical" frame-spike warning.
   */
  loadDataset(entry: DatasetLoadEntry): void {
    console.warn('[World] loading dataset:', entry.name ?? entry.label, entry.topology);
    this._doLoadDataset(entry);
  }

  /** Internal implementation called after the current frame yields. */
  _doLoadDataset(entry: DatasetLoadEntry): void {

    // Switch atmosphere to match dataset mood, if a preset is mapped.
    const presetName = entry.key && DATASET_THEME_MAP[entry.key];
    const preset = presetName ? WorldTheme.PRESETS[presetName] : null;
    if (presetName) {
      this.engine.theme.applyPreset(presetName);
    }

    // Recolor portals to match the active atmosphere preset.
    if (preset) {
      this.portalA?.setColor?.(preset.pointColor);
      this.portalB?.setColor?.(preset.pointColor);
    }

    // Pulse portals when the dataset is dynamic or anomaly-rich.
    const activity = entry.topology === 'TIME_SERIES' || entry.topology === 'ANOMALY' ? 0.75 : 0.35;
    this.portalA?.setDataActivity?.(activity);
    this.portalB?.setDataActivity?.(activity);

    // Tear down previous Draco node, diagnostic HUD, and in-place handles.
    if (this.dracoNode) {
      this.engine.removeUpdatable(this.dracoNode);
      this.inPlaceHandles.unregisterInteractables(this.engine.input);
      this.inPlaceHandles.clear();
      if (this.dracoNode.artifact) {
        for (const mesh of this.dracoNode.artifact.nodeMeshes) {
          this.engine.removeInteractable(mesh);
        }
      }
      disposeObject(this.dracoNode.group!);
      this.dracoNode = null;
    }

    if (this.diagnostic) {
      this.engine.input.panels = this.engine.input.panels.filter((p) => p !== this.diagnostic);
      disposeObject(this.diagnostic.mesh);
      this.diagnostic = null;
    }

    // Preserve original state so data operations can be reset. Setting
    // `_originalDataset` routes through AtlasCore.loadDataset (resets ledger,
    // results, and history, bumps version, appends a 'load' ResearchEvent);
    // setting `_transformedDataset` points the current dataset at the original.
    // Wave 5: this must happen BEFORE the Draco palace build so
    // `atlas.inferEncodings` and `atlas.asFactProvider` see the new dataset's
    // kernel handle (statistics + encodings come from the kernel, not JS).
    this._originalDataset = entry.dataset?.clone?.() ?? null;
    this._transformedDataset = this._originalDataset?.clone?.() ?? null;

    // Build new Draco palace.
    const topology = entry.topology as TopologyType;
    // Wave 5: encodings come from the kernel (via AtlasCore) when available,
    // then the entry's explicit encodings, then the static default mapping.
    const kernelEncodings = this.atlas.inferEncodings(topology) ?? undefined;
    const dataInput = {
      topology,
      dataset: entry.dataset,
      maxDepth: entry.maxDepth,
      encodings:
        entry.encodings ??
        kernelEncodings ??
        getDefaultEncodings({ dataset: entry.dataset, topology }),
    };

    this.dracoNode = new DracoTopologyNode(
      this.engine.scene,
      dataInput,
      [0, 1.4, -3.5],
      {
        colorblindMode: this.settingsPanel?.getSetting?.('colorblindMode') ?? 'none',
      },
      this.atlas.asFactProvider(),
    );
    this.engine.addUpdatable(this.dracoNode);
    this._wireArtifactInteraction(this.dracoNode);

    // Rebuild diagnostic HUD bound to the new node.
    this.diagnostic = new DracoDiagnosticHUD(
      this.engine.cameraGroup,
      this.dracoNode,
      [-0.8, 1.5, -1.2]
    );
    this.engine.input.addPanel(this.diagnostic);
    this.analystAnchor.add(this.diagnostic.mesh);

    this.currentEntry = entry;
    this.telemetryCollector?.recordDataset?.(entry.name ?? entry.label ?? 'dataset', entry.topology);

    // Attach optional TDA summary group for numeric datasets.
    this._attachTDASummary();

    // Rebuild dashboard chart panels for the new dataset.
    this._buildDashboard();

    // Sync statistical-lens visibility with the current setting.
    this._setStatisticalLensVisible(this._statisticalLensEnabled);
  }

  /**
   * Wave 5: once the analytical kernel is ready, rebuild the current palace so
   * Draco consumes kernel-derived facts (`kernel.statistics` via AtlasCore)
   * instead of the minimal schema-metadata facts used before `start()` loaded
   * the wasm runtime. No-op when no dataset is loaded.
   */
  _rebuildPalaceWithKernelFacts(): void {
    if (!this.currentEntry || this._disposed) return;
    this.loadDataset(this.currentEntry);
  }

  _attachTDASummary(): void {
    this.rendererLifecycle.attachTDASummary();
    this.tdaGroup = this.rendererLifecycle.tdaGroup;
    this.tdaRecompute = this.rendererLifecycle.tdaRecompute;
  }

  _buildDashboard(): void {
    this.rendererLifecycle.rebuildDashboard();
    this.dashboardPanels = this.rendererLifecycle.dashboardPanels;
    this._dashboardTooltipTargets = this.rendererLifecycle.dashboardTooltipTargets;
  }

  _updateDashboardDatasets(dataset: Dataset | null | undefined): void {
    this.rendererLifecycle.updateDashboardDatasets(dataset);
  }

  _wireArtifactInteraction(dracoNode: DracoTopologyNode): void {
    const wire = () => {
      if (!dracoNode.artifact) return;
      this.tooltipManager.setTargets(dracoNode.artifact.nodeMeshes);
      for (const mesh of dracoNode.artifact.nodeMeshes) {
        this.engine.addInteractable(mesh, {
          onEnter: (m: THREE.Object3D) => dracoNode.artifact!.interactions.onHover(m as THREE.Mesh),
          onLeave: (m: THREE.Object3D) => dracoNode.artifact!.interactions.onUnhover(m as THREE.Mesh),
          onSelect: (m: THREE.Object3D) => {
            dracoNode.artifact!.interactions.onSelect(m as THREE.Mesh);
            this._showDataCard(m as THREE.Mesh);
          },
        });
      }
    };

    const original = dracoNode.reSolveAndSynthesize.bind(dracoNode);
    dracoNode.reSolveAndSynthesize = () => {
      if (dracoNode.artifact) {
        this.inPlaceHandles.unregisterInteractables(this.engine.input);
        this.inPlaceHandles.clear();
        for (const mesh of dracoNode.artifact.nodeMeshes) {
          this.engine.removeInteractable(mesh);
        }
      }
      original();
      wire();
      this._rebuildStructureHandles(dracoNode);
      if (this.diagnostic) this.diagnostic.render();
    };

    wire();
    this._rebuildStructureHandles(dracoNode);
  }

  private _rebuildStructureHandles(dracoNode: { artifact?: { nodeMeshes?: THREE.Mesh[] } | undefined; dataInput?: { topology?: string } | undefined }): void {
    if (this.atlas.structures.length > 0) {
      this.inPlaceHandles.buildFromStructures(dracoNode as never, this.atlas.structures as never);
    } else {
      this.inPlaceHandles.build(dracoNode as never);
    }
    this.inPlaceHandles.registerInteractables(this.engine.input as never);
  }

  _showDataCard(mesh: THREE.Mesh): void {
    const pointer = this.engine.input.getActivePointer();
    this.inspector.showAtNode(mesh, mesh.userData.row, pointer, 'DATA NODE');
  }

  _warpToZone(zone: string, pos: number[], operation: string | null): void {
    // First apply the data transformation that the gate represents.
    this.landmarkController.applyPortalOperation(operation);

    this.engine.cameraGroup.position.set(pos[0], pos[1], pos[2]);
    const zonePreset = zone === 'DEEP_NET' ? 'deepNet' : 'neonMidnight';
    this.engine.theme.applyPreset(zonePreset);
    const preset = WorldTheme.PRESETS[zonePreset];
    this.portalA?.setColor?.(preset.pointColor);
    this.portalB?.setColor?.(preset.pointColor);

    this.engine.input.feedback?.playPortalTone?.(zone, operation);
    this.engine.input.feedback?.playHaptic?.(0.7, 120);
    this.vrConsole?.log?.('log', [`Farcaster warp: ${zone}${operation ? ` + ${operation}` : ''}`]);
    this._logInteraction('Portal warp', { result: `${zone}${operation ? ` + ${operation}` : ''}` });
    this._captureSession();
  }

  _togglePanels(): void {
    this.panelManager.toggleLauncher();
    this.adaptiveAssist.recordPanelToggle('launcher', this.panelManager.isLauncherVisible());
    this._logInteraction('Launcher', {
      result: this.panelManager.isLauncherVisible() ? 'opened' : 'closed',
    });
  }

  /** Legacy facade for tests and direct callers. Delegates to the input coordinator. */
  _onGesture(name: string, ctx: Record<string, unknown> = {}): void {
    this.inputCoordinator.onGesture(name, ctx);
  }

  _togglePauseInput(): void {
    this.inputCoordinator.togglePauseInput();
  }

  /**
   * Legacy facade for tests and direct callers. Delegates to the input
   * coordinator's reset view action.
   */
  _resetView(): void {
    this.inputCoordinator.resetView();
  }

  /** Legacy facade for tests that want to force a context recompute. */
  _updateInputContext(): void {
    this.inputCoordinator._updateInputContext();
  }

  _cycleDataset(delta: number = 1): void {
    const n = allSampleDatasets.length;
    this._datasetCycleIndex = (this._datasetCycleIndex + delta + n) % n;
    const entry = allSampleDatasets[this._datasetCycleIndex];
    const wasmEntry = this._maybeLoadSampleFromWasm({
      key: entry.key,
      label: entry.label,
      topology: entry.topology,
      dataset: entry.dataset,
      maxDepth: entry.depth,
    } as DatasetLoadEntry);
    const topology =
      TopologyTypes[entry.topology as keyof typeof TopologyTypes] ?? entry.topology;
    this.loadDataset({
      key: wasmEntry.key,
      name: wasmEntry.label ?? wasmEntry.name,
      topology: topology as TopologyType,
      dataset: wasmEntry.dataset,
      maxDepth: wasmEntry.maxDepth ?? entry.depth ?? 1,
      encodings: getDefaultEncodings({
        dataset: wasmEntry.dataset,
        topology: topology as TopologyType,
      }),
    });
    this.vrConsole?.log?.('log', [`Dataset: ${wasmEntry.label ?? wasmEntry.name}`]);
    this._logInteraction('Dataset', { result: wasmEntry.label ?? wasmEntry.name });
  }

  _cycleThemePreset(): void {
    const name = this.engine.theme.cyclePreset();
    this.vrConsole?.log?.('log', [`Theme: ${name}`]);
    this._logInteraction('Theme', { result: name });
    this._captureSession();
  }

  _toggleStatisticalLens(): void {
    this._statisticalLensEnabled = !this._statisticalLensEnabled;
    this._setStatisticalLensVisible(this._statisticalLensEnabled);
    this.adaptiveAssist.recordPanelToggle('statistical-lens', this._statisticalLensEnabled);
    this.vrConsole?.log?.('log', [
      `Statistical lens ${this._statisticalLensEnabled ? 'on' : 'off'}`,
    ]);
    this._logInteraction('Statistical lens', {
      result: this._statisticalLensEnabled ? 'on' : 'off',
    });
    this._captureSession();
  }

  _toggleMiniOverview(): void {
    const next = !this.miniOverview.mesh.visible;
    this.miniOverview.setEnabled(next);
    this.settingsPanel?.setSetting?.('miniOverview', next);
    this.vrConsole?.log?.('log', [`Mini overview ${next ? 'on' : 'off'}`]);
    this._logInteraction('Mini overview', { result: next ? 'on' : 'off' });
    this._captureSession();
  }

  _toggleLoadTestPanel(): void {
    this.uiManager?.panelManager?.togglePanel?.(this.loadTestPanel);
  }

  _toggleRecommendationPanel(): void {
    this.uiManager?.panelManager?.togglePanel?.(this.recommendationPanel);
  }

  _generateRecommendation(): void {
    this.atlas.generateRecommendation();
    this.recommendationPanel?.markDirty?.();
  }

  _acceptRecommendation(): void {
    this.atlas.acceptRecommendation();
    this._applyEmbodimentHint();
    this._executeVRCommand();
    this.recommendationPanel?.markDirty?.();
  }

  _rejectRecommendation(): void {
    this.atlas.rejectRecommendation();
    this.recommendationPanel?.markDirty?.();
  }

  _overrideRecommendation(): void {
    this.atlas.overrideRecommendation();
    this.recommendationPanel?.markDirty?.();
  }

  private _applyEmbodimentHint(): void {
    const rec = this.atlas.activeRecommendation;
    if (!rec?.suggestedEmbodiment || !this.dracoNode) return;
    import('./../draco/EmbodimentHints.ts').then(({ applyEmbodimentHint }) => {
      if (this.dracoNode) {
        applyEmbodimentHint(this.dracoNode, rec.suggestedEmbodiment!);
      }
    });
  }

  private _executeVRCommand(): void {
    const rec = this.atlas.activeRecommendation;
    if (!rec || rec.decision !== 'accepted') return;
    import('./coordinators/VRCommandExecutor.ts').then(({ VRCommandExecutor }) => {
      const executor = new VRCommandExecutor({
        atlas: this.atlas,
        onIsolate: (rowIndices) => this._isolateStructures(rowIndices),
        onNavigate: (rowIndices) => this._navigateToStructures(rowIndices),
        onReset: () => this._resetEmbodiment(),
      });
      executor.executeFromRecommendation();
    });
  }

  private _isolateStructures(rowIndices: number[]): void {
    if (!this.dracoNode?.artifact) return;
    isolateRowIndices(this.dracoNode.artifact, rowIndices);
  }

  private _navigateToStructures(rowIndices: number[]): void {
    if (!this.dracoNode?.artifact?.nodeMeshes || rowIndices.length === 0) return;
    let cx = 0, cy = 0, cz = 0, count = 0;
    for (let i = 0; i < this.dracoNode.artifact.nodeMeshes.length; i++) {
      if (rowIndices.includes(i)) {
        const mesh = this.dracoNode.artifact.nodeMeshes[i];
        cx += mesh.position.x;
        cy += mesh.position.y;
        cz += mesh.position.z;
        count++;
      }
    }
    if (count > 0) {
      this.engine.cameraGroup.position.set(cx / count, cy / count + 0.5, cz / count + 1.5);
    }
  }

  private _resetEmbodiment(): void {
    if (!this.dracoNode?.artifact) return;
    resetVisibility(this.dracoNode.artifact);
  }

  private _executeStructureCommand(structureId: string, action: string): void {
    import('./coordinators/VRCommandExecutor.ts').then(({ VRCommandExecutor }) => {
      const executor = new VRCommandExecutor({
        atlas: this.atlas,
        onIsolate: (rowIndices) => this._isolateStructures(rowIndices),
        onNavigate: (rowIndices) => this._navigateToStructures(rowIndices),
        onReset: () => this._resetEmbodiment(),
      });
      executor.execute({
        action: action as never,
        targetIds: [structureId],
        embodiment: 'structure-handle',
      });
    });
  }

  private _discoverStructuresAndRecommend(operation: string): void {
    if (!this.atlas.isReady()) return;
    const dataset = this._transformedDataset ?? this.atlas.dataset;
    if (!dataset || dataset.rowCount === 0) return;

    if (operation === 'cluster' || operation === 'hierarchical' || operation === 'density') {
      const opMap: Record<string, string> = {
        cluster: 'k_means',
        hierarchical: 'hierarchical',
        density: 'dbscan',
      };
      const opName = opMap[operation] ?? 'k_means';
      this.atlas.discoverClusterStructures(dataset, { op: opName, k: 3 } as never);
    } else if (this.tdaRecompute) {
      const filterValues = dataset.rows.map((r) => Number(r[dataset.columns[0]?.name] ?? 0));
      this.atlas.discoverMapperStructures(dataset, { featureColumns: [dataset.columns[0]?.name].filter(Boolean), filterValues, bins: 10, overlap: 0.5 });
      this.atlas.discoverPersistenceStructures(dataset, { featureColumns: [dataset.columns[0]?.name].filter(Boolean), filterValues, maxDistance: 2 });
    }

    this.atlas.generateRecommendation();
    this.recommendationPanel?.markDirty?.();
    if (this.dracoNode && this.atlas.structures.length > 0) {
      this.inPlaceHandles.buildFromStructures(this.dracoNode, this.atlas.structures as never);
      this.inPlaceHandles.registerInteractables(this.engine.input as never);
    }
  }

  _togglePeerPresenceHUD(): void {
    const next = !this.peerPresenceHUD.mesh.visible;
    this.peerPresenceHUD.setEnabled(next);
    this.settingsPanel?.setSetting?.('peerPresence', next);
    this.vrConsole?.log?.('log', [`Peer presence ${next ? 'on' : 'off'}`]);
    this._logInteraction('Peer presence', { result: next ? 'on' : 'off' });
    this._captureSession();
  }

  /**
   * Toggle a desktop "preview" orbit camera for preparing on a monitor before
   * entering VR. Saves the current first-person pose so it can be restored.
   */
  _toggleDesktopPreview(): void {
    const isVR = !!this.engine.renderer.xr.getSession();
    if (isVR) {
      this.vrConsole?.log?.('log', ['Desktop preview is only available outside VR']);
      return;
    }

    this._desktopPreviewEnabled = !this._desktopPreviewEnabled;
    if (this._desktopPreviewEnabled) {
      // Store first-person pose.
      this._desktopPreviewSavedPose = {
        position: this.engine.cameraGroup.position.clone(),
        yaw: this.engine.desktop?.yaw ?? 0,
        pitch: this.engine.desktop?.pitch ?? 0,
      };
      // Disable first-person desktop mouse look and locomotion.
      this.engine.desktop?.disable?.();
      this.engine.locomotion?.setEnabled?.(false);

      // Create orbit controls looking at the palace center.
      if (!this._orbitControls) {
        this._orbitControls = new OrbitControls(
          this.engine.camera,
          this.engine.renderer.domElement
        );
        this._orbitControls.target.set(0, 1.4, -3.5);
        this._orbitControls.enableDamping = true;
        this._orbitControls.dampingFactor = 0.1;
        this._orbitControls.screenSpacePanning = false;
        this.engine.addUpdatable({
          update: () => this._orbitControls?.update?.(),
        });
      }
      this._orbitControls.enabled = true;
      this._orbitControls.reset();
      // Position the camera for a flattering overview.
      this.engine.cameraGroup.position.set(0, 2.5, 2);
      this.engine.cameraGroup.rotation.y = Math.PI;
      this.engine.camera.rotation.x = -0.25;
      this._orbitControls.update();
      this.vrConsole?.log?.('log', ['Desktop preview on']);
    } else {
      if (this._orbitControls) this._orbitControls.enabled = false;
      this.engine.desktop?.enable?.();
      this.engine.locomotion?.setEnabled?.(true);
      if (this._desktopPreviewSavedPose) {
        this.engine.cameraGroup.position.copy(this._desktopPreviewSavedPose.position);
        if (this.engine.desktop) {
          this.engine.desktop.yaw = this._desktopPreviewSavedPose.yaw;
          this.engine.desktop.pitch = this._desktopPreviewSavedPose.pitch;
          this.engine.desktop._applyRotation?.();
        }
      }
      this.vrConsole?.log?.('log', ['Desktop preview off']);
    }
    this._logInteraction('Desktop preview', { result: this._desktopPreviewEnabled ? 'on' : 'off' });
    this._captureSession();
  }

  /**
   * Persist a cross-platform settings payload so desktop and VR sessions can
   * share preferences and the latest analysis story.
   */
  async _saveSharedSettings(): Promise<void> {
    if (this._disposed || !this.sessionStore || !this.settingsPanel) return;
    const settings = this.settingsPanel.getAllSettings();
    const story = this._buildAnalysisStory();
    try {
      await this.sessionStore.setItem('shared-settings', {
        version: 1,
        savedAt: Date.now(),
        settings,
        lastStory: story,
      });
    } catch (err) {
      if (this._disposed) return;
      console.warn('[World] failed to save shared settings:', err);
    }
  }

  /**
   * Restore cross-platform shared settings. Applied before the per-session
   * autosave so the current session can override shared defaults.
   */
  async _loadSharedSettings(): Promise<void> {
    if (this._disposed || !this.sessionStore || !this.settingsPanel) return;
    try {
      const shared = await this.sessionStore.getItem('shared-settings');
      if (!shared?.settings) return;
      for (const [key, value] of Object.entries(shared.settings)) {
        this.settingsPanel.setSetting(key as keyof SettingsMap & string, value as never);
      }
      this.comfortSettingsController.apply(this.settingsPanel.getAllSettings());
      this.comfortSettingsController.applyPanelDistance(
        this.settingsPanel.getAllSettings().defaultPanelDistance
      );
      this._applyFeedbackSettings(this.settingsPanel.getAllSettings());
      this._applyAccessibilitySettings();
      if (this._disposed) return;
      this.vrConsole?.log?.('log', ['Shared settings restored']);
    } catch (err) {
      if (this._disposed) return;
      console.warn('[World] failed to load shared settings:', err);
    }
  }

  _setStatisticalLensVisible(enabled: boolean): void {
    const tdaEnabled = enabled && (this.settingsPanel?.getSetting('lensTDA') ?? true);
    const corrEnabled = enabled && (this.settingsPanel?.getSetting('lensCorrelation') ?? true);
    if (this.tdaGroup) this.tdaGroup.visible = tdaEnabled;
    const corr = this.dashboardPanels?.find((e) => e.panel?.chartType === 'CORRELATION');
    if (corr?.panel?.mesh) corr.panel.mesh.visible = corrEnabled;
  }

  _toggleSettingsPanel(): void {
    if (!this.settingsPanel) return;
    this.panelManager.togglePanel(this.settingsPanel);
    this.adaptiveAssist.recordPanelToggle('settings', this.settingsPanel.mesh.visible);
    this._logInteraction('Settings panel', {
      result: this.settingsPanel.mesh.visible ? 'opened' : 'closed',
    });
  }

  _onSettingChanged(key: string, value: unknown): void {
    if (key.startsWith('lens')) {
      this._setStatisticalLensVisible(this._statisticalLensEnabled);
    } else if (key.startsWith('feedback')) {
      this._applyFeedbackSettings(this.settingsPanel.getAllSettings());
    } else if (key === 'telemetryEnabled') {
      this.telemetryCollector.saveConsent?.(value as boolean);
      this.vrConsole?.log?.('log', [`Telemetry ${value ? 'enabled' : 'disabled'}`]);
    } else if (['textScale', 'highContrast', 'colorblindMode', 'dwellSelection'].includes(key)) {
      this._applyAccessibilitySettings();
    } else if (key === 'strictBudget') {
      const budgets = value ? { frameMs: 13.33, droppedFramesPer10s: 2 } : {};
      this.engine.performanceBudget?.setBudgets?.(budgets);
      this.vrConsole?.log?.('log', [`Performance budget ${value ? 'strict' : 'default'}`]);
    } else if (key === 'collabEnabled') {
      if (value) this._joinCollaborationRoom();
      else this._leaveCollaborationRoom();
    } else if (key === 'collabRoom') {
      if (this.settingsPanel.getSetting('collabEnabled')) {
        this._leaveCollaborationRoom();
        this._joinCollaborationRoom(value as string);
      }
    } else if (key === 'userMode') {
      this.userModeController.apply();
      this.inPlaceHandles?.setUserMode?.(this.settingsPanel.getSetting('userMode') as 'novice' | 'expert');
    } else if (['snapTurn', 'snapTurnAngle', 'reducedMotion'].includes(key)) {
      this.comfortSettingsController.apply(this.settingsPanel.getAllSettings());
    } else if (key === 'vignette' || key === 'vignetteIntensity') {
      this.comfortSettingsController.apply(this.settingsPanel.getAllSettings());
    } else if (key === 'seatedHeightOffset') {
      this.comfortSettingsController.apply(this.settingsPanel.getAllSettings());
    } else if (key === 'defaultPanelDistance') {
      this.comfortSettingsController.applyPanelDistance(
        this.settingsPanel.getAllSettings().defaultPanelDistance
      );
    } else if (key === 'miniOverview') {
      this.miniOverview?.setEnabled?.(value as boolean);
    } else if (key === 'peerPresence') {
      this.peerPresenceHUD?.setEnabled?.(value as boolean);
    }
    this._saveSharedSettings();
    this._logInteraction('Setting changed', { result: `${key} = ${value}` });
    this._captureSession();
  }

  _applyAccessibilitySettings(): void {
    const settings = this.settingsPanel.getAllSettings();
    const options = {
      textScale: settings.textScale ?? 1,
      highContrast: settings.highContrast ?? false,
      colorblindMode: settings.colorblindMode ?? 'none',
      dwellSelection: settings.dwellSelection ?? false,
    };

    for (const panel of this.panelManager.panels) {
      if (panel?.applyAccessibility) panel.applyAccessibility(options);
    }

    this.handWheelMenu?.applyAccessibility?.(options);
    this.engine.input.setDwellSelection?.(
      options.dwellSelection ?? false,
      (settings.dwellTimeMs as number) ?? 1200
    );

    if (this.dracoNode && this.dracoNode.translatorOptions.colorblindMode !== options.colorblindMode) {
      this.dracoNode.translatorOptions.colorblindMode = options.colorblindMode;
      this.dracoNode.reSolveAndSynthesize();
      // A full re-solve rebuilds the artefact from the dataset but drops the
      // visual transform of the currently-active data operation (e.g. a
      // filter's lifted/hidden nodes). Re-apply it so a mid-analysis palette
      // change does not silently revert the active operation's transform —
      // mirroring _restoreDataset, which re-applies it after the same call.
      const currentOp = this.analysisHistory?.current?.()?.operation;
      const currentDataset = this._transformedDataset ?? this._originalDataset;
      if (currentOp && currentDataset) {
        this._reapplyOperationTransform(currentOp, currentDataset);
      }
    }

    // Remap world theme accent colors for colorblind modes.
    if (options.colorblindMode && options.colorblindMode !== 'none') {
      this.engine.theme.applyColorblindMode?.(options.colorblindMode as string);
    } else {
      this.engine.theme.applyPreset?.(this.engine.theme.currentPreset);
    }
  }

  _applyFeedbackSettings(settings: SettingsMap): void {
    this.engine.input.feedback.setToggles?.({
      audio: settings.feedbackAudio,
      haptic: settings.feedbackHaptic,
      visual: settings.feedbackVisual,
    });
  }

  _joinCollaborationRoom(roomId: string | null = null): Promise<void> {
    return this.collaborationCoordinator.joinCollaborationRoom(roomId);
  }

  _leaveCollaborationRoom(): void {
    this.collaborationCoordinator.leaveCollaborationRoom();
  }

  /**
   * The DatasetSpace for the currently-loaded dataset. Built lazily on first
   * access (and rebuilt when the source dataset changes) rather than eagerly
   * on every `loadDataset`, since the renderer, session save, and data
   * operations do not read it — only scaffolding/tests do — so paying a full
   * clone + per-row hash + range computation on the load hot path was wasted
   * work that could trip the PerformanceBudget critical frame-spike warning.
   */
  get datasetSpace(): DatasetSpace | null {
    // AtlasCore caches the DatasetSpace against the current dataset identity.
    return this.atlas.datasetSpace;
  }

  get networkManager(): NetworkManagerLike | null {
    return this.collaborationCoordinator?.networkManager ?? null;
  }

  undoAnalysis(): void {
    // The controller emits HISTORY_SEEK; World's listener restores the dataset
    // + narrative strip. Consolidating the two history-mutation paths here
    // keeps seek events consistent (Wave 4).
    const frame = this.dataOperationController.undo();
    if (!frame) return;
    this.vrConsole?.log?.('log', [`Undo: ${frame.operation}`]);
    this._logInteraction('Undo', { result: frame.operation });
  }

  redoAnalysis(): void {
    const frame = this.dataOperationController.redo();
    if (!frame) return;
    this.vrConsole?.log?.('log', [`Redo: ${frame.operation}`]);
    this._logInteraction('Redo', { result: frame.operation });
  }

  _restoreDataset(dataset: Dataset | null, operation: string): void {
    if (!dataset || !this.dracoNode) return;

    const transformedDataset = dataset.clone();
    this._transformedDataset = transformedDataset;
    this.dracoNode.dataInput.dataset = transformedDataset;
    this.dracoNode.reSolveAndSynthesize();

    // Re-apply the visual transform that belongs to this operation, because a
    // full re-solve only rebuilds the artefact from the dataset.
    this._reapplyOperationTransform(operation, transformedDataset);

    this._updateDashboardDatasets(transformedDataset);
    if (this.tdaRecompute && operation !== 'anomaly') {
      this.tdaRecompute();
    }
  }

  /**
   * Re-apply the visual transform for a data operation to the current artefact.
   *
   * A full `reSolveAndSynthesize` rebuilds the artefact from the dataset but
   * drops the operation's visual transform (e.g. a filter's lifted/hidden
   * nodes, a sort's ordering, a cluster's grouping). Any code path that
   * re-solves mid-analysis must call this to preserve the active operation.
   */
  _reapplyOperationTransform(operation: string, dataset: Dataset): void {
    if (!this.dracoNode?.artifact) return;
    switch (operation) {
      case 'filter':
        applyFilter(this.dracoNode.artifact, dataset);
        break;
      case 'sort':
        applySort(this.dracoNode.artifact, dataset);
        break;
      case 'aggregate':
        applyAggregate(this.dracoNode.artifact, dataset);
        break;
      case 'cluster':
        applyCluster(this.dracoNode.artifact, dataset);
        break;
      case 'hierarchical':
        applyHierarchicalCluster(this.dracoNode.artifact, dataset);
        break;
      case 'density':
        applyDensityCluster(this.dracoNode.artifact, dataset);
        break;
      case 'anomaly':
        applyAnomaly(this.dracoNode.artifact, dataset);
        break;
      case 'timeSlice':
        applySlice(this.dracoNode.artifact, dataset, this._originalDataset ?? dataset);
        break;
      case 'compare':
        // The dataset re-solve is the visual representation for Compare.
        break;
      case 'reset':
      default:
        resetTransforms(this.dracoNode.artifact);
        break;
    }
  }

  _seekAnalysisHistory(index: number): void {
    const frame = this.dataOperationController.seekHistory(index);
    if (!frame) return;
    this.vrConsole?.log?.('log', [`Rewound to ${frame.operation}`]);
    this._logInteraction('Seek history', { result: frame.operation });
    this._captureSession();
  }

  _updateNarrativeStrip(): void {
    this.narrativeStrip?.render?.();
    if (this.analysisHistory?.length > 0) {
      this.panelManager?.showPanel?.(this.narrativeStrip);
    }
  }

  _updateOperationLog(): void {
    const entries = this.analysisHistory.frames().map((f) => ({
      operation: f.operation,
      rowCount: f.datasetAfter?.rowCount,
      timestamp: f.timestamp,
    }));
    this.operationLogPanel?.setEntries(entries);
  }

  _subscribeDataOperationEvents(): void {
    // Cross-cutting subscribers: keep logging, telemetry, and auto-save out of
    // feature methods by reacting to events instead of calling World directly.
    this.eventBus.on(
      WorldTopics.INTERACTION_LOG,
      (payload: unknown) => {
        const { action, gesture, controller, result } = payload as {
          action: string;
          gesture?: string;
          controller?: string;
          result?: string;
        };
        this.interactionCoach?.log?.({ action, gesture, controller, result });
      }
    );

    this.eventBus.on(WorldTopics.SESSION_CAPTURE, () => {
      this._requestAutoSave();
    });

    this.eventBus.on(WorldTopics.CONSOLE_LOG, (args: unknown) => {
      this.vrConsole?.log?.('log', Array.isArray(args) ? args : [args]);
    });

    this.eventBus.on(WorldTopics.CONSOLE_WARN, (args: unknown) => {
      this.vrConsole?.log?.('warn', Array.isArray(args) ? args : [args]);
    });

    // Route interaction events (gestures, commands, settings changes) to the
    // interaction coach and telemetry so individual callers do not need to.
    this.eventBus.on(
      WorldTopics.INTERACTION,
      (payload: unknown) => {
        const { action, gesture, controller, result } = payload as {
          action: string;
          gesture?: string;
          controller?: string;
          result?: string;
        };
        this.eventBus.emit(WorldTopics.INTERACTION_LOG, { action, gesture, controller, result });
      }
    );

    this.eventBus.on(WorldTopics.GESTURE_RECOGNIZED, (payload: unknown) => {
      const { name } = payload as { name: string };
      this.telemetryCollector?.recordGesture?.(name);
    });

    this.eventBus.on(
      WorldTopics.OPERATION_APPLIED,
      (payload: unknown) => {
        const { operation, rowCount } = payload as { operation: string; rowCount?: number };
        this.telemetryCollector?.recordOperation?.(operation);
        if (operation === 'compare') {
          // Compare changes the dataset shape, so rebuild the Draco artefact.
          this._restoreDataset(this._transformedDataset, operation);
        }
        this._updateDashboardDatasets(this._transformedDataset);
        if (this.tdaRecompute && operation !== 'anomaly') this.tdaRecompute();
        this._discoverStructuresAndRecommend(operation);
        this._updateOperationLog();
        this._updateNarrativeStrip();
        this.vrConsole?.log?.('log', [`Operation: ${operation} → ${rowCount} rows`]);
        this._logInteraction(operation, { result: `${rowCount} rows` });
        this._requestAutoSave();
      }
    );

    this.eventBus.on(
      WorldTopics.OPERATION_PREVIEW,
      (payload: unknown) => {
        const {
          operation,
          previewDataset,
          originalDataset,
          artifact,
        } = payload as {
          operation: string;
          previewDataset: Dataset;
          originalDataset: Dataset | null;
          artifact: ArtifactRef;
        };
        this.livePreview.preview(operation, previewDataset, originalDataset ?? previewDataset, artifact);
      }
    );

    this.eventBus.on(WorldTopics.OPERATION_CLEAR_PREVIEW, () => {
      this.livePreview.clear();
    });

    this.eventBus.on(
      WorldTopics.HISTORY_SEEK,
      (payload: unknown) => {
        const { operation, dataset } = payload as { operation: string; dataset: Dataset };
        this._restoreDataset(dataset, operation);
        this._updateNarrativeStrip();
      }
    );

    this.eventBus.on(WorldTopics.SESSION_AUTOSAVE_REQUEST, () => {
      this._requestAutoSave();
    });

    // Load-test completion: store the summary, enrich it with usability
    // aggregates (friction score/level/patterns — no raw interaction trail),
    // restore telemetry consent to its prior state, and flush the perf/UX
    // summary to the LOCAL dev-server log endpoint. No user dataset rows or
    // session snapshots leave the device.
    this.eventBus.on(WorldTopics.LOADTEST_COMPLETE, (payload: unknown) => {
      const summary = payload as LoadTestSummary;
      this._lastLoadTestSummary = summary;
      this._enrichAndFlushLoadTestSummary(summary);
      this._restoreTelemetryConsent();
    });
  }

  _buildWheelMenu(): void {
    this.uiManager.buildWheelMenu(buildWheelMenuCategories(this));
  }

  // --- Load-test harness (WASM command-buffer decision) ---

  /** Read the geometry/layout the Draco solver actually picked for the current palace. */
  _getActiveSpecInfo(): { geometry?: string; layout?: string } | null {
    const spec = this.dracoNode?.solverResult?.spec;
    if (!spec) return null;
    return { geometry: String(spec.geometry), layout: String(spec.layout) };
  }

  /**
   * Start a load-test run. Enables telemetry for the run window (restored on
   * completion) so the usability/friction aggregates are captured. The per-frame
   * perf trace is captured independently by the LoadTestCollector.
   */
  runLoadTest(profile?: LoadTestProfile): void {
    // Show the panel so the user sees live progress.
    this.uiManager?.showPanel?.(this.loadTestPanel);
    this._telemetryConsentBeforeRun = !!this.telemetryCollector?.enabled;
    try {
      this.telemetryCollector?.setEnabled?.(true);
    } catch {
      // ignore — telemetry is best-effort
    }
    this.loadTestDriver.run(profile);
  }

  /** Abort a running load test. */
  stopLoadTest(): void {
    this.loadTestDriver.stop();
  }

  /** Re-POST the last completed summary to the local dev-server log endpoint. */
  flushLastLoadTestSummary(): void {
    if (this._lastLoadTestSummary) {
      this._enrichAndFlushLoadTestSummary(this._lastLoadTestSummary);
    }
  }

  /** Restore telemetry consent to whatever it was before the run. */
  _restoreTelemetryConsent(): void {
    if (this._telemetryConsentBeforeRun !== null) {
      try {
        this.telemetryCollector?.setEnabled?.(this._telemetryConsentBeforeRun);
      } catch {
        // ignore
      }
      this._telemetryConsentBeforeRun = null;
    }
  }

  /**
   * Attach usability aggregates (friction score/level/patterns — no raw
   * interaction trail) and POST the summary to the LOCAL dev-server endpoint
   * `/__loadtest-results` (serve-only), which appends to
   * `logs/loadtest-results.jsonl`. Failures are silent — the endpoint only
   * exists on `npm run dev`, and the panel's Download button is the fallback.
   */
  _enrichAndFlushLoadTestSummary(summary: LoadTestSummary): void {
    summary.usability = this._collectUsabilityDigest();
    try {
      void fetch('/__loadtest-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(summary),
      }).catch(() => {
        // Endpoint absent (production/preview) or fetch unavailable — silent.
      });
    } catch {
      // fetch unavailable — silent
    }
    // Also log a one-line verdict to the console so the RemoteDebugStreamer
    // (which writes logs/vr-remote-console.log) captures it on the headset.
    try {
      // eslint-disable-next-line no-console
      console.log(
        `[LOAD TEST] ${summary.profileName} | XR=${summary.xrActive} | ` +
          `sufficientTo=${summary.verdict.jsPathSufficientTo} ` +
          `warrantedAt=${summary.verdict.commandBufferWarrantedAt} | ` +
          summary.verdict.recommendation
      );
    } catch {
      // ignore
    }
  }

  /** Aggregate usability digest from the frustration analyzer (local, opt-in). */
  _collectUsabilityDigest(): {
    frictionLevel: string;
    dissatisfactionScore: number;
    detectedPatterns: string[];
    telemetryConsentEnabled: boolean;
  } {
    const tc = this.telemetryCollector as TelemetryCollectorLike & {
      frustrationAnalyzer?: { getCompactDigest?: () => Record<string, unknown> };
    };
    const digest = tc?.frustrationAnalyzer?.getCompactDigest?.();
    return {
      frictionLevel: typeof digest?.frictionLevel === 'string' ? (digest.frictionLevel as string) : 'unknown',
      dissatisfactionScore: typeof digest?.dissatisfactionScore === 'number' ? (digest.dissatisfactionScore as number) : 0,
      detectedPatterns: Array.isArray(digest?.detectedPatterns)
        ? (digest.detectedPatterns as Array<{ name?: string } | string>).map((p) =>
            typeof p === 'string' ? p : p?.name ?? 'pattern'
          )
        : [],
      telemetryConsentEnabled: !!this.telemetryCollector?.enabled,
    };
  }

  setPortalsEnabled(enabled: boolean): void {
    this.portalsEnabled = enabled;
    this.portalA.group.visible = enabled;
    this.portalB.group.visible = enabled;
    this.vrMenu?.setPortalsEnabled?.(enabled);
    this._logInteraction('Portals', { result: enabled ? 'visible' : 'hidden' });
  }

  _updateTelemetry(): void {
    if (!this.telemetry) return;
    const pos = this.engine.headWorldPos;
    const spec = this.dracoNode?.solverResult?.spec;
    const name = this.currentEntry?.name ?? '-';
    this.telemetry.textContent =
      `${name}  |  POS: [${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}]  |  ` +
      `LAYOUT: ${spec?.layout ?? '-'}  GEOM: ${spec?.geometry ?? '-'}  BEHAVIOR: ${spec?.behavior ?? '-'}`;
  }

  /**
   * Connect to a curated open live data source by key.
   * @param {string} sourceKey from src/data/connectors/OpenDataSources.ts
   */
  connectLiveSource(sourceKey: string): boolean {
    return this.liveStreamCoordinator.connectLiveSource(sourceKey);
  }

  /**
   * Connect to a raw WebSocket data stream.
   * If no URL is supplied, the bundled demo endpoint is used.
   */
  connectLiveStream(url?: string, options?: LiveStreamOptions): boolean {
    return this.liveStreamCoordinator.connectLiveStream(url, options);
  }

  disconnectLiveStream(): void {
    this.liveStreamCoordinator.disconnectLiveStream();
  }

  get liveConnector(): LiveConnectorLike | null {
    return this.liveStreamCoordinator?.liveConnector ?? null;
  }

  get _liveFlushTimer(): ReturnType<typeof setTimeout> | null {
    return this.liveStreamCoordinator?._liveFlushTimer ?? null;
  }

  get _pendingRows(): Record<string, unknown>[] {
    return this.liveStreamCoordinator?._pendingRows ?? [];
  }

  isLiveConnected(): boolean {
    return this.liveStreamCoordinator.isLiveConnected();
  }

  /**
   * Apply a named dataset operation and its matching VR artefact transform.
   * Delegates to `DataOperationController`; World reacts through the event bus.
   */
  applyDataOperation(operation: string): void {
    this.dataOperationController.apply(operation);
  }

  /**
   * Show a transient preview of what `operation` would do. World renders the
   * preview by subscribing to `operation:preview` events.
   */
  previewDataOperation(operation: string): void {
    this.dataOperationController.preview(operation);
  }

  clearOperationPreview(): void {
    this.dataOperationController.clearPreview();
  }

  /** Restore the original dataset and reset artefact transforms. */
  resetDataOperation(): void {
    this.dataOperationController.reset();
    // For layouts whose positions were changed by sort/cluster, a full re-solve
    // is the safest reset.
    this.dracoNode?.reSolveAndSynthesize?.();
    this._updateDashboardDatasets(this.dataOperationController.transformedDataset);
    if (this.tdaRecompute) this.tdaRecompute();
    this._updateOperationLog();
    this._updateNarrativeStrip();
    this.vrConsole?.log?.('log', [
      `Reset transforms → ${this.dataOperationController.transformedDataset?.rowCount ?? 0} rows`,
    ]);
    this._logInteraction('Reset', {
      result: `${this.dataOperationController.transformedDataset?.rowCount ?? 0} rows`,
    });
    this._requestAutoSave();
  }

  /**
   * Gracefully exits immersive VR and returns to 2D desktop mode. Resolves to
   * `true` on a clean exit (or when no session was active), `false` if the
   * underlying `session.end()` failed — propagated so UI/telemetry can react.
   */
  async exitVR(): Promise<boolean> {
    return this.engine.exitVR();
  }

  /**
   * Tear down the world and all async resources. Production code rarely calls
   * this, but tests need it to avoid timers, live streams, and collaboration
   * connections logging after the environment has been torn down.
   */
  async dispose(): Promise<void> {
    if (this._disposed) return;
    this._disposed = true;

    // Stop any pending auto-save and live flushes before they log.
    this.sessionController?.dispose?.();
    this.atlas?.dispose?.();
    this.liveStreamCoordinator?.disconnectLiveStream?.();
    this.collaborationCoordinator?.leaveCollaborationRoom?.();

    // Detach telemetry global listeners so late window errors are not recorded.
    this.telemetryCollector?.setEnabled?.(false);
    this.adaptiveAssist?.dispose();
    this.rendererLifecycle?.dispose();
    this.sceneGraphController.dispose();

    // Wait for async init work to finish so it cannot log after disposal.
    await Promise.allSettled(this._initPromises);
    this._initPromises = [];

    this.engine.dispose();
  }

  async start(): Promise<void> {
    // Initialise the Rust/WASM runtime in parallel with engine start. The
    // kernel is MANDATORY for analytics; if it cannot be loaded the engine
    // still starts but data ops surface a hard "kernel unavailable" state.
    const wasmInitPromise = this._initWasmRuntime().catch((err) => {
      this._wasmRuntime = null;
      this._wasmCapabilities = 0;
      this._wasmUnavailable = true;
      console.error('[World] analytical kernel unavailable:', err);
      this.vrConsole?.log?.('error', ['Analytical kernel unavailable — data ops disabled. Run npm run wasm:dev.']);
    });

    this.engine.start();

    await wasmInitPromise;
  }

  /**
   * Initialise the WASM runtime and record the enabled capability set. Throws
   * on failure; the caller (start()) surfaces the unavailable state.
   */
  async _initWasmRuntime(): Promise<void> {
    // Load the bridge lazily so that production builds which skip wasm-pack
    // still start without a missing-module error at import time.
    const bridge = await import('../wasm/RuntimeBridge.js');
    if (bridge.isReady()) {
      this._wasmRuntime = bridge;
      this._wasmCapabilities = bridge.capabilities();
      this.atlas.setKernel(bridge, this._wasmCapabilities);
      this._rebuildPalaceWithKernelFacts();
      return;
    }

    // In dev, Vite serves the wasm-pack output at /wasm/nemosyne_wasm_bg.wasm.
    await bridge.initRuntime('/wasm/nemosyne_wasm_bg.wasm');
    this._wasmRuntime = bridge;
    this._wasmCapabilities = bridge.capabilities();
    this.atlas.setKernel(bridge, this._wasmCapabilities);
    this._rebuildPalaceWithKernelFacts();
    this.vrConsole?.log?.('log', [
      `WASM ready — capabilities ${this._wasmCapabilities.toString(2)}`,
    ]);
  }

  /**
   * If the analytical kernel is ready and `entry` is a built-in sample key,
   * load the sample *content* from Rust. Otherwise return the entry unchanged.
   *
   * Sample content may come from the static JS `SampleDatasets` arrays when the
   * kernel is absent (those are static data, not analytical results), but NO
   * analytical operation ever runs in JS — the kernel remains the only
   * analytical path.
   */
  _maybeLoadSampleFromWasm(entry: DatasetLoadEntry): DatasetLoadEntry {
    // Wave 6: sample content is loaded through AtlasCore (the single kernel
    // caller). When the kernel is absent or the key is unknown, `loadSample`
    // returns null and the static JS `SampleDatasets` entry is used unchanged
    // (static data, not an analytical result).
    if (!entry?.key) return entry;
    try {
      const dataset = this.atlas.loadSample(entry.key);
      if (!dataset) return entry;
      return { ...entry, dataset };
    } catch (e) {
      console.error('[World] kernel sample load panic:', e);
      return entry;
    }
  }
}
