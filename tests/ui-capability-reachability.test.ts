// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { buildIntentWheelMenuCategories, type WheelMenuHost } from '../src/vr/coordinators/WheelMenuBuilder.ts';
import { ContextualTaskSurface } from '../src/vr/ui/ContextualTaskSurface.ts';

function minimalWorld(): WheelMenuHost {
  const panelManager = {
    panels: [],
    register: vi.fn(),
    togglePanel: vi.fn(),
    toggleLauncher: vi.fn(),
    showPanel: vi.fn(),
    hidePanel: vi.fn(),
    isLauncherVisible: () => false,
    recenter: vi.fn(),
  };
  return {
    uiManager: {
      panelManager,
      dataSourcePanel: { mesh: new THREE.Group() },
      vaultPanel: { mesh: new THREE.Group() },
    },
    engine: {
      locomotion: {
        teleportToAnchor: vi.fn(),
        toggleTeleport: vi.fn(),
        toggleFlight: vi.fn(),
        dropToFloor: vi.fn(),
      },
    },
    collaborationCoordinator: { isConnected: () => false },
    applyDataOperation: vi.fn(),
    previewDataOperation: vi.fn(),
    clearOperationPreview: vi.fn(),
    resetDataOperation: vi.fn(),
    undoAnalysis: vi.fn(),
    redoAnalysis: vi.fn(),
    saveSession: vi.fn(),
    loadSession: vi.fn(),
    deleteSession: vi.fn(),
    exportScreenshot: vi.fn(),
    exportAnalysisStory: vi.fn(),
    loadTemplate: vi.fn(),
    setPortalsEnabled: vi.fn(),
    isLiveConnected: () => false,
    connectLiveStream: vi.fn(),
    disconnectLiveStream: vi.fn(),
    startTour: vi.fn(),
    _cycleDataset: vi.fn(),
    _cycleThemePreset: vi.fn(),
    _toggleSettingsPanel: vi.fn(),
    _toggleMiniOverview: vi.fn(),
    _togglePeerPresenceHUD: vi.fn(),
    _toggleDesktopPreview: vi.fn(),
    _joinCollaborationRoom: vi.fn(),
    _leaveCollaborationRoom: vi.fn(),
  };
}

describe('post-UXR1 UI capability reachability', () => {
  it('keeps every legacy global analysis operation except compare directly on ANALYSE', () => {
    const analyse = buildIntentWheelMenuCategories(minimalWorld()).find((c) => c.id === 'ANALYSE');
    const ids = new Set(analyse?.items.map((item) => item.id));
    for (const id of ['filter', 'sort', 'aggregate', 'cluster', 'hierarchical', 'density', 'anomaly', 'timeSlice', 'reset']) {
      expect(ids.has(id), id).toBe(true);
    }
  });

  it('keeps compare reachable through the selected-object task authority', () => {
    const onCompare = vi.fn();
    const engine = { camera: new THREE.PerspectiveCamera() } as never;
    const surface = new ContextualTaskSurface(engine, { onCompare });

    expect(surface.dispatchTask('compare', { topology: 'GRAPH', id: 'g1' })).toBe(true);
    expect(onCompare).toHaveBeenCalledWith({ topology: 'GRAPH', id: 'g1' });
    surface.dispose();
  });

  it('keeps unique data-source and archive surfaces reachable without the generic launcher', () => {
    const world = minimalWorld();
    const categories = buildIntentWheelMenuCategories(world);
    expect(categories.find((c) => c.id === 'DATA')?.items.some((i) => i.id === 'data-sources')).toBe(true);
    expect(categories.find((c) => c.id === 'STUDY')?.items.some((i) => i.id === 'vault')).toBe(true);
    expect(categories.find((c) => c.id === 'SYSTEM')?.items.some((i) => i.id === 'launcher')).toBe(false);
    expect(categories.find((c) => c.id === 'SUPERUSER')?.items.some((i) => i.id === 'su-panel-launcher')).toBe(true);
  });
});
