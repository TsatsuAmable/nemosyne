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
import { ANALYSIS_TEMPLATES, resolveTemplate } from '../data/AnalysisTemplates.ts';
import { TopologyTypes } from '../draco/ConstraintEngine.ts';
import { disposeObject } from '../utils/Dispose.ts';
import { downloadDataUrl, downloadText } from '../utils/Download.ts';
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
} from './interactions/DataOperations.ts';
import { buildTDASummaryGroup } from './artifacts/TDAPlanes.ts';
import { ControllerGestureMapper } from './interactions/ControllerGestureMapper.ts';
import { WorldInputCoordinator } from './coordinators/WorldInputCoordinator.ts';
import { UserModeController } from './coordinators/UserModeController.ts';
import { ComfortSettingsController } from './coordinators/ComfortSettingsController.ts';
import { AnalysisHistory } from '../data/AnalysisHistory.ts';
import { SessionStore, type SessionSnapshot } from '../data/SessionStore.ts';
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
import { WorldEventBus, WorldTopics } from '../utils/EventBus.ts';
import { SceneGraphController } from './coordinators/SceneGraphController.ts';
import { WorkspaceManager } from './coordinators/WorkspaceManager.ts';
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
import { DatumPlane } from './artifacts/DatumPlane.ts';
import { TechnoCoreNode } from './artifacts/TechnoCoreNode.ts';
import { FarcasterPortal } from './artifacts/FarcasterPortal.ts';
import { HolographicInspector } from './artifacts/HolographicInspector.ts';
import type { DatasetJSON, EncodingMapping, TopologyType } from '../data/types.ts';
import type {
  ArtifactRef,
  DatasetLoadEntry,
  LiveConnectorLike,
  LiveStreamOptions,
  NetworkManagerLike,
  SettingsMap,
  TelemetryCollectorLike,
  WasmRuntimeBridge,
  WorldEventBusLike,
} from './coordinators/types.ts';

