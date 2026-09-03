import { CLIENT_STORES, openClientDatabase } from '../persistence/ClientPersistence.ts';

const SNAPSHOT_SCHEMA_VERSION = 2;

export interface SessionSnapshot {
  schemaVersion?: number;
  dataset?: Record<string, unknown>;
  currentDataset?: Record<string, unknown>;
  originalDataset?: Record<string, unknown>;
  history?: unknown[];
  eventLedger?: unknown[];
  analysisResults?: unknown[];
  [key: string]: unknown;
}

export interface SessionListing {
  id: string;
  savedAt: number;
}

export interface SessionStoreLike {
  saveSession(id: string, snapshot: SessionSnapshot): Promise<void>;
  loadSession(id: string): Promise<SessionSnapshot | null>;
  deleteSession(id: string): Promise<void>;
  hasSession(id: string): Promise<boolean>;
}

type IDBFactoryLike = Pick<IDBFactory, 'open'>;

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

/** Production session persistence over the single versioned nemosyne-client DB. */
export class SessionStore {
  private readonly _idb: IDBFactoryLike | null;

  constructor({ indexedDB: idb = null }: { indexedDB?: IDBFactoryLike | null } = {}) {
    this._idb = idb ?? (typeof globalThis.indexedDB !== 'undefined' ? globalThis.indexedDB : null);
  }

  private _db(): Promise<IDBDatabase> {
    if (!this._idb) return Promise.reject(new Error('IndexedDB is not available in this environment'));
    return openClientDatabase(this._idb);
  }

  async saveSession(id: string, snapshot: SessionSnapshot): Promise<void> {
    const db = await this._db();
    const tx = db.transaction(CLIENT_STORES.sessions, 'readwrite');
    tx.objectStore(CLIENT_STORES.sessions).put({ id, snapshot: structuredClone(snapshot), savedAt: Date.now() });
    await txDone(tx);
  }

  async loadSession(id: string): Promise<SessionSnapshot | null> {
    if (!this._idb) return null;
    try {
      const db = await this._db();
      const tx = db.transaction(CLIENT_STORES.sessions, 'readonly');
      const result = await requestResult(tx.objectStore(CLIENT_STORES.sessions).get(id)) as { snapshot?: SessionSnapshot } | undefined;
      await txDone(tx);
      return this._validateSnapshot(result?.snapshot);
    } catch {
      return null;
    }
  }

  private _validateSnapshot(snapshot: SessionSnapshot | undefined | null): SessionSnapshot | null {
    if (!snapshot || typeof snapshot !== 'object' || snapshot.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) return null;
    const hasDataset =
      (snapshot.dataset && typeof snapshot.dataset === 'object') ||
      (snapshot.currentDataset && typeof snapshot.currentDataset === 'object') ||
      (snapshot.originalDataset && typeof snapshot.originalDataset === 'object');
    if (!hasDataset) return null;
    if (!Array.isArray(snapshot.history) && snapshot.history !== undefined) return null;
    if (!Array.isArray(snapshot.eventLedger) && snapshot.eventLedger !== undefined) return null;
    if (!Array.isArray(snapshot.analysisResults) && snapshot.analysisResults !== undefined) return null;
    return snapshot;
  }

  async listSessions(): Promise<SessionListing[]> {
    if (!this._idb) return [];
    try {
      const db = await this._db();
      const tx = db.transaction(CLIENT_STORES.sessions, 'readonly');
      const rows = await requestResult(tx.objectStore(CLIENT_STORES.sessions).getAll()) as Array<{ id: string; savedAt: number }>;
      await txDone(tx);
      return rows.map(({ id, savedAt }) => ({ id, savedAt }));
    } catch {
      return [];
    }
  }

  async deleteSession(id: string): Promise<void> {
    if (!this._idb) return;
    try {
      const db = await this._db();
      const tx = db.transaction(CLIENT_STORES.sessions, 'readwrite');
      tx.objectStore(CLIENT_STORES.sessions).delete(id);
      await txDone(tx);
    } catch {
      // Client storage is optional in unavailable/private environments.
    }
  }

  async hasSession(id: string): Promise<boolean> {
    if (!this._idb) return false;
    try {
      const db = await this._db();
      const tx = db.transaction(CLIENT_STORES.sessions, 'readonly');
      const key = await requestResult(tx.objectStore(CLIENT_STORES.sessions).getKey(id));
      await txDone(tx);
      return key !== undefined;
    } catch {
      return false;
    }
  }

  async setItem(id: string, value: Record<string, unknown>): Promise<void> {
    const db = await this._db();
    const tx = db.transaction(CLIENT_STORES.settings, 'readwrite');
    tx.objectStore(CLIENT_STORES.settings).put(structuredClone(value), id);
    await txDone(tx);
  }

  async getItem(id: string): Promise<Record<string, unknown> | null> {
    if (!this._idb) return null;
    try {
      const db = await this._db();
      const tx = db.transaction(CLIENT_STORES.settings, 'readonly');
      const value = await requestResult(tx.objectStore(CLIENT_STORES.settings).get(id)) as Record<string, unknown> | undefined;
      await txDone(tx);
      return value ?? null;
    } catch {
      return null;
    }
  }
}
