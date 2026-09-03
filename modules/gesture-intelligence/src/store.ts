/**
 * Persistence layer for @nemosyne/gesture-intelligence.
 *
 * The Nemosyne application default is the shared `nemosyne-client` database
 * and its `gesture-profiles` object store. Standalone consumers may override
 * the database/store names for isolation, but the production default no longer
 * creates a second Nemosyne database.
 */

import type { GesturePersistence, StoredProfile } from './contracts.ts';

const PROFILE_SCHEMA_VERSION = 2;
const SHARED_DATABASE_SCHEMA_VERSION = 1;
const STANDALONE_DATABASE_SCHEMA_VERSION = 2;
const DEFAULT_DB_NAME = 'nemosyne-client';
const DEFAULT_STORE_NAME = 'gesture-profiles';

export interface PersistenceOptions {
  dbName?: string;
  storeName?: string;
}

export function createPersistence(options: PersistenceOptions = {}): GesturePersistence {
  const dbName = options.dbName ?? DEFAULT_DB_NAME;
  const storeName = options.storeName ?? DEFAULT_STORE_NAME;
  const databaseVersion = dbName === DEFAULT_DB_NAME
    ? SHARED_DATABASE_SCHEMA_VERSION
    : STANDALONE_DATABASE_SCHEMA_VERSION;
  if (typeof globalThis.indexedDB === 'undefined') {
    return createMemoryPersistence();
  }
  return createIndexedDbPersistence(dbName, storeName, databaseVersion);
}

export function deleteDatabase(name: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (typeof globalThis.indexedDB === 'undefined') {
      resolve();
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = globalThis.indexedDB.deleteDatabase(name);
    } catch (error) {
      reject(error);
      return;
    }
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error(`failed to delete database '${name}'`));
    request.onblocked = () => undefined;
  });
}

const isIndexedDbUnavailableError = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) return false;
  const { name } = error as { name?: unknown };
  return name === 'InvalidStateError' || name === 'SecurityError' || name === 'TypeError';
};

const isValidStoredProfile = (value: unknown): value is StoredProfile => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { schemaVersion?: unknown; calibration?: { moveThreshold?: unknown } };
  if (candidate.schemaVersion !== PROFILE_SCHEMA_VERSION) return false;
  return typeof candidate.calibration?.moveThreshold === 'number';
};

const validateLoadedProfile = (
  profileId: string,
  raw: unknown,
  warnedKeys: Set<string>
): StoredProfile | null => {
  if (raw === undefined || raw === null) return null;
  if (isValidStoredProfile(raw)) return raw;
  if (!warnedKeys.has(profileId)) {
    warnedKeys.add(profileId);
    console.warn(
      `[gesture-intelligence] stored profile '${profileId}' failed schema validation ` +
        `(expected schemaVersion ${PROFILE_SCHEMA_VERSION}); returning null.`
    );
  }
  return null;
};

const createMemoryPersistence = (): GesturePersistence => {
  const profiles = new Map<string, StoredProfile>();
  const warnedKeys = new Set<string>();
  return {
    backend: 'memory',
    loadProfile: async (profileId) => validateLoadedProfile(profileId, profiles.get(profileId), warnedKeys),
    saveProfile: async (profileId, profile) => {
      profiles.set(profileId, structuredClone(profile));
      return true;
    },
    deleteProfile: async (profileId) => profiles.delete(profileId),
    close: () => {
      profiles.clear();
      warnedKeys.clear();
    },
  };
};

const runTransaction = <T>(
  database: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  issueRequest: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    let transaction: IDBTransaction;
    try {
      transaction = database.transaction(storeName, mode);
    } catch (error) {
      reject(error);
      return;
    }
    let request: IDBRequest<T>;
    try {
      request = issueRequest(transaction.objectStore(storeName));
    } catch (error) {
      reject(error);
      return;
    }
    let value: T | undefined;
    request.onsuccess = () => {
      value = request.result;
    };
    transaction.oncomplete = () => resolve(value as T);
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });

