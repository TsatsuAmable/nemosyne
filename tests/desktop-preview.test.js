/**
 * @jest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as THREE from 'three';

/**
 * Minimal in-memory IndexedDB stub for unit testing.
 */
function makeStubIndexedDB() {
  const stores = new Map();

  class FakeRequest {
    constructor(result = null, error = null) {
      this.result = result;
      this.error = error;
    }
    _dispatch() {
      if (this.error && this.onerror) this.onerror({ target: this });
      if (this.onsuccess) this.onsuccess({ target: this });
    }
  }

  class FakeObjectStore {
    constructor(data) {
      this.data = data;
    }
    put(record) {
      this.data.set(record.id, record);
      const req = new FakeRequest();
      Promise.resolve().then(() => req._dispatch());
      return req;
    }
    get(id) {
      const req = new FakeRequest(this.data.get(id) ?? undefined);
      Promise.resolve().then(() => req._dispatch());
      return req;
    }
    getAll() {
      const req = new FakeRequest([...this.data.values()]);
      Promise.resolve().then(() => req._dispatch());
      return req;
    }
    getKey(id) {
      const req = new FakeRequest(this.data.has(id) ? id : undefined);
      Promise.resolve().then(() => req._dispatch());
      return req;
    }
  }

  class FakeTransaction {
    constructor(data) {
      this.store = new FakeObjectStore(data);
    }
    objectStore() {
      return this.store;
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
    const logSpy = vi.spyOn(world.vrConsole, 'log').mockImplementation(() => {});
    world._toggleDesktopPreview();
    expect(world._desktopPreviewEnabled).toBe(true);
    expect(world._orbitControls).not.toBeNull();
    expect(logSpy).toHaveBeenCalledWith('log', ['Desktop preview on']);

    world._toggleDesktopPreview();
    expect(world._desktopPreviewEnabled).toBe(false);
    expect(logSpy).toHaveBeenCalledWith('log', ['Desktop preview off']);
  });

  it('does not toggle desktop preview while in an XR session', () => {
    const logSpy = vi.spyOn(world.vrConsole, 'log').mockImplementation(() => {});
    vi.spyOn(world.engine.renderer.xr, 'getSession').mockReturnValue({});
    world._toggleDesktopPreview();
    expect(world._desktopPreviewEnabled).toBeUndefined();
    expect(logSpy).toHaveBeenCalledWith('log', ['Desktop preview is only available outside VR']);
  });

  it('saves shared settings when a setting changes', async () => {
    const saveSpy = vi.spyOn(world.sessionStore, 'setItem').mockResolvedValue();
    world.settingsPanel.setSetting('textScale', 1.5);
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
    const { World } = await import('../src/vr/World.ts');
    const w2 = new World();
    await new Promise((r) => setTimeout(r, 200));
    const loaded = await w2.sessionStore.getItem('shared-settings');
    expect(loaded?.settings?.textScale).toBe(1.75);
    expect(w2.settingsPanel.getSetting('textScale')).toBe(1.75);
    expect(w2.settingsPanel.getSetting('highContrast')).toBe(true);
  });
});
