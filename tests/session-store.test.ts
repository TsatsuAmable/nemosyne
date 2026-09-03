// @ts-nocheck
// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest';
import { SessionStore } from '../src/data/SessionStore.ts';

/**
 * Minimal transaction-correct in-memory IndexedDB stub for unit testing.
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

    delete(id) {
      this.data.delete(id);
      return this._request();
    }

    getKey(id) {
      return this._request(this.data.has(id) ? id : undefined);
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
      this.objectStoreNames = {
        contains: () => true,
      };
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