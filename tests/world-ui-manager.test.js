import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { WorldUIManager } from '../src/vr/coordinators/WorldUIManager.ts';
import { WorldEventBus } from '../src/utils/EventBus.ts';
import { Engine } from '../src/vr/Engine.ts';

describe('WorldUIManager', () => {
  let engine;
  let anchor;
  let bus;
  let callbacks;
  let ui;

  beforeEach(() => {
    globalThis.navigator.xr = {
      isSessionSupported: vi.fn().mockResolvedValue(true),
      requestSession: vi.fn().mockResolvedValue({
        addEventListener: vi.fn(),
        updateRenderState: vi.fn().mockResolvedValue(undefined),
        renderState: {},
        inputSources: [],
      }),
    };

    engine = new Engine();
    anchor = new THREE.Group();
    engine.cameraGroup.add(anchor);
    bus = new WorldEventBus();
    callbacks = {
      onLoadDataset: vi.fn(),
      onTogglePortals: vi.fn(),
      onConnectStream: vi.fn(),
      onDisconnectStream: vi.fn(),
      onSelectLiveSource: vi.fn(),
      onFilter: vi.fn(),
      onSort: vi.fn(),
      onAggregate: vi.fn(),
      onCluster: vi.fn(),
      onHierarchicalCluster: vi.fn(),
      onDensityCluster: vi.fn(),
      onAnomaly: vi.fn(),
      onTimeSlice: vi.fn(),
      onReset: vi.fn(),
      onPanelChange: vi.fn(),
      onSettingChanged: vi.fn(),
      onSeekHistory: vi.fn(),
      getNodeMeshes: () => [],
      getPeers: () => [],
      getLocalPeerId: () => 'local',
      getSetting: vi.fn(() => null),
      telemetryCollector: null,
      analysisHistory: { frames: () => [], length: 0 },
    };
    ui = new WorldUIManager(engine, anchor, bus, callbacks);
  });

  afterEach(() => {
    engine.dispose();
    const button = document.getElementById('nemosyne-vr-button');
    if (button?.parentNode) button.parentNode.removeChild(button);
    for (const canvas of Array.from(document.querySelectorAll('canvas'))) {
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }
  });

  it('creates all expected panel accessors', () => {
    expect(ui.panelManager).toBeTruthy();
    expect(ui.dashboard).toBeTruthy();
    expect(ui.handWheelMenu).toBeTruthy();
    expect(ui.vrMenu).toBeTruthy();
    expect(ui.vrConsole).toBeTruthy();
    expect(ui.telemetryPanel).toBeTruthy();
    expect(ui.settingsPanel).toBeTruthy();
    expect(ui.operationLogPanel).toBeTruthy();
    expect(ui.metricsPanel).toBeTruthy();
    expect(ui.performancePanel).toBeTruthy();
    expect(ui.networkPanel).toBeTruthy();
    expect(ui.interactionCoach).toBeTruthy();
    expect(ui.narrativeStrip).toBeTruthy();
    expect(ui.miniOverview).toBeTruthy();
    expect(ui.peerPresenceHUD).toBeTruthy();
  });

  it('parents the dashboard, launcher, and wheel menu to the analyst anchor', () => {
    expect(ui.panelManager._launcherGroup.parent).toBe(anchor);
    expect(ui.dashboard.wallGroup.parent).toBe(anchor);
    expect(ui.handWheelMenu.group.parent).toBe(anchor);
  });

  it('registers the telemetry panel, console, and VR menu with PanelManager', () => {
    expect(ui.panelManager.panels).toContain(ui.telemetryPanel);
    expect(ui.panelManager.panels).toContain(ui.vrConsole);
    expect(ui.panelManager.panels).toContain(ui.vrMenu);
  });

  it('registers input panels with the engine input router', () => {
    expect(engine.input.panels).toContain(ui.telemetryPanel);
    expect(engine.input.panels).toContain(ui.vrConsole);
    expect(engine.input.panels).toContain(ui.vrMenu);
  });

  it('sets the panel manager on the input router', () => {
    expect(engine.input.panelManager).toBe(ui.panelManager);
  });

  it('sets the hand wheel menu on the input router', () => {
    expect(engine.input.handWheelMenu).toBe(ui.handWheelMenu);
  });

  it('hides auxiliary panels at startup', () => {
    expect(ui.operationLogPanel.mesh.visible).toBe(false);
    expect(ui.metricsPanel.mesh.visible).toBe(false);
    expect(ui.performancePanel.mesh.visible).toBe(false);
    expect(ui.networkPanel.mesh.visible).toBe(false);
    expect(ui.interactionCoach.mesh.visible).toBe(false);
    expect(ui.narrativeStrip.mesh.visible).toBe(false);
  });

  it('builds a wheel menu from supplied actions', () => {
    const cb = vi.fn();
    ui.buildWheelMenu([
      {
        id: 'cat',
        label: 'Category',
        icon: '🧪',
        items: [{ id: 'action', label: 'Action', icon: '✅', callback: cb }],
      },
    ]);

    expect(ui.handWheelMenu._categories.length).toBe(1);
    expect(ui.handWheelMenu._categories[0].items[0].callback).toBe(cb);
  });

  it('toggles the settings panel', () => {
    expect(ui.settingsPanel.mesh.visible).toBe(true);
    ui.toggleSettingsPanel();
    expect(ui.settingsPanel.mesh.visible).toBe(false);
    ui.toggleSettingsPanel();
    expect(ui.settingsPanel.mesh.visible).toBe(true);
  });

  it('toggles the launcher ring', () => {
    expect(ui.isLauncherVisible).toBe(false);
    ui.toggleLauncher();
    expect(ui.isLauncherVisible).toBe(true);
    ui.toggleLauncher();
    expect(ui.isLauncherVisible).toBe(false);
  });

  it('recenter panels via PanelManager', () => {
    const recenterSpy = vi.spyOn(ui.panelManager, 'recenter');
    ui.recenterPanels();
    expect(recenterSpy).toHaveBeenCalledOnce();
  });

  it('applies accessibility options to panels with applyAccessibility', () => {
    const panelSpy = vi.spyOn(ui.settingsPanel, 'applyAccessibility').mockImplementation(() => {});
    const wheelSpy = vi.spyOn(ui.handWheelMenu, 'applyAccessibility').mockImplementation(() => {});

    ui.applyAccessibility({ textScale: 1.5, highContrast: true });

    expect(panelSpy).toHaveBeenCalledWith({ textScale: 1.5, highContrast: true, colorblindMode: 'none' });
    expect(wheelSpy).toHaveBeenCalledWith({ textScale: 1.5, highContrast: true, colorblindMode: 'none' });
  });

  it('reads initial mini-overview setting from callback', () => {
    const getSetting = vi.fn((key) => (key === 'miniOverview' ? true : null));
    const localUi = new WorldUIManager(engine, anchor, bus, { ...callbacks, getSetting });

    expect(getSetting).toHaveBeenCalledWith('miniOverview');
    expect(localUi.miniOverview.mesh.visible).toBe(true);
  });

  it('reads initial peer-presence setting from callback', () => {
    const getSetting = vi.fn((key) => (key === 'peerPresence' ? true : null));
    const localUi = new WorldUIManager(engine, anchor, bus, { ...callbacks, getSetting });

    expect(getSetting).toHaveBeenCalledWith('peerPresence');
    expect(localUi.peerPresenceHUD.mesh.visible).toBe(true);
  });
});
