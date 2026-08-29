import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Engine } from './Engine.ts';
import { LoadDatasetUseCase } from '../app/dataset/LoadDatasetUseCase.ts';
import { RepresentationSurface } from './presentation/representation/RepresentationSurface.ts';
import { MonetaTopologyNode as DracoTopologyNode } from '../moneta/MonetaTopologyNode.ts';
import { MonetaDiagnosticHUD as DracoDiagnosticHUD } from './ui/MonetaDiagnosticHUD.ts';
import { TooltipManager } from './ui/TooltipManager.ts';
import { ChartPlanePanel } from './ui/ChartPlanePanel.ts';
import { FileLoaderUI } from '../ui/FileLoader.ts';
import {
  supplyChainHierarchy,
  allSampleDatasets,
  getDefaultEncodings,
} from '../data/SampleDatasets.ts';
import { resolveTemplate } from '../data/AnalysisTemplates.ts';
import { TopologyTypes } from '../moneta/ConstraintEngine.ts';
import {
  LiveStreamCoordinator,
  type LiveConnectorLike,
  type LiveStreamOptions,
} from './coordinators/LiveStreamCoordinator.ts';
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
import {
  VALIDATION_SESSION_LABEL_HEADER,
  VALIDATION_SESSION_ID_HEADER,
  readValidationSessionEnv,
} from '../validation/validation-session.ts';
import { InPlaceOperationHandles } from './interactions/InPlaceOperationHandles.ts';
import { LivePreview } from './interactions/LivePreview.ts';
import { FocusContextController } from './interactions/FocusContextController.ts';
import { SemanticTargetResolver } from './input/SemanticTargetResolver.ts';
import {
  CollaborationCoordinator,
  type NetworkManagerLike,
} from './coordinators/CollaborationCoordinator.ts';
import { DataOperationController } from './coordinators/DataOperationController.ts';
import { WorldUIManager } from './coordinators/WorldUIManager.ts';
import { WorldSceneComposer } from './coordinators/WorldSceneComposer.ts';
import { WorldSessionController } from './coordinators/WorldSessionController.ts';
import { MarkMomentAction } from './interactions/MarkMomentAction.ts';
import type { Observation } from '../atlas/types.ts';
import {
  parseApplicationAnalysisOperation,
  type ApplicationIntentDispatcher,
} from '../app/intents/ApplicationIntent.ts';
import { GuidedTourController } from './coordinators/GuidedTourController.ts';
import { WorldLandmarkController } from './coordinators/WorldLandmarkController.ts';
import { AnalysisStoryExporter } from './coordinators/AnalysisStoryExporter.ts';
import { buildIntentWheelMenuCategories } from './coordinators/WheelMenuBuilder.ts';
import { WorldEventBus, WorldTopics } from '../utils/EventBus.ts';
import { SceneGraphController } from './coordinators/SceneGraphController.ts';
import { WorkspaceManager } from './coordinators/WorkspaceManager.ts';
import { WorldRendererLifecycle } from './coordinators/WorldRendererLifecycle.ts';
import { DerivedAnalysisPipeline } from './coordinators/DerivedAnalysisPipeline.ts';
import { WorldLifecycleOwner, type WorldBootState } from './coordinators/WorldLifecycleOwner.ts';
import {
  LoadTestDriver,
  type LoadTestProfile,
  type LoadTestSummary,
} from './scalability/LoadTestDriver.ts';
import { QuestBoundaryProbe, type QuestBoundarySummary } from './scalability/QuestBoundaryProbe.ts';
import { DatumPlane } from './artifacts/DatumPlane.ts';
import { TechnoCoreNode } from './artifacts/TechnoCoreNode.ts';
import { IceVaultNode } from './artifacts/IceVaultNode.ts';
import { FarcasterPortal } from './artifacts/FarcasterPortal.ts';
import { HolographicInspector } from './artifacts/HolographicInspector.ts';
import type { ProvenanceProvider, ProvenanceEntry, EvidenceEntry } from './artifacts/HolographicInspector.ts';
import type { ResearchEvent } from '../atlas/types.ts';
import type { TopologyType } from '../data/types.ts';
import { DatasetSpace } from '../atlas/DatasetSpace.ts';
import { AtlasCore } from '../atlas/AtlasCore.ts';
import { WorkerAnalyticalPort, type WorkerTransport } from '../atlas/ports/WorkerAnalyticalPort.ts';
import { NemosyneSession } from '../session/NemosyneSession.ts';
import {
  InvestigationReplayRunner,
  type ReplayVerificationResult,
} from '../session/InvestigationReplayRunner.ts';
import { VaultArchiveStore } from '../session/index.ts';
import type {
  ArtifactRef,
  DatasetLoadEntry,
  HandLike,
  PanelLike,
  SettingsMap,
  TelemetryCollectorLike,
  WorldEventBusLike,
} from './coordinators/types.ts';
import type { InteractionMode, FocusState } from './input/InteractionModeController.ts';
import { KernelLayoutUnavailableError } from '../moneta/layouts/LayoutBase.ts';
import type { RepresentationRequirements } from '../moneta/representation/RepresentationRequirements.ts';
import { createDefaultRequirements } from '../moneta/representation/RepresentationRequirements.ts';
import type { InvestigatorActionableOutcome } from '../moneta/representation/ActionableNil.ts';
import { buildRemediationProvenance } from '../moneta/representation/ActionableNil.ts';

