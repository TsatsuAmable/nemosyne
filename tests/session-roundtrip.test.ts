// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { AnalysisHistory } from '../src/data/AnalysisHistory.ts';
import { SessionStore } from '../src/data/SessionStore.ts';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { NemosyneSession } from '../src/session/NemosyneSession.ts';
import {
  WorldSessionController,
  type WorldSessionControllerOptions,
} from '../src/vr/coordinators/WorldSessionController.ts';
import { WorldPresentationSnapshotAdapter } from '../src/vr/presentation/session/WorldPresentationSnapshotAdapter.ts';
import { WorldEventBus, WorldTopics } from '../src/utils/EventBus.ts';
import { VaultArchiveStore } from '../src/session/VaultArchiveStore.ts';
import { FocusContextController } from '../src/vr/interactions/FocusContextController.ts';
import { toAnalysisSpec } from '../src/vr/interactions/DataOperations.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';

/**
 * Minimal in-memory IndexedDB fake. Implements just the surface the
 * SessionStore touches: open() with onupgradeneeded/onsuccess, and a single
 * object store supporting put/get/getAll/delete/getKey. Every request fires
 * its onsuccess on a microtask, mirroring the real async IDB request model.
 */
function createFakeIndexedDB() {
  const records = new Map<string, { id: string; snapshot?: any; value?: any; savedAt: number }>();
  let storeCreated = false;

  const db: any = {
    objectStoreNames: { contains: () => storeCreated },
    createObjectStore: () => {
      storeCreated = true;
      return {};
    },
    transaction: () => {
      const req = (result: any) => {
        const r: any = { onerror: null, onsuccess: null, error: null, result };
        Promise.resolve().then(() => r.onsuccess && r.onsuccess({ target: r }));
        return r;
      };
      const storeApi = {
        put: (val: any) => {
          records.set(val.id, val);
          return req(undefined);
        },
        get: (id: string) => req(records.get(id)),
        getAll: () => req([...records.values()]),
        delete: (id: string) => {
          records.delete(id);
          return req(undefined);
        },
        getKey: (id: string) => req(records.has(id) ? id : undefined),
      };
      return { objectStore: () => storeApi };
    },
  };

  const factory: any = {
    open: () => {
      const r: any = {
        onerror: null,
        onsuccess: null,
        onupgradeneeded: null,
        error: null,
        result: db,
      };
      Promise.resolve().then(() => {
        if (r.onupgradeneeded) r.onupgradeneeded({ target: r, oldVersion: 0 });
        if (r.onsuccess) r.onsuccess({ target: r });
      });
      return r;
    },
  };
  return { factory, records };
}

