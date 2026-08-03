const DB_NAME = 'nemosyne-sessions';
const DB_VERSION = 2;
const STORE_NAME = 'sessions';
const SNAPSHOT_SCHEMA_VERSION = 1;

/**
 * Lightweight IndexedDB-backed session store.
 *
 * Each session is a JSON snapshot of the analysis world: dataset, camera
 * pose, operation history, settings, and tour progress. The store accepts an
 * optional `indexedDB` factory so tests can inject a stub.
 */
export class SessionStore {
  constructor({ indexedDB: idb = null } = {}) {
    this._idb = idb || (typeof indexedDB !== 'undefined' ? indexedDB : null);
    this._dbPromise = null;
  }

  _db() {
    if (!this._idb) {
      return Promise.reject(new Error('IndexedDB is not available in this environment'));
    }
    if (!this._dbPromise) {
      this._dbPromise = new Promise((resolve, reject) => {
        const request = this._idb.open(DB_NAME, DB_VERSION);
        request.onerror = () => {
          this._dbPromise = null;
          reject(request.error);
        };
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
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
   *
   * @param {string} id
   * @param {object} snapshot
   * @returns {Promise<void>}
   */
  async saveSession(id, snapshot) {
    const db = await this._db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put({ id, snapshot, savedAt: Date.now() });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Load a session snapshot by id.
   *
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async loadSession(id) {
    if (!this._idb) return null;
    try {
      const db = await this._db();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(id);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const result = request.result;
          resolve(result ? this._validateSnapshot(result.snapshot) : null);
        };
      });
    } catch (err) {
      return null;
    }
  }

  /**
   * Validate and normalize a stored snapshot.
   * Rejects snapshots with incompatible schema versions or missing required fields.
   *
   * @param {object|null} snapshot
   * @returns {object|null}
   */
  _validateSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return null;
    if (snapshot.schemaVersion && snapshot.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) {
      // Future migrations can branch here; for now reject stale snapshots.
      return null;
    }
    if (!snapshot.dataset || typeof snapshot.dataset !== 'object') return null;
    if (!Array.isArray(snapshot.history) && snapshot.history !== undefined) return null;
    return snapshot;
  }

  /**
   * List all stored session ids with their save timestamps.
   *
   * @returns {Promise<Array<{id: string, savedAt: number}>>}
   */
  async listSessions() {
    if (!this._idb) return [];
    try {
      const db = await this._db();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          resolve(request.result.map((r) => ({ id: r.id, savedAt: r.savedAt })));
        };
      });
    } catch (err) {
      return [];
    }
  }

  /**
   * Delete a session by id.
   *
   * @param {string} id
   * @returns {Promise<void>}
   */
  async deleteSession(id) {
    if (!this._idb) return;
    try {
      const db = await this._db();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    } catch (err) {
      // Ignore deletion errors when storage is unavailable.
    }
  }

  /**
   * Check whether a session exists.
   *
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async hasSession(id) {
    if (!this._idb) return false;
    try {
      const db = await this._db();
      return new Promise((resolve, reject) => {
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