// Capability flags returned by the Rust/WASM runtime. Keep in sync with wasm/src/lib.rs.
const CAP_DATASET_RUST = 1 << 0;

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
  dataOperationController: DataOperationController;
  sceneComposer: WorldSceneComposer;
  analystAnchor: THREE.Group;
  datum: DatumPlane;
  core: TechnoCoreNode;
  inspector: HolographicInspector;
  portalA: FarcasterPortal;
  portalB: FarcasterPortal;
  telemetryCollector: TelemetryCollectorLike;
  uiManager: WorldUIManager;
  panelManager: PanelManager;
  dashboard: DashboardManager;
  handWheelMenu: HandWheelMenu;
  vrMenu: VRMenu;
  vrConsole: VRConsole;
  telemetryPanel: InputTelemetry;
  settingsPanel: SettingsPanel;
  operationLogPanel: OperationLogPanel;
  metricsPanel: TelemetryPanel;
  performancePanel: PerformancePanel;
  networkPanel: NetworkPanel;
  interactionCoach: InteractionCoach;
  narrativeStrip: NarrativeStrip;
  miniOverview: MiniOverview;
  peerPresenceHUD: PeerPresenceHUD;
  inputCoordinator: WorldInputCoordinator;
  userModeController: UserModeController;
  comfortSettingsController: ComfortSettingsController;
  tooltipManager: TooltipManager;
  inPlaceHandles: InPlaceOperationHandles;
  livePreview: LivePreview;
  portalsEnabled: boolean;
  _datasetCycleIndex: number;
  _wasmCapabilities: number;
  _wasmRuntime: WasmRuntimeBridge | null;
  liveStreamCoordinator: LiveStreamCoordinator;
  collaborationCoordinator: CollaborationCoordinator;
  loader: FileLoaderUI;
  telemetry: HTMLElement | null;
  _dashboardTooltipTargets: THREE.Mesh[];
  analysisHistory: AnalysisHistory;
  _originalDataset!: Dataset | null;
  _transformedDataset!: Dataset | null;
  _inputPaused!: boolean;
  _handNearArtefact!: boolean;
  _handNearWheelMenu!: boolean;
  sessionStore: SessionStore;
  _sessionAutoSaveTimer: ReturnType<typeof setTimeout> | null;
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
  _desktopPreviewSavedPose!: { position: THREE.Vector3; yaw: number; pitch: number } | null;
  _orbitControls!: OrbitControls | null;
  dracoNode!: DracoTopologyNode | null;
  diagnostic!: DracoDiagnosticHUD | null;
  currentEntry!: DatasetLoadEntry | null;
  tdaGroup!: THREE.Group | null;
  tdaRecompute!: (() => void) | null;
  dashboardPanels!: { panel: ChartPlanePanel }[];

  constructor() {
    this.engine = new Engine();

    // Lightweight event bus for cross-cutting UI/UX concerns. Anything that
    // needs to react to operations, settings changes, or session events can
    // subscribe without hard-wiring into `World`. Reuse the engine's bus so
    // the AdaptiveFrameGovernor's PERFORMANCE_THROTTLE events reach all
    // subscribers on the same bus.
    this.eventBus = this.engine.eventBus;

    this.sceneGraphController = new SceneGraphController();
    this.workspaceManager = new WorkspaceManager(this.engine.scene);

    // Data-operation controller owns dataset mutation, analysis history, and
    // the operation → visual-transform mapping.
    this.dataOperationController = new DataOperationController({
      eventBus: this.eventBus as WorldEventBus,
      getArtifact: () => this.dracoNode?.artifact ?? null,
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
    this.inspector = this.sceneComposer.inspector;
    this.portalA = this.sceneComposer.portalA;
    this.portalB = this.sceneComposer.portalB;

    // Opt-in telemetry collector. Local-only until explicitly exported.
    this.telemetryCollector = new TelemetryCollector();
    this.telemetryCollector.loadConsent?.();
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
      onReset: () => this.resetDataOperation(),
      onPanelChange: () => this._requestAutoSave(),
      onSettingChanged: (key, value) => this._onSettingChanged(key, value),
      onSeekHistory: (index) => this._seekAnalysisHistory(index),
      getNodeMeshes: () => this.dracoNode?.artifact?.nodeMeshes ?? [],
      getPeers: () => this.networkManager?.room?.getRemoteSnapshot() ?? [],
      getLocalPeerId: () => this.networkManager?.peerId ?? null,
      getSetting: (key) => this.uiManager?.settingsPanel?.getSetting?.(key),
      telemetryCollector: this.telemetryCollector,
      analysisHistory: this.dataOperationController.analysisHistory,
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
    this.comfortSettingsController = new ComfortSettingsController(this.engine, this.analystAnchor);

    this.tooltipManager = new TooltipManager(this.engine.camera);
    this.tooltipManager.mount(this.engine.scene);
    this.tooltipManager.setPointerRaycaster(this.engine.input.raycaster);
    this.engine.addUpdatable(this.tooltipManager);

    // In-place operation handles near data artefacts for direct manipulation.
    this.inPlaceHandles = new InPlaceOperationHandles(this.engine.scene, this.engine.camera, {
      userMode: (this.settingsPanel?.getSetting?.('userMode') as 'novice' | 'expert') ?? 'novice',
      onOperation: (op) => this.dataOperationController.apply(op),
      onOperationHover: (op) => this.dataOperationController.preview(op),
      onOperationLeave: () => this.dataOperationController.clearPreview(),
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
    this._registerLandmarkInteractions();

    // Per-frame hook: portal trigger checks and core activity sync.
    this.engine.addUpdatable({
      update: (delta: number, time: number) => this._updateWorld(delta, time),
    });

    // Register visual elements for gaze/pointer tooltips.
    this._registerTooltipTargets();

    this.portalsEnabled = true;
    this._datasetCycleIndex = -1;
    this._wasmCapabilities = 0;
    this._wasmRuntime = null;

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
      wasmRuntime: this._wasmRuntime,
      wasmCapabilities: this._wasmCapabilities,
    });

    // Teleport anchors around the palace.
    this._setupTeleportAnchors();

    // System gesture (controller grip or two-hand pinch) toggles launcher ring.
    this.engine.input.onSystemToggle = () => this._togglePanels();

    // Tell the tooltip manager about any dashboard panels created later.
    this._dashboardTooltipTargets = [];

    // Analysis operation history is owned by the data-operation controller, but
    // exposed as a legacy property for tests and UI panels.
    this.analysisHistory = this.dataOperationController.analysisHistory;

    // Facade getters for the dataset state owned by the data-operation controller.
    // Tests and session code still access `world._originalDataset` and
    // `world._transformedDataset` directly.
    Object.defineProperty(this, '_originalDataset', {
      get: () => this.dataOperationController.originalDataset,
      set: (value) => {
        this.dataOperationController._originalDataset = value?.clone?.() ?? null;
      },
    });
    Object.defineProperty(this, '_transformedDataset', {
      get: () => this.dataOperationController.transformedDataset,
      set: (value) => {
        this.dataOperationController._transformedDataset = value?.clone?.() ?? null;
      },
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
    this._sessionAutoSaveTimer = null;

    // Track async initialization work so tests can wait for it during teardown.
    this._initPromises = [];
    this._disposed = false;

    // Wire desktop/VR keyboard undo/redo to the analysis history.
    this.engine.onUndo = () => this.undoAnalysis();
    this.engine.onRedo = () => this.redoAnalysis();
    this.engine.onPauseInput = () => this.inputCoordinator.togglePauseInput();
    this.engine.onResetView = () => this.inputCoordinator.resetView();

    // Gesture recognition and context routing is owned by the input coordinator.

    // Statistical-lens visibility state.
    this._statisticalLensEnabled = true;

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
    this.guidedTour = new GuidedTour(this.engine, {
      analystAnchor: this.analystAnchor,
      feedback: this.engine.input.feedback,
      tour: FIRST_DATASET_TOUR,
      resolveTarget: (target: string) => this._resolveTourTarget(target),
      checkCondition: (step: TourStep) => this._checkTourCondition(step),
      onComplete: () => this.vrConsole?.log?.('log', ['Tour complete']),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    this.engine.addUpdatable(this.guidedTour);
    this.engine.addHudObject(this.guidedTour);

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

  _resolveTourTarget(target: string): { object?: THREE.Object3D; position?: THREE.Vector3 } | null {
    switch (target) {
      case 'datum-plane':
        return { object: this.datum?.mesh, position: this.datum?.mesh?.position };
      case 'draco-palace':
        return { object: this.dracoNode?.group, position: this.dracoNode?.group?.position };
      case 'node-mesh':
        return this.dracoNode?.artifact?.nodeMeshes?.[0]
          ? { object: this.dracoNode.artifact.nodeMeshes[0] }
          : null;
      case 'wheel-menu':
        return this.handWheelMenu?.group ? { object: this.handWheelMenu.group } : null;
      case 'wheel-ops': {
        const ops = (
          this.handWheelMenu as unknown as { _categories: { id: string }[] }
        )._categories?.find((c) => c.id === 'ops');
        return ops ? { position: new THREE.Vector3(0, 1.4, -0.6) } : null;
      }
      case 'gesture-hint':
        return { position: new THREE.Vector3(0, 1.5, -1.0) };
      case 'settings-panel':
        return this.settingsPanel?.mesh ? { object: this.settingsPanel.mesh } : null;
      case 'dashboard':
        return { position: new THREE.Vector3(0, 1.45, -1.35) };
      case 'data-loader':
        return this.vrMenu?.mesh ? { object: this.vrMenu.mesh } : { position: new THREE.Vector3(-0.9, 1.5, -1.1) };
      case 'session-export':
        return this.operationLogPanel?.mesh ? { object: this.operationLogPanel.mesh } : { position: new THREE.Vector3(0.5, 1.4, -0.9) };
      case 'peer-collaboration':
        return this.peerPresenceHUD?.mesh ? { object: this.peerPresenceHUD.mesh } : { position: new THREE.Vector3(-0.9, 1.35, -0.7) };
      case 'draco-transform':
        return this.vrMenu?.mesh ? { object: this.vrMenu.mesh } : { position: new THREE.Vector3(-0.9, 1.5, -1.1) };
      default:
        return null;
    }
  }

  _checkTourCondition(step: TourStep): boolean {
    // Auto-advance a few steps when the user performs the hinted action.
    switch (step.target) {
      case 'node-mesh':
        return this.inspector?.active === true;
      case 'wheel-menu':
        return this.handWheelMenu?.isVisible?.() === true;
      case 'settings-panel':
        return this.settingsPanel?.mesh?.visible === true;
      case 'draco-transform':
        return (this.dataOperationController?.analysisHistory?.length ?? 0) > 0;
      default:
        return false;
    }
  }

  startTour(): boolean {
    return this.guidedTour?.start?.() ?? false;
  }

  stopTour(): void {
    this.guidedTour?.stop?.();
  }

  _registerTooltipTargets(): void {
    // Landmarks and environment.
    if (this.core?.group) {
      this.core.group.userData.tooltipMeta = {
        title: 'TechnoCore',
        body: 'Lens hub: pinch to cycle statistical/anomaly lens',
      };
      this.tooltipManager.registerTarget(this.core.group);
    }
    if (this.datum?.mesh) {
      this.datum.mesh.userData.tooltipMeta = {
        title: 'Datum Plane',
        body: 'Substrate of cyberspace',
      };
      this.tooltipManager.registerTarget(this.datum.mesh);
    }
    if (this.portalA?.group) {
      this.portalA.group.userData.tooltipMeta = {
        title: 'Farcaster: Deep Net',
        body: 'Step through to apply anomaly lens and warp to the deep-net zone',
      };
      this.tooltipManager.registerTarget(this.portalA.group);
    }
    if (this.portalB?.group) {
      this.portalB.group.userData.tooltipMeta = {
        title: 'Farcaster: Local Matrix',
        body: 'Step through to reset transforms and return to the local matrix',
      };
      this.tooltipManager.registerTarget(this.portalB.group);
    }
  }

  _registerLandmarkInteractions(): void {
    if (this.core?.group) {
      this.engine.addInteractable(this.core.group, {
        onEnter: () => {},
        onLeave: () => {},
        onSelect: () => this._onCoreSelect(),
      });
    }
  }

  _onCoreSelect(): void {
    const mode = this.core.nextLensMode();
    if (mode === 'statistical') {
      this._statisticalLensEnabled = true;
      this._setStatisticalLensVisible(true);
      this.vrConsole?.log?.('log', ['TechnoCore: statistical lens']);
    } else if (mode === 'anomaly') {
      this.applyDataOperation('anomaly');
      this.vrConsole?.log?.('log', ['TechnoCore: anomaly lens applied']);
    } else {
      this._statisticalLensEnabled = false;
      this._setStatisticalLensVisible(false);
      this.vrConsole?.log?.('log', ['TechnoCore: lens off']);
    }
    this._logInteraction('TechnoCore lens', { result: mode });
    this.engine.input.feedback?.playCoreTone?.(mode);
    this.engine.input.feedback?.playHaptic?.(0.5, 60);
    this._captureSession();
  }

  _applyPortalOperation(operation: string | null): void {
    if (!operation) return;
    if (operation === 'reset') {
      this.resetDataOperation();
    } else {
      this.applyDataOperation(operation);
    }
  }

  /**
   * Capture the current world state as a JSON snapshot and save it.
   */
  async saveSession(id: string = 'autosave'): Promise<void> {
    if (this._disposed || !this.currentEntry?.dataset || !this.dracoNode) return;

    const snapshot: Record<string, unknown> = {
      schemaVersion: 1,
      savedAt: Date.now(),
      dataset: this._originalDataset?.toJSON?.() ?? null,
      entry: {
        name:
          this.currentEntry.name ??
          this._originalDataset?.name ??
          this.currentEntry.label ??
          'dataset',
        topology: this.currentEntry.topology,
        encodings: this.currentEntry.encodings,
        maxDepth: this.currentEntry.maxDepth,
      },
      originalDataset: this._originalDataset?.toJSON?.() ?? null,
      transformedDataset: this._transformedDataset?.toJSON?.() ?? null,
      analysisHistory: this.analysisHistory?.toJSON?.() ?? null,
      camera: {
        position: this.engine.cameraGroup.position.toArray(),
        rotationY: this.engine.cameraGroup.rotation.y,
      },
      settings: this.settingsPanel?.getAllSettings?.() ?? {},
      tour: {
        stepIndex: this.guidedTour?._stepIndex ?? 0,
        finished: this.guidedTour?._finished ?? true,
      },
      theme: this.engine.theme?.currentPreset ?? 'neonMidnight',
      panelPositions: this.panelManager?.getPanelPositions?.() ?? [],
    };

    try {
      await this.sessionStore.saveSession(id, snapshot as SessionSnapshot);
      this.vrConsole?.log?.('log', [`Session saved: ${id}`]);
      this._logInteraction('Save session', { result: id });
    } catch (err) {
      if (this._disposed) return;
      console.warn('[World] failed to save session:', err);
      this.vrConsole?.log?.('warn', [`Session save failed: ${(err as Error).message}`]);
    }
  }

  /**
   * Restore a saved session. Rebuilds the dataset, palace, camera pose, history,
   * settings, and tour progress from the snapshot.
   */
  async loadSession(id: string = 'autosave'): Promise<boolean> {
    if (this._disposed) return false;
    const snapshot = await this.sessionStore.loadSession(id);
    if (!snapshot) {
      if (this._disposed) return false;
      this.vrConsole?.log?.('log', [`No saved session: ${id}`]);
      return false;
    }

    const s = snapshot as Record<string, unknown>;
    const originalDataset = s.originalDataset as DatasetJSON | null;
    if (!originalDataset) {
      if (this._disposed) return false;
      this.vrConsole?.log?.('warn', [`Session ${id} has no dataset`]);
      return false;
    }

    const original = Dataset.fromJSON(originalDataset);
    const transformedDataset = s.transformedDataset as DatasetJSON | null;
    const transformed = transformedDataset ? Dataset.fromJSON(transformedDataset) : original.clone();

    const entryData = (s.entry ?? {}) as Record<string, unknown>;
    const entry: DatasetLoadEntry = {
      name: (entryData.name as string | undefined) ?? original.name,
      topology: (entryData.topology as string | undefined) ?? 'TABULAR',
      dataset: original,
      maxDepth: entryData.maxDepth as number | undefined,
      encodings: entryData.encodings as EncodingMapping | undefined,
    };

    this.loadDataset(entry);
    this._originalDataset = original.clone();
    this._transformedDataset = transformed.clone();

    // Restore the analysis history so undo/redo works across sessions.
    const historyData = s.analysisHistory;
    if (historyData) {
      this.analysisHistory = AnalysisHistory.fromJSON(historyData);
    } else {
      this.analysisHistory.clear();
    }
    this.narrativeStrip?.setHistory?.(this.analysisHistory);
    this._updateNarrativeStrip();

    // Re-apply the visual transform of the current history frame, if any.
    const current = this.analysisHistory.current();
    if (current) {
      this._restoreDataset(current.datasetAfter, current.operation);
    } else {
      this._restoreDataset(this._transformedDataset, 'reset');
    }

    // Restore camera pose.
    const cameraData = (s.camera ?? {}) as Record<string, unknown>;
    const cameraPos = cameraData.position as number[] | undefined;
    if (cameraPos) {
      this.engine.cameraGroup.position.fromArray(cameraPos);
    }
    const rotationY = cameraData.rotationY as number | undefined;
    if (typeof rotationY === 'number') {
      this.engine.cameraGroup.rotation.y = rotationY;
    }

    // Restore settings (including comfort and user mode).
    const settingsData = s.settings as SettingsMap | undefined;
    if (settingsData) {
      for (const [key, value] of Object.entries(settingsData)) {
        this.settingsPanel?.setSetting?.(key as keyof SettingsMap & string, value as never);
      }
      this.comfortSettingsController.apply(this.settingsPanel.getAllSettings());
      this.comfortSettingsController.applyPanelDistance(
        this.settingsPanel.getAllSettings().defaultPanelDistance
      );
    }

    // Restore theme.
    const themeName = s.theme as string | undefined;
    if (themeName && this.engine.theme?.applyPreset) {
      this.engine.theme.applyPreset(themeName);
    }

    // Restore panel layout (free-floating positions and visibility).
    const panelPositions = s.panelPositions as { title?: string; position?: number[]; visible?: boolean }[] | undefined;
    if (panelPositions && this.panelManager) {
      this.panelManager.setPanelPositions(panelPositions);
    }

    // Restore tour progress.
    const tourData = s.tour as { finished?: boolean; stepIndex?: number } | undefined;
    if (this.guidedTour && tourData && !tourData.finished) {
      this.guidedTour._stepIndex = tourData.stepIndex ?? 0;
      this.guidedTour._finished = false;
      this.guidedTour._active = true;
      this.guidedTour._cardGroup.visible = true;
      this.guidedTour._renderStep();
    }

    if (this._disposed) return true;
    this.vrConsole?.log?.('log', [`Session restored: ${id}`]);
    return true;
  }

  async deleteSession(id: string): Promise<void> {
    if (this._disposed) return;
    try {
      await this.sessionStore.deleteSession(id);
      this.vrConsole?.log?.('log', [`Session deleted: ${id}`]);
    } catch (err) {
      if (this._disposed) return;
      console.warn('[World] failed to delete session:', err);
    }
  }

  /**
   * Queue an automatic save after a short debounce. Called from actions that
   * mutate the world state.
   */
  _requestAutoSave(): void {
    if (this._disposed) return;
    if (this._sessionAutoSaveTimer) clearTimeout(this._sessionAutoSaveTimer);
    this._sessionAutoSaveTimer = setTimeout(() => this.saveSession('autosave'), 2000);
  }

  async _restoreAutoSave(): Promise<unknown> {
    try {
      const has = await this.sessionStore.hasSession('autosave');
      if (!has) return;
      if (this._disposed) return;
      this.vrConsole?.log?.('log', ['Restoring autosave...']);
      const restored = await this.loadSession('autosave');
      if (restored && !this._disposed) this.userModeController.apply();
      return restored;
    } catch (err) {
      if (this._disposed) return;
      console.warn('[World] autosave restore failed:', err);
    }
    return;
  }

  _captureSession(): void {
    this.eventBus.emit(WorldTopics.SESSION_CAPTURE);
  }

  /**
   * Capture the current renderer output as a PNG/JPEG screenshot and trigger a
   * browser download.
   */
  exportScreenshot(format: string = 'png'): void {
    try {
      const renderer = this.engine?.renderer;
      if (!renderer?.domElement?.toDataURL) {
        this.vrConsole?.log?.('warn', ['Screenshot not available']);
        return;
      }
      const isJpeg = format === 'jpeg' || format === 'jpg';
      const mime = isJpeg ? 'image/jpeg' : 'image/png';
      const ext = isJpeg ? 'jpg' : 'png';
      const dataUrl = renderer.domElement.toDataURL(mime);
      const filename = `nemosyne-${Date.now()}.${ext}`;
      downloadDataUrl(dataUrl, filename);
      this.vrConsole?.log?.('log', [`Screenshot exported: ${filename}`]);
      this._logInteraction('Export screenshot', { result: filename });
    } catch (err) {
      console.warn('[World] screenshot export failed:', err);
      this.vrConsole?.log?.('warn', [`Screenshot export failed: ${(err as Error).message}`]);
    }
  }

  /**
   * Build a JSON "analysis story" describing the current dataset, applied
   * operations, camera position, and theme.
   */
  _buildAnalysisStory(): Record<string, unknown> {
    const frames = this.analysisHistory?.frames() ?? [];
    return {
      version: 1,
      timestamp: Date.now(),
      savedAt: new Date().toISOString(),
      dataset: {
        name: this.currentEntry?.name ?? this._originalDataset?.name ?? 'dataset',
        topology: this.currentEntry?.topology ?? 'TABULAR',
        rowCount: this._transformedDataset?.rowCount ?? this._originalDataset?.rowCount ?? 0,
      },
      camera: this.engine?.cameraGroup?.position?.toArray?.() ?? [],
      theme: this.engine?.theme?.currentPreset ?? 'neonMidnight',
      operations: frames.map((f) => ({
        operation: f.operation,
        rowCountAfter: f.datasetAfter?.rowCount,
        parameters: f.parameters,
        timestamp: f.timestamp,
      })),
      telemetry: this.telemetryCollector?.getReport?.(),
    };
  }

  /**
   * Export the analysis story as a downloadable JSON file.
   */
  exportAnalysisStory(): Record<string, unknown> {
    const story = this._buildAnalysisStory();
    this.downloadAnalysisStory(story);
    this._logInteraction('Export story', { result: `nemosyne-story-${story.timestamp}.json` });
    return story;
  }

  /**
   * Download a previously-built analysis story, or build one if none provided.
   */
  downloadAnalysisStory(story: Record<string, unknown> | null = null): void {
    const data = story ?? this._buildAnalysisStory();
    const text = JSON.stringify(data, null, 2);
    const filename = `nemosyne-story-${data.timestamp}.json`;
    downloadText(text, filename, 'application/json');
    this.vrConsole?.log?.('log', [`Analysis story exported: ${filename}`]);
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
    console.log('[World] loading dataset:', entry.name ?? entry.label, entry.topology);
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

    // Build new Draco palace.
    const topology = entry.topology as TopologyType;
    const dataInput = {
      topology,
      dataset: entry.dataset,
      maxDepth: entry.maxDepth,
      encodings:
        entry.encodings ??
        getDefaultEncodings({ dataset: entry.dataset, topology }),
    };

    this.dracoNode = new DracoTopologyNode(this.engine.scene, dataInput, [0, 1.4, -3.5]);
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

    // Preserve original state so data operations can be reset.
    this._originalDataset = entry.dataset?.clone?.() ?? null;
    this._transformedDataset = this._originalDataset?.clone?.() ?? null;

    // Each loaded dataset starts a fresh analysis history.
    this.analysisHistory?.clear();

    // Attach optional TDA summary group for numeric datasets.
    this._attachTDASummary();

    // Rebuild dashboard chart panels for the new dataset.
    this._buildDashboard();

    // Sync statistical-lens visibility with the current setting.
    this._setStatisticalLensVisible(this._statisticalLensEnabled);
  }

  _attachTDASummary(): void {
    if (this.tdaGroup) {
      this.engine.scene.remove(this.tdaGroup);
      this.tdaGroup = null;
    }
    const ds = this._originalDataset;
    if (!ds || ds.numericColumns.length === 0) return;
    const numericNames = ds.numericColumns.map((c) => c.name);
    const filterName = numericNames[0];
    const featureNames = numericNames.slice(0, 3);
    const tda = buildTDASummaryGroup(ds, featureNames, filterName);
    this.tdaGroup = tda.group;
    this.tdaRecompute = tda.recompute;
    this.engine.scene.add(this.tdaGroup);
    this.tdaRecompute();
  }

  _buildDashboard(): void {
    // Tear down any existing dashboard chart panels.
    for (const mesh of this._dashboardTooltipTargets ?? []) {
      const idx = this.tooltipManager.targets.indexOf(mesh);
      if (idx >= 0) this.tooltipManager.targets.splice(idx, 1);
    }
    this._dashboardTooltipTargets = [];

    for (const entry of this.dashboardPanels ?? []) {
      this.dashboard.unregisterPanel(entry.panel);
      this.engine.input.panels = this.engine.input.panels.filter((p) => p !== entry.panel);
      disposeObject(entry.panel.mesh);
    }
    this.dashboardPanels = [];

    if (!this._originalDataset || !this.dashboard) return;
    const ds = this._originalDataset;
    const facts = this.dracoNode?.engine?.extractFacts?.(ds) ?? null;
    const numericColumnCount = facts?.numericColumns ?? ds.numericColumns.length;
    const hasTimeSeries = facts?.hasTimeSeries ?? ds.temporalColumns.length > 0;

    const panels: ChartPlanePanel[] = [];

    if (numericColumnCount > 1 || ds.numericColumns.length > 1) {
      panels.push(
        new ChartPlanePanel(this.engine.cameraGroup, ds, {
          title: 'Correlation Matrix',
          chartType: 'CORRELATION',
        })
      );
    }

    if (hasTimeSeries || ds.temporalColumns.length > 0) {
      panels.push(
        new ChartPlanePanel(this.engine.cameraGroup, ds, {
          title: 'Time Series',
          chartType: 'LINE',
        })
      );
    }

    if (panels.length === 0 && ds.numericColumns.length > 0) {
      panels.push(
        new ChartPlanePanel(this.engine.cameraGroup, ds, {
          title: `Distribution of ${ds.numericColumns[0].name}`,
          chartType: 'HISTOGRAM',
          column: ds.numericColumns[0].name,
        })
      );
    }

    for (let i = 0; i < panels.length; i++) {
      const panel = panels[i];
      panel.mesh.visible = false;
      this.engine.input.addPanel(panel);
      // Let the dashboard pick the next free visible zone so panels start in
      // front of the analyst in semicircle mode.
      this.dashboard.registerPanel(panel);
      this.dashboardPanels.push({ panel });

      // Register the panel mesh for pointer-hover labels.
      panel.mesh.userData.tooltipMeta = {
        title: panel.title,
        body: 'Drag to reposition; drop to snap',
      };
      this.tooltipManager.registerTarget(panel.mesh);
      this._dashboardTooltipTargets.push(panel.mesh);
    }
  }

  _updateDashboardDatasets(dataset: Dataset | null | undefined): void {
    for (const entry of this.dashboardPanels ?? []) {
      entry.panel.setDataset(dataset);
    }
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
      this.inPlaceHandles.build(dracoNode);
      this.inPlaceHandles.registerInteractables(this.engine.input);
      if (this.diagnostic) this.diagnostic.render();
    };

    wire();
    this.inPlaceHandles.build(dracoNode);
    this.inPlaceHandles.registerInteractables(this.engine.input);
  }

  _showDataCard(mesh: THREE.Mesh): void {
    const pointer = this.engine.input.getActivePointer();
    this.inspector.showAtNode(mesh, mesh.userData.row, pointer, 'DATA NODE');
  }

  _warpToZone(zone: string, pos: number[], operation: string | null): void {
    // First apply the data transformation that the gate represents.
    this._applyPortalOperation(operation);

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
    this.engine.input.setDwellSelection?.(options.dwellSelection ?? false);

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

  get networkManager(): NetworkManagerLike | null {
    return this.collaborationCoordinator?.networkManager ?? null;
  }

  undoAnalysis(): void {
    if (!this.analysisHistory.canUndo) return;
    const frame = this.analysisHistory.undo();
    if (!frame) return;
    this._restoreDataset(frame.dataset, frame.operation);
    this._updateNarrativeStrip();
    this.vrConsole?.log?.('log', [`Undo: ${frame.operation}`]);
    this._logInteraction('Undo', { result: frame.operation });
  }

  redoAnalysis(): void {
    if (!this.analysisHistory.canRedo) return;
    const frame = this.analysisHistory.redo();
    if (!frame) return;
    this._restoreDataset(frame.dataset, frame.operation);
    this._updateNarrativeStrip();
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
    switch (operation) {
      case 'filter':
        applyFilter(this.dracoNode.artifact!, transformedDataset);
        break;
      case 'sort':
        applySort(this.dracoNode.artifact!, transformedDataset);
        break;
      case 'aggregate':
        applyAggregate(this.dracoNode.artifact!, transformedDataset);
        break;
      case 'cluster':
        applyCluster(this.dracoNode.artifact!, transformedDataset);
        break;
      case 'hierarchical':
        applyHierarchicalCluster(this.dracoNode.artifact!, transformedDataset);
        break;
      case 'density':
        applyDensityCluster(this.dracoNode.artifact!, transformedDataset);
        break;
      case 'anomaly':
        applyAnomaly(this.dracoNode.artifact!, transformedDataset);
        break;
      case 'timeSlice':
        applySlice(this.dracoNode.artifact!, transformedDataset, this._originalDataset ?? transformedDataset);
        break;
      case 'reset':
      default:
        resetTransforms(this.dracoNode.artifact!);
        break;
    }

    this._updateDashboardDatasets(transformedDataset);
    if (this.tdaRecompute && operation !== 'anomaly') {
      this.tdaRecompute();
    }
  }

  _seekAnalysisHistory(index: number): void {
    const frame = this.analysisHistory?.seek?.(index);
    if (!frame) return;
    this._restoreDataset(frame.dataset, frame.operation);
    this._updateNarrativeStrip();
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
        this._updateDashboardDatasets(this._transformedDataset);
        if (this.tdaRecompute && operation !== 'anomaly') this.tdaRecompute();
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
  }

  _buildWheelMenu(): void {
    this.uiManager.buildWheelMenu([
      {
        id: 'panels',
        label: 'Panels',
        icon: '🪟',
        items: [
          {
            id: 'launcher',
            label: 'Launcher',
            icon: '🚀',
            callback: () => this.panelManager.toggleLauncher(),
          },
          {
            id: 'settings',
            label: 'Settings',
            icon: '⚙️',
            callback: () => this._toggleSettingsPanel(),
          },
          {
            id: 'operation-log',
            label: 'Log',
            icon: '📝',
            callback: () => this.panelManager.togglePanel(this.operationLogPanel),
          },
          {
            id: 'telemetry',
            label: 'Telemetry',
            icon: '📊',
            callback: () => this.panelManager.togglePanel(this.metricsPanel),
          },
          {
            id: 'performance',
            label: 'Perf',
            icon: '⏱️',
            callback: () => this.panelManager.togglePanel(this.performancePanel),
          },
          {
            id: 'interaction-coach',
            label: 'Coach',
            icon: '🎓',
            callback: () => this.panelManager.togglePanel(this.interactionCoach),
          },
          { id: 'tour', label: 'Tour', icon: '📍', callback: () => this.startTour() },
          {
            id: 'narrative-strip',
            label: 'Timeline',
            icon: '🎞️',
            callback: () => this.panelManager.togglePanel(this.narrativeStrip),
          },
          {
            id: 'recenter',
            label: 'Recenter',
            icon: '🎯',
            callback: () => this.panelManager.recenter(),
          },
          {
            id: 'scroll-dashboard-left',
            label: '◀ Dash',
            icon: '⬅️',
            callback: () => this.dashboard.scrollBySlots(-1),
          },
          {
            id: 'scroll-dashboard-right',
            label: 'Dash ▶',
            icon: '➡️',
            callback: () => this.dashboard.scrollBySlots(1),
          },
          {
            id: 'reset-dashboard',
            label: 'Reset Dash',
            icon: '↺',
            callback: () => this.dashboard.resetDashboard(),
          },
          {
            id: 'save-session',
            label: 'Save',
            icon: '💾',
            callback: () => this.saveSession('manual'),
          },
          {
            id: 'load-session',
            label: 'Load',
            icon: '⏮️',
            callback: () => this.loadSession('autosave'),
          },
          {
            id: 'delete-autosave',
            label: 'New',
            icon: '🆕',
            callback: () => this.deleteSession('autosave'),
          },
          {
            id: 'export-screenshot',
            label: 'Screenshot',
            icon: '📸',
            callback: () => this.exportScreenshot(),
          },
          {
            id: 'export-story',
            label: 'Story',
            icon: '📤',
            callback: () => this.exportAnalysisStory(),
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
          callback: () => this.loadTemplate(t.id),
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
            callback: () => this.setPortalsEnabled(!this.portalsEnabled),
          },
          { id: 'dataset', label: 'Dataset', icon: '💎', callback: () => this._cycleDataset() },
          {
            id: 'cycle-theme',
            label: 'Theme',
            icon: '🎨',
            callback: () => this._cycleThemePreset(),
          },
          {
            id: 'teleport-toggle',
            label: 'Teleport',
            icon: '📡',
            callback: () => this.engine.locomotion.toggleTeleport(),
          },
          {
            id: 'teleport-overview',
            label: 'Overview',
            icon: '🌍',
            callback: () => this.engine.locomotion.teleportToAnchor('overview'),
          },
          {
            id: 'teleport-detail',
            label: 'Detail',
            icon: '🔎',
            callback: () => this.engine.locomotion.teleportToAnchor('detail'),
          },
          {
            id: 'teleport-north',
            label: 'North',
            icon: '⬆️',
            callback: () => this.engine.locomotion.teleportToAnchor('north'),
          },
          {
            id: 'teleport-south',
            label: 'South',
            icon: '⬇️',
            callback: () => this.engine.locomotion.teleportToAnchor('south'),
          },
          {
            id: 'toggle-mini-overview',
            label: 'Overview',
            icon: '🗺️',
            callback: () => this._toggleMiniOverview(),
          },
          {
            id: 'toggle-peer-presence',
            label: 'Peers',
            icon: '👥',
            callback: () => this._togglePeerPresenceHUD(),
          },
          {
            id: 'toggle-desktop-preview',
            label: 'Preview',
            icon: '🖥️',
            callback: () => this._toggleDesktopPreview(),
          },
          {
            id: 'toggle-flight',
            label: 'Flight',
            icon: '🚀',
            callback: () => this.engine.locomotion.toggleFlight(),
          },
          {
            id: 'drop-to-floor',
            label: 'Floor',
            icon: '🧱',
            callback: () => this.engine.locomotion.dropToFloor(),
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
            label: this.isLiveConnected() ? 'Stop' : 'Start',
            icon: this.isLiveConnected() ? '⏹️' : '▶️',
            callback: () =>
              this.isLiveConnected() ? this.disconnectLiveStream() : this.connectLiveStream(),
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
            label: this.collaborationCoordinator.isConnected() ? 'Leave' : 'Join',
            icon: this.collaborationCoordinator.isConnected() ? '🚪' : '🔗',
            callback: () =>
              this.collaborationCoordinator.isConnected()
                ? this._leaveCollaborationRoom()
                : this._joinCollaborationRoom(),
          },
          {
            id: 'collab-panel',
            label: 'Network',
            icon: '🌐',
            callback: () => this.panelManager.togglePanel(this.networkPanel),
          },
        ],
      },
      {
        id: 'ops',
        label: 'Ops',
        icon: '⚙️',
        items: (() => {
          const opItem = (id: string, label: string, icon: string, op: string) => ({
            id,
            label,
            icon,
            callback: () => this.applyDataOperation(op),
            onHover: () => this.previewDataOperation(op),
            onLeave: () => this.clearOperationPreview(),
          });
          return [
            opItem('filter', 'Filter', '🔎', 'filter'),
            opItem('sort', 'Sort', '📶', 'sort'),
            opItem('aggregate', 'Aggregate', '📚', 'aggregate'),
            opItem('cluster', 'Cluster', '🔷', 'cluster'),
            opItem('hierarchical', 'Hierarchy', '🌳', 'hierarchical'),
            opItem('density', 'Density', '⚫', 'density'),
            opItem('anomaly', 'Anomaly', '⚡', 'anomaly'),
            opItem('timeSlice', 'Slice', '🕒', 'timeSlice'),
            { id: 'reset', label: 'Reset', icon: '↺', callback: () => this.resetDataOperation() },
          ];
        })(),
      },
    ]);
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
   * Tear down the world and all async resources. Production code rarely calls
   * this, but tests need it to avoid timers, live streams, and collaboration
   * connections logging after the environment has been torn down.
   */
  async dispose(): Promise<void> {
    if (this._disposed) return;
    this._disposed = true;

    // Stop any pending auto-save and live flushes before they log.
    if (this._sessionAutoSaveTimer) {
      clearTimeout(this._sessionAutoSaveTimer);
      this._sessionAutoSaveTimer = null;
    }
    this.liveStreamCoordinator?.disconnectLiveStream?.();
    this.collaborationCoordinator?.leaveCollaborationRoom?.();

    // Detach telemetry global listeners so late window errors are not recorded.
    this.telemetryCollector?.setEnabled?.(false);

    // Wait for async init work to finish so it cannot log after disposal.
    await Promise.allSettled(this._initPromises);
    this._initPromises = [];

    this.engine.dispose();
  }

  async start(): Promise<void> {
    // Initialise the Rust/WASM runtime in parallel with engine start. If the
    // binary is missing (e.g. plain Vite build without wasm-pack) or the host
    // rejects it, fall back to the existing JS data layer.
    const wasmInitPromise = this._initWasmRuntime().catch((err) => {
      console.warn('[World] WASM runtime unavailable, using JS fallbacks:', err);
      this._wasmCapabilities = 0;
    });

    this.engine.start();

    await wasmInitPromise;
  }

  /**
   * Initialise the WASM runtime and record the enabled capability set.
   */
  async _initWasmRuntime(): Promise<void> {
    // Load the bridge lazily so that production builds which skip wasm-pack
    // still start without a missing-module error at import time.
    const bridge = await import('../wasm/RuntimeBridge.js');
    if (bridge.isReady()) {
      this._wasmRuntime = bridge;
      this._wasmCapabilities = bridge.capabilities();
      this.dataOperationController?.setWasmRuntime?.(bridge, this._wasmCapabilities);
      this.loader?.setWasmRuntime?.(bridge, this._wasmCapabilities);
      return;
    }

    // In dev, Vite serves the wasm-pack output at /wasm/nemosyne_wasm_bg.wasm.
    // In production builds that skip wasm-pack this fetch will fail and the
    // app will transparently fall back to the JS data layer.
    await bridge.initRuntime('/wasm/nemosyne_wasm_bg.wasm');
    this._wasmRuntime = bridge;
    this._wasmCapabilities = bridge.capabilities();
    this.dataOperationController?.setWasmRuntime?.(bridge, this._wasmCapabilities);
    this.loader?.setWasmRuntime?.(bridge, this._wasmCapabilities);
    this.vrConsole?.log?.('log', [
      `WASM ready — capabilities ${this._wasmCapabilities.toString(2)}`,
    ]);
  }

  /**
   * If the WASM data layer is ready and the dataset is a built-in sample key,
   * load it from Rust. Otherwise return the original JS entry unchanged.
   *
   * @param {object} entry
   * @returns {object}
   */
  _maybeLoadSampleFromWasm(entry: DatasetLoadEntry): DatasetLoadEntry {
    if (!entry?.key) return entry;
    if (!this._wasmCapabilities || (this._wasmCapabilities & CAP_DATASET_RUST) === 0) {
      return entry;
    }
    const bridge = this._wasmRuntime;
    if (!bridge || !bridge.isReady()) return entry;

    try {
      const handle = bridge.loadSample(entry.key);
      if (handle === 0) return entry;

      try {
        const json = bridge.getDatasetJson(handle);
        if (!json) return entry;
        const dataset = Dataset.fromJSON(json);
        return { ...entry, dataset };
      } finally {
        bridge.destroyDataset(handle);
      }
    } catch (e) {
      console.warn('[World] WASM sample load panic, falling back to JS:', e);
      return entry;
    }
  }
}
