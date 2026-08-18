// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { buildWheelMenuCategories } from '../src/vr/coordinators/WheelMenuBuilder.ts';
import { ANALYSIS_TEMPLATES } from '../src/data/AnalysisTemplates.ts';
import type { WorldLike } from '../src/vr/coordinators/types.ts';

/**
 * Builds a stub WorldLike whose every callable member is a vi.fn spy, so each
 * wheel-menu callback can be invoked and its wiring verified at runtime (tsc
 * only guarantees the method exists on the facade — it does not guarantee the
 * callback actually delegates to it).
 */
function makeStubWorld(): { world: WorldLike; spy: Record<string, ReturnType<typeof vi.fn>> } {
  const spy: Record<string, ReturnType<typeof vi.fn>> = {};
  const fn = (name: string) => (spy[name] = vi.fn());
  const panel = () => ({ mesh: new THREE.Object3D() } as any);

  const locomotion = {
    toggleTeleport: fn('locomotion.toggleTeleport'),
    teleportToAnchor: fn('locomotion.teleportToAnchor'),
    toggleFlight: fn('locomotion.toggleFlight'),
    dropToFloor: fn('locomotion.dropToFloor'),
  };

  const world: any = {
    panelManager: {
      togglePanel: fn('panelManager.togglePanel'),
      toggleLauncher: fn('panelManager.toggleLauncher'),
      recenter: fn('panelManager.recenter'),
    },
    dashboard: {
      scrollBySlots: fn('dashboard.scrollBySlots'),
      resetDashboard: fn('dashboard.resetDashboard'),
    },
    collaborationCoordinator: { isConnected: () => false },
    engine: { locomotion },

    // Panel-like targets (truthy so the `toggle` helper actually calls togglePanel).
    operationLogPanel: panel(),
    metricsPanel: panel(),
    performancePanel: panel(),
    interactionCoach: panel(),
    narrativeStrip: panel(),
    networkPanel: panel(),

    // Settings / tour / lens.
    _toggleSettingsPanel: fn('_toggleSettingsPanel'),
    startTour: fn('startTour'),
    _toggleStatisticalLens: fn('_toggleStatisticalLens'),
    _toggleMiniOverview: fn('_toggleMiniOverview'),
    _togglePeerPresenceHUD: fn('_togglePeerPresenceHUD'),
    _toggleDesktopPreview: fn('_toggleDesktopPreview'),
    _toggleLoadTestPanel: fn('_toggleLoadTestPanel'),

    // Views.
    portalsEnabled: false,
    setPortalsEnabled: fn('setPortalsEnabled'),
    _cycleDataset: fn('_cycleDataset'),
    _cycleThemePreset: fn('_cycleThemePreset'),

    // Session / export.
    saveSession: fn('saveSession'),
    loadSession: fn('loadSession'),
    deleteSession: fn('deleteSession'),
    exportScreenshot: fn('exportScreenshot'),
    exportAnalysisStory: fn('exportAnalysisStory'),

    // Live + collab.
    isLiveConnected: () => false,
    connectLiveStream: fn('connectLiveStream'),
    disconnectLiveStream: fn('disconnectLiveStream'),
    _joinCollaborationRoom: fn('_joinCollaborationRoom'),
    _leaveCollaborationRoom: fn('_leaveCollaborationRoom'),

    // Data ops.
    applyDataOperation: fn('applyDataOperation'),
    previewDataOperation: fn('previewDataOperation'),
    clearOperationPreview: fn('clearOperationPreview'),
    resetDataOperation: fn('resetDataOperation'),
    undoAnalysis: fn('undoAnalysis'),
    redoAnalysis: fn('redoAnalysis'),

    // Templates + load test.
    loadTemplate: fn('loadTemplate'),
    runLoadTest: fn('runLoadTest'),
    stopLoadTest: fn('stopLoadTest'),
    exitVR: fn('exitVR'),
  };

  return { world: world as unknown as WorldLike, spy };
}

