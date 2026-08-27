// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { WorldUIManager } from '../src/vr/coordinators/WorldUIManager.ts';
import { WorldEventBus } from '../src/utils/EventBus.ts';
import { Engine } from '../src/vr/Engine.ts';
import { GestureConfidenceHUD } from '../src/vr/ui/GestureConfidenceHUD.ts';

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
    ui?.dispose();
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
    expect(ui.metricsPanel).toBeTruthy();
    expect(ui.performancePanel).toBeTruthy();
    expect(ui.networkPanel).toBeTruthy();
    expect(ui.miniOverview).toBeTruthy();
    expect(ui.peerPresenceHUD).toBeTruthy();
    expect(ui.operationLogPanel).toBeNull();
    expect(ui.interactionCoach).toBeNull();
    expect(ui.narrativeStrip).toBeNull();
    expect(ui.loadTestPanel).toBeNull();
  });

  it('constructs lazy panels on first access via getOrCreate accessors', () => {
    expect(ui.getOrCreateOperationLogPanel()).toBeTruthy();
    expect(ui.getOrCreateInteractionCoach()).toBeTruthy();
    expect(ui.getOrCreateNarrativeStrip()).toBeTruthy();
    expect(ui.getOrCreateLoadTestPanel()).toBeTruthy();
    expect(ui.operationLogPanel).toBeTruthy();
    expect(ui.interactionCoach).toBeTruthy();
    expect(ui.narrativeStrip).toBeTruthy();
    expect(ui.loadTestPanel).toBeTruthy();
  });

  it('tracks the settings panel in the workspace budget controller through the live show/hide path', () => {
    // The settings panel starts hidden (World hides it at startup); confirm it
    // is not tracked, then verify the live show/hide paths register/deregister
    // it in the 'primary' role — production-path evidence that the budget is
    // enforced by the runtime, not only by an isolated controller unit test.
    expect(ui.panelBudgetController).toBeTruthy();
    expect(ui.panelBudgetController.isOpen(ui.settingsPanel)).toBe(false);

    ui.settingsPanel.show();
    expect(ui.panelBudgetController.isOpen(ui.settingsPanel)).toBe(true);
    expect(ui.panelBudgetController.getRole(ui.settingsPanel)).toBe('primary');
    expect(ui.panelBudgetController.activeBudgetCount).toBe(1);

    ui.settingsPanel.hide();
    expect(ui.panelBudgetController.isOpen(ui.settingsPanel)).toBe(false);
    expect(ui.panelBudgetController.activeBudgetCount).toBe(0);
  });

  it('applies accessibility options to the SpatialPanel settings panel via the manager (the World._applyAccessibilitySettings path)', () => {
    // World._applyAccessibilitySettings delegates panel theming to
    // uiManager.applyAccessibility; the migrated settings panel is no longer in
    // panelManager.panels, so this is the path that reaches it. Verify the
    // settings panel's accessibility state updates through the manager.
    const before = (ui.settingsPanel as unknown as { _highContrast: boolean })._highContrast;
    ui.applyAccessibility({ highContrast: true, colorblindMode: 'deuteranopia', textScale: 1.5 });
    const state = ui.settingsPanel as unknown as {
      _highContrast: boolean;
      _colorblindMode: string;
      _textScale: number;
    };
    expect(state._highContrast).toBe(true);
    expect(state._colorblindMode).toBe('deuteranopia');
    expect(state._textScale).toBe(1.5);
    // The panel was not high-contrast before; confirm the change actually landed.
    expect(before).toBe(false);
  });

  it('uses the production adaptive-assist components in the Dev Lab controls', () => {
    const confidenceHUD = new GestureConfidenceHUD(anchor);
    const frustrationResponse = { update: vi.fn() };
    const jitHints = { enabled: true };

    ui.bindAdaptiveAssist({ confidenceHUD, frustrationResponse, jitHints });

    expect(ui.getOrCreateGestureConfidenceHUD()).toBe(confidenceHUD);
    expect(ui.frustrationResponseManager).toBe(frustrationResponse);
    expect(ui.jitGestureHintManager).toBe(jitHints);
    expect(ui.panelManager.panels).toContain(confidenceHUD);

    ui.toggleJITGestureHintManager();
    expect(jitHints.enabled).toBe(false);
  });

  it('detaches and disposes every owned UI resource exactly once', () => {
    ui.getOrCreateOperationLogPanel();
    ui.getOrCreateInteractionCoach();
    ui.getOrCreateNarrativeStrip();
    ui.getOrCreateLoadTestPanel();
    ui.getOrCreateSchemaMappingPanel();
    ui.getOrCreateGestureConfidenceHUD();
    ui.toggleRepresentationCarousel();
    ui.toggleJITGestureHintManager();

    const dashboardDispose = vi.spyOn(ui.dashboard, 'dispose');
    const wheelDispose = vi.spyOn(ui.handWheelMenu, 'dispose');
    const overviewDispose = vi.spyOn(ui.miniOverview, 'dispose');
    const presenceDispose = vi.spyOn(ui.peerPresenceHUD, 'dispose');
    const panelManagerDispose = vi.spyOn(ui.panelManager, 'dispose');
    const registeredPanels = [...ui.panelManager.panels];

    ui.dispose();
    ui.dispose();

    expect(dashboardDispose).toHaveBeenCalledOnce();
    expect(wheelDispose).toHaveBeenCalledOnce();
    expect(overviewDispose).toHaveBeenCalledOnce();
    expect(presenceDispose).toHaveBeenCalledOnce();
    expect(panelManagerDispose).toHaveBeenCalledOnce();
    expect(ui.panelManager.panels).toEqual([]);
    expect(engine.input.panels).toEqual([]);
    expect(engine.input.handWheelMenu).toBeNull();
    expect(engine.input.panelManager).toBeNull();
    expect(engine.input.hudObjects).not.toContain(ui.handWheelMenu);
    for (const panel of registeredPanels) expect(engine.updatables).not.toContain(panel);
    expect(engine.updatables).not.toContain(ui.dashboard);
    expect(engine.updatables).not.toContain(ui.handWheelMenu);
    expect(engine.updatables).not.toContain(ui.miniOverview);
    expect(engine.updatables).not.toContain(ui.peerPresenceHUD);
  });

  it('detaches borrowed adaptive-assist resources without disposing them', () => {
    const confidenceHUD = new GestureConfidenceHUD(anchor);
    const confidenceDispose = vi.spyOn(confidenceHUD, 'dispose');
    const frustrationResponse = { update: vi.fn(), dispose: vi.fn() };
    const jitHints = { enabled: true, dispose: vi.fn() };
    engine.input.addPanel(confidenceHUD);

    ui.bindAdaptiveAssist({ confidenceHUD, frustrationResponse, jitHints });
    ui.dispose();

    expect(engine.input.panels).not.toContain(confidenceHUD);
    expect(ui.panelManager.panels).not.toContain(confidenceHUD);
    expect(confidenceDispose).not.toHaveBeenCalled();
    expect(frustrationResponse.dispose).not.toHaveBeenCalled();
    expect(jitHints.dispose).not.toHaveBeenCalled();
    confidenceHUD.dispose();
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

  it('binds the wheel menu to the supplied dominant hand', () => {
    const dominantHand = { handedness: 'left' };
    const localUi = new WorldUIManager(engine, anchor, bus, {
      ...callbacks,
      getDominantHand: () => dominantHand,
    });

    expect(localUi.handWheelMenu.hand).toBe(dominantHand);
  });

  it('hides auxiliary panels at startup', () => {
    expect(ui.metricsPanel.mesh.visible).toBe(false);
    expect(ui.performancePanel.mesh.visible).toBe(false);
    expect(ui.networkPanel.mesh.visible).toBe(false);
    expect(ui.getOrCreateOperationLogPanel().mesh.visible).toBe(false);
    expect(ui.getOrCreateInteractionCoach().mesh.visible).toBe(false);
    expect(ui.getOrCreateNarrativeStrip().mesh.visible).toBe(false);
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

    expect(panelSpy).toHaveBeenCalledWith({
      textScale: 1.5,
      highContrast: true,
      colorblindMode: 'none',
    });
    expect(wheelSpy).toHaveBeenCalledWith({
      textScale: 1.5,
      highContrast: true,
      colorblindMode: 'none',
    });
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
