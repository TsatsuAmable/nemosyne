/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { AnalysisHistory } from '../src/data/AnalysisHistory.ts';
import { SessionStore } from '../src/data/SessionStore.ts';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { NemosyneSession } from '../src/session/NemosyneSession.ts';
import { WorldSessionController } from '../src/vr/coordinators/WorldSessionController.ts';
import { toAnalysisSpec } from '../src/vr/interactions/DataOperations.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.js';
import type { WorldLike } from '../src/vr/coordinators/types.ts';

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
      const r: any = { onerror: null, onsuccess: null, onupgradeneeded: null, error: null, result: db };
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

/** Builds a stub WorldLike backed by REAL Dataset/AtlasCore/NemosyneSession
 *  + three.js objects so the controller's serialize/deserialize roundtrip is
 *  genuine. Wave 4: snapshot authority lives on NemosyneSession. */
function makeStubWorld(sessionStore: SessionStore): { world: WorldLike; stub: any } {
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

  const stub: any = {
    _disposed: false,
    currentEntry: { dataset: ds, name: 'palace', topology: 'TABULAR', label: 'palace' },
    dracoNode: { group: new THREE.Object3D() },
    _originalDataset: ds,
    _transformedDataset: ds,
    atlas,
    session,
    analysisHistory: atlas.analysisHistory,
    engine: {
      cameraGroup,
      theme: { currentPreset: 'neonMidnight', applyPreset: vi.fn() },
    },
    settingsPanel: {
      getAllSettings: () => ({ ...settings }),
      setSetting: vi.fn((k: string, v: unknown) => {
        settings[k] = v;
      }),
    },
    guidedTour: {
      _stepIndex: 2,
      _finished: false,
      _active: false,
      _cardGroup: { visible: false },
      _renderStep: vi.fn(),
    },
    panelManager: {
      getPanelPositions: () => [{ title: 'A', position: [1, 2, 3], visible: true }],
      setPanelPositions: vi.fn(),
    },
    comfortSettingsController: { apply: vi.fn(), applyPanelDistance: vi.fn() },
    userModeController: { apply: vi.fn() },
    narrativeStrip: { setHistory: vi.fn() },
    sessionStore,
    vrConsole: { log: vi.fn() },
    _logInteraction: vi.fn(),
    loadDataset: vi.fn(),
    _restoreDataset: vi.fn(),
    _updateNarrativeStrip: vi.fn(),
  };

  return { world: stub as unknown as WorldLike, stub };
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
  let world: WorldLike;
  let controller: WorldSessionController;

  beforeEach(() => {
    idb = createFakeIndexedDB();
    store = new SessionStore({ indexedDB: idb.factory });
    const built = makeStubWorld(store);
    stub = built.stub;
    world = built.world;
    controller = new WorldSessionController(world);
  });

  it('saveSession serializes the world into the store and logs the interaction', async () => {
    await controller.saveSession('manual');

    expect(stub._logInteraction).toHaveBeenCalledWith('Save session', { result: 'manual' });
    expect(await store.hasSession('manual')).toBe(true);

    const snap: any = await store.loadSession('manual');
    expect(snap.schemaVersion).toBe(2);
    expect(snap.presentation.theme).toBe('neonMidnight');
    expect(snap.presentation.tour).toEqual({ stepIndex: 2, finished: false });
    expect(snap.presentation.camera.position).toEqual([1.5, 2.0, -3.0]);
    expect(snap.presentation.camera.rotationY).toBeCloseTo(0.7);
    expect(snap.presentation.settings.userMode).toBe('intermediate');
    expect(snap.presentation.panelPositions).toEqual([{ title: 'A', position: [1, 2, 3], visible: true }]);
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
    expect(stub.narrativeStrip.setHistory).toHaveBeenCalledWith(stub.atlas.analysisHistory);
    expect(stub._restoreDataset).toHaveBeenCalled();

    // Camera pose restored.
    expect(stub.engine.cameraGroup.position.toArray()).toEqual([1.5, 2.0, -3.0]);
    expect(stub.engine.cameraGroup.rotation.y).toBeCloseTo(0.7);

    // Settings applied + comfort controller re-applied.
    expect(stub.settingsPanel.setSetting).toHaveBeenCalledWith('userMode', 'intermediate');
    expect(stub.comfortSettingsController.apply).toHaveBeenCalledTimes(1);
    expect(stub.comfortSettingsController.applyPanelDistance).toHaveBeenCalledWith(1.4);

    // Theme + panel positions restored.
    expect(stub.engine.theme.applyPreset).toHaveBeenCalledWith('neonMidnight');
    expect(stub.panelManager.setPanelPositions).toHaveBeenCalledWith([
      { title: 'A', position: [1, 2, 3], visible: true },
    ]);

    // Tour resumed at the saved step.
    expect(stub.guidedTour._stepIndex).toBe(2);
    expect(stub.guidedTour._active).toBe(true);
    expect(stub.guidedTour._finished).toBe(false);
    expect(stub.guidedTour._cardGroup.visible).toBe(true);
    expect(stub.guidedTour._renderStep).toHaveBeenCalled();
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
      expect(stub._logInteraction).toHaveBeenCalledWith('Save session', { result: 'autosave' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('restoreAutoSave is a no-op when no autosave exists', async () => {
    const result = await controller.restoreAutoSave();
    expect(result).toBeUndefined();
    expect(stub.loadDataset).not.toHaveBeenCalled();
  });
});