type WorldRuntimeBridge = typeof import('../wasm/RuntimeBridge.ts');

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
  loadDatasetUseCase: LoadDatasetUseCase;
  representationSurface!: RepresentationSurface;
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
  loadTestDriver!: LoadTestDriver;
  questBoundaryProbe!: QuestBoundaryProbe;
  inputCoordinator: WorldInputCoordinator;
  userModeController: UserModeController;
  comfortSettingsController: ComfortSettingsController;
  adaptiveAssist: AdaptiveAssistController;
  tooltipManager: TooltipManager;
  inPlaceHandles: InPlaceOperationHandles;
  livePreview: LivePreview;
  /** RF-025: P1-F semantic targeting + focus/context layer installed on the input router. */
  semanticResolver!: SemanticTargetResolver;
  focusContext!: FocusContextController;
  portalsEnabled: boolean;
  _datasetCycleIndex: number;
  _wasmCapabilities: number;
  _wasmRuntime: WorldRuntimeBridge | null;
  _wasmUnavailable: boolean;
  _lastSelectedMesh: THREE.Mesh | null = null;
  _activeRequirements: RepresentationRequirements = createDefaultRequirements('individual-inspection');
  _activeOutcome: InvestigatorActionableOutcome | null = null;
  _previewedRequirements: RepresentationRequirements | null = null;
  _previewedRemediationAction: import('../moneta/representation/ActionableNil.ts').RemedialAction | null = null;
  _previewedDecision: import('../moneta/representation/RepresentationDecision.ts').RepresentationDecision | null = null;
  _lastLoadedEntry: DatasetLoadEntry | null = null;
  liveStreamCoordinator: LiveStreamCoordinator;
  collaborationCoordinator: CollaborationCoordinator;
  landmarkController!: WorldLandmarkController;
  tourController!: GuidedTourController;
  sessionController!: WorldSessionController;
  /** Vault archive store for managing frozen investigation snapshots (P1-U6). */
  archiveStore: VaultArchiveStore;
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
  _autosaveRestoreStarted: boolean;
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
  derivedAnalysisPipeline: DerivedAnalysisPipeline;
  lifecycle: WorldLifecycleOwner;
  _desktopPreviewSavedPose!: { position: THREE.Vector3; yaw: number; pitch: number } | null;
  _orbitControls!: OrbitControls | null;
  dracoNode!: DracoTopologyNode | null;
  diagnostic!: DracoDiagnosticHUD | null;
  currentEntry!: DatasetLoadEntry | null;
  tdaGroup!: THREE.Group | null;
  tdaRecompute!: (() => Promise<import('./artifacts/TDAPlanes.ts').TDAComputationResult | null>) | null;
  dashboardPanels!: { panel: ChartPlanePanel }[];
  _lastLoadTestSummary: LoadTestSummary | null = null;
  _lastQuestBoundarySummary: QuestBoundarySummary | null = null;
  _telemetryConsentBeforeRun: boolean | null = null;
  /**
   * Canonical application-intent dispatcher, injected by the bootstrap
   * composition root after World construction. When set, mutating commands
   * (analysis ops, reset/undo/redo, dataset cycle, lens toggle) funnel through
   * this single command authority; null keeps pre-bootstrap behavior.
   */
  dispatchIntent: ApplicationIntentDispatcher | null = null;

  get bootState(): WorldBootState {
    return this.lifecycle.state;
  }

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
    this.atlas = new AtlasCore({
      kernel: null,
      eventBus: this.eventBus as WorldEventBus,
      onKernelFailure: (error) => this.markKernelUnavailable(error),
    });

    this.loadDatasetUseCase = new LoadDatasetUseCase(this.atlas);

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
      onSemanticWarp: (target) => this._onSemanticWarp(target),
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
      this.engine,
      {
        getWasmMemoryBytes: () => {
          try {
            return this._wasmRuntime?.memory?.().buffer.byteLength ?? null;
          } catch {
            return null;
          }
        },
      }
    );
    this.engine.addUpdatable(this.loadTestDriver);
    this.questBoundaryProbe = new QuestBoundaryProbe(this.engine, this.eventBus);
    this.engine.addUpdatable(this.questBoundaryProbe);
    this.engine.telemetry = this.telemetryCollector;

    // UI manager owns all HUD panels, dashboard, and wheel menu. It is created
    // early so later code can access panel references through the facade.
    this.uiManager = new WorldUIManager(this.engine, this.analystAnchor, this.eventBus, {
      onLoadDataset: (entry) => this.loadDataset(entry as DatasetLoadEntry),
      onTogglePortals: (enabled) => this.setPortalsEnabled(enabled),
      onConnectStream: () => this.connectLiveStream(),
      onDisconnectStream: () => this.disconnectLiveStream(),
      onSelectLiveSource: (sourceKey) => this.connectLiveSource(sourceKey),
      onFilter: () => this._dispatchAnalysis('filter'),
      onSort: () => this._dispatchAnalysis('sort'),
      onAggregate: () => this._dispatchAnalysis('aggregate'),
      onCluster: () => this._dispatchAnalysis('cluster'),
      onHierarchicalCluster: () => this._dispatchAnalysis('hierarchical'),
      onDensityCluster: () => this._dispatchAnalysis('density'),
      onAnomaly: () => this._dispatchAnalysis('anomaly'),
      onTimeSlice: () => this._dispatchAnalysis('timeSlice'),
      onCompare: () => this._dispatchAnalysis('compare'),
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
      onStartQuestBoundary: () => this.runQuestBoundaryProbe(),
      onStopLoadTest: () => this.stopLoadTest(),
      onFlushLoadTest: () => this.flushLastLoadTestSummary(),
      getRecommendation: () => this.atlas.activeRecommendation ?? null,
      getOutcome: () => this._activeOutcome,
      onAcceptRecommendation: () => this._acceptRecommendation(),
      onRejectRecommendation: () => this._rejectRecommendation(),
      onOverrideRecommendation: () => this._overrideRecommendation(),
      onGenerateRecommendation: () => this._generateRecommendation(),
      onApplyRemediation: (action) => this._applyRemediation(action),
      onPreviewRemediation: (action) => this._previewRemediation(action),
      onCommitRemediation: (action) => this._commitRemediation(action),
      onCancelRemediationPreview: () => this._cancelRemediationPreview(),
      onExitVR: () => this.exitVR(),
      frustrationAnalyzer: this.telemetryCollector.frustrationAnalyzer,
      getDataset: () => this.atlas.dataset,
      applySchemaMapping: (updated) => this.applySchemaMapping(updated),
      onInspectNode: (data) => {
        if (this._lastSelectedMesh) {
          const pointer = this.engine.input.getActivePointer();
          this.uiManager.contextualTaskSurface.hide();
          this.inspector.showAtNode(this._lastSelectedMesh, data, pointer, 'DATA NODE');
        }
      },
      onRecordFinding: (data) => {
        const row = (data ?? {}) as Record<string, unknown> | null;
        const identity = row?.id ?? row?.name ?? null;
        const note =
          identity != null
            ? `Recorded finding at node ${String(identity)}`
            : 'Recorded finding from contextual task surface';
        this.markMoment(note, identity != null ? [String(identity)] : undefined);
        this.inputCoordinator.callbacks.onRecordAction?.('Record Finding');
        this.uiManager.vrConsole?.log?.('log', ['Finding recorded to ledger']);
        this.uiManager.contextualTaskSurface.hide();
      },
      onNavigateNode: (_data) => {
        this.inputCoordinator.callbacks.onApplyOperation?.('timeSlice');
        this.uiManager.contextualTaskSurface.hide();
      },
      getDracoNode: () => this.dracoNode,
      onFreezeInvestigation: () => this._freezeInvestigation(),
      onRestoreArchive: (archiveId) => this._restoreArchive(archiveId),
      onExportArchive: (archiveId) => this._exportArchive(archiveId),
      onDeleteArchive: (archiveId) => this._deleteArchive(archiveId),
      onShowConstraints: () => this.uiManager.showConstraintsPanel(),
    });

    // Input coordinator owns gesture recognition, context-aware suppression, and
    // the mapping from gestures/commands to world actions.
    this.inputCoordinator = new WorldInputCoordinator(this.engine, this.eventBus, {
      getSetting: (key) => this.uiManager.settingsPanel?.getSetting?.(key),
      getDracoGroup: () => this.dracoNode?.group ?? null,
      getArtifact: () => this.dracoNode?.artifact ?? null,
      getHandWheelMenu: () => this.uiManager.handWheelMenu,
      callbacks: {
        onApplyOperation: (op) => this._dispatchAnalysis(op),
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
        onLog: (msg) => this.uiManager.vrConsole?.log?.('log', Array.isArray(msg) ? msg : [msg]),
        onCaptureSession: () => this._requestAutoSave(),
        onCommitSelection: () => this._commitSelection(),
        onToggleTransformHandle: () => this._toggleTransformHandle(),
        onRecordAction: (action, next) => this.uiManager.statusStrip.recordAction(action, next),
        onModeChanged: (mode) => this.uiManager.statusStrip.setInteractionMode(mode),
      },
    });
    this.engine.uiManager = this.uiManager;

    // Wire the HolographicInspector (owned by the scene composer) into the
    // workspace budget controller owned by the UI manager, so the live
    // open/close paths enforce the analyst panel budget for SpatialPanels.
    this.sceneComposer.inspector.budgetController = this.uiManager.panelBudgetController;
    // Wire session-level provenance/evidence sourced from the authoritative
    // atlas evidence ledger into the inspector's Provenance/Evidence tabs.
    // Node-scoped provenance is a P1-U3 residual (structure-id↔row join).
    this.sceneComposer.inspector.provenanceProvider = this._buildProvenanceProvider();
    // Footer actions for the inspector's Compare/Challenge/Annotate buttons,
    // routed through the same canonical command authority (dispatcher when the
    // bootstrap has injected it) and the authoritative evidence ledger.
    this.sceneComposer.inspector.inspectorActions = {
      onCompare: () => this._dispatchAnalysis('compare'),
      onChallenge: () => this._dispatchAnalysis('anomaly'),
      onAnnotate: () => {
        const row = this._lastSelectedMesh?.userData?.row as
          | Record<string, unknown>
          | undefined;
        const identity = row?.id ?? row?.name ?? 'selected node';
        const pos = new THREE.Vector3();
        this.engine.camera.getWorldPosition(pos);
        this.atlas.recordAnnotation({
          text: `Inspector annotation on node ${String(identity)}`,
          position: [pos.x, pos.y, pos.z],
          targetId: String(identity),
        });
      },
    };

    // User-mode controller applies novice/intermediate/expert policies to the
    // coach, tour, and tooltips.
    this.userModeController = new UserModeController(this.eventBus as WorldEventBus, {
      getUserMode: () => this.uiManager.settingsPanel?.getSetting?.('userMode') ?? 'novice',
      getTourState: () => ({
        isActive: this.guidedTour?.isActive ?? false,
        isFinished: this.guidedTour?.isFinished ?? false,
      }),
      startTour: () => this.startTour(),
      skipTour: () => this.guidedTour?.skip?.(),
      setCoachMode: (mode) => this.uiManager.interactionCoach?.setUserMode?.(mode),
      setTourMode: (mode) => this.guidedTour?.setUserMode?.(mode),
      setTooltipEnabled: (enabled) => this.tooltipManager?.setEnabled?.(enabled),
      hideCoachPanel: () => {
        if (this.uiManager.interactionCoach) {
          this.uiManager.panelManager?.hidePanel?.(this.uiManager.interactionCoach);
        }
      },
    });

    // Comfort settings controller applies snap turn, vignette, seated height,
    // and panel distance to the engine/locomotion and analyst anchor.
    this.comfortSettingsController = new ComfortSettingsController(
      this.engine,
      this.analystAnchor,
      this.sceneComposer
    );

    this.adaptiveAssist = new AdaptiveAssistController({
      engine: this.engine,
      eventBus: this.eventBus,
      analystAnchor: this.analystAnchor,
      scene: this.engine.scene,
      analyzer: this.telemetryCollector.frustrationAnalyzer,
      isAssistEnabled: () => this.telemetryCollector.enabled,
    });
    this.uiManager.bindAdaptiveAssist(this.adaptiveAssist);

    this.tooltipManager = new TooltipManager(this.engine.camera);
    this.tooltipManager.mount(this.engine.scene);
    this.tooltipManager.setPointerRaycaster(this.engine.input.raycaster);
    this.engine.addUpdatable(this.tooltipManager);

    this.rendererLifecycle = new WorldRendererLifecycle({
      engine: this.engine,
      dashboard: this.uiManager.dashboard,
      tooltipManager: this.tooltipManager,
      getOriginalDataset: () => this._originalDataset,
      getDracoNode: () => this.dracoNode,
      getAtlas: () => this.atlas,
    });

    // In-place operation handles near data artefacts for direct manipulation.
    this.inPlaceHandles = new InPlaceOperationHandles(this.engine.scene, this.engine.camera, {
      userMode:
        (this.uiManager.settingsPanel?.getSetting?.('userMode') as 'novice' | 'expert') ?? 'novice',
      onOperation: (op) => this._dispatchAnalysis(op),
      onOperationHover: (op) => this.dataOperationController.preview(op),
      onOperationLeave: () => this.dataOperationController.clearPreview(),
      onStructureCommand: (structureId, action) =>
        this._executeStructureCommand(structureId, action),
    });
    this.engine.addUpdatable({
      update: (delta: number, time: number) =>
        this.inPlaceHandles.update(delta, time, this.engine.input.raycaster.ray),
    });

    this.representationSurface = new RepresentationSurface({
      scene: this.engine.scene,
      cameraGroup: this.engine.cameraGroup,
      analystAnchor: this.analystAnchor,
      getColorblindMode: () =>
        this.uiManager.settingsPanel?.getSetting?.('colorblindMode') ?? 'none',
      getFactProvider: () => this.atlas.asFactProvider(),
      addUpdatable: (node) => this.engine.addUpdatable(node),
      removeUpdatable: (node) => this.engine.removeUpdatable(node),
      addInteractable: (mesh, options) => this.engine.addInteractable(mesh, options as never),
      removeInteractable: (mesh) => this.engine.removeInteractable(mesh),
      addDiagnosticPanel: (panel) => this.engine.input.addPanel(panel),
      removeDiagnosticPanel: (panel) => this.engine.input.removePanel(panel),
      setTooltipTargets: (meshes) => this.tooltipManager.setTargets(meshes),
      clearStructureHandles: () => {
        this.inPlaceHandles.unregisterInteractables(this.engine.input);
        this.inPlaceHandles.clear();
      },
      rebuildStructureHandles: (node) => this._rebuildStructureHandles(node),
      onSelectNode: (mesh) => this._showDataCard(mesh),
    });

    this.derivedAnalysisPipeline = new DerivedAnalysisPipeline({
      atlas: this.atlas,
      rendererLifecycle: this.rendererLifecycle,
      markRecommendationDirty: () => this.uiManager.recommendationPanel?.markDirty?.(),
      publishStructureHandles: () => {
        if (this.dracoNode && this.atlas.structures.length > 0) {
          this.inPlaceHandles.buildFromStructures(this.dracoNode, this.atlas.structures as never);
          this.inPlaceHandles.registerInteractables(this.engine.input as never);
        }
      },
      onError: (error, request) => {
        console.warn(
          `[RF-061] derived analysis failed for v${request.datasetVersion} ${request.operation}:`,
          error
        );
      },
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
      onLoad: (entry: unknown) =>
        this.loadDataset(this._maybeLoadSampleFromWasm(entry as DatasetLoadEntry)),
      atlas: this.atlas,
    });

    // Teleport anchors around the palace.
    this._setupTeleportAnchors();

    // System gesture (controller grip or two-hand pinch) toggles launcher ring.
    this.engine.input.onSystemToggle = () => this._togglePanels();

    // RF-025: install the P1-F semantic targeting + focus/context layer on the
    // real picking path. The resolver re-ranks the full scene hit list with
    // coercion + hysteresis (the precision escape hatch is preserved — the
    // resolver only re-ranks existing hits); structure-kind selection drives
    // the focus/context controller, which navigates the Memory Palace and
    // persists durable focus state into the session snapshot.
    this.semanticResolver = new SemanticTargetResolver();
    this.focusContext = new FocusContextController();
    this.engine.input.setSemanticTargeting(this.semanticResolver, this.focusContext);
    this.engine.input.onFocusChange = (state) => {
      // Record the Memory Palace navigation in the session interaction log so
      // the focus/context transition is part of the reproducible investigation
      // record, then persist the durable focus snapshot.
      this._logInteraction('Focus structure', {
        result: `level=${state.currentLevel} structure=${state.focusedStructureId ?? 'none'}`,
      });
      this._requestAutoSave();
    };

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
    this._autosaveRestoreStarted = false;
    this._disposed = false;
    this.lifecycle = new WorldLifecycleOwner({
      startEngine: () => this.engine.start(),
      initializeKernel: (generation) => this._initWasmRuntime(generation),
      onKernelUnavailable: (error) => this._onKernelUnavailable(error),
      onDisposing: () => {
        this._disposed = true;
      },
      teardown: () => this._teardown(),
    });

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
    this._applyFeedbackSettings(this.uiManager.settingsPanel.getAllSettings());
    // The settings panel is toggled on demand; do not show it at startup.
    this.uiManager.settingsPanel.hide();

    // Guided tour: step-by-step spatial onboarding.
    this.tourController = new GuidedTourController(this);
    this.guidedTour = new GuidedTour(this.engine, {
      analystAnchor: this.analystAnchor,
      feedback: this.engine.input.feedback,
      tour: FIRST_DATASET_TOUR,
      resolveTarget: (target: string) => this.tourController.resolveTarget(target),
      checkCondition: (step: TourStep) => this.tourController.checkCondition(step),
      onComplete: () => this.uiManager.vrConsole?.log?.('log', ['Tour complete']),
    });
    this.engine.addUpdatable(this.guidedTour);
    this.engine.addHudObject(this.guidedTour);
    this.engine.guidedTour = this.guidedTour;

    // Authoritative logical session (Wave 4): wraps AtlasCore + presentation
    // state and owns the schemaVersion-2 snapshot. Constructed before the
    // session controller so it can read `this.session`.
    this.session = new NemosyneSession({ atlas: this.atlas });

    /** Vault archive store for managing frozen investigation snapshots (P1-U6). */
    this.archiveStore = new VaultArchiveStore(this.sessionStore);

    // Session save/load/autosave coordinator (reads facade members lazily).
    this.sessionController = new WorldSessionController(this);

    // Track whether the guided tour has been auto-started for novice users.
    this._tourAutoStarted = false;

    try {
      this.loadDataset(DEFAULT_DATASET_ENTRY);
    } catch (error) {
      if (!(error instanceof KernelLayoutUnavailableError)) throw error;
      this.currentEntry = DEFAULT_DATASET_ENTRY;
      this.dracoNode = null;
      this.diagnostic = null;
      console.warn('[World] initial dataset staged until the analytical kernel is ready');
    }

    // Apply the initial user mode (novice by default) to the coach, tooltips,
    // and tour visibility.
    this.userModeController.apply();

    // Apply initial comfort and panel-distance settings from the saved/default
    // settings panel values.
    this.comfortSettingsController.apply(this.uiManager.settingsPanel.getAllSettings());
    this.comfortSettingsController.applyPanelDistance(
      this.uiManager.settingsPanel.getAllSettings().defaultPanelDistance
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

  async _restoreAutoSaveOnce(): Promise<void> {
    if (this._autosaveRestoreStarted || this._disposed) return;
    this._autosaveRestoreStarted = true;
    await this._restoreAutoSave();
  }

  _captureSession(): void {
    this.eventBus.emit(WorldTopics.SESSION_CAPTURE);
  }

  /**
   * Capture the current renderer output as a PNG/JPEG screenshot and trigger a
   * browser download.
   */
  exportScreenshot(format: string = 'png'): void {
    AnalysisStoryExporter.exportScreenshot(
      this.engine,
      this.uiManager.vrConsole,
      this._logInteraction,
      format
    );
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

  async replayPortableInvestigation(bytes: Uint8Array): Promise<ReplayVerificationResult> {
    const runtime = this._wasmRuntime;
    if (!runtime || !this.atlas.isReady()) {
      throw new Error('Analytical kernel unavailable; cannot verify investigation replay');
    }
    return new InvestigationReplayRunner(runtime).replayArchive(bytes);
  }

  /**
   * Mark the current spatial/analytical moment as an authoritative Observation.
   */
  markMoment(notes?: string, targetIds?: string[]): Observation {
    const obs = MarkMomentAction.execute({
      atlas: this.atlas,
      camera: this.engine.camera,
      scene: this.engine.scene,
      feedback: this.engine.input.feedback,
      notes,
      targetIds,
      onLogged: (msg) => this.uiManager.vrConsole?.log?.('log', [msg]),
    });
    this.uiManager.statusStrip.recordAction('Mark Moment', 'Finding recorded in evidence ledger');
    this._logInteraction('Mark moment', { result: obs.id });
    return obs;
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
    this.collaborationCoordinator?.update?.();
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
      this.uiManager.vrConsole?.log?.('warn', [`Unknown analysis template: ${templateId}`]);
      return false;
    }
    const { entry, theme, tourId } = resolved;
    const fullEntry: DatasetLoadEntry = {
      key: entry.key,
      name: entry.label,
      topology: TopologyTypes[entry.topology as keyof typeof TopologyTypes] ?? entry.topology,
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

    this.uiManager.vrConsole?.log?.('log', [`Template loaded: ${templateId}`]);
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
  _doLoadDataset(
    entry: DatasetLoadEntry,
    {
      preserveAnalyticalState = false,
      preserveAuxiliaryPresentation = false,
    }: {
      preserveAnalyticalState?: boolean;
      preserveAuxiliaryPresentation?: boolean;
    } = {}
  ): void {
    this._lastLoadedEntry = entry;
    // A dataset/representation change invalidates any selection context the
    // contextual task surface is pinned to; hide it so stale row data and
    // poses do not linger after the artefact is rebuilt.
    this.uiManager.contextualTaskSurface.hide();
    const presetName = entry.key && DATASET_THEME_MAP[entry.key];
    const preset = presetName ? WorldTheme.PRESETS[presetName] : null;
    const activity =
      entry.topology === 'TIME_SERIES' || entry.topology === 'ANOMALY' ? 0.75 : 0.35;

    const result = this.loadDatasetUseCase.execute(entry, {
      preserveAnalyticalState,
      requirements: this._activeRequirements,
    });
    this._activeRequirements = result.requirements;
    this._activeOutcome = result.outcome;
    this.uiManager?.recommendationPanel?.markDirty();

    this.dracoNode = this.representationSurface.replace(
      result.dataInput,
      result.representationDecision
    );
    this.diagnostic = this.representationSurface.diagnostic;
    this._lastSelectedMesh = this.representationSurface.selectedMesh;

    if (presetName) this.engine.theme.applyPreset(presetName);
    if (preset) {
      this.portalA?.setColor?.(preset.pointColor);
      this.portalB?.setColor?.(preset.pointColor);
    }
    this.portalA?.setDataActivity?.(activity);
    this.portalB?.setDataActivity?.(activity);

    const datasetLabel = entry.label ?? entry.name ?? entry.key ?? 'Dataset';
    const rowCount = result.embodiedDataset?.rows?.length ?? 0;
    this.uiManager.statusStrip.setDatasetContext(datasetLabel, String(entry.topology), rowCount);
    if (entry.topology) {
      this.uiManager.contextualTaskSurface.setTopology(entry.topology as never);
    }

    if (!preserveAnalyticalState) {
      this.currentEntry = entry;
      this.telemetryCollector?.recordDataset?.(
        entry.name ?? entry.label ?? 'dataset',
        entry.topology
      );
    }

    if (!preserveAuxiliaryPresentation) {
      this._attachTDASummary();
      this._buildDashboard();
    } else {
      this._updateDashboardDatasets(result.embodiedDataset);
    }

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
    this._doLoadDataset(this.currentEntry, {
      preserveAnalyticalState: true,
      preserveAuxiliaryPresentation: this._wasmUnavailable,
    });
  }

  /**
   * Apply an edited column schema by reloading the dataset with the new column
   * types. The new column schema (`updated.columns`) is combined with the
   * ORIGINAL loaded dataset's rows/edges (`currentEntry.dataset`), NOT the live
   * `atlas.dataset` (which may be a transformed subset after a filter/cluster).
   * Sourcing rows from the original prevents a current data operation from
   * being silently baked into the new baseline — schema mapping is a fresh
   * reload, so any pending filter/cluster/aggregate is discarded. This resets
   * the evidence ledger, analysis results, and history, exactly as any fresh
   * dataset load does (the schema-mapping `ConfirmButton` warns the user).
   */
  applySchemaMapping(updated: Dataset): void {
    if (!this.currentEntry || this._disposed) return;
    const original = this.currentEntry.dataset;
    const rebuilt = new Dataset(original.name, updated.columns, original.rows, original.edges);
    const entry: DatasetLoadEntry = {
      ...this.currentEntry,
      dataset: rebuilt,
    };
    this.loadDataset(entry);
  }

  /**
   * Build the inspector's session-level provenance/evidence provider from the
   * authoritative `atlas.evidenceLedger`. Provenance is the recent ledger event
   * stream (operation + dataset version); evidence is observations/findings/
   * annotations. Both are session-level — node-scoped provenance requires the
   * structure-id↔row join that is a P1-U3 residual.
   */
  _buildProvenanceProvider(): ProvenanceProvider {
    return {
      getProvenance: (): ProvenanceEntry[] => {
        const ledger = this.atlas.evidenceLedger.ledger;
        return ledger.slice(-50).map((event) => ({
          id: event.eventId,
          operation: this._provenanceLabel(event),
          datasetVersion: event.datasetVersion,
          timestamp: event.timestamp,
        }));
      },
      getEvidence: (): EvidenceEntry[] => {
        const lg = this.atlas.evidenceLedger;
        const out: EvidenceEntry[] = [];
        for (const o of lg.observations) {
          out.push({ id: o.id, kind: 'observation', title: o.notes, timestamp: o.timestamp });
        }
        for (const f of lg.findings) {
          out.push({ id: f.id, kind: 'finding', title: f.title, timestamp: f.timestamp });
        }
        for (const a of lg.annotations) {
          out.push({ id: a.id, kind: 'annotation', title: a.text, timestamp: a.timestamp });
        }
        return out.slice(-50);
      },
    };
  }

  private _provenanceLabel(event: ResearchEvent): string {
    const cmd = event.command;
    if ('operation' in cmd) {
      return cmd.label ?? cmd.operation.op ?? event.kind;
    }
    if (event.kind === 'seek' && cmd.index != null) return `seek #${cmd.index}`;
    return cmd.op;
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

  private _rebuildStructureHandles(dracoNode: {
    artifact?: { nodeMeshes?: THREE.Mesh[] } | undefined;
    dataInput?: { topology?: string } | undefined;
  }): void {
    if (this.atlas.structures.length > 0) {
      this.inPlaceHandles.buildFromStructures(dracoNode as never, this.atlas.structures as never);
    } else {
      this.inPlaceHandles.build(dracoNode as never);
    }
    this.inPlaceHandles.registerInteractables(this.engine.input as never);
  }

  _showDataCard(mesh: THREE.Mesh): void {
    const pointer = this.engine.input.getActivePointer();
    this._lastSelectedMesh = mesh;
    this.uiManager.contextualTaskSurface.showAtNode(mesh, mesh.userData.row, pointer);
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
    this.uiManager.vrConsole?.log?.('log', [
      `Farcaster warp: ${zone}${operation ? ` + ${operation}` : ''}`,
    ]);
    this._logInteraction('Portal warp', { result: `${zone}${operation ? ` + ${operation}` : ''}` });
    this._captureSession();
  }

  /**
   * Handle semantic portal travel (P1-U6). Portals navigate between semantic
   * contexts (Overview, Saved Investigation) without performing analytical
   * mutations. Overview warps the camera to the overview vantage; a
   * saved-investigation target restores the latest frozen archive.
   */
  _onSemanticWarp(target: import('../vr/artifacts/FarcasterPortal.ts').PortalSemanticTarget): void {
    if (target.kind === 'overview') {
      this._warpToZone('OVERVIEW', [0, 1.6, -6], null);
      this.uiManager.vrConsole?.log?.('log', ['Farcaster: Overview']);
    } else if (target.kind === 'saved-investigation') {
      if (target.archiveId === 'latest') {
        this._restoreLatestArchiveOrWarning();
      } else {
        this._restoreArchive(target.archiveId);
      }
      this.uiManager.vrConsole?.log?.('log', ['Farcaster: Saved Investigation']);
    } else if (target.kind === 'detail' || target.kind === 'branch') {
      this._warpToZone('LOCAL_MATRIX', [0, 1.6, -3], null);
      this.uiManager.vrConsole?.log?.('log', [`Farcaster: ${target.kind}`]);
    }
    this._logInteraction('Semantic portal warp', { result: target.kind });
  }

  /** Restore the latest archive or warn the user when none exists. */
  private async _restoreLatestArchiveOrWarning(): Promise<void> {
    if (!this.sessionController?.archiveStore) return;
    const archives = await this.sessionController.archiveStore.listArchives();
    if (archives.length === 0) {
      this.uiManager.vrConsole?.log?.('warn', [
        'No frozen archives found. Freeze an investigation first.',
      ]);
      return;
    }
    const latest = archives[archives.length - 1];
    await this._restoreArchive(latest.archiveId);
  }

  _togglePanels(): void {
    this.uiManager.panelManager.toggleLauncher();
    this.adaptiveAssist.recordPanelToggle(
      'launcher',
      this.uiManager.panelManager.isLauncherVisible()
    );
    this._logInteraction('Launcher', {
      result: this.uiManager.panelManager.isLauncherVisible() ? 'opened' : 'closed',
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
    const topology = TopologyTypes[entry.topology as keyof typeof TopologyTypes] ?? entry.topology;
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
    this.uiManager.vrConsole?.log?.('log', [`Dataset: ${wasmEntry.label ?? wasmEntry.name}`]);
    this._logInteraction('Dataset', { result: wasmEntry.label ?? wasmEntry.name });
  }

  _cycleThemePreset(): void {
    const name = this.engine.theme.cyclePreset();
    this.uiManager.vrConsole?.log?.('log', [`Theme: ${name}`]);
    this._logInteraction('Theme', { result: name });
    this._captureSession();
  }

  _toggleStatisticalLens(): void {
    this._statisticalLensEnabled = !this._statisticalLensEnabled;
    this._setStatisticalLensVisible(this._statisticalLensEnabled);
    this.adaptiveAssist.recordPanelToggle('statistical-lens', this._statisticalLensEnabled);
    this.uiManager.vrConsole?.log?.('log', [
      `Statistical lens ${this._statisticalLensEnabled ? 'on' : 'off'}`,
    ]);
    this._logInteraction('Statistical lens', {
      result: this._statisticalLensEnabled ? 'on' : 'off',
    });
    this._captureSession();
  }

  _toggleMiniOverview(): void {
    const next = !this.uiManager.miniOverview.mesh.visible;
    this.uiManager.miniOverview.setEnabled(next);
    this.uiManager.settingsPanel?.setSetting?.('miniOverview', next);
    this.uiManager.vrConsole?.log?.('log', [`Mini overview ${next ? 'on' : 'off'}`]);
    this._logInteraction('Mini overview', { result: next ? 'on' : 'off' });
    this._captureSession();
  }

  _toggleLoadTestPanel(): void {
    this.uiManager?.panelManager?.togglePanel?.(this.uiManager.getOrCreateLoadTestPanel());
  }

  _toggleRecommendationPanel(): void {
    this.uiManager?.panelManager?.togglePanel?.(this.uiManager.recommendationPanel);
  }

  _applyRemediation(action: import('../moneta/representation/ActionableNil.ts').RemedialAction): void {
    const oldRequirements = this._activeRequirements;
    const newReq = { ...this._activeRequirements, ...action.suggestedRequirementPatch };

    const provenance = buildRemediationProvenance(
      action,
      oldRequirements,
      newReq,
      this.atlas.datasetFingerprint ?? '',
      Date.now()
    );

    // Record the remediation event in the ledger.
    this.atlas.recordRemediation(provenance);

    // Apply the patch.
    this._activeRequirements = newReq;

    // Re-arbitrate representation layout.
    if (this._lastLoadedEntry) {
      const savedSelectionName = this._lastSelectedMesh?.name ?? null;

      // Reload dataset preserving analytical state so the ledger is not cleared.
      this._doLoadDataset(this._lastLoadedEntry, { preserveAnalyticalState: true });

      // Restore selected mesh if possible.
      if (savedSelectionName && this.dracoNode?.artifact?.nodeMeshes) {
        const matchingMesh = this.dracoNode.artifact.nodeMeshes.find((m) => m.name === savedSelectionName);
        if (matchingMesh) {
          this._lastSelectedMesh = matchingMesh as THREE.Mesh;
        }
      }
    }
  }

  /** Preview a remediation by computing the alternative representation decision without committing. */
  _previewRemediation(action: import('../moneta/representation/ActionableNil.ts').RemedialAction): void {
    const newReq = { ...this._activeRequirements, ...action.suggestedRequirementPatch };
    this._previewedRequirements = newReq;
    this._previewedRemediationAction = action;

    if (this.atlas.isReady()) {
      try {
        const previewDecision = this.atlas.arbitrateRepresentation(newReq);
        this._previewedDecision = previewDecision;
      } catch {
        this._previewedDecision = null;
      }
    }
    this.uiManager.recommendationPanel?.markDirty?.();
  }

  /** Commit a previewed remediation by applying it for real. */
  _commitRemediation(action: import('../moneta/representation/ActionableNil.ts').RemedialAction): void {
    this._applyRemediation(action);
    this._previewedRequirements = null;
    this._previewedRemediationAction = null;
    this._previewedDecision = null;
  }

  /** Cancel a remediation preview without applying. */
  _cancelRemediationPreview(): void {
    this._previewedRequirements = null;
    this._previewedRemediationAction = null;
    this._previewedDecision = null;
    this.uiManager.recommendationPanel?.markDirty?.();
  }

  reconstructRequirementsAndReArbitrate(): void {
    if (!this.atlas.isReady() || !this._lastLoadedEntry) return;

    let req = createDefaultRequirements('individual-inspection');
    const events = this.atlas.remediationEvents();
    for (const ev of events) {
      if (ev.requirementPatch) {
        req = { ...req, ...ev.requirementPatch };
      }
    }
    this._activeRequirements = req;

    this._doLoadDataset(this._lastLoadedEntry, { preserveAnalyticalState: true });
  }

  _generateRecommendation(): void {
    this.atlas.generateRecommendation();
    this.uiManager.recommendationPanel?.markDirty?.();
  }

  _acceptRecommendation(): void {
    this.atlas.acceptRecommendation();
    this._applyEmbodimentHint();
    this._executeVRCommand();
    this.uiManager.recommendationPanel?.markDirty?.();
  }

  _rejectRecommendation(): void {
    this.atlas.rejectRecommendation();
    this.uiManager.recommendationPanel?.markDirty?.();
  }

  _overrideRecommendation(): void {
    this.atlas.overrideRecommendation();
    this.uiManager.recommendationPanel?.markDirty?.();
  }

  private _applyEmbodimentHint(): void {
    const rec = this.atlas.activeRecommendation;
    if (!rec?.suggestedEmbodiment || !this.dracoNode) return;
    import('./../moneta/EmbodimentHints.ts').then(({ applyEmbodimentHint }) => {
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
    this.engine.input.invalidateSpatialAcceleration();
  }

  private _navigateToStructures(rowIndices: number[]): void {
    if (!this.dracoNode?.artifact?.nodeMeshes || rowIndices.length === 0) return;
    let cx = 0,
      cy = 0,
      cz = 0,
      count = 0;
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

  // ---- Vault/Archive methods (P1-U6) ----

  /** Freeze the current investigation state as an immutable archive. */
  private async _freezeInvestigation(): Promise<void> {
    if (!this.uiManager?.vaultPanel || !this.sessionController?.archiveStore || !this.atlas.isReady()) return;

    const snapshot = this.session.serialize() as unknown as Record<string, unknown>;
    const label = `Archive ${new Date().toLocaleString()}`;

    const eventLedger = (snapshot.eventLedger as unknown[]) ?? [];
    const discoveryEpisodes = snapshot.discoveryEpisodes as
      | { outcomes?: unknown[] }
      | undefined;
    const metadata = {
      datasetFingerprint: this.atlas.datasetFingerprint ?? '',
      datasetName: this._lastLoadedEntry?.label ?? this._lastLoadedEntry?.key ?? 'unknown',
      investigationDigest: null,
      eventCount: eventLedger.length,
      discoveryCount: discoveryEpisodes?.outcomes?.length ?? 0,
    };

    const archiveId = await this.sessionController.archiveStore.freezeInvestigation(label, snapshot, metadata);

    const archives = await this.sessionController.archiveStore.listArchives?.() ?? [];
    this.uiManager.vaultPanel.setArchives(archives);
    this.uiManager.vaultPanel.show();

    this.uiManager.vrConsole?.log?.('log', [`Frozen investigation: ${archiveId}`]);
    this._logInteraction('Freeze investigation', { result: archiveId });
  }

  /** Restore an archived investigation by ID. */
  private async _restoreArchive(archiveId: string): Promise<void> {
    if (!this.uiManager?.vaultPanel || !this.sessionController?.archiveStore) return;
    const archive = await this.sessionController.archiveStore.loadArchive(archiveId);
    if (!archive) {
      this.uiManager.vrConsole?.log?.('warn', [`Archive not found: ${archiveId}`]);
      return;
    }
    // Restore the session state
    this.sessionController.loadSession(archiveId);
    this.uiManager.vrConsole?.log?.('log', [`Restored archive: ${archiveId}`]);
    this._captureSession();
  }

  /** Export an archive as a portable .nemosyne package. */
  private async _exportArchive(archiveId: string): Promise<void> {
    if (!this.sessionController?.archiveStore) return;
    const archive = await this.sessionController.archiveStore.loadArchive(archiveId);
    if (!archive) return;
    // Delegate to NemosyneSession for package creation
    const packageBytes = await this.session.exportPortablePackage();
    const blob = new Blob([packageBytes as unknown as BlobPart], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nemosyne-${archiveId}.nemosyne`;
    a.click();
    URL.revokeObjectURL(url);
    this.uiManager.vrConsole?.log?.('log', [`Exported archive: ${archiveId}`]);
  }

  /** Delete an archive by ID. */
  private async _deleteArchive(archiveId: string): Promise<void> {
    if (!this.sessionController?.archiveStore) return;
    await this.sessionController.archiveStore.deleteArchive(archiveId);
    if (this.uiManager?.vaultPanel) {
      this.uiManager.vaultPanel.setArchives(
        await this.sessionController.archiveStore.listArchives?.() ?? []
      );
    }
    this.uiManager.vrConsole?.log?.('log', [`Deleted archive: ${archiveId}`]);
    this._captureSession();
  }

  _togglePeerPresenceHUD(): void {
    const next = !this.uiManager.peerPresenceHUD.mesh.visible;
    this.uiManager.peerPresenceHUD.setEnabled(next);
    this.uiManager.settingsPanel?.setSetting?.('peerPresence', next);
    this.uiManager.vrConsole?.log?.('log', [`Peer presence ${next ? 'on' : 'off'}`]);
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
      this.uiManager.vrConsole?.log?.('log', ['Desktop preview is only available outside VR']);
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
      this.uiManager.vrConsole?.log?.('log', ['Desktop preview on']);
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
      this.uiManager.vrConsole?.log?.('log', ['Desktop preview off']);
    }
    this._logInteraction('Desktop preview', { result: this._desktopPreviewEnabled ? 'on' : 'off' });
    this._captureSession();
  }

  /**
   * Persist a cross-platform settings payload so desktop and VR sessions can
   * share preferences and the latest analysis story.
   */
  async _saveSharedSettings(): Promise<void> {
    if (this._disposed || !this.sessionStore || !this.uiManager.settingsPanel) return;
    const settings = this.uiManager.settingsPanel.getAllSettings();
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
    if (this._disposed || !this.sessionStore || !this.uiManager.settingsPanel) return;
    try {
      const shared = await this.sessionStore.getItem('shared-settings');
      if (this._disposed) return;
      if (!shared?.settings) return;
      for (const [key, value] of Object.entries(shared.settings)) {
        this.uiManager.settingsPanel.setSetting(key as keyof SettingsMap & string, value as never);
      }
      this.comfortSettingsController.apply(this.uiManager.settingsPanel.getAllSettings());
      this.comfortSettingsController.applyPanelDistance(
        this.uiManager.settingsPanel.getAllSettings().defaultPanelDistance
      );
      this._applyFeedbackSettings(this.uiManager.settingsPanel.getAllSettings());
      this._applyAccessibilitySettings();
      if (this._disposed) return;
      this.uiManager.vrConsole?.log?.('log', ['Shared settings restored']);
    } catch (err) {
      if (this._disposed) return;
      console.warn('[World] failed to load shared settings:', err);
    }
  }

  _setStatisticalLensVisible(enabled: boolean): void {
    const tdaEnabled = enabled && (this.uiManager.settingsPanel?.getSetting('lensTDA') ?? true);
    const corrEnabled =
      enabled && (this.uiManager.settingsPanel?.getSetting('lensCorrelation') ?? true);
    if (this.tdaGroup) this.tdaGroup.visible = tdaEnabled;
    const corr = this.dashboardPanels?.find((e) => e.panel?.chartType === 'CORRELATION');
    if (corr?.panel?.mesh) corr.panel.mesh.visible = corrEnabled;
  }

  _toggleSettingsPanel(): void {
    if (!this.uiManager.settingsPanel) return;
    this.uiManager.toggleSettingsPanel();
    this.adaptiveAssist.recordPanelToggle('settings', this.uiManager.settingsPanel.mesh.visible);
    this._logInteraction('Settings panel', {
      result: this.uiManager.settingsPanel.mesh.visible ? 'opened' : 'closed',
    });
  }

  _toggleVaultPanel(): void {
    if (!this.uiManager?.vaultPanel) return;
    this.uiManager.panelManager.togglePanel(this.uiManager.vaultPanel);
    this._logInteraction('Evidence Vault', {
      result: this.uiManager.vaultPanel.mesh.visible ? 'opened' : 'closed',
    });
  }

  _toggleDracoExplainer(): void {
    const panel = this.uiManager?.dracoExplainerPanel;
    if (!panel) return;
    this.uiManager.panelManager.togglePanel(panel);
    if (panel.mesh.visible && this.dracoNode) {
      panel.setDracoNode(this.dracoNode);
    }
  }

  /**
   * Toggle the Draco constraint diagnostic HUD (Dev Lab / superuser). World owns
   * this HUD and rebuilds it per palace, so we toggle its mesh visibility
   * directly rather than routing through PanelManager. No-op (with a console
   * hint) when no palace is loaded.
   */
  _toggleDracoDiagnostic(): void {
    if (!this.diagnostic) {
      this.uiManager?.vrConsole?.log?.('warn', [
        'Draco Diagnostic HUD requires a loaded dataset/palace.',
      ]);
      return;
    }
    this.diagnostic.mesh.visible = !this.diagnostic.mesh.visible;
    if (this.diagnostic.mesh.visible) this.diagnostic.render?.();
  }

  _onSettingChanged(key: string, value: unknown): void {
    if (key.startsWith('lens')) {
      this._setStatisticalLensVisible(this._statisticalLensEnabled);
    } else if (key.startsWith('feedback')) {
      this._applyFeedbackSettings(this.uiManager.settingsPanel.getAllSettings());
    } else if (key === 'telemetryEnabled') {
      this.telemetryCollector.saveConsent?.(value as boolean);
      this.uiManager.vrConsole?.log?.('log', [`Telemetry ${value ? 'enabled' : 'disabled'}`]);
    } else if (['textScale', 'highContrast', 'colorblindMode', 'dwellSelection'].includes(key)) {
      this._applyAccessibilitySettings();
    } else if (key === 'strictBudget') {
      const budgets = value ? { frameMs: 13.33, droppedFramesPer10s: 2 } : {};
      this.engine.performanceBudget?.setBudgets?.(budgets);
      this.uiManager.vrConsole?.log?.('log', [
        `Performance budget ${value ? 'strict' : 'default'}`,
      ]);
    } else if (key === 'collabEnabled') {
      if (value) this._joinCollaborationRoom();
      else this._leaveCollaborationRoom();
    } else if (key === 'collabRoom') {
      if (this.uiManager.settingsPanel.getSetting('collabEnabled')) {
        this._leaveCollaborationRoom();
        this._joinCollaborationRoom(value as string);
      }
    } else if (key === 'userMode') {
      this.userModeController.apply();
      this.inPlaceHandles?.setUserMode?.(
        this.uiManager.settingsPanel.getSetting('userMode') as 'novice' | 'expert'
      );
    } else if (['snapTurn', 'snapTurnAngle', 'reducedMotion'].includes(key)) {
      this.comfortSettingsController.apply(this.uiManager.settingsPanel.getAllSettings());
    } else if (key === 'vignette' || key === 'vignetteIntensity') {
      this.comfortSettingsController.apply(this.uiManager.settingsPanel.getAllSettings());
    } else if (key === 'seatedHeightOffset') {
      this.comfortSettingsController.apply(this.uiManager.settingsPanel.getAllSettings());
    } else if (key === 'defaultPanelDistance') {
      this.comfortSettingsController.applyPanelDistance(
        this.uiManager.settingsPanel.getAllSettings().defaultPanelDistance
      );
    } else if (key === 'miniOverview') {
      this.uiManager.miniOverview?.setEnabled?.(value as boolean);
    } else if (key === 'peerPresence') {
      this.uiManager.peerPresenceHUD?.setEnabled?.(value as boolean);
    }
    this._saveSharedSettings();
    this._logInteraction('Setting changed', { result: `${key} = ${value}` });
    this._captureSession();
  }

  _applyAccessibilitySettings(): void {
    const settings = this.uiManager.settingsPanel.getAllSettings();
    const options = {
      textScale: settings.textScale ?? 1,
      highContrast: settings.highContrast ?? false,
      colorblindMode: settings.colorblindMode ?? 'none',
      dwellSelection: settings.dwellSelection ?? false,
      reducedMotion: settings.reducedMotion ?? false,
    };

    // Delegate panel theming to the UI manager so the SpatialPanel-based
    // SettingsPanel (no longer in panelManager.panels) is re-themed too, along
    // with the registered MovablePanels and the hand wheel menu.
    this.uiManager.applyAccessibility(options);

    this.engine.input.setDwellSelection?.(
      options.dwellSelection ?? false,
      (settings.dwellTimeMs as number) ?? 1200
    );

    if (
      this.dracoNode &&
      this.dracoNode.translatorOptions.colorblindMode !== options.colorblindMode
    ) {
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
    this.uiManager.vrConsole?.log?.('log', [`Undo: ${frame.operation}`]);
    this._logInteraction('Undo', { result: frame.operation });
  }

  redoAnalysis(): void {
    const frame = this.dataOperationController.redo();
    if (!frame) return;
    this.uiManager.vrConsole?.log?.('log', [`Redo: ${frame.operation}`]);
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
    this.uiManager.vrConsole?.log?.('log', [`Rewound to ${frame.operation}`]);
    this._logInteraction('Seek history', { result: frame.operation });
    this._captureSession();
  }

  _updateNarrativeStrip(): void {
    const strip = this.uiManager.narrativeStrip;
    strip?.render?.();
    if (this.analysisHistory?.length > 0) {
      if (!strip) {
        this.uiManager.panelManager?.showPanel?.(this.uiManager.getOrCreateNarrativeStrip());
      } else {
        this.uiManager.panelManager?.showPanel?.(strip);
      }
    }
  }

  _updateOperationLog(): void {
    const entries = this.analysisHistory.frames().map((f) => ({
      operation: f.operation,
      rowCount: f.datasetAfter?.rowCount,
      timestamp: f.timestamp,
    }));
    this.uiManager.operationLogPanel?.setEntries(entries);
  }

  _subscribeDataOperationEvents(): void {
    // Cross-cutting subscribers: keep logging, telemetry, and auto-save out of
    // feature methods by reacting to events instead of calling World directly.
    this.eventBus.on(WorldTopics.INTERACTION_LOG, (payload: unknown) => {
      const { action, gesture, controller, result } = payload as {
        action: string;
        gesture?: string;
        controller?: string;
        result?: string;
      };
      this.uiManager.interactionCoach?.log?.({ action, gesture, controller, result });
    });

    this.eventBus.on(WorldTopics.SESSION_CAPTURE, () => {
      this._requestAutoSave();
    });

    this.eventBus.on(WorldTopics.CONSOLE_LOG, (args: unknown) => {
      this.uiManager.vrConsole?.log?.('log', Array.isArray(args) ? args : [args]);
    });

    this.eventBus.on(WorldTopics.CONSOLE_WARN, (args: unknown) => {
      this.uiManager.vrConsole?.log?.('warn', Array.isArray(args) ? args : [args]);
    });

    // Route interaction events (gestures, commands, settings changes) to the
    // interaction coach and telemetry so individual callers do not need to.
    this.eventBus.on(WorldTopics.INTERACTION, (payload: unknown) => {
      const { action, gesture, controller, result } = payload as {
        action: string;
        gesture?: string;
        controller?: string;
        result?: string;
      };
      this.eventBus.emit(WorldTopics.INTERACTION_LOG, { action, gesture, controller, result });
    });

    this.eventBus.on(WorldTopics.GESTURE_RECOGNIZED, (payload: unknown) => {
      const { name } = payload as { name: string };
      this.telemetryCollector?.recordGesture?.(name);
    });

    this.eventBus.on(WorldTopics.OPERATION_APPLIED, (payload: unknown) => {
      const { operation, rowCount } = payload as { operation: string; rowCount?: number };
      this.engine.input.invalidateSpatialAcceleration();
      this.telemetryCollector?.recordOperation?.(operation);
      if (operation === 'compare') {
        // Compare changes the dataset shape, so rebuild the Draco artefact.
        this._restoreDataset(this._transformedDataset, operation);
      }
      this._updateDashboardDatasets(this._transformedDataset);
      this.derivedAnalysisPipeline.schedule(operation);
      this._updateOperationLog();
      this._updateNarrativeStrip();
      this.uiManager.vrConsole?.log?.('log', [`Operation: ${operation} → ${rowCount} rows`]);
      this._logInteraction(operation, { result: `${rowCount} rows` });
      this._requestAutoSave();
    });

    this.eventBus.on(WorldTopics.OPERATION_PREVIEW, (payload: unknown) => {
      const { operation, previewDataset, originalDataset, artifact } = payload as {
        operation: string;
        previewDataset: Dataset;
        originalDataset: Dataset | null;
        artifact: ArtifactRef;
      };
      this.livePreview.preview(
        operation,
        previewDataset,
        originalDataset ?? previewDataset,
        artifact
      );
    });

    this.eventBus.on(WorldTopics.OPERATION_CLEAR_PREVIEW, () => {
      this.livePreview.clear();
    });

    this.eventBus.on(WorldTopics.HISTORY_SEEK, (payload: unknown) => {
      const { operation, dataset } = payload as { operation: string; dataset: Dataset };
      this._restoreDataset(dataset, operation);
      if (this.tdaRecompute && operation !== 'anomaly') void this.tdaRecompute();
      this._updateNarrativeStrip();
    });

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

    this.eventBus.on(WorldTopics.QUEST_BOUNDARY_COMPLETE, (payload: unknown) => {
      const summary = payload as QuestBoundarySummary;
      this._lastQuestBoundarySummary = summary;
      this._flushQuestBoundarySummary(summary);
    });
  }

  _buildWheelMenu(): void {
    this.uiManager.buildWheelMenu(buildIntentWheelMenuCategories(this));
  }

  // --- Load-test harness (WASM command-buffer decision) ---

  /** Read the geometry/layout the Draco solver actually picked for the current palace. */
  _getActiveSpecInfo(): {
    geometry?: string;
    layout?: string;
    renderedNodeCount?: number;
  } | null {
    const spec = this.dracoNode?.solverResult?.spec;
    if (!spec) return null;
    const renderedNodeCount = this.dracoNode?.artifact?.nodeMeshes?.reduce(
      (total, mesh) => total + (mesh instanceof THREE.InstancedMesh ? mesh.count : 1),
      0
    );
    return {
      geometry: String(spec.geometry),
      layout: String(spec.layout),
      renderedNodeCount,
    };
  }

  /**
   * Start a load-test run. Enables telemetry for the run window (restored on
   * completion) so the usability/friction aggregates are captured. The per-frame
   * perf trace is captured independently by the LoadTestCollector.
   */
  runLoadTest(profile?: LoadTestProfile): void {
    if (this.questBoundaryProbe.running) return;
    this._lastQuestBoundarySummary = null;
    // Show the panel so the user sees live progress.
    this.uiManager?.showPanel?.(this.uiManager.getOrCreateLoadTestPanel());
    this._telemetryConsentBeforeRun = !!this.telemetryCollector?.enabled;
    try {
      this.telemetryCollector?.setEnabled?.(true);
    } catch {
      // ignore — telemetry is best-effort
    }
    this.loadTestDriver.run(profile);
  }

  runQuestBoundaryProbe(): void {
    if (this.loadTestDriver.phase !== 'IDLE' && this.loadTestDriver.phase !== 'COMPLETE') return;
    this._lastLoadTestSummary = null;
    this.uiManager?.showPanel?.(this.uiManager.getOrCreateLoadTestPanel());
    this.questBoundaryProbe.run();
  }

  /** Abort a running load test. */
  stopLoadTest(): void {
    this.loadTestDriver.stop();
    this.questBoundaryProbe.stop();
  }

  /** Re-POST the last completed summary to the local dev-server log endpoint. */
  flushLastLoadTestSummary(): void {
    if (this._lastLoadTestSummary) {
      this._enrichAndFlushLoadTestSummary(this._lastLoadTestSummary);
    }
    if (this._lastQuestBoundarySummary) {
      this._flushQuestBoundarySummary(this._lastQuestBoundarySummary);
    }
  }

  /**
   * Build the fetch init for a load-test POST. When this build runs under a QV
   * validation session (the launcher placed the session identity in env), the
   * POST is tagged with the session label + id so the dev-server sink can route
   * it to the per-session evidence directory. Without a session this returns the
   * exact same init as before, so ordinary dev runs are byte-identical.
   */
  _loadTestPostInit(body: unknown): RequestInit {
    const session = readValidationSessionEnv(import.meta.env);
    if (!session) {
      return {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      };
    }
    return {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [VALIDATION_SESSION_LABEL_HEADER]: session.label,
        [VALIDATION_SESSION_ID_HEADER]: session.id,
      },
      body: JSON.stringify(body),
    };
  }

  _flushQuestBoundarySummary(summary: QuestBoundarySummary): void {
    try {
      void fetch('/__loadtest-results', this._loadTestPostInit(summary)).catch(() => {});
    } catch {
      return;
    }
    try {
      // eslint-disable-next-line no-console
      console.log(
        `[QUEST 10M] status=${summary.outcome.status} | ` +
          `evidence=${summary.qualification.evidencePathAvailableAt10m} | ` +
          `maxGapMs=${summary.maximumFrameGapMs ?? 'unknown'} | ` +
          `auditGate=${summary.qualification.promotionBlockedByAudits}`
      );
    } catch {
      return;
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
   * `/__loadtest-results` (serve-only). Generic dev appends to
   * `logs/loadtest-results.jsonl`; under a QV validation session the POST is
   * tagged so the dev plugin routes it to `logs/validation/<sessionLabel>/`.
   * Failures are silent — the endpoint only exists on `npm run dev`, and the
   * panel's Download button is the fallback.
   */
  _enrichAndFlushLoadTestSummary(summary: LoadTestSummary): void {
    summary.usability = this._collectUsabilityDigest();
    try {
      void fetch('/__loadtest-results', this._loadTestPostInit(summary)).catch(() => {
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
      frictionLevel:
        typeof digest?.frictionLevel === 'string' ? (digest.frictionLevel as string) : 'unknown',
      dissatisfactionScore:
        typeof digest?.dissatisfactionScore === 'number'
          ? (digest.dissatisfactionScore as number)
          : 0,
      detectedPatterns: Array.isArray(digest?.detectedPatterns)
        ? (digest.detectedPatterns as Array<{ name?: string } | string>).map((p) =>
            typeof p === 'string' ? p : (p?.name ?? 'pattern')
          )
        : [],
      telemetryConsentEnabled: !!this.telemetryCollector?.enabled,
    };
  }

  setPortalsEnabled(enabled: boolean): void {
    this.portalsEnabled = enabled;
    this.portalA.group.visible = enabled;
    this.portalB.group.visible = enabled;
    this.uiManager.vrMenu?.setPortalsEnabled?.(enabled);
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
    this._dispatchAnalysis(operation);
  }

  /**
   * Single-command-authority funnel: when the bootstrap has injected the
   * canonical `ApplicationIntentDispatcher`, mutating operations dispatch
   * through it; otherwise they fall back to the legacy controller call so the
   * world stays functional in isolation (tests, harnesses). Compare releases
   * the artefact via re-solve, so any pinned selection context is dropped
   * before the dispatcher runs.
   */
  _dispatchAnalysis(operation: string): void {
    if (operation === 'compare') this.uiManager.contextualTaskSurface.hide();
    const parsed = this.dispatchIntent ? parseApplicationAnalysisOperation(operation) : null;
    if (this.dispatchIntent && parsed) {
      this.dispatchIntent({ type: 'analysis.apply', operation: parsed });
      return;
    }
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
    this.uiManager.vrConsole?.log?.('log', [
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
  dispose(): Promise<void> {
    return this.lifecycle.dispose();
  }

  async _teardown(): Promise<void> {
    const failures: unknown[] = [];
    const run = async (action: () => void | Promise<void>) => {
      try {
        await action();
      } catch (error) {
        failures.push(error);
      }
    };

    await run(() => this.engine.pause());
    await run(() => this.loadTestDriver?.dispose());
    await run(() => this.questBoundaryProbe?.dispose());
    await run(() => this.sessionController?.dispose?.());
    await run(() => this.liveStreamCoordinator?.disconnectLiveStream?.());
    await run(() => this.collaborationCoordinator?.leaveCollaborationRoom?.());
    await run(() => this.telemetryCollector?.setEnabled?.(false));
    await run(() => this.derivedAnalysisPipeline?.dispose());
    await run(() => this.rendererLifecycle?.dispose());
    await run(() => this.livePreview?.clear());
    await run(() => this.representationSurface?.dispose());
    this.dracoNode = null;
    this.diagnostic = null;
    this._lastSelectedMesh = null;
    await run(() => this.adaptiveAssist?.dispose());
    await run(() => this.engine.removeUpdatable(this.guidedTour));
    await run(() => this.engine.removeHudObject(this.guidedTour));
    await run(() => this.guidedTour?.dispose());
    this.engine.guidedTour = null;
    await run(() => this.uiManager?.dispose());
    await run(() => this.tooltipManager?.dispose());
    await run(() => this.sceneComposer?.dispose());
    await run(() => this.sceneGraphController.dispose());
    for (const promise of this._initPromises) void Promise.resolve(promise).catch(() => {});
    this._initPromises = [];
    await run(() => this.loader?.dispose());
    await run(() => this.atlas?.dispose?.());
    await run(() => this.engine.input.setControllerGestureMapper(null));
    await run(() => this.engine.eventBus.removeAll());
    await run(() => this.engine.dispose());

    if (failures.length > 0) {
      throw new AggregateError(failures, 'World teardown failed');
    }
  }

  start(): Promise<void> {
    return this.lifecycle.start();
  }

  recoverKernel(): Promise<void> {
    return this.lifecycle.recoverKernel();
  }

  markKernelUnavailable(error: unknown): void {
    this.lifecycle.markKernelUnavailable(error);
  }

  _onKernelUnavailable(error: unknown): void {
    const runtime = this._wasmRuntime;
    this.atlas.setKernel(null, 0);
    runtime?.invalidateRuntime?.(error);
    this._wasmRuntime = null;
    this._wasmCapabilities = 0;
    this._wasmUnavailable = true;
    console.error('[World] analytical kernel unavailable:', error);
    this.uiManager.vrConsole?.log?.('error', [
      'Analytical kernel unavailable — data ops disabled. Run npm run wasm:dev.',
    ]);
  }

  /**
   * Initialise the WASM runtime and record the enabled capability set. Throws
   * on failure; the caller (start()) surfaces the unavailable state.
   */
  async _initWasmRuntime(generation: number): Promise<void> {
    // Load the bridge lazily so that production builds which skip wasm-pack
    // still start without a missing-module error at import time.
    const bridge = await import('../wasm/RuntimeBridge.ts');
    if (!this.lifecycle.isCurrentKernelAttempt(generation)) return;

    if (typeof Worker !== 'undefined' && typeof window !== 'undefined') {
      try {
        const worker = new Worker(
          new URL('../atlas/ports/analytical.worker.ts', import.meta.url),
          { type: 'module' }
        );
        const port = new WorkerAnalyticalPort(
          worker as unknown as WorkerTransport,
          (err) => this.markKernelUnavailable(err),
          // RF-030: durably record kernel-inline TDA resource refusals (non-
          // mutating provenance). A refusal is not a kernel failure, so it
          // must not mark the kernel unavailable — only record, then let the
          // typed error reject the async request so VR/UI can react.
          (err) => this.atlas.recordRefusalFromError(err)
        );
        this.atlas.setExecutionPort(port);
      } catch (workerErr) {
        console.warn('[World] WorkerAnalyticalPort unavailable, defaulting to inline port:', workerErr);
      }
    }

    if (bridge.isReady()) {
      const capabilities = bridge.capabilities();
      if (!this.lifecycle.isCurrentKernelAttempt(generation)) return;
      this._wasmRuntime = bridge;
      this._wasmCapabilities = capabilities;
      this.atlas.setKernel(bridge, this._wasmCapabilities, generation);
      this._rebuildPalaceWithKernelFacts();
      this._wasmUnavailable = false;
      await this._restoreAutoSaveOnce();
      return;
    }

    try {
      await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
    } catch {
      // Fallback for legacy dev paths
      await bridge.initRuntime('/wasm/nemosyne_wasm_bg.wasm');
    }

    if (!this.lifecycle.isCurrentKernelAttempt(generation)) return;

    const capabilities = bridge.capabilities();
    if (!this.lifecycle.isCurrentKernelAttempt(generation)) return;
    this._wasmRuntime = bridge;
    this._wasmCapabilities = capabilities;
    this.atlas.setKernel(bridge, this._wasmCapabilities, generation);
    this._rebuildPalaceWithKernelFacts();
    this._wasmUnavailable = false;
    await this._restoreAutoSaveOnce();
    if (!this.lifecycle.isCurrentKernelAttempt(generation)) return;
    this.uiManager.vrConsole?.log?.('log', [
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

  // --- Spatial UX Convergence & Intelligence Facade ---

  get interactionModeController() {
    return this.inputCoordinator.interactionModeController;
  }

  get gestureOwnershipManager() {
    return this.inputCoordinator.gestureOwnershipManager;
  }

  get statusStripController() {
    return this.uiManager.statusStrip;
  }

  get panelRolesManager() {
    return this.uiManager.panelRolesManager;
  }

  get contextualTaskSurface() {
    return this.uiManager.contextualTaskSurface;
  }

  setInteractionMode(mode: InteractionMode, reason = 'user_action'): boolean {
    return this.inputCoordinator.setInteractionMode(mode, reason);
  }

  revertInteractionMode(): boolean {
    return this.inputCoordinator.revertInteractionMode();
  }

  getInteractionMode(): InteractionMode {
    return this.inputCoordinator.getInteractionMode();
  }

  setFocusState(surfaceId: string, state: FocusState): void {
    this.inputCoordinator.setFocusState(surfaceId, state);
  }

  getFocusState(surfaceId: string): FocusState {
    return this.inputCoordinator.getFocusState(surfaceId);
  }

  togglePanelByRole(id: string, panel: PanelLike): boolean {
    return this.uiManager.togglePanelWithRole(id, panel);
  }

  _commitSelection(): void {
    this.uiManager.vrConsole?.log?.('log', ['Selection committed']);
    this.uiManager.statusStrip.recordAction('Commit Selection', 'Operation confirmed');
  }

  _toggleTransformHandle(): void {
    this.uiManager.vrConsole?.log?.('log', ['Transform active artifact']);
    this.uiManager.statusStrip.recordAction('Transform Artifact', 'Scale / rotate cluster');
  }
}