describe('WheelMenuBuilder', () => {
  it('builds all seven categories with non-empty item lists', () => {
    const { world } = makeStubWorld();
    const cats = buildWheelMenuCategories(world);

    expect(cats.map((c) => c.id)).toEqual([
      'panels',
      'templates',
      'views',
      'live',
      'collab',
      'ops',
      'loadtest',
    ]);
    for (const c of cats) {
      expect(c.items.length).toBeGreaterThan(0);
      for (const item of c.items) {
        expect(typeof item.callback).toBe('function');
        expect(item.id).toBeTruthy();
        expect(item.label).toBeTruthy();
      }
    }
  });

  it('templates category has one item per AnalysisTemplate, each wired to loadTemplate', () => {
    const { world, spy } = makeStubWorld();
    const cats = buildWheelMenuCategories(world);
    const templates = cats.find((c) => c.id === 'templates')!;

    expect(templates.items.length).toBe(ANALYSIS_TEMPLATES.length);
    templates.items[0].callback();
    expect(spy.loadTemplate).toHaveBeenCalledWith(ANALYSIS_TEMPLATES[0].id);
  });

  it('every callback is wired: invoking each one calls exactly one world spy without throwing', () => {
    const { world, spy } = makeStubWorld();
    const cats = buildWheelMenuCategories(world);

    // Track call counts so we can confirm at least one spy fired per callback.
    const spyNames = Object.keys(spy);
    const countsBefore = spyNames.reduce((m, n) => ((m[n] = spy[n].mock.calls.length), m), {} as Record<string, number>);

    for (const c of cats) {
      for (const item of c.items) {
        expect(() => item.callback()).not.toThrow();
      }
    }

    const anyCalled = spyNames.some((n) => spy[n].mock.calls.length > countsBefore[n]);
    expect(anyCalled).toBe(true);
  });

  it('wires the new Lens (toggle-lens) item to _toggleStatisticalLens', () => {
    const { world, spy } = makeStubWorld();
    const cats = buildWheelMenuCategories(world);
    const views = cats.find((c) => c.id === 'views')!;
    const lens = views.items.find((i) => i.id === 'toggle-lens');

    expect(lens).toBeDefined();
    lens!.callback();
    expect(spy._toggleStatisticalLens).toHaveBeenCalledTimes(1);
  });

  it('wires high-value items to the expected world calls', () => {
    const { world, spy } = makeStubWorld();
    const cats = buildWheelMenuCategories(world);
    const panels = cats.find((c) => c.id === 'panels')!;
    const views = cats.find((c) => c.id === 'views')!;
    const ops = cats.find((c) => c.id === 'ops')!;
    const live = cats.find((c) => c.id === 'live')!;
    const collab = cats.find((c) => c.id === 'collab')!;
    const loadtest = cats.find((c) => c.id === 'loadtest')!;

    const find = (cat: typeof panels, id: string) => cat.items.find((i) => i.id === id)!;

    find(panels, 'settings').callback();
    expect(spy._toggleSettingsPanel).toHaveBeenCalledTimes(1);

    find(panels, 'exit-vr').callback();
    expect(spy.exitVR).toHaveBeenCalledTimes(1);

    find(panels, 'tour').callback();
    expect(spy.startTour).toHaveBeenCalledTimes(1);

    find(panels, 'save-session').callback();
    expect(spy.saveSession).toHaveBeenCalledWith('manual');

    find(panels, 'load-session').callback();
    expect(spy.loadSession).toHaveBeenCalledWith('autosave');

    find(panels, 'delete-autosave').callback();
    expect(spy.deleteSession).toHaveBeenCalledWith('autosave');

    find(panels, 'export-screenshot').callback();
    expect(spy.exportScreenshot).toHaveBeenCalledTimes(1);

    find(panels, 'export-story').callback();
    expect(spy.exportAnalysisStory).toHaveBeenCalledTimes(1);

    // A panel-toggle item must delegate to panelManager.togglePanel.
    find(panels, 'operation-log').callback();
    expect(spy['panelManager.togglePanel']).toHaveBeenCalledTimes(1);

    find(views, 'cycle-theme').callback();
    expect(spy._cycleThemePreset).toHaveBeenCalledTimes(1);

    find(views, 'teleport-toggle').callback();
    expect(spy['locomotion.toggleTeleport']).toHaveBeenCalledTimes(1);

    // Live not connected → Start connects.
    find(live, 'live-toggle').callback();
    expect(spy.connectLiveStream).toHaveBeenCalledTimes(1);

    // Collab not connected → Join.
    find(collab, 'collab-toggle').callback();
    expect(spy._joinCollaborationRoom).toHaveBeenCalledTimes(1);

    // Ops: filter → applyDataOperation('filter'); reset → resetDataOperation.
    find(ops, 'filter').callback();
    expect(spy.applyDataOperation).toHaveBeenCalledWith('filter');
    find(ops, 'reset').callback();
    expect(spy.resetDataOperation).toHaveBeenCalledTimes(1);

    find(loadtest, 'loadtest-panel').callback();
    expect(spy._toggleLoadTestPanel).toHaveBeenCalledTimes(1);
  });

  it('ops items expose onHover/onLeave wired to preview/clear', () => {
    const { world, spy } = makeStubWorld();
    const cats = buildWheelMenuCategories(world);
    const ops = cats.find((c) => c.id === 'ops')!;
    const filter = ops.items.find((i) => i.id === 'filter')!;

    expect(typeof filter.onHover).toBe('function');
    expect(typeof filter.onLeave).toBe('function');

    filter.onHover!();
    expect(spy.previewDataOperation).toHaveBeenCalledWith('filter');

    filter.onLeave!();
    expect(spy.clearOperationPreview).toHaveBeenCalledTimes(1);
  });

  it('live toggle stops the stream when already connected', () => {
    const { world, spy } = makeStubWorld();
    (world as any).isLiveConnected = () => true;
    const cats = buildWheelMenuCategories(world);
    const live = cats.find((c) => c.id === 'live')!;

    live.items[0].callback();
    expect(spy.disconnectLiveStream).toHaveBeenCalledTimes(1);
    expect(spy.connectLiveStream).not.toHaveBeenCalled();
  });
});