const deleteInTransaction = (
  database: IDBDatabase,
  storeName: string,
  profileId: string
): Promise<boolean> =>
  new Promise<boolean>((resolve, reject) => {
    let transaction: IDBTransaction;
    try {
      transaction = database.transaction(storeName, 'readwrite');
    } catch (error) {
      reject(error);
      return;
    }
    let existed = false;
    const store = transaction.objectStore(storeName);
    const getRequest = store.get(profileId);
    getRequest.onsuccess = () => {
      existed = getRequest.result !== undefined;
      if (existed) store.delete(profileId);
    };
    transaction.oncomplete = () => resolve(existed);
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });

const createIndexedDbPersistence = (
  dbName: string,
  storeName: string,
  databaseVersion: number
): GesturePersistence => {
  let memoryFallback: GesturePersistence | null = null;
  let openPromise: Promise<IDBDatabase> | null = null;
  let databaseHandle: IDBDatabase | null = null;
  const warnedKeys = new Set<string>();

  const openConnection = (): Promise<IDBDatabase> => {
    if (openPromise !== null) return openPromise;
    openPromise = new Promise<IDBDatabase>((resolve, reject) => {
      let request: IDBOpenDBRequest;
      try {
        request = globalThis.indexedDB.open(dbName, databaseVersion);
      } catch (error) {
        reject(error);
        return;
      }
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(storeName)) {
          database.createObjectStore(storeName);
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        databaseHandle = database;
        if (!database.objectStoreNames.contains(storeName)) {
          database.close();
          databaseHandle = null;
          openPromise = null;
          reject(new Error(`IndexedDB store '${storeName}' is missing; initialize the Nemosyne client schema before gesture persistence`));
          return;
        }
        database.onversionchange = () => {
          database.close();
          databaseHandle = null;
          openPromise = null;
        };
        database.onclose = () => {
          databaseHandle = null;
          openPromise = null;
        };
        resolve(database);
      };
      request.onerror = () =>
        reject(request.error ?? new Error(`failed to open IndexedDB database '${dbName}'`));
    });
    openPromise.catch((error: unknown) => {
      openPromise = null;
      if (isIndexedDbUnavailableError(error)) {
        memoryFallback = createMemoryPersistence();
      }
    });
    return openPromise;
  };

  const delegateToMemory = async <T>(
    error: unknown,
    memoryOp: (fallback: GesturePersistence) => Promise<T>
  ): Promise<T> => {
    if (memoryFallback) return memoryOp(memoryFallback);
    throw error;
  };

  return {
    get backend(): 'indexeddb' | 'memory' {
      return memoryFallback ? 'memory' : 'indexeddb';
    },
    loadProfile: async (profileId) => {
      if (memoryFallback) return memoryFallback.loadProfile(profileId);
      let database: IDBDatabase;
      try {
        database = await openConnection();
      } catch (error) {
        return delegateToMemory(error, (fallback) => fallback.loadProfile(profileId));
      }
      const raw = await runTransaction(database, storeName, 'readonly', (store) => store.get(profileId));
      return validateLoadedProfile(profileId, raw, warnedKeys);
    },
    saveProfile: async (profileId, profile) => {
      if (memoryFallback) return memoryFallback.saveProfile(profileId, profile);
      const clone = structuredClone(profile);
      let database: IDBDatabase;
      try {
        database = await openConnection();
      } catch (error) {
        return delegateToMemory(error, (fallback) => fallback.saveProfile(profileId, profile));
      }
      await runTransaction(database, storeName, 'readwrite', (store) => store.put(clone, profileId));
      return true;
    },
    deleteProfile: async (profileId) => {
      if (memoryFallback) return memoryFallback.deleteProfile(profileId);
      let database: IDBDatabase;
      try {
        database = await openConnection();
      } catch (error) {
        return delegateToMemory(error, (fallback) => fallback.deleteProfile(profileId));
      }
      return deleteInTransaction(database, storeName, profileId);
    },
    close: () => {
      if (memoryFallback) {
        memoryFallback.close();
        return;
      }
      const database = databaseHandle;
      const pending = openPromise;
      openPromise = null;
      databaseHandle = null;
      if (database) {
        database.close();
        return;
      }
      if (pending) {
        pending.then((opened) => opened.close()).catch(() => undefined);
      }
    },
  };
};
