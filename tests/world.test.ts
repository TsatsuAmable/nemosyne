// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { World } from '../src/vr/World.ts';
import { MonetaTopologyNode as DracoTopologyNode } from '../src/moneta/MonetaTopologyNode.ts';
import { DracoDiagnosticHUD } from '../src/vr/ui/DracoDiagnosticHUD.ts';
import { getSampleDataset } from '../src/data/SampleDatasets.ts';
import { WebSocketAdapter } from '../src/data/connectors/WebSocketAdapter.ts';
import { WorldTheme } from '../src/vr/WorldTheme.ts';
import * as Download from '../src/utils/Download.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';

// Wave 2: the analytical kernel is mandatory in production. Integration tests
// wire a mock kernel (canned, JS-backed) so orchestration stays testable in
// plain jsdom; analytical parity is covered by Rust tests + wasm-runtime.test.ts.
function wireKernel(w) {
  const bridge = makeKernelMockBridge();
  // Wave 4/6: AtlasCore is the analytical authority; bind the kernel there.
  // FileLoader/TDA/sample-load all reach the kernel through AtlasCore.
  w.atlas?.setKernel?.(bridge, 0x3c07);
  w._wasmRuntime = bridge;
  w._wasmUnavailable = false;
}

const CONNECTING = 0;
const OPEN = 1;
const CLOSED = 3;

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url) {
    this.url = url;
    this.readyState = CONNECTING;
    this.listeners = {};
    this.lastSent = null;
  }

  addEventListener(type, fn) {
    (this.listeners[type] ||= []).push(fn);
  }

  dispatch(type, event = {}) {
    (this.listeners[type] || []).forEach((fn) => fn(event));
  }

  dispatchMessage(data) {
    this.dispatch('message', { data });
  }

  send(data) {
    this.lastSent = data;
  }

  open() {
    this.readyState = OPEN;
    this.dispatch('open', {});
  }

  close() {
    this.readyState = CLOSED;
    this.dispatch('close', {});
  }
}

class MockDataChannel extends EventTarget {
  constructor() {
    super();
    this.readyState = 'connecting';
    this.messages = [];
  }

  send(data) {
    this.messages.push(data);
  }
}

class MockRTCPeerConnection extends EventTarget {
  constructor() {
    super();
    this.iceCandidates = [];
    this.remoteDescription = null;
    this.connectionState = 'new';
    this._channel = null;
  }

  createDataChannel(label, options) {
    this._channel = new MockDataChannel();
    return this._channel;
  }

  async createOffer() {
    return { type: 'offer', sdp: 'offer-sdp' };
  }

  async createAnswer() {
    return { type: 'answer', sdp: 'answer-sdp' };
  }

  async setLocalDescription(desc) {
    this.localDescription = desc;
  }

  async setRemoteDescription(desc) {
    this.remoteDescription = desc;
  }

  addEventListener(type, fn) {
    if (type === 'icecandidate') this._iceHandler = fn;
    else super.addEventListener(type, fn);
  }
}

