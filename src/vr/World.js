import { Engine } from './Engine.js';
import { DatumPlane } from './artifacts/DatumPlane.js';
import { TechnoCoreNode } from './artifacts/TechnoCoreNode.js';
import { FarcasterPortal } from './artifacts/FarcasterPortal.js';
import { HolographicInspector } from './artifacts/HolographicInspector.js';
import { DracoTopologyNode } from '../draco/DracoTopologyNode.js';
import { DracoDiagnosticHUD } from '../draco/DracoDiagnosticHUD.js';
import { InputTelemetry } from './InputTelemetry.js';
import { VRConsole } from './ui/VRConsole.js';
import { VRMenu } from './ui/VRMenu.js';
import { PanelManager } from './ui/PanelManager.js';
import { SettingsPanel } from './ui/SettingsPanel.js';
import { HandWheelMenu } from './ui/HandWheelMenu.js';
import { TooltipManager } from './ui/TooltipManager.js';
import { OperationLogPanel } from './ui/OperationLogPanel.js';
import { DashboardManager } from './ui/DashboardManager.js';
import { ChartPlanePanel } from './ui/ChartPlanePanel.js';
import { FileLoaderUI } from '../ui/FileLoader.js';
import {
  supplyChainHierarchy,
  allSampleDatasets,
  getDefaultEncodings,
} from '../data/SampleDatasets.js';
import { ANALYSIS_TEMPLATES, resolveTemplate } from '../data/AnalysisTemplates.js';
import { TopologyTypes } from '../draco/ConstraintEngine.js';
import { disposeObject } from '../utils/Dispose.js';
import { downloadDataUrl, downloadText } from '../utils/Download.js';
import { LiveStreamCoordinator } from './coordinators/LiveStreamCoordinator.js';
import {
  applyFilter,
  applySort,
  applyAggregate,
  applyCluster,
  applyHierarchicalCluster,
  applyDensityCluster,
  applyAnomaly,
  clearAnomaly,
  applySlice,
  captureBaseState,
  resetTransforms,
  computeOperationDataset,
} from './interactions/DataOperations.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildTDASummaryGroup } from './artifacts/TDAPlanes.js';
import { HandGestureRecognizer } from './interactions/HandGestureRecognizer.js';
import { ControllerGestureMapper } from './interactions/ControllerGestureMapper.js';
import { AnalysisHistory } from '../data/AnalysisHistory.js';
import { SessionStore } from '../data/SessionStore.js';
import { Dataset } from '../data/Dataset.js';
import { GuidedTour } from './ui/GuidedTour.js';
import { FIRST_DATASET_TOUR } from '../data/DefaultTour.js';
import { WorldTheme } from './WorldTheme.js';
import { TelemetryCollector } from '../utils/Telemetry.js';
import { TelemetryPanel } from './ui/TelemetryPanel.js';
import { PerformancePanel } from './ui/PerformancePanel.js';
import { NetworkPanel } from './ui/NetworkPanel.js';
import { InteractionCoach } from './ui/InteractionCoach.js';
import { NarrativeStrip } from './ui/NarrativeStrip.js';
import { InPlaceOperationHandles } from './interactions/InPlaceOperationHandles.js';
import { LivePreview } from './interactions/LivePreview.js';
import { MiniOverview } from './ui/MiniOverview.js';
import { PeerPresenceHUD } from './ui/PeerPresenceHUD.js';
import { CollaborationCoordinator } from './coordinators/CollaborationCoordinator.js';
import { getGestureMeta } from '../utils/GestureMapping.js';

