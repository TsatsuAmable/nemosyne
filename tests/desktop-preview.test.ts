// @ts-nocheck
/**
 * @jest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as THREE from 'three';

async function ensureKernelAfterModuleReset() {
  const bridge = await import('../src/wasm/RuntimeBridge.ts');
  if (!bridge.isReady()) {
    await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
  }
}

/**
 * Minimal transaction-correct in-memory IndexedDB stub for unit testing.
 * Requests settle before the transaction completion callback, matching the
 * ordering relied on by production persistence.
 */
function makeStubIndexedDB() {
  const stores = new Map();

  class FakeRequest {
    constructor(result = null, error = null, transaction = null) {
      this.result = result;
      this.error = error;
      this.transaction = transaction;
    }
    _dispatch() {
      if (this.error && this.onerror) this.onerror({ target: this });
      else if (this.onsuccess) this.onsuccess({ target: this });
      this.transaction?._requestSettled();
    }
  }

  class FakeObjectStore {
    constructor(data, transaction) {
      this.data = data;
      this.transaction = transaction;
    }
    _request(result = null, error = null) {
      this.transaction._requestStarted();
      const req = new FakeRequest(result, error, this.transaction);
      Promise.resolve().then(() => req._dispatch());
      return req;
    }
    put(record, explicitKey) {
      const key = explicitKey ?? record?.id;
      this.data.set(key, record);
      return this._request();
    }
    get(id) {
      return this._request(this.data.get(id) ?? undefined);
    }
    getAll() {
      return this._request([...this.data.values()]);
    }
    getAllKeys() {
      return this._request([...this.data.keys()]);
    }
    getKey(id) {
      return this._request(this.data.has(id) ? id : undefined);
    }
    delete(id) {
      this.data.delete(id);
      return this._request();
    }
  }

  class FakeTransaction {
    constructor(data) {
      this.store = new FakeObjectStore(data, this);
      this.pending = 0;
      this.completed = false;
      Promise.resolve().then(() => this._maybeComplete());
    }
    objectStore() {
      return this.store;
    }
    _requestStarted() {
      this.pending += 1;
    }
    _requestSettled() {
      this.pending -= 1;
      this._maybeComplete();
    }
    _maybeComplete() {
      if (this.pending !== 0 || this.completed) return;
      this.completed = true;
      Promise.resolve().then(() => this.oncomplete?.({ target: this }));
    }
  }

  class FakeDatabase {
    constructor() {
      this.objectStoreNames = { contains: () => true };
      this._data = stores;
    }
    transaction() {
      return new FakeTransaction(this._data);
    }
    close() {}
  }

  return {
    open() {
      const req = new FakeRequest();
      Promise.resolve().then(() => {
        req.result = new FakeDatabase();
        req._dispatch();
      });
      return req;
    },
  };
}

describe('Desktop preview and shared settings', () => {
  let world;
  let originalIndexedDB;

  beforeEach(async () => {
    vi.resetModules();
    await ensureKernelAfterModuleReset();
    localStorage.clear();
    originalIndexedDB = global.indexedDB;
    global.indexedDB = makeStubIndexedDB();
    const { World } = await import('../src/vr/World.ts');
    world = new World();
    // Wait for async autosave / shared-settings load to settle.
    await new Promise((r) => setTimeout(r, 80));
  });

  afterEach(() => {
    world?.engine?.desktop?.disable?.();
    global.indexedDB = originalIndexedDB;
  });

  it('toggles desktop preview when not in XR', () => {
    const logSpy = vi.spyOn(world.uiManager.vrConsole, 'log').mockImplementation(() => {});
    world._toggleDesktopPreview();
    expect(world._desktopPreviewEnabled).toBe(true);
    expect(world._orbitControls).not.toBeNull();
    expect(logSpy).toHaveBeenCalledWith('log', ['Desktop preview on']);

    world._toggleDesktopPreview();
    expect(world._desktopPreviewEnabled).toBe(false);
    expect(logSpy).toHaveBeenCalledWith('log', ['Desktop preview off']);
  });

  it('does not toggle desktop preview while in an XR session', () => {
    const logSpy = vi.spyOn(world.uiManager.vrConsole, 'log').mockImplementation(() => {});
    vi.spyOn(world.engine.renderer.xr, 'getSession').mockReturnValue({});
    world._toggleDesktopPreview();
    expect(world._desktopPreviewEnabled).toBeUndefined();
    expect(logSpy).toHaveBeenCalledWith('log', ['Desktop preview is only available outside VR']);
  });

  it('saves shared settings when a setting changes', async () => {
    const saveSpy = vi.spyOn(world.sessionStore, 'setItem').mockResolvedValue();
    world.uiManager.settingsPanel.setSetting('textScale', 1.5);
    // _onSettingChanged is invoked by setSetting; give async _saveSharedSettings a tick.
    await new Promise((r) => setTimeout(r, 10));
    expect(saveSpy).toHaveBeenCalled();
    const [id, payload] = saveSpy.mock.calls[saveSpy.mock.calls.length - 1];
    expect(id).toBe('shared-settings');
    expect(payload.settings.textScale).toBe(1.5);
    expect(payload.lastStory).toBeDefined();
  });

  it('loads shared settings on startup', async () => {
    await world.sessionStore.setItem('shared-settings', {
      version: 1,
      savedAt: Date.now(),
      settings: { textScale: 1.75, highContrast: true },
      lastStory: { dataset: { name: 'Test' } },
    });
    const direct = await world.sessionStore.getItem('shared-settings');
    expect(direct?.settings?.textScale).toBe(1.75);

    vi.resetModules();
    await ensureKernelAfterModuleReset();
    const { World } = await import('../src/vr/World.ts');
    const w2 = new World();
    await new Promise((r) => setTimeout(r, 200));
    const loaded = await w2.sessionStore.getItem('shared-settings');
    expect(loaded?.settings?.textScale).toBe(1.75);
    expect(w2.uiManager.settingsPanel.getSetting('textScale')).toBe(1.75);
    expect(w2.uiManager.settingsPanel.getSetting('highContrast')).toBe(true);
  });
});