describe('World integration', () => {
  let world;
  const resizeListeners = [];
  let addListenerSpy;

  beforeEach(() => {
    // VRButton creation calls navigator.xr.isSessionSupported; provide a stub.
    globalThis.navigator.xr = {
      isSessionSupported: vi.fn().mockResolvedValue(true),
      requestSession: vi.fn().mockResolvedValue({
        addEventListener: vi.fn(),
        updateRenderState: vi.fn().mockResolvedValue(undefined),
        renderState: {},
        inputSources: [],
      }),
    };

    // Capture window resize listeners so each test can remove them cleanly.
    const originalAdd = window.addEventListener;
    addListenerSpy = vi
      .spyOn(window, 'addEventListener')
      .mockImplementation((type, listener, options) => {
        if (type === 'resize') resizeListeners.push(listener);
        return originalAdd.call(window, type, listener, options);
      });
  });

  afterEach(async () => {
    addListenerSpy?.mockRestore();

    if (world) {
      await world.dispose();
      if (world.loader?.container?.parentNode) {
        world.loader.container.parentNode.removeChild(world.loader.container);
      }
      world = null;
    }

    const button = document.getElementById('nemosyne-vr-button');
    if (button?.parentNode) button.parentNode.removeChild(button);

    for (const canvas of Array.from(document.querySelectorAll('canvas'))) {
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }

    for (const listener of resizeListeners.splice(0)) {
      window.removeEventListener('resize', listener);
    }

    vi.restoreAllMocks();
  });

  function expectedInteractableCount(world) {
    const topology = world.dracoNode.dataInput?.topology;
    const supportsHandles =
      topology === 'TIME_SERIES' || topology === 'TABULAR' || topology === 'HIERARCHY';
    const handleCount = supportsHandles ? (topology === 'TIME_SERIES' ? 1 : 2) : 0;
    return world.dracoNode.artifact.nodeMeshes.length + 1 + handleCount;
  }

  it('creates the default Draco node and registers diagnostic + telemetry panels', () => {
    world = new World(); wireKernel(world);

    expect(world.dracoNode).toBeInstanceOf(DracoTopologyNode);
    expect(world.dracoNode.artifact).toBeTruthy();
    expect(world.dracoNode.artifact.nodeMeshes.length).toBeGreaterThan(0);

    expect(world.diagnostic).toBeInstanceOf(DracoDiagnosticHUD);

    const panels = world.engine.input.panels;
    expect(panels).toContain(world.uiManager.telemetryPanel);
    expect(panels).toContain(world.diagnostic);

    const interactableMeshes = world.engine.input.interactables.map((i) => i.mesh);
    expect(interactableMeshes.length).toBe(expectedInteractableCount(world));
    expect(interactableMeshes).toContain(world.core.group);
    for (const mesh of world.dracoNode.artifact.nodeMeshes) {
      expect(interactableMeshes).toContain(mesh);
    }
  });

  it('loadDataset tears down the previous Draco node and diagnostic, then rebuilds', () => {
    world = new World(); wireKernel(world);

    const oldDraco = world.dracoNode;
    const oldDiagnostic = world.diagnostic;
    const oldMeshes = [...oldDraco.artifact.nodeMeshes];

    const fraud = getSampleDataset('fraud-graph');
    const entry = { name: 'Fraud Graph', ...fraud };
    world.loadDataset(entry);

    expect(world.currentEntry).toBe(entry);
    expect(world.dracoNode).toBeInstanceOf(DracoTopologyNode);
    expect(world.dracoNode).not.toBe(oldDraco);
    expect(world.diagnostic).not.toBe(oldDiagnostic);
    expect(world.engine.input.panels).toContain(world.diagnostic);

    const interactableMeshes = world.engine.input.interactables.map((i) => i.mesh);
    expect(interactableMeshes.length).toBe(expectedInteractableCount(world));
    expect(interactableMeshes).toContain(world.core.group);
    for (const mesh of oldMeshes) {
      expect(interactableMeshes).not.toContain(mesh);
    }
    for (const mesh of world.dracoNode.artifact.nodeMeshes) {
      expect(interactableMeshes).toContain(mesh);
    }
  });

  it('reSolveAndSynthesize re-wires artifact interactables', () => {
    world = new World(); wireKernel(world);

    const oldMeshes = [...world.dracoNode.artifact.nodeMeshes];
    world.dracoNode.reSolveAndSynthesize();

    const interactableMeshes = world.engine.input.interactables.map((i) => i.mesh);
    expect(interactableMeshes.length).toBe(expectedInteractableCount(world));
    expect(interactableMeshes).toContain(world.core.group);
    for (const mesh of oldMeshes) {
      expect(interactableMeshes).not.toContain(mesh);
    }
    for (const mesh of world.dracoNode.artifact.nodeMeshes) {
      expect(interactableMeshes).toContain(mesh);
    }
  });

  it('loadDataset infers default encodings when none are provided', () => {
    world = new World(); wireKernel(world);

    const sales = getSampleDataset('sales-table');
    const entry = { name: 'Sales Table', topology: sales.topology, dataset: sales.dataset };
    world.loadDataset(entry);

    expect(world.dracoNode.dataInput.encodings).toBeTruthy();
    expect(world.dracoNode.dataInput.encodings.color).toBe(
      sales.dataset.categoricalColumns[0]?.name
    );
    expect(world.dracoNode.solverResult.spec).toBeTruthy();
  });

  it('updates the DOM telemetry overlay with current dataset and head position', () => {
    const telemetry = document.createElement('div');
    telemetry.id = 'telemetry';
    document.body.appendChild(telemetry);

    try {
      world = new World(); wireKernel(world);
      world.currentEntry = { name: 'Telemetry Test' };
      world._updateTelemetry();

      expect(telemetry.textContent).toContain('Telemetry Test');
      expect(telemetry.textContent).toContain('POS:');
      expect(telemetry.textContent).toContain('LAYOUT:');
      expect(telemetry.textContent).toContain('GEOM:');
      expect(telemetry.textContent).toContain('BEHAVIOR:');
    } finally {
      telemetry.parentNode.removeChild(telemetry);
    }
  });

  it('wires system toggle to the launcher ring', () => {
    world = new World(); wireKernel(world);

    expect(typeof world.engine.input.onSystemToggle).toBe('function');
    expect(world.uiManager.panelManager.isLauncherVisible()).toBe(false);

    world.engine.input.onSystemToggle();
    expect(world.uiManager.panelManager.isLauncherVisible()).toBe(true);

    world.engine.input.onSystemToggle();
    expect(world.uiManager.panelManager.isLauncherVisible()).toBe(false);
  });

  it('creates and registers a hand-attached wheel menu', () => {
    world = new World(); wireKernel(world);

    expect(world.uiManager.handWheelMenu).toBeTruthy();
    expect(world.uiManager.handWheelMenu.engine).toBe(world.engine);
    expect(world.engine.input.handWheelMenu).toBe(world.uiManager.handWheelMenu);
    expect(world.uiManager.handWheelMenu._categories.length).toBeGreaterThan(0);
  });

  it('cycles datasets through the hand wheel action', () => {
    world = new World(); wireKernel(world);
    const initialName = world.currentEntry?.label ?? world.currentEntry?.name;

    // The first cycle returns to the same default sample, so cycle twice.
    world._cycleDataset();
    world._cycleDataset();

    const nextName = world.currentEntry?.label ?? world.currentEntry?.name;
    expect(nextName).not.toBe(initialName);
    expect(world.dracoNode).toBeInstanceOf(DracoTopologyNode);
  });

  it('toggles individual panels via PanelManager', () => {
    world = new World(); wireKernel(world);
    const panel = world.uiManager.telemetryPanel;

    expect(panel.mesh.visible).toBe(true);
    world.uiManager.panelManager.hidePanel(panel);
    expect(panel.mesh.visible).toBe(false);

    world.uiManager.panelManager.showPanel(panel);
    expect(panel.mesh.visible).toBe(true);
  });

  it('creates a spatial dashboard with chart panels', () => {
    world = new World(); wireKernel(world);

    expect(world.uiManager.dashboard).toBeTruthy();
    expect(world.engine.updatables).toContain(world.uiManager.dashboard);
    expect(world.dashboardPanels.length).toBeGreaterThan(0);
    for (const entry of world.dashboardPanels) {
      expect(world.engine.input.panels).toContain(entry.panel);
      // The statistical lens is hidden by default (progressive disclosure), so
      // the CORRELATION matrix panel starts hidden; other dashboard charts show.
      if (entry.panel?.chartType === 'CORRELATION') {
        expect(entry.panel.mesh.visible).toBe(false);
      } else {
        expect(entry.panel.mesh.visible).toBe(true);
      }
    }
  });

  it('includes a reset dashboard action in the hand wheel menu', () => {
    world = new World(); wireKernel(world);

    const panelsCategory = world.uiManager.handWheelMenu._categories.find((c) => c.id === 'panels');
    expect(panelsCategory).toBeTruthy();
    const resetAction = panelsCategory.items.find((i) => i.id === 'reset-dashboard');
    expect(resetAction).toBeTruthy();
    expect(typeof resetAction.callback).toBe('function');
  });

  it('creates a semicircle dashboard by default', () => {
    world = new World(); wireKernel(world);

    expect(world.uiManager.dashboard.layoutMode).toBe('semicircle');
    expect(world.uiManager.dashboard.columns).toBeGreaterThan(world.uiManager.dashboard.visibleColumns);
    expect(world.uiManager.dashboard.radius).toBeGreaterThan(1);
  });

  it('includes scroll dashboard actions in the hand wheel menu', () => {
    world = new World(); wireKernel(world);

    const panelsCategory = world.uiManager.handWheelMenu._categories.find((c) => c.id === 'panels');
    expect(panelsCategory).toBeTruthy();
    const leftAction = panelsCategory.items.find((i) => i.id === 'scroll-dashboard-left');
    const rightAction = panelsCategory.items.find((i) => i.id === 'scroll-dashboard-right');
    expect(leftAction).toBeTruthy();
    expect(rightAction).toBeTruthy();
    expect(typeof leftAction.callback).toBe('function');
    expect(typeof rightAction.callback).toBe('function');

    const before = world.uiManager.dashboard.targetScrollOffset;
    rightAction.callback();
    expect(world.uiManager.dashboard.targetScrollOffset).toBeGreaterThan(before);
  });

  it('applies a theme preset when loading a dataset by key', () => {
    world = new World(); wireKernel(world);
    const fraud = getSampleDataset('fraud-graph');

    world.loadDataset({ key: 'fraud-graph', name: 'Fraud Graph', ...fraud });

    expect(world.engine.theme.currentPreset).toBe('warmAnomaly');
  });

  it('cycles through theme presets from the hand wheel menu', () => {
    world = new World(); wireKernel(world);
    const startPreset = world.engine.theme.currentPreset;

    const viewsCategory = world.uiManager.handWheelMenu._categories.find((c) => c.id === 'views');
    const cycleAction = viewsCategory.items.find((i) => i.id === 'cycle-theme');
    expect(cycleAction).toBeTruthy();

    cycleAction.callback();
    expect(world.engine.theme.currentPreset).not.toBe(startPreset);
  });

  it('sets portal data activity based on dataset topology', () => {
    world = new World(); wireKernel(world);
    const sensor = getSampleDataset('sensor-stream');

    world.loadDataset({ key: 'sensor-stream', name: 'Sensor Stream', ...sensor });

    expect(world.portalA._dataActivity).toBeGreaterThan(0.5);
    expect(world.portalB._dataActivity).toBeGreaterThan(0.5);
  });

  it('recolors portals to match the loaded dataset theme preset', () => {
    world = new World(); wireKernel(world);
    const fraud = getSampleDataset('fraud-graph');

    world.loadDataset({ key: 'fraud-graph', name: 'Fraud Graph', ...fraud });

    const expected = WorldTheme.PRESETS.warmAnomaly.pointColor;
    expect(world.portalA._sharedRingMaterial.color.getHex()).toBe(expected);
    expect(world.portalB._sharedRingMaterial.color.getHex()).toBe(expected);
  });

  it('recolors portals when warping through a portal', () => {
    world = new World(); wireKernel(world);

    world._warpToZone('DEEP_NET', [0, 0, -20]);

    const expected = WorldTheme.PRESETS.deepNet.pointColor;
    expect(world.portalA._sharedRingMaterial.color.getHex()).toBe(expected);
    expect(world.portalB._sharedRingMaterial.color.getHex()).toBe(expected);
  });

  it('connects to a live stream and applies updates after throttle', () => {
    const originalWebSocket = globalThis.WebSocket;
    vi.useFakeTimers();
    try {
      globalThis.WebSocket = MockWebSocket;
      world = new World(); wireKernel(world);
      const loadSpy = vi.spyOn(world, 'loadDataset');

      const connected = world.connectLiveStream('wss://test/stream', { mode: 'replace' });
      expect(connected).toBe(true);
      expect(world.liveConnector).toBeInstanceOf(WebSocketAdapter);

      world.liveConnector._ws.open();
      world.liveConnector._ws.dispatchMessage(
        JSON.stringify({
          topology: 'TIME_SERIES',
          rows: [{ time: '2026-07-28T12:00:00Z', sensorId: 'alpha', temperature: 22.5 }],
        })
      );

      expect(loadSpy).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1100);
      expect(loadSpy).toHaveBeenCalledOnce();

      const entry = loadSpy.mock.calls[0][0];
      expect(entry.name).toBe('Live Stream');
      expect(entry.topology).toBe('TIME_SERIES');
      expect(entry.dataset.rows.length).toBe(1);

      world.disconnectLiveStream();
      expect(world.liveConnector).toBeNull();
    } finally {
      globalThis.WebSocket = originalWebSocket;
      vi.useRealTimers();
    }
  });

  it('skips live stream when WebSocket is unavailable', () => {
    const originalWebSocket = globalThis.WebSocket;
    try {
      globalThis.WebSocket = undefined;
      world = new World(); wireKernel(world);
      expect(world.connectLiveStream()).toBe(false);
      expect(world.liveConnector).toBeNull();
    } finally {
      globalThis.WebSocket = originalWebSocket;
    }
  });

  it('creates an explicit analyst anchor under the camera group', () => {
    world = new World(); wireKernel(world);
    expect(world.analystAnchor).toBeTruthy();
    expect(world.analystAnchor.parent).toBe(world.engine.cameraGroup);
  });

  it('parents HUD managers to the analyst anchor', () => {
    world = new World(); wireKernel(world);
    expect(world.uiManager.panelManager._launcherGroup.parent).toBe(world.analystAnchor);
    expect(world.uiManager.dashboard.wallGroup.parent).toBe(world.analystAnchor);
    expect(world.uiManager.handWheelMenu.group.parent).toBe(world.analystAnchor);
  });

  it('includes flight mode actions in the hand wheel menu', () => {
    world = new World(); wireKernel(world);

    const viewsCategory = world.uiManager.handWheelMenu._categories.find((c) => c.id === 'views');
    expect(viewsCategory).toBeTruthy();
    const toggleAction = viewsCategory.items.find((i) => i.id === 'toggle-flight');
    const dropAction = viewsCategory.items.find((i) => i.id === 'drop-to-floor');
    expect(toggleAction).toBeTruthy();
    expect(dropAction).toBeTruthy();
    expect(typeof toggleAction.callback).toBe('function');
    expect(typeof dropAction.callback).toBe('function');

    toggleAction.callback();
    expect(world.engine.locomotion.flightMode).toBe(true);

    dropAction.callback();
    expect(world.engine.locomotion.cameraGroup.position.y).toBeCloseTo(0, 3);
  });

  it('routes scoopUp to ascend when flight mode is active', () => {
    world = new World(); wireKernel(world);
    world.engine.locomotion.setFlightEnabled(true);
    const startY = world.engine.locomotion.cameraGroup.position.y;

    world._onGesture('scoopUp');
    expect(world.engine.locomotion.cameraGroup.position.y).toBeGreaterThan(startY);
  });

  it('registers the TechnoCore as an interactable', () => {
    world = new World(); wireKernel(world);
    const meshes = world.engine.input.interactables.map((i) => i.mesh);
    expect(meshes).toContain(world.core.group);
  });

  it('cycles the core lens mode on core selection', () => {
    world = new World(); wireKernel(world);
    expect(world.core.lensMode).toBe('off');

    world._onCoreSelect();
    expect(world.core.lensMode).toBe('statistical');
    expect(world._statisticalLensEnabled).toBe(true);

    world._onCoreSelect();
    expect(world.core.lensMode).toBe('anomaly');
  });

  it('turns the statistical lens off when the core cycles back to off', () => {
    world = new World(); wireKernel(world);
    world._onCoreSelect();
    world._onCoreSelect();
    world._onCoreSelect();

    expect(world.core.lensMode).toBe('off');
    expect(world._statisticalLensEnabled).toBe(false);
  });

  it('attaches data operations to each portal', () => {
    world = new World(); wireKernel(world);
    expect(world.portalA.operation).toBe('anomaly');
    expect(world.portalB.operation).toBe('reset');
  });

  it('applies portal operation and moves the camera when warping', () => {
    world = new World(); wireKernel(world);
    const resetSpy = vi.spyOn(world, 'resetDataOperation');

    world._warpToZone('LOCAL_MATRIX', [0, 0, 0], 'reset');

    expect(resetSpy).toHaveBeenCalledOnce();
    expect(world.engine.cameraGroup.position.toArray()).toEqual([0, 0, 0]);
  });

  it('updates core data activity from analysis history length', () => {
    world = new World(); wireKernel(world);
    world.applyDataOperation('filter');
    world._updateWorld(0.016, 0);

    expect(world.core._dataActivity).toBeGreaterThan(0);
  });

  it('triggers a warp when the head enters a portal bounding sphere', () => {
    world = new World(); wireKernel(world);
    const warpSpy = vi.spyOn(world, '_warpToZone');
    world.engine.headWorldPos = new THREE.Vector3(-2.5, 1.6, -2);

    world._updateWorld(0.016, 0);

    expect(warpSpy).toHaveBeenCalled();
  });

  it('activates portal preview when the user is nearby', () => {
    world = new World(); wireKernel(world);
    const headPos = new THREE.Vector3(-2.5, 1.6, -2).add(new THREE.Vector3(0, 0, 1));
    world.engine.headWorldPos = headPos;

    world._updateWorld(0.016, 0);

    expect(world.portalA._previewActive).toBe(true);
  });

  it('saves and restores a session via the session store', async () => {
    world = new World(); wireKernel(world);
    world.sessionStore = new SessionStoreStub();

    // Move camera and mutate data so we have something to restore.
    world.engine.cameraGroup.position.set(1, 2, 3);
    world.applyDataOperation('filter');

    // Move a free-floating HUD panel so we can verify its position is persisted.
    world.uiManager.panelManager.showPanel(world.uiManager.metricsPanel);
    world.uiManager.metricsPanel.mesh.position.set(0.5, 1.2, -0.8);
    world.engine.cameraGroup.updateMatrixWorld(true);

    await world.saveSession('test');

    // Create a fresh world and restore the saved session.
    const restoredWorld = new World(); wireKernel(restoredWorld);
    restoredWorld.sessionStore = world.sessionStore;
    const ok = await restoredWorld.loadSession('test');

    expect(ok).toBe(true);
    expect(restoredWorld.currentEntry.name).toBe('Global Supply Chain');
    expect(restoredWorld.engine.cameraGroup.position.toArray()).toEqual([1, 2, 3]);
    expect(restoredWorld.analysisHistory.length).toBeGreaterThan(0);

    // Free-floating panel pose and visibility should have been restored.
    expect(restoredWorld.uiManager.metricsPanel.mesh.position.x).toBeCloseTo(0.5, 2);
    expect(restoredWorld.uiManager.metricsPanel.mesh.position.y).toBeCloseTo(1.2, 2);
    expect(restoredWorld.uiManager.metricsPanel.mesh.position.z).toBeCloseTo(-0.8, 2);
    expect(restoredWorld.uiManager.metricsPanel.mesh.visible).toBe(true);
    const savedMetrics = restoredWorld.uiManager.panelManager
      .getPanelPositions()
      .find((p) => p.title === 'TELEMETRY');
    expect(savedMetrics?.visible).toBe(true);
  });

  it('Atlas 5 gate: full session (structures + research context + recommendations/decisions + observations + interventions + spatial state) restores without manual reconstruction', async () => {
    world = new World(); wireKernel(world);
    world.sessionStore = new SessionStoreStub();

    // Seed the session with every Atlas 5 dimension:
    // 1) Structures + recommendation from a cluster analysis.
    world.applyDataOperation('cluster');
    expect(world.atlas.structures.length).toBeGreaterThan(0);
    world._acceptRecommendation();
    expect(world.atlas.decisionHistory.length).toBeGreaterThan(0);

    // 2) Research context.
    world.session.setResearchContext({
      studyId: 'study-atlas5',
      researchQuestion: 'does structure persist across restore?',
      hypothesis: 'structures + decisions survive serialize',
      variablesOfInterest: ['inventory'],
      observerMode: true,
    });

    // 3) Observations + interventions.
    world.session.recordObservation('cluster assignments stable');
    world.session.recordIntervention('inspected cluster handle');

    // 4) Spatial state — camera pose + a free-floating panel.
    world.engine.cameraGroup.position.set(2.5, 1.75, -4.25);
    world.uiManager.panelManager.showPanel(world.uiManager.metricsPanel);
    world.uiManager.metricsPanel.mesh.position.set(0.5, 1.2, -0.8);
    world.engine.cameraGroup.updateMatrixWorld(true);

    const savedStructureIds = world.atlas.structures
      .flatMap((set) => set.structures.map((s) => s.id))
      .sort();

    await world.saveSession('atlas5');

    // Restore into a FRESH world — the restored scene must rebuild the
    // artefact + operation transform + TDA + structure handles with no
    // manual reconstruction.
    const restoredWorld = new World(); wireKernel(restoredWorld);
    restoredWorld.sessionStore = world.sessionStore;
    const ok = await restoredWorld.loadSession('atlas5');
    expect(ok).toBe(true);

    // Structures restored from the ledger (authoritative provenance record).
    expect(restoredWorld.atlas.structures.length).toBeGreaterThan(0);
    const restoredIds = restoredWorld.atlas.structures
      .flatMap((set) => set.structures.map((s) => s.id))
      .sort();
    expect(restoredIds).toEqual(savedStructureIds);

    // Research context restored.
    expect(restoredWorld.session.researchContext).toMatchObject({
      studyId: 'study-atlas5',
      researchQuestion: 'does structure persist across restore?',
      hypothesis: 'structures + decisions survive serialize',
      variablesOfInterest: ['inventory'],
      observerMode: true,
    });

    // Recommendation + decision history restored.
    expect(restoredWorld.atlas.decisionHistory.length).toBeGreaterThan(0);
    expect(restoredWorld.atlas.decisionHistory.at(-1).decision).toBe('accepted');

    // Observations + interventions present in the ledger.
    const ledger = restoredWorld.atlas.ledger;
    expect(ledger.some((e) => e.observation === 'cluster assignments stable')).toBe(true);
    expect(ledger.some((e) => e.intervention === 'inspected cluster handle')).toBe(true);

    // VR scene rebuilt WITHOUT manual reconstruction:
    // artefact meshes re-solved.
    expect(restoredWorld.dracoNode.artifact.nodeMeshes.length).toBeGreaterThan(0);
    // structure handles rebuilt from restored structures (not generic build()).
    const structureHandles = restoredWorld.inPlaceHandles._handles.filter((h) => h.structureId);
    expect(structureHandles.length).toBeGreaterThan(0);
    expect(structureHandles.map((h) => h.structureId).sort()).toEqual(savedStructureIds.slice(0, 6));
    // TDA recompute wired.
    expect(typeof restoredWorld.tdaRecompute).toBe('function');

    // Spatial state restored.
    expect(restoredWorld.engine.cameraGroup.position.toArray()).toEqual([2.5, 1.75, -4.25]);
    const restoredMetrics = restoredWorld.uiManager.panelManager
      .getPanelPositions()
      .find((p) => p.title === 'TELEMETRY');
    expect(restoredMetrics?.visible).toBe(true);
  });

  it('exports a screenshot from the renderer canvas', () => {
    world = new World(); wireKernel(world);

    const dataUrl = 'data:image/png;base64,test';
    const toDataURL = vi.fn().mockReturnValue(dataUrl);
    world.engine.renderer.domElement.toDataURL = toDataURL;
    const downloadSpy = vi.spyOn(Download, 'downloadDataUrl').mockImplementation(() => {});

    world.exportScreenshot('png');

    expect(toDataURL).toHaveBeenCalledOnce();
    expect(toDataURL).toHaveBeenCalledWith('image/png');
    expect(downloadSpy).toHaveBeenCalledOnce();
    expect(downloadSpy.mock.calls[0][0]).toBe(dataUrl);
    expect(downloadSpy.mock.calls[0][1]).toMatch(/^nemosyne-\d+\.png$/);
  });

  it('exports an analysis story as downloadable JSON', () => {
    world = new World(); wireKernel(world);
    const downloadSpy = vi.spyOn(Download, 'downloadText').mockImplementation(() => {});

    world.applyDataOperation('filter');
    const story = world.exportAnalysisStory();

    expect(story.version).toBe(1);
    expect(story.dataset.topology).toBe(world.currentEntry.topology);
    expect(story.operations).toHaveLength(1);
    expect(story.operations[0].operation).toBe('filter');
    expect(downloadSpy).toHaveBeenCalledOnce();
    expect(downloadSpy.mock.calls[0][1]).toMatch(/^nemosyne-story-\d+\.json$/);
    const payload = JSON.parse(downloadSpy.mock.calls[0][0]);
    expect(payload.operations[0].operation).toBe('filter');
  });

  it('includes export and operation log actions in the hand wheel menu', () => {
    world = new World(); wireKernel(world);
    const panelsCategory = world.uiManager.handWheelMenu._categories.find((c) => c.id === 'panels');
    expect(panelsCategory).toBeTruthy();
    expect(panelsCategory.items.find((i) => i.id === 'operation-log')).toBeTruthy();
    expect(panelsCategory.items.find((i) => i.id === 'export-screenshot')).toBeTruthy();
    expect(panelsCategory.items.find((i) => i.id === 'export-story')).toBeTruthy();
  });

  it('toggles the operation log panel from the hand wheel menu', () => {
    world = new World(); wireKernel(world);
    const opLog = world.uiManager.getOrCreateOperationLogPanel();
    expect(opLog).toBeTruthy();
    expect(opLog.mesh.visible).toBe(false);

    const panelsCategory = world.uiManager.handWheelMenu._categories.find((c) => c.id === 'panels');
    const action = panelsCategory.items.find((i) => i.id === 'operation-log');
    action.callback();

    expect(world.uiManager.operationLogPanel.mesh.visible).toBe(true);
  });

  it('updates the operation log panel when operations are applied', () => {
    world = new World(); wireKernel(world);
    const opLog = world.uiManager.getOrCreateOperationLogPanel();
    const setEntriesSpy = vi.spyOn(opLog, 'setEntries');

    world.applyDataOperation('filter');

    expect(setEntriesSpy).toHaveBeenCalled();
    const lastCall = setEntriesSpy.mock.calls[setEntriesSpy.mock.calls.length - 1][0];
    expect(lastCall).toHaveLength(1);
    expect(lastCall[0].operation).toBe('filter');
  });

  it('includes a telemetry action in the hand wheel menu', () => {
    world = new World(); wireKernel(world);
    const panelsCategory = world.uiManager.handWheelMenu._categories.find((c) => c.id === 'panels');
    expect(panelsCategory).toBeTruthy();
    const action = panelsCategory.items.find((i) => i.id === 'telemetry');
    expect(action).toBeTruthy();
    expect(typeof action.callback).toBe('function');
  });

  it('toggles the telemetry metrics panel from the hand wheel menu', () => {
    world = new World(); wireKernel(world);
    expect(world.uiManager.metricsPanel.mesh.visible).toBe(false);

    const panelsCategory = world.uiManager.handWheelMenu._categories.find((c) => c.id === 'panels');
    const action = panelsCategory.items.find((i) => i.id === 'telemetry');
    action.callback();

    expect(world.uiManager.metricsPanel.mesh.visible).toBe(true);
  });

  it('records operations in telemetry when enabled', () => {
    world = new World(); wireKernel(world);
    world.telemetryCollector.setEnabled(true);

    world.applyDataOperation('filter');
    world.applyDataOperation('sort');

    const report = world.telemetryCollector.getReport();
    expect(report.operations).toEqual({ filter: 1, sort: 1 });
  });

  it('records gestures in telemetry when enabled', () => {
    world = new World(); wireKernel(world);
    world.telemetryCollector.setEnabled(true);

    world._onGesture('pinchTogether');
    world._onGesture('pinchApart');
    world._onGesture('pinchTogether');

    const report = world.telemetryCollector.getReport();
    expect(report.gestures).toEqual({ pinchTogether: 2, pinchApart: 1 });
  });

  it('records dataset load in telemetry when enabled', () => {
    world = new World(); wireKernel(world);
    world.telemetryCollector.setEnabled(true);

    const fraud = getSampleDataset('fraud-graph');
    world.loadDataset({ key: 'fraud-graph', name: 'Fraud Graph', ...fraud });

    const report = world.telemetryCollector.getReport();
    expect(report.session.datasetName).toBe('Fraud Graph');
    expect(report.session.datasetTopology).toBe('GRAPH');
  });

  it('includes telemetry in the analysis story when enabled', () => {
    world = new World(); wireKernel(world);
    world.telemetryCollector.setEnabled(true);
    world.applyDataOperation('filter');

    const story = world._buildAnalysisStory();
    expect(story.telemetry).toBeTruthy();
    expect(story.telemetry.enabled).toBe(true);
    expect(story.telemetry.operations.filter).toBe(1);
  });

  it('includes collaboration actions in the hand wheel menu', () => {
    world = new World(); wireKernel(world);

    const collabCategory = world.uiManager.handWheelMenu._categories.find((c) => c.id === 'collab');
    expect(collabCategory).toBeTruthy();
    expect(collabCategory.items.find((i) => i.id === 'collab-toggle')).toBeTruthy();
    expect(collabCategory.items.find((i) => i.id === 'collab-panel')).toBeTruthy();
  });

  it('joins and leaves a collaboration room through the wheel menu', async () => {
    const originalWebSocket = globalThis.WebSocket;
    const originalRTCPeerConnection = globalThis.RTCPeerConnection;
    globalThis.WebSocket = MockWebSocket;
    globalThis.RTCPeerConnection = MockRTCPeerConnection;

    try {
      world = new World(); wireKernel(world);
      const collabCategory = world.uiManager.handWheelMenu._categories.find((c) => c.id === 'collab');
      const joinAction = collabCategory.items.find((i) => i.id === 'collab-toggle');

      const connectPromise = world._joinCollaborationRoom('test-room');
      world.networkManager.signalling._ws.open();
      await connectPromise;

      expect(world.networkManager.isConnected).toBe(true);
      expect(world.uiManager.networkPanel.status.roomId).toBe('test-room');
      expect(world.uiManager.networkPanel.status.connected).toBe(true);

      joinAction.callback();
      expect(world.networkManager).toBeNull();
      expect(world.uiManager.networkPanel.status.connected).toBe(false);
    } finally {
      globalThis.WebSocket = originalWebSocket;
      globalThis.RTCPeerConnection = originalRTCPeerConnection;
    }
  });

  it('toggles the collaboration network panel from the wheel menu', () => {
    world = new World(); wireKernel(world);
    expect(world.uiManager.networkPanel.mesh.visible).toBe(false);

    const collabCategory = world.uiManager.handWheelMenu._categories.find((c) => c.id === 'collab');
    const action = collabCategory.items.find((i) => i.id === 'collab-panel');
    action.callback();

    expect(world.uiManager.networkPanel.mesh.visible).toBe(true);
  });

  it('broadcasts camera presence when connected', async () => {
    const originalWebSocket = globalThis.WebSocket;
    const originalRTCPeerConnection = globalThis.RTCPeerConnection;
    globalThis.WebSocket = MockWebSocket;
    globalThis.RTCPeerConnection = MockRTCPeerConnection;

    try {
      world = new World(); wireKernel(world);
      const connectPromise = world._joinCollaborationRoom('presence-room');
      world.networkManager.signalling._ws.open();
      await connectPromise;

      // Simulate a peer joining so a data channel is wired.
      world.networkManager.signalling._ws.dispatchMessage(
        JSON.stringify({
          roomId: 'presence-room',
          from: 'peerB',
          data: { type: 'join' },
        })
      );

      const channel = world.networkManager.channels.get('peerB');
      expect(channel).toBeTruthy();
      channel.readyState = 'open';
      channel.dispatchEvent(new Event('open'));

      world.engine.cameraGroup.position.set(1, 2, 3);
      world._broadcastPresence();

      expect(channel.messages.length).toBeGreaterThan(0);
      const last = JSON.parse(channel.messages[channel.messages.length - 1]);
      expect(last.state.position).toEqual({ x: 1, y: 2, z: 3 });
    } finally {
      globalThis.WebSocket = originalWebSocket;
      globalThis.RTCPeerConnection = originalRTCPeerConnection;
    }
  });

  it('joins collaboration when the setting is enabled', async () => {
    const originalWebSocket = globalThis.WebSocket;
    const originalRTCPeerConnection = globalThis.RTCPeerConnection;
    globalThis.WebSocket = MockWebSocket;
    globalThis.RTCPeerConnection = MockRTCPeerConnection;

    try {
      world = new World(); wireKernel(world);
      world.uiManager.settingsPanel.setSetting('collabEnabled', true);

      const connected = new Promise((resolve) => {
        world.networkManager.addEventListener('connected', resolve);
      });
      world.networkManager.signalling._ws.open();
      await connected;

      expect(world.networkManager).toBeTruthy();
      expect(world.networkManager.isConnected).toBe(true);
      expect(world.networkManager.roomId).toBe('default');
    } finally {
      globalThis.WebSocket = originalWebSocket;
      globalThis.RTCPeerConnection = originalRTCPeerConnection;
    }
  });

  it('creates an interaction coach panel on first access', () => {
    world = new World(); wireKernel(world);
    expect(world.uiManager.interactionCoach).toBeNull();
    const coach = world.uiManager.getOrCreateInteractionCoach();
    expect(coach).toBeTruthy();
    expect(world.uiManager.panelManager.panels).toContain(coach);
    expect(coach.mesh.visible).toBe(false);
  });

  it('includes an interaction coach action in the hand wheel menu', () => {
    world = new World(); wireKernel(world);
    const panelsCategory = world.uiManager.handWheelMenu._categories.find((c) => c.id === 'panels');
    const action = panelsCategory.items.find((i) => i.id === 'interaction-coach');
    expect(action).toBeTruthy();
    action.callback();
    expect(world.uiManager.interactionCoach?.mesh.visible).toBe(true);
  });

  it('logs gestures to the interaction coach', () => {
    world = new World(); wireKernel(world);
    const coach = world.uiManager.getOrCreateInteractionCoach();
    const logSpy = vi.spyOn(coach, 'log');

    world._onGesture('pinchTogether');

    expect(logSpy).toHaveBeenCalled();
    const call = logSpy.mock.calls[0][0];
    expect(call.action).toBe('Filter');
    expect(call.gesture).toBe('pinchTogether');
  });

  it('logs controller gesture context when source is controller', () => {
    world = new World(); wireKernel(world);
    const logSpy = vi.spyOn(world.uiManager.getOrCreateInteractionCoach(), 'log');

    world._onGesture('rotateCW', { source: 'controller', button: 'B' });

    const call = logSpy.mock.calls[0][0];
    expect(call.action).toBe('Redo');
    expect(call.controller).toContain('Controller B');
  });

  it('logs data operations to the interaction coach', () => {
    world = new World(); wireKernel(world);
    const logSpy = vi.spyOn(world.uiManager.getOrCreateInteractionCoach(), 'log');

    world.applyDataOperation('filter');

    const filterCall = logSpy.mock.calls.find((c) => c[0].action === 'filter');
    expect(filterCall).toBeTruthy();
    expect(filterCall[0].result).toMatch(/\d+ rows/);
  });

  it('logs the launcher toggle to the interaction coach', () => {
    world = new World(); wireKernel(world);
    const logSpy = vi.spyOn(world.uiManager.getOrCreateInteractionCoach(), 'log');

    world._togglePanels();

    const call = logSpy.mock.calls.find((c) => c[0].action === 'Launcher');
    expect(call).toBeTruthy();
    expect(call[0].result).toBe('opened');
  });

  it('wires the controller gesture mapper into input', () => {
    world = new World(); wireKernel(world);
    expect(world.engine.input.controllerGestureMapper).toBe(world.controllerGestureMapper);
  });
});

/**
 * In-memory session store stub for World integration tests.
 */
class SessionStoreStub {
  constructor() {
    this._sessions = new Map();
  }

  async saveSession(id, snapshot) {
    this._sessions.set(id, JSON.parse(JSON.stringify(snapshot)));
  }

  async loadSession(id) {
    return this._sessions.get(id) ?? null;
  }

  async hasSession(id) {
    return this._sessions.has(id);
  }

  async listSessions() {
    return [...this._sessions.keys()].map((id) => ({ id, savedAt: Date.now() }));
  }

  async deleteSession(id) {
    this._sessions.delete(id);
  }
}
