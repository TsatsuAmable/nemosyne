import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { WorldSessionController } from '../src/vr/coordinators/WorldSessionController.ts';

function makeController() {
  const log = vi.fn();
  const recordInteraction = vi.fn();
  const saveSession = vi.fn(async () => {
    throw new Error('IndexedDB is not available in this environment');
  });
  const session = {
    atlas: {},
    presentation: {},
    setPresentation: vi.fn(),
    serialize: vi.fn(() => ({
      schemaVersion: 2,
      originalDataset: { name: 'dataset', columns: [], rows: [] },
    })),
    loadFromJSON: vi.fn(),
  };
  const controller = new WorldSessionController({
    session: session as never,
    getSessionStore: () => ({ saveSession } as never),
    presentation: {
      capture: () => ({
        camera: { position: [0, 0, 0], rotationY: 0 },
        settings: {},
        tour: { stepIndex: 0, finished: true },
        theme: 'neonMidnight',
        panelPositions: [],
        entry: { name: 'dataset' },
      }),
      restore: vi.fn(),
    } as never,
    loadDataset: vi.fn(),
    restoreRepresentation: vi.fn(),
    eventBus: { emit: vi.fn() } as never,
    archiveStore: {} as never,
    log,
    recordInteraction,
    applyUserMode: vi.fn(),
  });

  return { controller, log, recordInteraction };
}

describe('local persistence unavailable product state', () => {
  it('surfaces manual-save storage failure through the visible interaction projection', async () => {
    const { controller, log, recordInteraction } = makeController();

    await expect(controller.saveSessionChecked('manual')).rejects.toThrow(/IndexedDB is not available/);

    expect(log).toHaveBeenCalledWith(
      'warn',
      expect.stringContaining('Local recovery unavailable: Investigation save failed'),
    );
    expect(recordInteraction).toHaveBeenCalledWith(
      'Local recovery unavailable',
      expect.objectContaining({ result: expect.stringContaining('IndexedDB is not available') }),
    );
  });

  it('keeps autosave failure non-throwing while preserving the same visible warning', async () => {
    const { controller, recordInteraction } = makeController();

    await expect(controller.saveSession('autosave')).resolves.toBeUndefined();
    expect(recordInteraction).toHaveBeenCalledWith(
      'Local recovery unavailable',
      expect.objectContaining({ result: expect.stringContaining('Investigation save failed') }),
    );
  });

  it('proves the production composition routes controller interactions into the Interaction Coach', () => {
    const worldSource = readFileSync(new URL('../src/vr/World.ts', import.meta.url), 'utf8');
    const bindingSource = readFileSync(
      new URL('../src/vr/presentation/bindings/bindInteractionProjection.ts', import.meta.url),
      'utf8',
    );

    expect(worldSource).toContain(
      'recordInteraction: (action, options) => this._logInteraction(action, options)',
    );
    expect(worldSource).toContain(
      'logInteraction: (event) => this.uiManager.interactionCoach?.log?.(event)',
    );
    expect(bindingSource).toContain('eventBus.on(WorldTopics.INTERACTION_LOG');
    expect(bindingSource).toContain('logInteraction(payload as InteractionEvent)');
  });
});