function makeDataset(name: string): Dataset {
  return new Dataset(
    name,
    [
      { name: 'id', type: ColumnType.NUMERIC },
      { name: 'value', type: ColumnType.NUMERIC },
    ],
    [
      { id: 1, value: 10 },
      { id: 2, value: 20 },
    ]
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

/** Builds narrow session/application/presentation ports around real authorities. */
function makeSessionHarness(sessionStore: SessionStore): {
  options: WorldSessionControllerOptions;
  stub: any;
  eventBus: WorldEventBus;
} {
  const ds = makeDataset('palace');

  // Real AtlasCore with the mock kernel; load the dataset so the ledger + a
  // history frame are populated before save.
  const atlas = new AtlasCore({ kernel: makeKernelMockBridge() as any });
  atlas.setOriginalDataset(ds);
  // Wave 6: AnalysisHistory is a DERIVED VIEW of the ledger — frames are
  // created by running real analyses (the kernel is the only path). The mock
  // kernel's canned 'filter' op yields the same 'load' + 'filter' shape the
  // save/load roundtrip asserts on.
  atlas.applyAnalysis(toAnalysisSpec('filter', ds, atlas));

  const session = new NemosyneSession({ atlas });

  const cameraGroup = new THREE.Group();
  cameraGroup.position.set(1.5, 2.0, -3.0);
  cameraGroup.rotation.y = 0.7;

  const settings: Record<string, unknown> = {
    lensTDA: false,
    userMode: 'intermediate',
    defaultPanelDistance: 1.4,
  };

  const settingsPanel = {
    getAllSettings: () => ({ ...settings }),
    setSetting: vi.fn((k: string, v: unknown) => {
      settings[k] = v;
    }),
  };
  const panelManager = {
    getPanelPositions: () => [{ title: 'A', position: [1, 2, 3], visible: true }],
    setPanelPositions: vi.fn(),
  };
  const narrativeStrip = { setHistory: vi.fn() };
  const focusController = new FocusContextController();
  const focusContext = {
    exportState: vi.fn(() => focusController.exportState()),
    restoreState: vi.fn((state) => focusController.restoreState(state)),
    clearFocus: vi.fn(() => focusController.clearFocus()),
  };

  const stub: any = {
    disposed: false,
    currentEntry: { dataset: ds, name: 'palace', topology: 'TABULAR', label: 'palace' },
    dracoNode: { group: new THREE.Object3D() },
    atlas,
    session,
    analysisHistory: atlas.analysisHistory,
    engine: {
      cameraGroup,
      theme: { currentPreset: 'neonMidnight', applyPreset: vi.fn() },
    },
    settingsPanel,
    guidedTour: {
      _stepIndex: 2,
      _finished: false,
      _active: false,
      _cardGroup: { visible: false },
      _renderStep: vi.fn(),
      capturePresentationState() {
        return { stepIndex: this._stepIndex, finished: this._finished };
      },
      restorePresentationState(state) {
        this._stepIndex = state.stepIndex;
        this._finished = state.finished;
        this._active = !state.finished;
        this._cardGroup.visible = !state.finished;
        if (!state.finished) this._renderStep();
      },
    },
    panelManager,
    comfortSettingsController: { apply: vi.fn(), applyPanelDistance: vi.fn() },
    userModeController: { apply: vi.fn() },
    focusContext,
    narrativeStrip,
    uiManager: {
      settingsPanel,
      panelManager,
      narrativeStrip,
    },
    sessionStore,
    vrConsole: { log: vi.fn() },
    recordInteraction: vi.fn(),
    loadDataset: vi.fn(),
    restoreRepresentation: vi.fn(),
    restoreDatasetView: vi.fn(),
  };

  const eventBus = new WorldEventBus();
  eventBus.on(WorldTopics.HISTORY_SEEK, (payload: unknown) => {
    const restored = payload as { operation: string; dataset: Dataset };
    narrativeStrip.setHistory(atlas.analysisHistory);
    stub.restoreDatasetView(restored.dataset, restored.operation);
  });

  const presentation = new WorldPresentationSnapshotAdapter({
    cameraGroup,
    theme: stub.engine.theme,
    settingsPanel,
    panelManager: panelManager as never,
    guidedTour: stub.guidedTour,
    comfortSettingsController: stub.comfortSettingsController,
    focusContext,
    getCurrentEntry: () => stub.currentEntry,
    getFallbackDatasetName: () => atlas.originalDataset?.name ?? null,
    hasRepresentation: () => !!stub.dracoNode,
  });
  const options: WorldSessionControllerOptions = {
    session,
    getSessionStore: () => stub.sessionStore,
    presentation,
    loadDataset: stub.loadDataset,
    restoreRepresentation: stub.restoreRepresentation,
    eventBus,
    archiveStore: new VaultArchiveStore(sessionStore),
    log: (level, message) => stub.vrConsole.log(level, [message]),
    recordInteraction: stub.recordInteraction,
    applyUserMode: stub.userModeController.apply,
    isRuntimeActive: () => !stub.disposed,
  };

  return { options, stub, eventBus };
}

describe('SessionStore persistence (fake IndexedDB)', () => {
  let idb: ReturnType<typeof createFakeIndexedDB>;
  let store: SessionStore;

  beforeEach(() => {
    idb = createFakeIndexedDB();
    store = new SessionStore({ indexedDB: idb.factory });
  });

  it('round-trips a snapshot through save/load', async () => {
    const snap = { schemaVersion: 2, dataset: { name: 'x' }, history: [] };
    await store.saveSession('s1', snap as any);
    const loaded = await store.loadSession('s1');
    expect(loaded).toEqual(snap);
  });

  it('hasSession / listSessions reflect stored entries', async () => {
    await store.saveSession('a', { schemaVersion: 2, dataset: {} } as any);
    await store.saveSession('b', { schemaVersion: 2, dataset: {} } as any);
    expect(await store.hasSession('a')).toBe(true);
    expect(await store.hasSession('missing')).toBe(false);

    const list = await store.listSessions();
    expect(list.map((l) => l.id).sort()).toEqual(['a', 'b']);
    expect(list.every((l) => typeof l.savedAt === 'number')).toBe(true);
  });

  it('deleteSession clears the entry', async () => {
    await store.saveSession('s', { schemaVersion: 2, dataset: {} } as any);
    expect(await store.hasSession('s')).toBe(true);
    await store.deleteSession('s');
    expect(await store.hasSession('s')).toBe(false);
    expect(await store.loadSession('s')).toBe(null);
  });

  it('rejects snapshots with an incompatible schema version', async () => {
    // Wave 4: schemaVersion 2 is the only accepted version; legacy v1 rejected.
    await store.saveSession('old', { schemaVersion: 1, dataset: {} } as any);
    expect(await store.loadSession('old')).toBe(null);
  });

  it('rejects snapshots missing a dataset object', async () => {
    await store.saveSession('bad', { schemaVersion: 2 } as any);
    expect(await store.loadSession('bad')).toBe(null);
  });

  it('returns null without a configured indexedDB factory', async () => {
    const empty = new SessionStore({ indexedDB: null });
    expect(await empty.loadSession('x')).toBe(null);
    expect(await empty.hasSession('x')).toBe(false);
    expect(await empty.listSessions()).toEqual([]);
  });
});

describe('WorldSessionController save/load roundtrip', () => {
  let idb: ReturnType<typeof createFakeIndexedDB>;
  let store: SessionStore;
  let stub: any;
  let options: WorldSessionControllerOptions;
  let eventBus: WorldEventBus;
  let controller: WorldSessionController;

  beforeEach(() => {
    idb = createFakeIndexedDB();
    store = new SessionStore({ indexedDB: idb.factory });
    const built = makeSessionHarness(store);
    stub = built.stub;
    options = built.options;
    eventBus = built.eventBus;
    controller = new WorldSessionController(options);
  });

  it('saveSession serializes the world into the store and logs the interaction', async () => {
    await controller.saveSession('manual');

    expect(stub.recordInteraction).toHaveBeenCalledWith('Save session', { result: 'manual' });
    expect(await store.hasSession('manual')).toBe(true);

    const snap: any = await store.loadSession('manual');
    expect(snap.schemaVersion).toBe(2);
    expect(snap.presentation.theme).toBe('neonMidnight');
    expect(snap.presentation.tour).toEqual({ stepIndex: 2, finished: false });
    expect(snap.presentation.camera.position).toEqual([1.5, 2.0, -3.0]);
    expect(snap.presentation.camera.rotationY).toBeCloseTo(0.7);
    expect(snap.presentation.settings.userMode).toBe('intermediate');
    expect(snap.presentation.panelPositions).toEqual([
      { title: 'A', position: [1, 2, 3], visible: true },
    ]);
    expect(snap.originalDataset).toBeTruthy();
    expect(snap.currentDataset).toBeTruthy();
    expect(snap.analysisHistory).toBeTruthy();
    expect(Array.isArray(snap.analysisResults)).toBe(true);
    expect(Array.isArray(snap.eventLedger)).toBe(true);
    expect(snap.datasetSpace).toBeTruthy();
  });

  it('loadSession restores dataset, settings, camera, theme, panels, and tour', async () => {
    await controller.saveSession('autosave');
    // Mutate the stub so we can prove load overwrites it.
    stub.engine.cameraGroup.position.set(0, 0, 0);
    stub.engine.cameraGroup.rotation.y = 0;
    stub.guidedTour._stepIndex = 0;
    stub.guidedTour._active = false;
    stub.guidedTour._cardGroup.visible = false;
    stub.guidedTour._finished = true;

    const ok = await controller.loadSession('autosave');
    expect(ok).toBe(true);

    // Dataset was reloaded via real Dataset.fromJSON.
    expect(stub.loadDataset).toHaveBeenCalledTimes(1);
    const entry = stub.loadDataset.mock.calls[0][0];
    expect(entry.dataset).toBeInstanceOf(Dataset);
    expect(entry.dataset.name).toBe('palace');

    // History restored on the shared atlas (real AnalysisHistory).
    expect(stub.atlas.analysisHistory).toBeInstanceOf(AnalysisHistory);
    expect(stub.uiManager.narrativeStrip.setHistory).toHaveBeenCalledWith(
      stub.atlas.analysisHistory
    );
    expect(stub.restoreDatasetView).toHaveBeenCalled();
    expect(stub.restoreRepresentation).toHaveBeenCalledOnce();

    // Camera pose restored.
    expect(stub.engine.cameraGroup.position.toArray()).toEqual([1.5, 2.0, -3.0]);
    expect(stub.engine.cameraGroup.rotation.y).toBeCloseTo(0.7);

    // Settings applied + comfort controller re-applied.
    expect(stub.uiManager.settingsPanel.setSetting).toHaveBeenCalledWith(
      'userMode',
      'intermediate'
    );
    expect(stub.comfortSettingsController.apply).toHaveBeenCalledTimes(1);
    expect(stub.comfortSettingsController.applyPanelDistance).toHaveBeenCalledWith(1.4);

    // Theme + panel positions restored.
    expect(stub.engine.theme.applyPreset).toHaveBeenCalledWith('neonMidnight');
    expect(stub.uiManager.panelManager.setPanelPositions).toHaveBeenCalledWith([
      { title: 'A', position: [1, 2, 3], visible: true },
    ]);

    // Tour resumed at the saved step.
    expect(stub.guidedTour._stepIndex).toBe(2);
    expect(stub.guidedTour._active).toBe(true);
    expect(stub.guidedTour._finished).toBe(false);
    expect(stub.guidedTour._cardGroup.visible).toBe(true);
    expect(stub.guidedTour._renderStep).toHaveBeenCalled();
  });

  it('clears a stale live representation decision when the snapshot has none', async () => {
    await controller.saveSession('no-representation-decision');
    const saved: any = await store.loadSession('no-representation-decision');
    expect(saved.representationDecision).toBeNull();

    stub.atlas.arbitrateRepresentation();
    expect(stub.atlas.activeRepresentationDecision).not.toBeNull();

    await expect(controller.loadSession('no-representation-decision')).resolves.toBe(true);
    expect(stub.atlas.activeRepresentationDecision).toBeNull();
  });

  it('fails closed for malformed presentation coordinates and semantic focus', async () => {
    await controller.saveSession('malformed-presentation');
    const snapshot: any = await store.loadSession('malformed-presentation');
    snapshot.presentation.camera = { position: [Number.NaN, 2, 3], rotationY: Infinity };
    snapshot.presentation.panelPositions = [
      { title: 'A', position: [1, Number.POSITIVE_INFINITY, 3], visible: true },
    ];
    snapshot.presentation.settings = {
      ...snapshot.presentation.settings,
      defaultPanelDistance: Number.NaN,
      userMode: 17,
    };
    snapshot.presentation.theme = 42;
    snapshot.presentation.tour = { stepIndex: -4, finished: false };
    snapshot.presentation.focus = { currentLevel: 'observation', focusedStructureId: null };
    await store.saveSession('malformed-presentation', snapshot);
    stub.engine.cameraGroup.position.set(9, 8, 7);
    stub.engine.cameraGroup.rotation.y = 0.25;
    stub.uiManager.panelManager.setPanelPositions.mockClear();

    await expect(controller.loadSession('malformed-presentation')).resolves.toBe(true);

    expect(stub.engine.cameraGroup.position.toArray()).toEqual([9, 8, 7]);
    expect(stub.engine.cameraGroup.rotation.y).toBe(0.25);
    expect(stub.uiManager.panelManager.setPanelPositions).toHaveBeenCalledWith([]);
    expect(stub.uiManager.settingsPanel.getAllSettings().defaultPanelDistance).toBe(1.4);
    expect(stub.uiManager.settingsPanel.getAllSettings().userMode).toBe('intermediate');
    expect(stub.engine.theme.applyPreset).not.toHaveBeenCalled();
    expect(stub.guidedTour._stepIndex).toBe(0);
    expect(stub.focusContext.clearFocus).toHaveBeenCalledOnce();
  });

  it('invalidates a deferred session load before disposal can mutate session authority', async () => {
    await controller.saveSession('late');
    const snapshot = await store.loadSession('late');
    const load = deferred<typeof snapshot>();
    const loadFromJSON = vi.spyOn(stub.session, 'loadFromJSON');
    const datasetVersion = stub.atlas.datasetVersion;
    stub.sessionStore.loadSession = vi.fn(() => load.promise);

    const pending = controller.loadSession('late');
    controller.dispose();
    controller.dispose();
    load.resolve(snapshot);

    await expect(pending).resolves.toBe(false);
    expect(loadFromJSON).not.toHaveBeenCalled();
    expect(stub.loadDataset).not.toHaveBeenCalled();
    expect(stub.restoreDatasetView).not.toHaveBeenCalled();
    expect(stub.atlas.datasetVersion).toBe(datasetVersion);
  });

  it('fences disposal while the ordinary dataset-load pathway is still pending', async () => {
    await controller.saveSession('pending-dataset-load');
    const gate = deferred<void>();
    const loadDataset = vi.fn(() => gate.promise);
    const loadFromJSON = vi.spyOn(stub.session, 'loadFromJSON');
    const outcome = vi.fn();
    eventBus.on(WorldTopics.HISTORY_SEEK, outcome);
    const pendingController = new WorldSessionController({
      ...options,
      loadDataset,
    });

    const pending = pendingController.loadSession('pending-dataset-load');
    await vi.waitFor(() => expect(loadDataset).toHaveBeenCalledOnce());
    pendingController.dispose();
    gate.resolve();

    await expect(pending).resolves.toBe(false);
    expect(loadFromJSON).not.toHaveBeenCalled();
    expect(outcome).not.toHaveBeenCalled();
  });

  it('deleteSession delegates to the store', async () => {
    await controller.saveSession('temp');
    expect(await store.hasSession('temp')).toBe(true);
    await controller.deleteSession('temp');
    expect(await store.hasSession('temp')).toBe(false);
  });

  it('requestAutoSave debounces into a single delayed save', async () => {
    vi.useFakeTimers();
    try {
      controller.requestAutoSave();
      controller.requestAutoSave();
      controller.requestAutoSave();

      // No save yet — the autosave is debounced (2s).
      expect(await store.hasSession('autosave')).toBe(false);

      await vi.advanceTimersByTimeAsync(2000);

      expect(await store.hasSession('autosave')).toBe(true);
      expect(stub.recordInteraction).toHaveBeenCalledWith('Save session', {
        result: 'autosave',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('restoreAutoSave is a no-op when no autosave exists', async () => {
    const result = await controller.restoreAutoSave();
    expect(result).toBeUndefined();
    expect(stub.loadDataset).not.toHaveBeenCalled();
  });

  it('restores analysis through the ordinary HISTORY_SEEK production outcome', async () => {
    await controller.saveSession('history-path');
    const outcome = vi.fn();
    eventBus.on(WorldTopics.HISTORY_SEEK, outcome);

    await expect(controller.loadSession('history-path')).resolves.toBe(true);

    expect(outcome).toHaveBeenCalledOnce();
    expect(outcome.mock.calls[0][0]).toMatchObject({ operation: 'filter' });
    expect(outcome.mock.calls[0][0].dataset).toBeInstanceOf(Dataset);
  });
});
