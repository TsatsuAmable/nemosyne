const DB_NAME = 'nemosyne-sessions';
const DB_VERSION = 2;
const STORE_NAME = 'sessions';
const SNAPSHOT_SCHEMA_VERSION = 2;

export interface SessionSnapshot {
  schemaVersion?: number;
  /** A dataset-shaped object: `currentDataset`, `originalDataset`, or legacy `dataset`. */
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

/** Neutral persistence facade shared by session and presentation orchestration. */
export interface SessionStoreLike {
  saveSession(id: string, snapshot: SessionSnapshot): Promise<void>;
  loadSession(id: string): Promise<SessionSnapshot | null>;
  deleteSession(id: string): Promise<void>;
  hasSession(id: string): Promise<boolean>;
}

type IDBFactory = Pick<typeof indexedDB, 'open'>;

/**
 * Lightweight IndexedDB-backed session store.
 *
 * Each session is a JSON snapshot of the analysis world: dataset, camera
 * pose, operation history, settings, and tour progress. The store accepts an
 * optional `indexedDB` factory so tests can inject a stub.
 */
export class SessionStore {
  private _idb: IDBFactory | null;
  private _dbPromise: Promise<IDBDatabase> | null;

  constructor({ indexedDB: idb = null }: { indexedDB?: IDBFactory | null } = {}) {
    this._idb = idb || (typeof indexedDB !== 'undefined' ? indexedDB : null);
    this._dbPromise = null;
  }

  private _db(): Promise<IDBDatabase> {
    if (!this._idb) {
      return Promise.reject(new Error('IndexedDB is not available in this environment'));
    }
    if (!this._dbPromise) {
      this._dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        const request = this._idb!.open(DB_NAME, DB_VERSION);
        request.onerror = () => {
          this._dbPromise = null;
          reject(request.error);
        };
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
          const target = event.target as IDBRequest;
          const db = target.result as IDBDatabase;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          }
          // Version 2: delete legacy snapshots without schema version.
          if (event.oldVersion < 2) {
            // Schema migration is limited in IndexedDB upgrade transactions;
            // invalid snapshots are filtered at load time instead.
          }
        };
      });
    }
    return this._dbPromise;
  }

  /**
   * Save a session snapshot. Existing entries with the same id are overwritten.
   */
  async saveSession(id: string, snapshot: SessionSnapshot): Promise<void> {
    const db = await this._db();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put({ id, snapshot, savedAt: Date.now() });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Load a session snapshot by id.
   */
  async loadSession(id: string): Promise<SessionSnapshot | null> {
    if (!this._idb) return null;
    try {
      const db = await this._db();
      return new Promise<SessionSnapshot | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(id);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const result = request.result as { snapshot?: SessionSnapshot } | undefined;
          resolve(result ? this._validateSnapshot(result.snapshot) : null);
        };
      });
    } catch {
      return null;
    }
  }

  /**
   * Validate and normalize a stored snapshot.
   * Rejects snapshots with an incompatible schema version (Wave 4: only
   * schemaVersion 2 is accepted — saved-session compat BREAKS per rule 5) or
   * missing a dataset-shaped object. NemosyneSessionJSON carries
   * `currentDataset`/`originalDataset`; the legacy `dataset` field is still
   * accepted as a fallback.
   */
  private _validateSnapshot(snapshot: SessionSnapshot | undefined | null): SessionSnapshot | null {
    if (!snapshot || typeof snapshot !== 'object') return null;
    if (snapshot.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) {
      // Reject stale/unknown schema versions (including legacy schemaVersion 1).
      return null;
    }
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

  /**
   * List all stored session ids with their save timestamps.
   */
  async listSessions(): Promise<SessionListing[]> {
    if (!this._idb) return [];
    try {
      const db = await this._db();
      return new Promise<SessionListing[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const result = request.result as Array<{ id: string; savedAt: number }>;
          resolve(result.map((r) => ({ id: r.id, savedAt: r.savedAt })));
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * Delete a session by id.
   */
  async deleteSession(id: string): Promise<void> {
    if (!this._idb) return;
    try {
      const db = await this._db();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    } catch {
      // Ignore deletion errors when storage is unavailable.
    }
  }

  /**
   * Store an arbitrary JSON value without session-schema validation.
   * Used for cross-platform shared settings and similar small payloads.
   */
  async setItem(id: string, value: Record<string, unknown>): Promise<void> {
    const db = await this._db();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put({ id, value, savedAt: Date.now() });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Load an arbitrary JSON value stored with `setItem`.
   */
  async getItem(id: string): Promise<Record<string, unknown> | null> {
    if (!this._idb) return null;
    try {
      const db = await this._db();
      return new Promise<Record<string, unknown> | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(id);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const result = request.result as { value?: Record<string, unknown> } | undefined;
          resolve(result?.value ?? null);
        };
      });
    } catch {
      return null;
    }
  }

  /**
   * Check whether a session exists.
   */
  async hasSession(id: string): Promise<boolean> {
    if (!this._idb) return false;
    try {
      const db = await this._db();
      return new Promise<boolean>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getKey(id);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result != null);
      });
    } catch {
      return false;
    }
  }
}