// Map sample-dataset keys to atmospheric presets so each dataset has a distinct mood.
const DATASET_THEME_MAP = {
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

const DEFAULT_DATASET_ENTRY = {
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
  constructor() {
    this.engine = new Engine();

    // Explicit analyst anchor: all HUD panels, dashboard, and wheel menu are
    // parented here so the workspace clusters around the user rather than the
    // world origin. It sits at the camera rig origin by default so local
    // coordinates remain compatible with existing panel defaults.
    this.analystAnchor = new THREE.Group();
    this.analystAnchor.name = 'analystAnchor';
    this.engine.cameraGroup.add(this.analystAnchor);

    // Shared substrate.
    this.datum = new DatumPlane();
    this.engine.scene.add(this.datum.mesh);
    this.engine.addUpdatable(this.datum);

    this.core = new TechnoCoreNode({ position: [7, 4, -10], scale: 1.2 });
    this.engine.scene.add(this.core.group);
    this.engine.addUpdatable(this.core);

    this.inspector = new HolographicInspector(this.engine);
    this.inspector.mount(this.engine.scene);
    this.engine.addUpdatable(this.inspector);

    this.tooltipManager = new TooltipManager(this.engine.camera);
    this.tooltipManager.mount(this.engine.scene);
    this.tooltipManager.setPointerRaycaster(this.engine.input.raycaster);
    this.engine.addUpdatable(this.tooltipManager);

    // In-place operation handles near data artefacts for direct manipulation.
    this.inPlaceHandles = new InPlaceOperationHandles(this.engine.scene, this.engine.camera, {
      userMode: this.settingsPanel?.getSetting?.('userMode') ?? 'novice',
      onOperation: (op) => this.applyDataOperation(op),
      onOperationHover: (op) => this.previewDataOperation(op),
      onOperationLeave: () => this.clearOperationPreview(),
    });
    this.engine.addUpdatable({
      update: (delta, time) =>
        this.inPlaceHandles.update(delta, time, this.engine.input.raycaster.ray),
    });

    // Live preview of data operations before they are committed.
    this.livePreview = new LivePreview(this.engine.scene, this.engine.camera);
    this.engine.addUpdatable({
      update: () => this.livePreview.update(),
    });

    // Farcaster portals: data-transformation gates.
    this.portalA = new FarcasterPortal({
      position: [-2.5, 1.6, -2],
      targetZone: 'DEEP_NET',
      targetPosition: [0, 0, -20],
      color: WorldTheme.PRESETS.deepNet.pointColor,
      operation: 'anomaly',
      onWarp: (zone, pos, operation) => this._warpToZone(zone, pos, operation),
    });
    this.engine.scene.add(this.portalA.group);
    this.engine.addUpdatable(this.portalA);

    this.portalB = new FarcasterPortal({
      position: [0, 1.6, -8],
      targetZone: 'LOCAL_MATRIX',
      targetPosition: [0, 0, 0],
      color: WorldTheme.PRESETS.neonMidnight.pointColor,
      operation: 'reset',
      onWarp: (zone, pos, operation) => this._warpToZone(zone, pos, operation),
    });
    this.engine.scene.add(this.portalB.group);
    this.engine.addUpdatable(this.portalB);

    // Register functional landmarks as interactables: core cycles the lens hub,
    // portals are triggered by walking through them.
    this._registerLandmarkInteractions();

    // Per-frame hook: portal trigger checks and core activity sync.
    this.engine.addUpdatable({
      update: (delta, time) => this._updateWorld(delta, time),
    });

    // Register visual elements for gaze/pointer tooltips.
    this._registerTooltipTargets();

    // In-VR movable panels.
    this.telemetryPanel = new InputTelemetry(this.engine);
    this.engine.addUpdatable(this.telemetryPanel);

    this.vrConsole = new VRConsole(this.engine.cameraGroup);
    this.engine.addUpdatable(this.vrConsole);

    this.portalsEnabled = true;
    this.vrMenu = new VRMenu(this.engine.cameraGroup, {
      onLoadDataset: (entry) => this.loadDataset(entry),
      onTogglePortals: (enabled) => this.setPortalsEnabled(enabled),
      onConnectStream: () => this.connectLiveStream(),
      onDisconnectStream: () => this.disconnectLiveStream(),
      onSelectLiveSource: (sourceKey) => this.connectLiveSource(sourceKey),
      onFilter: () => this.applyDataOperation('filter'),
      onSort: () => this.applyDataOperation('sort'),
      onAggregate: () => this.applyDataOperation('aggregate'),
      onCluster: () => this.applyDataOperation('cluster'),
      onHierarchicalCluster: () => this.applyDataOperation('hierarchical'),
      onDensityCluster: () => this.applyDataOperation('density'),
      onAnomaly: () => this.applyDataOperation('anomaly'),
      onTimeSlice: () => this.applyDataOperation('timeSlice'),
      onReset: () => this.resetDataOperation(),
    });
    this.engine.addUpdatable(this.vrMenu);

    // Independent panel manager: registers panels for per-panel toggling and
    // the launcher ring. InputRouter still handles raycast/drag; PanelManager
    // handles visibility orchestration. Free-floating mode lets users drag panels
    // independently; their poses are persisted with the session.
    this.panelManager = new PanelManager(this.engine.cameraGroup, {
      analystAnchor: this.analystAnchor,
      freeFloating: true,
      onChange: () => this._requestAutoSave(),
    });
    this.panelManager.register(this.telemetryPanel);
    this.panelManager.register(this.vrConsole);
    this.panelManager.register(this.vrMenu);
    this.engine.input.setPanelManager(this.panelManager);
    this.engine.input.addPanel(this.telemetryPanel);
    this.engine.input.addPanel(this.vrConsole);
    this.engine.input.addPanel(this.vrMenu);

    // Mini-overview / mini-map showing palace and camera frustum.
    this.miniOverview = new MiniOverview(this.engine.cameraGroup, {
      followAnchor: this.analystAnchor,
      getNodeMeshes: () => this.dracoNode?.artifact?.nodeMeshes ?? [],
      getCamera: () => this.engine.camera,
      position: [0.9, 1.35, -0.7],
      size: 0.5,
    });
    this.miniOverview.setEnabled(this.settingsPanel?.getSetting?.('miniOverview') ?? true);
    this.engine.addUpdatable(this.miniOverview);

    // Peer-presence HUD for collaboration.
    this.peerPresenceHUD = new PeerPresenceHUD(this.engine.cameraGroup, {
      followAnchor: this.analystAnchor,
      getPeers: () => this.networkManager?.room?.getRemoteSnapshot() ?? [],
      getLocalPeerId: () => this.networkManager?.peerId ?? null,
      position: [-0.9, 1.35, -0.7],
      size: 0.5,
    });
    this.peerPresenceHUD.setEnabled(this.settingsPanel?.getSetting?.('peerPresence') ?? true);
    this.engine.addUpdatable(this.peerPresenceHUD);

    // Curved, scrollable analyst dashboard in front of the user.
    this.dashboard = new DashboardManager(this.engine.cameraGroup, {
      analystAnchor: this.analystAnchor,
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
    this.dashboardPanels = [];

    // Hand-attached radial wheel menu on the first tracked hand.
    // Guard angles and hover delay are set from Google VR constellation
    // guidelines to reduce accidental opens and hover flashing.
    this.handWheelMenu = new HandWheelMenu(this.engine, this.engine.input.hands[0], {
      feedback: this.engine.input.feedback,
      analystAnchor: this.analystAnchor,
      openAngleThreshold: Math.PI / 8,
      closeAngleThreshold: Math.PI * 0.75,
      hoverDelayMs: 120,
    });
    this.engine.addUpdatable(this.handWheelMenu);
    this.engine.addHudObject(this.handWheelMenu);
    this.engine.input.setHandWheelMenu(this.handWheelMenu);

    this._datasetCycleIndex = -1;

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
      onLoad: (entry) => this.loadDataset(entry),
    });

    // Teleport anchors around the palace.
    this._setupTeleportAnchors();

    // System gesture (controller grip or two-hand pinch) toggles launcher ring.
    this.engine.input.onSystemToggle = () => this._togglePanels();

    // Tell the tooltip manager about any dashboard panels created later.
    this._dashboardTooltipTargets = [];

    // Analysis operation history for undo/redo stepping.
    this.analysisHistory = new AnalysisHistory();

    // Persistent session store (IndexedDB). Auto-saves the world state so the
    // user can resume after a page reload.
    this.sessionStore = new SessionStore();
    this._sessionAutoSaveTimer = null;

    // Opt-in telemetry collector. Local-only until explicitly exported.
    this.telemetryCollector = new TelemetryCollector();
    this.telemetryCollector.loadConsent();
    this.engine.telemetry = this.telemetryCollector;

    // Wire desktop/VR keyboard undo/redo to the analysis history.
    this.engine.onUndo = () => this.undoAnalysis();
    this.engine.onRedo = () => this.redoAnalysis();
    this.engine.onPauseInput = () => this._togglePauseInput();
    this.engine.onResetView = () => this._resetView();

    // Dual-hand gesture recognition.
    this.gestureRecognizer = new HandGestureRecognizer({
      cooldown: 0.65,
      onGesture: (name, ctx) => this._onGesture(name, ctx),
    });
    this.engine.addUpdatable({
      update: (delta, time) => this._updateGestures(delta, time),
    });

    // Statistical-lens visibility state.
    this._statisticalLensEnabled = true;

    // Settings panel for gesture / lens / feedback customization.
    this.settingsPanel = new SettingsPanel(this.engine.cameraGroup, {
      onChange: (key, value) => this._onSettingChanged(key, value),
    });
    this.engine.addUpdatable(this.settingsPanel);
    this.panelManager.register(this.settingsPanel);
    this.engine.input.addPanel(this.settingsPanel);

    // Operation log panel: lightweight provenance of applied operations.
    this.operationLogPanel = new OperationLogPanel(this.engine.cameraGroup);
    this.panelManager.register(this.operationLogPanel);
    this.engine.input.addPanel(this.operationLogPanel);
    this.panelManager.hidePanel(this.operationLogPanel);

    // Telemetry panel: live opt-in session / performance metrics.
    this.metricsPanel = new TelemetryPanel(this.engine.cameraGroup, {
      telemetry: this.telemetryCollector,
    });
    this.panelManager.register(this.metricsPanel);
    this.engine.input.addPanel(this.metricsPanel);
    this.engine.addUpdatable(this.metricsPanel);
    this.panelManager.hidePanel(this.metricsPanel);

    // Performance panel: live budget and violation view for Quest profiling.
    this.performancePanel = new PerformancePanel(this.engine.cameraGroup, {
      budget: this.engine.performanceBudget,
      telemetry: this.telemetryCollector,
    });
    this.panelManager.register(this.performancePanel);
    this.engine.input.addPanel(this.performancePanel);
    this.engine.addUpdatable(this.performancePanel);
    this.panelManager.hidePanel(this.performancePanel);

    // Collaboration network panel and manager (offline until explicitly joined).
    this.networkPanel = new NetworkPanel(this.engine.cameraGroup, {
      telemetry: this.telemetryCollector,
    });
    this.panelManager.register(this.networkPanel);
    this.engine.input.addPanel(this.networkPanel);
    this.engine.addUpdatable(this.networkPanel);
    this.panelManager.hidePanel(this.networkPanel);

    // Interaction coach: running commentary that anchors gestures/controllers to
    // system behavior and teaches the gesture vocabulary.
    this.interactionCoach = new InteractionCoach(this.engine.cameraGroup, {
      userMode: this.settingsPanel?.getSetting?.('userMode') ?? 'novice',
    });
    this.panelManager.register(this.interactionCoach);
    this.engine.input.addPanel(this.interactionCoach);
    this.engine.addUpdatable(this.interactionCoach);
    this.panelManager.hidePanel(this.interactionCoach);

    // Narrative breadcrumb strip: clickable timeline of analysis operations.
    this.narrativeStrip = new NarrativeStrip(this.engine.cameraGroup, {
      analystAnchor: this.analystAnchor,
      history: this.analysisHistory,
      onSeek: (index) => this._seekAnalysisHistory(index),
    });
    this.panelManager.register(this.narrativeStrip);
    this.engine.input.addPanel(this.narrativeStrip);
    this.engine.addUpdatable(this.narrativeStrip);
    this.panelManager.hidePanel(this.narrativeStrip);

    // Controller gesture mapper: emits the same gesture names as hand tracking.
    this.controllerGestureMapper = new ControllerGestureMapper({
      onGesture: (name, ctx) => this._onGesture(name, ctx),
    });
    this.engine.input.setControllerGestureMapper(this.controllerGestureMapper);

    // Apply initial settings to feedback.
    this._applyFeedbackSettings(this.settingsPanel.getAllSettings());
    // The settings panel is toggled on demand; do not show it at startup.
    this.panelManager.hidePanel(this.settingsPanel);

    // Guided tour: step-by-step spatial onboarding.
    this.guidedTour = new GuidedTour(this.engine, {
      feedback: this.engine.input.feedback,
      tour: FIRST_DATASET_TOUR,
      resolveTarget: (target) => this._resolveTourTarget(target),
      checkCondition: (step) => this._checkTourCondition(step),
      onComplete: () => this.vrConsole?.log?.('log', ['Tour complete']),
    });
    this.engine.addUpdatable(this.guidedTour);

    // Track whether the guided tour has been auto-started for novice users.
    this._tourAutoStarted = false;

    // Load default sample, then restore an autosave if one exists.
    this.loadDataset(DEFAULT_DATASET_ENTRY);
    this._restoreAutoSave();

    // Apply the initial user mode (novice by default) to the coach, tooltips,
    // and tour visibility.
    this._applyUserModeSettings();

    // Apply initial comfort and panel-distance settings from the saved/default
    // settings panel values.
    this._applyComfortSettings();
    this._applyPanelDistance();

    // Restore cross-platform shared settings asynchronously after the baseline
    // defaults have been applied.
    this._loadSharedSettings();
  }

  _resolveTourTarget(target) {
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
        const ops = this.handWheelMenu?._categories?.find((c) => c.id === 'ops');
        return ops ? { position: new THREE.Vector3(0, 1.4, -0.6) } : null;
      }
      case 'gesture-hint':
        return { position: new THREE.Vector3(0, 1.5, -1.0) };
      case 'settings-panel':
        return this.settingsPanel?.mesh ? { object: this.settingsPanel.mesh } : null;
      case 'dashboard':
        return { position: new THREE.Vector3(0, 1.45, -1.35) };
      default:
        return null;
    }
  }

  _checkTourCondition(step) {
    // Auto-advance a few steps when the user performs the hinted action.
    switch (step.target) {
      case 'node-mesh':
        return this.inspector?.active === true;
      case 'wheel-menu':
        return this.handWheelMenu?.isVisible?.() === true;
      case 'settings-panel':
        return this.settingsPanel?.mesh?.visible === true;
      default:
        return false;
    }
  }

  startTour() {
    return this.guidedTour?.start?.();
  }

  stopTour() {
    this.guidedTour?.stop?.();
  }

  _registerTooltipTargets() {
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

  _registerLandmarkInteractions() {
    if (this.core?.group) {
      this.engine.addInteractable(this.core.group, {
        onEnter: () => {},
        onLeave: () => {},
        onSelect: () => this._onCoreSelect(),
      });
    }
  }

  _onCoreSelect() {
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

  _applyPortalOperation(operation) {
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
  async saveSession(id = 'autosave') {
    if (!this.currentEntry?.dataset || !this.dracoNode) return;

    const snapshot = {
      version: 1,
      savedAt: Date.now(),
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
      await this.sessionStore.saveSession(id, snapshot);
      this.vrConsole?.log?.('log', [`Session saved: ${id}`]);
      this._logInteraction('Save session', { result: id });
    } catch (err) {
      console.warn('[World] failed to save session:', err);
      this.vrConsole?.log?.('warn', [`Session save failed: ${err.message}`]);
    }
  }

  /**
   * Restore a saved session. Rebuilds the dataset, palace, camera pose, history,
   * settings, and tour progress from the snapshot.
   */
  async loadSession(id = 'autosave') {
    const snapshot = await this.sessionStore.loadSession(id);
    if (!snapshot) {
      this.vrConsole?.log?.('log', [`No saved session: ${id}`]);
      return false;
    }

    if (!snapshot.originalDataset) {
      this.vrConsole?.log?.('warn', [`Session ${id} has no dataset`]);
      return false;
    }

    const original = Dataset.fromJSON(snapshot.originalDataset);
    const transformed = snapshot.transformedDataset
      ? Dataset.fromJSON(snapshot.transformedDataset)
      : original.clone();

    const entry = {
      name: snapshot.entry?.name ?? original.name,
      topology: snapshot.entry?.topology ?? 'TABULAR',
      dataset: original,
      maxDepth: snapshot.entry?.maxDepth,
      encodings: snapshot.entry?.encodings,
    };

    this.loadDataset(entry);
    this._originalDataset = original.clone();
    this._transformedDataset = transformed.clone();

    // Restore the analysis history so undo/redo works across sessions.
    if (snapshot.analysisHistory) {
      this.analysisHistory = AnalysisHistory.fromJSON(snapshot.analysisHistory);
    } else {
      this.analysisHistory.clear();
    }
    this.narrativeStrip?.setHistory?.(this.analysisHistory);
    this._updateNarrativeStrip();

    // Re-apply the visual transform of the current history frame, if any.
    const current = this.analysisHistory.current();
    if (current) {
      this._restoreDataset(current.dataset, current.operation);
    } else {
      this._restoreDataset(this._transformedDataset, 'reset');
    }

    // Restore camera pose.
    if (snapshot.camera?.position) {
      this.engine.cameraGroup.position.fromArray(snapshot.camera.position);
    }
    if (typeof snapshot.camera?.rotationY === 'number') {
      this.engine.cameraGroup.rotation.y = snapshot.camera.rotationY;
    }

    // Restore settings (including comfort and user mode).
    if (snapshot.settings) {
      for (const [key, value] of Object.entries(snapshot.settings)) {
        this.settingsPanel?.setSetting?.(key, value);
      }
      this._applyComfortSettings();
      this._applyPanelDistance();
    }

    // Restore theme.
    if (snapshot.theme && this.engine.theme?.applyPreset) {
      this.engine.theme.applyPreset(snapshot.theme);
    }

    // Restore panel layout (free-floating positions and visibility).
    if (snapshot.panelPositions && this.panelManager) {
      this.panelManager.setPanelPositions(snapshot.panelPositions);
    }

    // Restore tour progress.
    if (this.guidedTour && snapshot.tour && !snapshot.tour.finished) {
      this.guidedTour._stepIndex = snapshot.tour.stepIndex ?? 0;
      this.guidedTour._finished = false;
      this.guidedTour._active = true;
      this.guidedTour._cardGroup.visible = true;
      this.guidedTour._renderStep();
    }

    this.vrConsole?.log?.('log', [`Session restored: ${id}`]);
    return true;
  }

  async deleteSession(id) {
    try {
      await this.sessionStore.deleteSession(id);
      this.vrConsole?.log?.('log', [`Session deleted: ${id}`]);
    } catch (err) {
      console.warn('[World] failed to delete session:', err);
    }
  }

  /**
   * Queue an automatic save after a short debounce. Called from actions that
   * mutate the world state.
   */
  _requestAutoSave() {
    if (this._sessionAutoSaveTimer) clearTimeout(this._sessionAutoSaveTimer);
    this._sessionAutoSaveTimer = setTimeout(() => this.saveSession('autosave'), 2000);
  }

  async _restoreAutoSave() {
    try {
      const has = await this.sessionStore.hasSession('autosave');
      if (!has) return;
      this.vrConsole?.log?.('log', ['Restoring autosave...']);
      const restored = await this.loadSession('autosave');
      if (restored) this._applyUserModeSettings();
      return restored;
    } catch (err) {
      console.warn('[World] autosave restore failed:', err);
    }
  }

  _captureSession() {
    this._requestAutoSave();
  }

  /**
   * Capture the current renderer output as a PNG/JPEG screenshot and trigger a
   * browser download.
   */
  exportScreenshot(format = 'png') {
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
      this.vrConsole?.log?.('warn', [`Screenshot export failed: ${err.message}`]);
    }
  }

  /**
   * Build a JSON "analysis story" describing the current dataset, applied
   * operations, camera position, and theme.
   */
  _buildAnalysisStory() {
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
  exportAnalysisStory() {
    const story = this._buildAnalysisStory();
    this.downloadAnalysisStory(story);
    this._logInteraction('Export story', { result: `nemosyne-story-${story.timestamp}.json` });
    return story;
  }

  /**
   * Download a previously-built analysis story, or build one if none provided.
   */
  downloadAnalysisStory(story = null) {
    const data = story ?? this._buildAnalysisStory();
    const text = JSON.stringify(data, null, 2);
    const filename = `nemosyne-story-${data.timestamp}.json`;
    downloadText(text, filename, 'application/json');
    this.vrConsole?.log?.('log', [`Analysis story exported: ${filename}`]);
  }

  _updateWorld(delta, time) {
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

  _broadcastPresence() {
    const nm = this.collaborationCoordinator.networkManager;
    if (!nm?.isConnected) return;
    const pos = this.engine.cameraGroup.position;
    nm.setLocalState({
      position: { x: pos.x, y: pos.y, z: pos.z },
      rotationY: this.engine.cameraGroup.rotation.y,
      dataset: this.currentEntry?.name ?? this.currentEntry?.label ?? '-',
    });
  }

  _logInteraction(action, { gesture, controller, result } = {}) {
    this.interactionCoach?.log?.({ action, gesture, controller, result });
  }

  _trackCameraForAutoSave() {
    if (!this._lastCameraPosition) {
      this._lastCameraPosition = this.engine.cameraGroup.position.clone();
      return;
    }
    if (this.engine.cameraGroup.position.distanceToSquared(this._lastCameraPosition) > 0.01) {
      this._lastCameraPosition.copy(this.engine.cameraGroup.position);
      this._captureSession();
    }
  }

  _setupTeleportAnchors() {
    this.engine.locomotion.addAnchor('overview', [0, 0, -6], 0, 'Overview');
    this.engine.locomotion.addAnchor('detail', [0, 0, -3], 0, 'Detail');
    this.engine.locomotion.addAnchor('north', [-4, 0, -6], Math.PI / 4, 'North');
    this.engine.locomotion.addAnchor('south', [4, 0, -6], -Math.PI / 4, 'South');
  }

  _updateGestures(delta, time) {
    if (this.settingsPanel?.getSetting('gesturesEnabled') === false) return;
    this._updateInputContext();
    if (this._handNearArtefact) return;
    this.gestureRecognizer.setHands(this.engine.input.hands);
    this.gestureRecognizer.update(delta, time);
  }

  /**
   * Infer input context from hand poses and scene widgets. Used to suppress
   * conflicting commands when the user is interacting with an artefact or the
   * wheel menu.
   */
  _updateInputContext() {
    const hands = this.engine.input.hands;
    if (!hands?.length) {
      this._handNearArtefact = false;
      this._handNearWheelMenu = false;
      this.engine.input.setSuppressSceneSelection?.(false);
      this.engine.locomotion?.setEnabled?.(true);
      return;
    }

    // Dominant hand position in world space.
    const handPos = new THREE.Vector3();
    const dominant = hands[this.gestureRecognizer?.dominantHandIndex ?? 0] ?? hands[0];
    if (dominant.getHandTransform) {
      const q = new THREE.Quaternion();
      dominant.getHandTransform(handPos, q);
    } else if (dominant.rayOrigin) {
      handPos.copy(dominant.rayOrigin);
    }

    // Check proximity to the palace centre / node bounding sphere.
    let artefactCenter = null;
    let artefactRadius = 0;
    const nodeMeshes = this.dracoNode?.artifact?.nodeMeshes ?? [];
    if (nodeMeshes.length > 0) {
      const box = new THREE.Box3().setFromObject(this.dracoNode.group);
      artefactCenter = new THREE.Vector3();
      box.getCenter(artefactCenter);
      artefactRadius = box.getBoundingSphere(new THREE.Sphere()).radius;
    }
    this._handNearArtefact =
      artefactCenter != null && handPos.distanceToSquared(artefactCenter) < artefactRadius * artefactRadius;

    // Check proximity to the hand-attached wheel menu.
    const wheelWorldPos = new THREE.Vector3();
    this.handWheelMenu?.group?.getWorldPosition(wheelWorldPos);
    const wheelVisible = this.handWheelMenu?.isVisible?.() ?? false;
    let nearWheel = false;
    if (wheelVisible) {
      for (const hand of hands) {
        let pos = new THREE.Vector3();
        if (hand.getHandTransform) {
          const q = new THREE.Quaternion();
          hand.getHandTransform(pos, q);
        } else if (hand.rayOrigin) {
          pos.copy(hand.rayOrigin);
        }
        if (pos.distanceToSquared(wheelWorldPos) < 0.25) {
          nearWheel = true;
          break;
        }
      }
    }
    this._handNearWheelMenu = nearWheel;

    const paused = !!this._inputPaused;
    this.engine.input.setSuppressSceneSelection?.(this._handNearWheelMenu || paused);
    this.engine.locomotion?.setEnabled?.(!this._handNearArtefact && !paused);
  }

  _onGesture(name, ctx = {}) {
    // Global pause/resume overrides everything except the pause gesture itself.
    if (this._inputPaused && name !== 'pauseResume') {
      this.vrConsole?.log?.('log', ['Input paused — gesture ignored']);
      return;
    }

    this.telemetryCollector?.recordGesture?.(name);

    // Multi-modal feedback so gesture recognition is perceptible.
    this.engine.input.feedback?.playGestureTone?.(name);
    this.engine.input.feedback?.playHaptic?.(0.6, 50);

    const source = ctx.source === 'controller' ? 'controller' : 'hand';
    const meta = getGestureMeta(name);
    const input =
      source === 'controller'
        ? ctx.button
          ? `Controller ${ctx.button}`
          : ctx.input
            ? `Controller ${ctx.input}`
            : meta?.controller
        : meta?.hand;

    this._logInteraction(meta?.action ?? name, {
      gesture: name,
      controller: source === 'controller' ? input : null,
    });

    // Route the intent to the matching World action.
    switch (name) {
      case 'pinchTogether':
        this.applyDataOperation('filter');
        break;
      case 'pinchApart':
        this.applyDataOperation('aggregate');
        break;
      case 'swipeRight':
        this._cycleDataset(1);
        break;
      case 'swipeLeft':
        this._cycleDataset(-1);
        break;
      case 'sliceUp':
        this.applyDataOperation('sort');
        break;
      case 'sliceDown':
        this.applyDataOperation('timeSlice');
        break;
      case 'scoopUp':
        if (this.engine.locomotion.flightMode) {
          this.engine.locomotion.ascend();
          this.vrConsole?.log?.('log', ['Flight: ascend']);
        } else {
          this._toggleStatisticalLens();
        }
        break;
      case 'scoopDown':
        if (this.engine.locomotion.flightMode) {
          this.engine.locomotion.descend();
          this.vrConsole?.log?.('log', ['Flight: descend']);
        }
        break;
      case 'pushForward':
        // Infer intent from hand state: open hands reset the view, pinched hands
        // reset the data operations.
        if (ctx.openHands) {
          this._resetView();
        } else {
          this.resetDataOperation();
        }
        break;
      case 'rotateCW':
        this.redoAnalysis();
        break;
      case 'rotateCCW':
        this.undoAnalysis();
        break;
      case 'okSign':
        this._toggleSettingsPanel();
        break;
      case 'pauseResume':
        this._togglePauseInput();
        break;
      // 'bothPinched' is reserved for the system launcher toggle.
      default:
        break;
    }
  }

  _togglePauseInput() {
    this._inputPaused = !this._inputPaused;
    this.vrConsole?.log?.('log', [`Input ${this._inputPaused ? 'paused' : 'resumed'}`]);
    this._logInteraction('Pause input', { result: this._inputPaused ? 'paused' : 'resumed' });
  }

  /**
   * Return the camera to a default overview anchor without undoing analysis
   * history. This is the spatial equivalent of a "reset view" command.
   */
  _resetView() {
    this.engine.locomotion.teleportToAnchor('overview');
    this.vrConsole?.log?.('log', ['View reset to overview']);
    this._logInteraction('Reset view', { result: 'overview' });
    this._captureSession();
  }

  /**
   * Load a ready-made analysis template: dataset, theme, and tour in one step.
   * @param {string} templateId
   */
  loadTemplate(templateId) {
    const resolved = resolveTemplate(templateId, allSampleDatasets);
    if (!resolved) {
      this.vrConsole?.log?.('warn', [`Unknown analysis template: ${templateId}`]);
      return false;
    }
    const { entry, theme, tourId } = resolved;
    const fullEntry = {
      key: entry.key,
      name: entry.label,
      topology: TopologyTypes[entry.topology] ?? entry.topology,
      dataset: entry.dataset,
      maxDepth: entry.depth ?? entry.maxDepth ?? 1,
      encodings: entry.encodings ?? getDefaultEncodings(entry),
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
   */
  loadDataset(entry) {
    console.log('[World] loading dataset:', entry.name, entry.topology);

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
      disposeObject(this.dracoNode.group);
      this.dracoNode = null;
    }

    if (this.diagnostic) {
      this.engine.input.panels = this.engine.input.panels.filter((p) => p !== this.diagnostic);
      disposeObject(this.diagnostic.mesh);
      this.diagnostic = null;
    }

    // Build new Draco palace.
    const dataInput = {
      topology: entry.topology,
      dataset: entry.dataset,
      maxDepth: entry.maxDepth,
      encodings:
        entry.encodings ??
        getDefaultEncodings({ dataset: entry.dataset, topology: entry.topology }),
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
    this.telemetryCollector?.recordDataset?.(entry.name ?? entry.label, entry.topology);

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

  _attachTDASummary() {
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

  _buildDashboard() {
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
    const facts = this.dracoNode?.engine?.extractFacts?.(ds) ?? {
      numericColumns: ds.numericColumns.length,
    };

    const panels = [];

    if (facts.numericColumns > 1 || ds.numericColumns.length > 1) {
      panels.push(
        new ChartPlanePanel(this.engine.cameraGroup, ds, {
          title: 'Correlation Matrix',
          chartType: 'CORRELATION',
        })
      );
    }

    if (facts.hasTimeSeries || ds.temporalColumns.length > 0) {
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
      panel.mesh.visible = true;
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

  _updateDashboardDatasets(dataset) {
    for (const entry of this.dashboardPanels ?? []) {
      entry.panel.setDataset(dataset);
    }
  }

  _wireArtifactInteraction(dracoNode) {
    const wire = () => {
      if (!dracoNode.artifact) return;
      this.tooltipManager.setTargets(dracoNode.artifact.nodeMeshes);
      for (const mesh of dracoNode.artifact.nodeMeshes) {
        this.engine.addInteractable(mesh, {
          onEnter: (m) => dracoNode.artifact.interactions.onHover(m),
          onLeave: (m) => dracoNode.artifact.interactions.onUnhover(m),
          onSelect: (m) => {
            dracoNode.artifact.interactions.onSelect(m);
            this._showDataCard(m);
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

  _showDataCard(mesh) {
    const pointer = this.engine.input.getActivePointer();
    this.inspector.showAtNode(mesh, mesh.userData.row, pointer, 'DATA NODE');
  }

  _warpToZone(zone, pos, operation) {
    // First apply the data transformation that the gate represents.
    this._applyPortalOperation(operation);

    this.engine.cameraGroup.position.set(...pos);
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

  _togglePanels() {
    this.panelManager.toggleLauncher();
    this._logInteraction('Launcher', {
      result: this.panelManager.isLauncherVisible() ? 'opened' : 'closed',
    });
  }

  _cycleDataset(delta = 1) {
    const n = allSampleDatasets.length;
    this._datasetCycleIndex = (this._datasetCycleIndex + delta + n) % n;
    const entry = allSampleDatasets[this._datasetCycleIndex];
    this.loadDataset({
      key: entry.key,
      name: entry.label,
      topology: TopologyTypes[entry.topology] ?? entry.topology,
      dataset: entry.dataset,
      maxDepth: entry.depth ?? 1,
      encodings: getDefaultEncodings(entry),
    });
    this.vrConsole?.log?.('log', [`Dataset: ${entry.label}`]);
    this._logInteraction('Dataset', { result: entry.label });
  }

  _cycleThemePreset() {
    const name = this.engine.theme.cyclePreset();
    this.vrConsole?.log?.('log', [`Theme: ${name}`]);
    this._logInteraction('Theme', { result: name });
    this._captureSession();
  }

  _toggleStatisticalLens() {
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

  _toggleMiniOverview() {
    const next = !this.miniOverview.mesh.visible;
    this.miniOverview.setEnabled(next);
    this.settingsPanel?.setSetting?.('miniOverview', next);
    this.vrConsole?.log?.('log', [`Mini overview ${next ? 'on' : 'off'}`]);
    this._logInteraction('Mini overview', { result: next ? 'on' : 'off' });
    this._captureSession();
  }

  _togglePeerPresenceHUD() {
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
  _toggleDesktopPreview() {
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
        this._orbitControls = new OrbitControls(this.engine.camera, this.engine.renderer.domElement);
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
      this._orbitControls && (this._orbitControls.enabled = false);
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
  async _saveSharedSettings() {
    if (!this.sessionStore || !this.settingsPanel) return;
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
      console.warn('[World] failed to save shared settings:', err);
    }
  }

  /**
   * Restore cross-platform shared settings. Applied before the per-session
   * autosave so the current session can override shared defaults.
   */
  async _loadSharedSettings() {
    if (!this.sessionStore || !this.settingsPanel) return;
    try {
      const shared = await this.sessionStore.getItem('shared-settings');
      if (!shared?.settings) return;
      for (const [key, value] of Object.entries(shared.settings)) {
        this.settingsPanel.setSetting(key, value);
      }
      this._applyComfortSettings();
      this._applyPanelDistance();
      this._applyFeedbackSettings(this.settingsPanel.getAllSettings());
      this._applyAccessibilitySettings();
      this.vrConsole?.log?.('log', ['Shared settings restored']);
    } catch (err) {
      console.warn('[World] failed to load shared settings:', err);
    }
  }

  _setStatisticalLensVisible(enabled) {
    const tdaEnabled = enabled && (this.settingsPanel?.getSetting('lensTDA') ?? true);
    const corrEnabled = enabled && (this.settingsPanel?.getSetting('lensCorrelation') ?? true);
    if (this.tdaGroup) this.tdaGroup.visible = tdaEnabled;
    const corr = this.dashboardPanels?.find((e) => e.panel?.chartType === 'CORRELATION');
    if (corr?.panel?.mesh) corr.panel.mesh.visible = corrEnabled;
  }

  _toggleSettingsPanel() {
    if (!this.settingsPanel) return;
    this.panelManager.togglePanel(this.settingsPanel);
    this._logInteraction('Settings panel', {
      result: this.settingsPanel.mesh.visible ? 'opened' : 'closed',
    });
  }

  _onSettingChanged(key, value) {
    if (key.startsWith('lens')) {
      this._setStatisticalLensVisible(this._statisticalLensEnabled);
    } else if (key.startsWith('feedback')) {
      this._applyFeedbackSettings(this.settingsPanel.getAllSettings());
    } else if (key === 'telemetryEnabled') {
      this.telemetryCollector.saveConsent(value);
      this.vrConsole?.log?.('log', [`Telemetry ${value ? 'enabled' : 'disabled'}`]);
    } else if (['textScale', 'highContrast', 'colorblindMode', 'dwellSelection'].includes(key)) {
      this._applyAccessibilitySettings();
    } else if (key === 'strictBudget') {
      const budgets = value ? { frameMs: 13.33, droppedFramesPer10s: 2 } : {};
      this.engine.performanceBudget.setBudgets(budgets);
      this.vrConsole?.log?.('log', [`Performance budget ${value ? 'strict' : 'default'}`]);
    } else if (key === 'collabEnabled') {
      if (value) this._joinCollaborationRoom();
      else this._leaveCollaborationRoom();
    } else if (key === 'collabRoom') {
      if (this.settingsPanel.getSetting('collabEnabled')) {
        this._leaveCollaborationRoom();
        this._joinCollaborationRoom(value);
      }
    } else if (key === 'userMode') {
      this._applyUserModeSettings();
      this.inPlaceHandles?.setUserMode?.(this.settingsPanel.getSetting('userMode'));
    } else if (['snapTurn', 'snapTurnAngle', 'reducedMotion'].includes(key)) {
      this._applyComfortSettings();
    } else if (key === 'vignette' || key === 'vignetteIntensity') {
      this._applyComfortSettings();
    } else if (key === 'seatedHeightOffset') {
      this._applyComfortSettings();
    } else if (key === 'defaultPanelDistance') {
      this._applyPanelDistance();
    } else if (key === 'miniOverview') {
      this.miniOverview?.setEnabled?.(value);
    } else if (key === 'peerPresence') {
      this.peerPresenceHUD?.setEnabled?.(value);
    }
    this._saveSharedSettings();
    this._logInteraction('Setting changed', { result: `${key} = ${value}` });
    this._captureSession();
  }

  _applyAccessibilitySettings() {
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
      this.engine.theme.applyColorblindMode?.(options.colorblindMode);
    } else {
      this.engine.theme.applyPreset?.(this.engine.theme.currentPreset);
    }
  }

  _applyFeedbackSettings(settings) {
    this.engine.input.feedback.setToggles({
      audio: settings.feedbackAudio,
      haptic: settings.feedbackHaptic,
      visual: settings.feedbackVisual,
    });
  }

  /**
   * Apply comfort settings to the engine/locomotion and optional vignette.
   */
  _applyComfortSettings() {
    const settings = this.settingsPanel.getAllSettings();
    const locomotion = this.engine.locomotion;
    locomotion.setSnapTurnEnabled?.(settings.snapTurn ?? true);
    locomotion.setSnapAngle?.(((settings.snapTurnAngle ?? 30) * Math.PI) / 180);
    locomotion.setReducedMotion?.(settings.reducedMotion ?? false);
    locomotion.setSeatedHeightOffset?.(settings.seatedHeightOffset ?? 0);
    this.engine.setVignetteEnabled?.(settings.vignette ?? false, settings.vignetteIntensity ?? 0.4);
  }

  /**
   * Apply default panel distance by moving the analyst anchor forward/back.
   * Panels remain at their local positions relative to the anchor.
   */
  _applyPanelDistance() {
    const settings = this.settingsPanel.getAllSettings();
    const distance = settings.defaultPanelDistance ?? 1.2;
    if (this.analystAnchor) {
      this.analystAnchor.position.z = -distance;
    }
  }

  /**
   * Apply the current `userMode` setting to the interaction coach, tooltips,
   * and guided tour. Novice users get an automatic tour start and a full
   * interaction coach; intermediate users get a collapsed coach; expert users
   * disable coach logging and hide most tooltips.
   */
  _applyUserModeSettings() {
    const mode = this.settingsPanel?.getSetting?.('userMode') ?? 'novice';
    this.interactionCoach?.setUserMode?.(mode);
    this.guidedTour?.setUserMode?.(mode);
    if (this.tooltipManager) this.tooltipManager.setEnabled(mode !== 'expert');

    if (mode === 'novice') {
      if (
        this.guidedTour &&
        !this.guidedTour.isActive &&
        !this.guidedTour.isFinished &&
        !this._tourAutoStarted
      ) {
        this.startTour();
        this._tourAutoStarted = true;
      }
    } else if (mode === 'expert') {
      this.panelManager?.hidePanel?.(this.interactionCoach);
      if (this.guidedTour && !this.guidedTour.isFinished) {
        this.guidedTour.skip();
      }
    }
  }

  _joinCollaborationRoom(roomId = null) {
    return this.collaborationCoordinator.joinCollaborationRoom(roomId);
  }

  _leaveCollaborationRoom() {
    this.collaborationCoordinator.leaveCollaborationRoom();
  }

  get networkManager() {
    return this.collaborationCoordinator?.networkManager ?? null;
  }

  undoAnalysis() {
    if (!this.analysisHistory.canUndo) return;
    const frame = this.analysisHistory.undo();
    this._restoreDataset(frame.dataset, frame.operation);
    this._updateNarrativeStrip();
    this.vrConsole?.log?.('log', [`Undo: ${frame.operation}`]);
    this._logInteraction('Undo', { result: frame.operation });
  }

  redoAnalysis() {
    if (!this.analysisHistory.canRedo) return;
    const frame = this.analysisHistory.redo();
    this._restoreDataset(frame.dataset, frame.operation);
    this._updateNarrativeStrip();
    this.vrConsole?.log?.('log', [`Redo: ${frame.operation}`]);
    this._logInteraction('Redo', { result: frame.operation });
  }

  _restoreDataset(dataset, operation) {
    if (!dataset || !this.dracoNode) return;

    this._transformedDataset = dataset.clone();
    this.dracoNode.dataInput.dataset = this._transformedDataset;
    this.dracoNode.reSolveAndSynthesize();

    // Re-apply the visual transform that belongs to this operation, because a
    // full re-solve only rebuilds the artefact from the dataset.
    switch (operation) {
      case 'filter':
        applyFilter(this.dracoNode.artifact, this._transformedDataset);
        break;
      case 'sort':
        applySort(this.dracoNode.artifact, this._transformedDataset);
        break;
      case 'aggregate':
        applyAggregate(this.dracoNode.artifact, this._transformedDataset);
        break;
      case 'cluster':
        applyCluster(this.dracoNode.artifact, this._transformedDataset);
        break;
      case 'hierarchical':
        applyHierarchicalCluster(this.dracoNode.artifact, this._transformedDataset);
        break;
      case 'density':
        applyDensityCluster(this.dracoNode.artifact, this._transformedDataset);
        break;
      case 'anomaly':
        applyAnomaly(this.dracoNode.artifact, this._transformedDataset);
        break;
      case 'timeSlice':
        applySlice(this.dracoNode.artifact, this._transformedDataset, this._originalDataset);
        break;
      case 'reset':
      default:
        resetTransforms(this.dracoNode.artifact);
        break;
    }

    this._updateDashboardDatasets(this._transformedDataset);
    if (this.tdaRecompute && operation !== 'anomaly') {
      this.tdaRecompute();
    }
  }

  _pushAnalysisHistory(operation, datasetBefore, datasetAfter, parameters = {}) {
    this.analysisHistory.push(operation, datasetBefore, datasetAfter, parameters);
    this.telemetryCollector?.recordOperation?.(operation);
    this._updateOperationLog();
    this._updateNarrativeStrip();
    this._captureSession();
  }

  _seekAnalysisHistory(index) {
    const frame = this.analysisHistory?.seek?.(index);
    if (!frame) return;
    this._restoreDataset(frame.dataset, frame.operation);
    this._updateNarrativeStrip();
    this.vrConsole?.log?.('log', [`Rewound to ${frame.operation}`]);
    this._logInteraction('Seek history', { result: frame.operation });
    this._captureSession();
  }

  _updateNarrativeStrip() {
    this.narrativeStrip?.render?.();
    if (this.analysisHistory?.length > 0) {
      this.panelManager?.showPanel?.(this.narrativeStrip);
    }
  }

  _updateOperationLog() {
    const entries = this.analysisHistory.frames().map((f) => ({
      operation: f.operation,
      rowCount: f.datasetAfter?.rowCount,
      timestamp: f.timestamp,
    }));
    this.operationLogPanel?.setEntries(entries);
  }

  _buildWheelMenu() {
    this.handWheelMenu.setMenu([
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
          const opItem = (id, label, icon, op) => ({
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

  setPortalsEnabled(enabled) {
    this.portalsEnabled = enabled;
    this.portalA.group.visible = enabled;
    this.portalB.group.visible = enabled;
    this.vrMenu?.setPortalsEnabled?.(enabled);
    this._logInteraction('Portals', { result: enabled ? 'visible' : 'hidden' });
  }

  _updateTelemetry() {
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
   * @param {string} sourceKey from src/data/connectors/OpenDataSources.js
   */
  connectLiveSource(sourceKey) {
    return this.liveStreamCoordinator.connectLiveSource(sourceKey);
  }

  /**
   * Connect to a raw WebSocket data stream.
   * If no URL is supplied, the bundled demo endpoint is used.
   */
  connectLiveStream(url, options) {
    return this.liveStreamCoordinator.connectLiveStream(url, options);
  }

  disconnectLiveStream() {
    this.liveStreamCoordinator.disconnectLiveStream();
  }

  get liveConnector() {
    return this.liveStreamCoordinator?.liveConnector ?? null;
  }

  get _liveFlushTimer() {
    return this.liveStreamCoordinator?._liveFlushTimer ?? null;
  }

  get _pendingRows() {
    return this.liveStreamCoordinator?._pendingRows ?? [];
  }

  isLiveConnected() {
    return this.liveStreamCoordinator.isLiveConnected();
  }

  /**
   * Apply a named dataset operation and its matching VR artefact transform.
   * Supported: 'filter', 'sort', 'aggregate', 'cluster', 'timeSlice'.
   */
  applyDataOperation(operation) {
    if (!this._originalDataset || !this.dracoNode?.artifact) {
      console.warn('[World] no dataset/artefact available for operation:', operation);
      return;
    }

    if (!this._transformedDataset) {
      this._transformedDataset = this._originalDataset.clone();
    }

    const datasetBefore = this._transformedDataset.clone();
    captureBaseState(this.dracoNode.artifact);

    this._transformedDataset = computeOperationDataset(
      operation,
      this._transformedDataset,
      this._originalDataset
    );

    switch (operation) {
      case 'filter':
        applyFilter(this.dracoNode.artifact, this._transformedDataset);
        break;
      case 'sort':
        applySort(this.dracoNode.artifact, this._transformedDataset);
        break;
      case 'aggregate':
        applyAggregate(this.dracoNode.artifact, this._transformedDataset);
        break;
      case 'cluster':
        applyCluster(this.dracoNode.artifact, this._transformedDataset);
        break;
      case 'hierarchical':
        applyHierarchicalCluster(this.dracoNode.artifact, this._transformedDataset);
        break;
      case 'density':
        applyDensityCluster(this.dracoNode.artifact, this._transformedDataset);
        break;
      case 'anomaly':
        applyAnomaly(this.dracoNode.artifact, this._transformedDataset);
        break;
      case 'timeSlice':
        applySlice(this.dracoNode.artifact, this._transformedDataset, this._originalDataset);
        break;
      default:
        return;
    }

    // Commit clears any transient preview.
    this.clearOperationPreview();

    if (this.tdaRecompute && operation !== 'anomaly') {
      this.tdaRecompute();
    }

    this._updateDashboardDatasets(this._transformedDataset);
    this._pushAnalysisHistory(operation, datasetBefore, this._transformedDataset);

    this.vrConsole?.log?.('log', [
      `Operation: ${operation} → ${this._transformedDataset.rowCount} rows`,
    ]);
    this._logInteraction(operation, {
      result: `${this._transformedDataset.rowCount} rows`,
    });
  }

  /**
   * Show a transient preview of what `operation` would do to the current
   * palace without mutating the dataset or artefact. Cleared automatically
   * when the operation is applied or when the menu is closed.
   */
  previewDataOperation(operation) {
    if (!this._originalDataset || !this.dracoNode?.artifact) return;
    if (!this._transformedDataset) {
      this._transformedDataset = this._originalDataset.clone();
    }
    const previewDataset = computeOperationDataset(
      operation,
      this._transformedDataset,
      this._originalDataset
    );
    this.livePreview.preview(operation, previewDataset, this._originalDataset, this.dracoNode.artifact);
  }

  clearOperationPreview() {
    this.livePreview.clear();
  }

  /** Restore the original dataset and reset artefact transforms. */
  resetDataOperation() {
    if (!this._originalDataset || !this.dracoNode?.artifact) return;
    this.clearOperationPreview();
    const datasetBefore = this._transformedDataset?.clone?.() ?? null;
    this._transformedDataset = this._originalDataset.clone();
    resetTransforms(this.dracoNode.artifact);
    // For layouts whose positions were changed by sort/cluster, a full re-solve
    // is the safest reset.
    this.dracoNode.reSolveAndSynthesize();
    this._updateDashboardDatasets(this._transformedDataset);
    this._pushAnalysisHistory('reset', datasetBefore, this._transformedDataset);
    this.vrConsole?.log?.('log', ['Reset transforms']);
    this._logInteraction('Reset', { result: `${this._transformedDataset.rowCount} rows` });
  }

  start() {
    this.engine.start();
  }
}
