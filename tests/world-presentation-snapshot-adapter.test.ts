import { describe, expect, it, vi } from 'vitest';
import type { PresentationState } from '../src/session/NemosyneSession.ts';
import { WorldPresentationSnapshotAdapter } from '../src/vr/presentation/session/WorldPresentationSnapshotAdapter.ts';

describe('WorldPresentationSnapshotAdapter restore isolation', () => {
  it('clears live semantic focus when the restored snapshot has no focus field', async () => {
    const clearFocus = vi.fn();
    const restoreState = vi.fn();
    const settings = { defaultPanelDistance: 1.4 };
    const adapter = new WorldPresentationSnapshotAdapter({
      cameraGroup: {
        position: { fromArray: vi.fn(), toArray: () => [0, 0, 0] },
        rotation: { y: 0 },
      } as never,
      theme: {
        currentPreset: 'neonMidnight',
        applyPreset: vi.fn(),
      } as never,
      settingsPanel: {
        getAllSettings: () => settings,
        setSetting: vi.fn(),
      } as never,
      panelManager: {
        getPanelPositions: () => [],
        setPanelPositions: vi.fn(),
      } as never,
      guidedTour: {
        capturePresentationState: () => ({ stepIndex: 0, finished: true }),
        restorePresentationState: vi.fn(),
      },
      comfortSettingsController: {
        apply: vi.fn(),
        applyPanelDistance: vi.fn(),
      } as never,
      focusContext: {
        exportState: vi.fn(() => ({ currentLevel: 'overview', focusedStructureId: null })),
        restoreState,
        clearFocus,
      } as never,
      getCurrentEntry: () => null,
      getFallbackDatasetName: () => null,
      hasRepresentation: () => false,
    });

    const snapshot: PresentationState = {
      camera: { position: [0, 0, 0], rotationY: 0 },
      settings,
      tour: { stepIndex: 0, finished: true },
      theme: 'neonMidnight',
      panelPositions: [],
      entry: { name: 'archive' },
    };

    await adapter.restore(snapshot);

    expect(clearFocus).toHaveBeenCalledOnce();
    expect(restoreState).not.toHaveBeenCalled();
  });
});