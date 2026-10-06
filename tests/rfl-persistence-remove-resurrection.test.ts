import { afterEach, describe, expect, it } from 'vitest';

import {
  initializeClientPersistence,
  installClientPersistenceStorageBridge,
  readBootstrappedValue,
  resetClientPersistenceForTests,
} from '../src/persistence/ClientPersistence.ts';

const SETTINGS_KEY = 'nemosyne-vr-settings';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    key(index: number) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

/**
 * Minimal transaction-correct in-memory IndexedDB fake for the client
 * persistence bridge: requests resolve on microtasks and transactions
 * complete only after their requests settle.
 */
function createFakeClientIdb() {
  const stores = new Map<string, Map<unknown, unknown>>();

  class FakeTransaction {
    oncomplete: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onabort: (() => void) | null = null;
    error: Error | null = null;
    private pending = 0;
    private settled = false;

    request(result: unknown) {
      this.pending += 1;
      const r: any = { onerror: null, onsuccess: null, error: null, result };
      Promise.resolve().then(() => {
        if (r.onsuccess) r.onsuccess({ target: r });
        this.pending -= 1;
        this.maybeComplete();
      });
      return r;
    }

    armCompletion(): void {
      Promise.resolve().then(() => this.maybeComplete());
    }

    private maybeComplete(): void {
      if (this.settled || this.pending !== 0 || !this.oncomplete) return;
      this.settled = true;
      this.oncomplete();
    }

    storeApi(name: string) {
      const records = () => {
        let map = stores.get(name);
        if (!map) {
          map = new Map();
          stores.set(name, map);
        }
        return map;
      };
      return {
        get: (key: unknown) => this.request(records().get(key)),
        put: (value: unknown, key?: unknown) => {
          records().set(key ?? (value as any)?.id, structuredClone(value));
          return this.request(undefined);
        },
        getAllKeys: () => this.request([...records().keys()]),
        getAll: () => this.request([...records().values()]),
        delete: (key: unknown) => {
          records().delete(key);
          return this.request(undefined);
        },
      };
    }
  }

  const created = new Set<string>(['sessions', 'settings', 'telemetry', 'gesture-profiles', 'migrations']);
  const db: any = {
    objectStoreNames: { contains: (name: string) => created.has(name) },
    createObjectStore: (name: string) => {
      created.add(name);
      return {};
    },
    transaction: () => {
      const tx = new FakeTransaction();
      const result: any = {
        objectStore: (name: string) => tx.storeApi(name),
      };
      Object.defineProperties(result, {
        oncomplete: {
          get: () => tx.oncomplete,
          set: (handler) => {
            tx.oncomplete = handler;
            tx.armCompletion();
          },
        },
        onerror: {
          get: () => tx.onerror,
          set: (handler) => {
            tx.onerror = handler;
          },
        },
        onabort: {
          get: () => tx.onabort,
          set: (handler) => {
            tx.onabort = handler;
          },
        },
      });
      return result;
    },
    close() {},
  };

  return {
    open: () => {
      const request: any = { onerror: null, onsuccess: null, onupgradeneeded: null, error: null, result: db };
      Promise.resolve().then(() => {
        if (request.onupgradeneeded) request.onupgradeneeded({ target: request });
        if (request.onsuccess) request.onsuccess({ target: request });
      });
      return request;
    },
  };
}

async function flushAsyncWork(rounds = 20): Promise<void> {
  for (let i = 0; i < rounds; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe('RFL cycle 10: persistence-bridge removal durability', () => {
  let originalIndexedDB: unknown;

  afterEach(() => {
    resetClientPersistenceForTests();
    (globalThis as any).indexedDB = originalIndexedDB;
  });

  it('rehydrates surviving rows across a restart (durable path works)', async () => {
    originalIndexedDB = (globalThis as any).indexedDB;
    (globalThis as any).indexedDB = createFakeClientIdb();
    const storage = memoryStorage();
    installClientPersistenceStorageBridge(storage);

    storage.setItem(SETTINGS_KEY, JSON.stringify({ textScale: 1.5 }));
    await flushAsyncWork();
    expect(JSON.parse(storage.getItem(SETTINGS_KEY) ?? '{}')).toEqual({ textScale: 1.5 });

    resetClientPersistenceForTests();
    await initializeClientPersistence();
    expect(readBootstrappedValue('settings', 'vr')).toEqual({ textScale: 1.5 });
  });

  // RFL-0006 removal durability: the bridge removeItem travels the same
  // durable path as writes, so the deleted row cannot resurrect on the next
  // re-bootstrap. This test guards the durable removal contract.
  it('a removed key stays absent across re-bootstrap', async () => {
    originalIndexedDB = (globalThis as any).indexedDB;
    (globalThis as any).indexedDB = createFakeClientIdb();
    const storage = memoryStorage();
    installClientPersistenceStorageBridge(storage);

    storage.setItem(SETTINGS_KEY, JSON.stringify({ textScale: 1.5 }));
    await flushAsyncWork();
    storage.removeItem(SETTINGS_KEY);
    expect(storage.getItem(SETTINGS_KEY)).toBeNull();

    resetClientPersistenceForTests();
    await initializeClientPersistence();
    expect(readBootstrappedValue('settings', 'vr')).toBeUndefined();
  });
});
