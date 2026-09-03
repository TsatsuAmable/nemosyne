export const CLIENT_DB_NAME = 'nemosyne-client';
export const CLIENT_DB_VERSION = 1;
export const CLIENT_STORES = Object.freeze({
  sessions: 'sessions',
  settings: 'settings',
  telemetry: 'telemetry',
  gestureProfiles: 'gesture-profiles',
  migrations: 'migrations',
} as const);

const LEGACY_SESSION_DB = 'nemosyne-sessions';
const LEGACY_SESSION_STORE = 'sessions';
const LEGACY_GESTURE_DB = 'nemosyne_gesture_ai';
const LEGACY_GESTURE_STORE = 'profiles';
const SETTINGS_KEY = 'nemosyne-vr-settings';
const TELEMETRY_KEY = 'nemosyne-telemetry-consent';
const MIGRATION_KEY = 'legacy-v1';

type IDBFactoryLike = Pick<IDBFactory, 'open' | 'deleteDatabase'>;

let defaultDbPromise: Promise<IDBDatabase> | null = null;
const bootstrapCache = new Map<string, unknown>();

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

export function openClientDatabase(idb: IDBFactoryLike = globalThis.indexedDB): Promise<IDBDatabase> {
  if (!idb) return Promise.reject(new Error('IndexedDB is not available in this environment'));
  if (idb === globalThis.indexedDB && defaultDbPromise) return defaultDbPromise;
  const promise = new Promise<IDBDatabase>((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = idb.open(CLIENT_DB_NAME, CLIENT_DB_VERSION);
    } catch (error) {
      reject(error);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CLIENT_STORES.sessions)) db.createObjectStore(CLIENT_STORES.sessions, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(CLIENT_STORES.settings)) db.createObjectStore(CLIENT_STORES.settings);
      if (!db.objectStoreNames.contains(CLIENT_STORES.telemetry)) db.createObjectStore(CLIENT_STORES.telemetry);
      if (!db.objectStoreNames.contains(CLIENT_STORES.gestureProfiles)) db.createObjectStore(CLIENT_STORES.gestureProfiles);
      if (!db.objectStoreNames.contains(CLIENT_STORES.migrations)) db.createObjectStore(CLIENT_STORES.migrations);
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        if (idb === globalThis.indexedDB) defaultDbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error(`failed to open ${CLIENT_DB_NAME}`));
  });
  if (idb === globalThis.indexedDB) {
    defaultDbPromise = promise;
    promise.catch(() => { defaultDbPromise = null; });
  }
  return promise;
}

async function getValue<T>(db: IDBDatabase, storeName: string, key: IDBValidKey): Promise<T | undefined> {
  const tx = db.transaction(storeName, 'readonly');
  const value = await requestResult(tx.objectStore(storeName).get(key)) as T | undefined;
  await transactionDone(tx);
  return value;
}

async function putValue(db: IDBDatabase, storeName: string, key: IDBValidKey, value: unknown): Promise<void> {
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).put(structuredClone(value), key);
  await transactionDone(tx);
}

async function readAllLegacy(idb: IDBFactoryLike, dbName: string, storeName: string): Promise<Array<{ key: IDBValidKey; value: unknown }>> {
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try { request = idb.open(dbName); } catch { resolve([]); return; }
    let created = false;
    request.onupgradeneeded = () => { created = true; };
    request.onerror = () => resolve([]);
    request.onsuccess = async () => {
      const db = request.result;
      if (created || !db.objectStoreNames.contains(storeName)) {
        db.close();
        if (created) { try { idb.deleteDatabase(dbName); } catch { /* no-op */ } }
        resolve([]);
        return;
      }
      try {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const keys = await requestResult(store.getAllKeys());
        const values = await requestResult(store.getAll());
        await transactionDone(tx);
        resolve(keys.map((key, index) => ({ key, value: values[index] })));
      } catch {
        resolve([]);
      } finally {
        db.close();
      }
    };
  });
}

function readLocalJson(key: string): unknown {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw === null || raw === undefined ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

async function migrateLegacy(db: IDBDatabase, idb: IDBFactoryLike): Promise<void> {
  if (await getValue(db, CLIENT_STORES.migrations, MIGRATION_KEY)) return;

  const legacySessions = await readAllLegacy(idb, LEGACY_SESSION_DB, LEGACY_SESSION_STORE);
  const legacyGestures = await readAllLegacy(idb, LEGACY_GESTURE_DB, LEGACY_GESTURE_STORE);
  const legacySettings = readLocalJson(SETTINGS_KEY);
  const legacyTelemetry = readLocalJson(TELEMETRY_KEY);

  const stores = [CLIENT_STORES.sessions, CLIENT_STORES.settings, CLIENT_STORES.telemetry, CLIENT_STORES.gestureProfiles, CLIENT_STORES.migrations];
  const tx = db.transaction(stores, 'readwrite');
  const sessions = tx.objectStore(CLIENT_STORES.sessions);
  for (const { value } of legacySessions) {
    if (value && typeof value === 'object' && 'id' in (value as Record<string, unknown>)) sessions.put(value);
  }
  const gestures = tx.objectStore(CLIENT_STORES.gestureProfiles);
  for (const { key, value } of legacyGestures) gestures.put(value, key);
  if (legacySettings !== undefined) tx.objectStore(CLIENT_STORES.settings).put(legacySettings, 'vr');
  if (legacyTelemetry !== undefined) tx.objectStore(CLIENT_STORES.telemetry).put(legacyTelemetry, 'consent');
  tx.objectStore(CLIENT_STORES.migrations).put({ completedAt: Date.now(), schemaVersion: CLIENT_DB_VERSION }, MIGRATION_KEY);
  await transactionDone(tx);

  // Legacy records are retired only after the unified transaction commits.
  try { globalThis.localStorage?.removeItem(SETTINGS_KEY); } catch { /* no-op */ }
  try { globalThis.localStorage?.removeItem(TELEMETRY_KEY); } catch { /* no-op */ }
  for (const name of [LEGACY_SESSION_DB, LEGACY_GESTURE_DB]) {
    try { idb.deleteDatabase(name); } catch { /* no-op */ }
  }
}

export async function initializeClientPersistence(idb: IDBFactoryLike = globalThis.indexedDB): Promise<void> {
  if (!idb) return;
  const db = await openClientDatabase(idb);
  await migrateLegacy(db, idb);
  const [settings, telemetry] = await Promise.all([
    getValue(db, CLIENT_STORES.settings, 'vr'),
    getValue(db, CLIENT_STORES.telemetry, 'consent'),
  ]);
  if (settings !== undefined) bootstrapCache.set('settings:vr', settings);
  if (telemetry !== undefined) bootstrapCache.set('telemetry:consent', telemetry);
}

export function readBootstrappedValue<T>(namespace: 'settings' | 'telemetry', key: string): T | undefined {
  return bootstrapCache.get(`${namespace}:${key}`) as T | undefined;
}

export function persistBootstrappedValue(namespace: 'settings' | 'telemetry', key: string, value: unknown): void {
  bootstrapCache.set(`${namespace}:${key}`, structuredClone(value));
  void openClientDatabase()
    .then((db) => putValue(db, namespace === 'settings' ? CLIENT_STORES.settings : CLIENT_STORES.telemetry, key, value))
    .catch(() => undefined);
}

export function resetClientPersistenceForTests(): void {
  defaultDbPromise?.then((db) => db.close()).catch(() => undefined);
  defaultDbPromise = null;
  bootstrapCache.clear();
}
