// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest';
import { SessionStore } from '../src/data/SessionStore.ts';

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

    delete(id) {
      this.data.delete(id);
      const req = new FakeRequest();
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
      this.objectStoreNames = {
        contains: () => true,
      };
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

describe('SessionStore', () => {
  let store;

  beforeEach(() => {
    store = new SessionStore({ indexedDB: makeStubIndexedDB() });
  });

  it('saves and loads a session', async () => {
    const snapshot = { schemaVersion: 2, dataset: { name: 'test' }, camera: { x: 1, y: 2, z: 3 } };
    await store.saveSession('session-1', snapshot);
    const loaded = await store.loadSession('session-1');
    expect(loaded).toEqual(snapshot);
  });

  it('overwrites an existing session', async () => {
    await store.saveSession('session-1', { schemaVersion: 2, dataset: { a: 1 } });
    await store.saveSession('session-1', { schemaVersion: 2, dataset: { a: 2 } });
    const loaded = await store.loadSession('session-1');
    expect(loaded.dataset.a).toBe(2);
  });

  it('returns null for missing sessions', async () => {
    const loaded = await store.loadSession('missing');
    expect(loaded).toBeNull();
  });

  it('lists saved sessions', async () => {
    await store.saveSession('a', { x: 1 });
    await store.saveSession('b', { x: 2 });
    const sessions = await store.listSessions();
    expect(sessions.map((s) => s.id).sort()).toEqual(['a', 'b']);
    expect(sessions[0].savedAt).toBeTypeOf('number');
  });

  it('deletes a session', async () => {
    await store.saveSession('to-delete', { x: 1 });
    expect(await store.hasSession('to-delete')).toBe(true);
    await store.deleteSession('to-delete');
    expect(await store.hasSession('to-delete')).toBe(false);
  });

  it('reports hasSession correctly', async () => {
    expect(await store.hasSession('none')).toBe(false);
    await store.saveSession('existing', { x: 1 });
    expect(await store.hasSession('existing')).toBe(true);
  });

  it('rejects when IndexedDB is unavailable', async () => {
    const noDbStore = new SessionStore({ indexedDB: null });
    await expect(noDbStore.saveSession('x', {})).rejects.toThrow(/IndexedDB is not available/);
  });
});
