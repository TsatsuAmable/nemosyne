import { CLIENT_STORES, openClientDatabase } from '../persistence/ClientPersistence.ts';

const SNAPSHOT_SCHEMA_VERSION = 2;
const STORAGE_SCHEMA_VERSION = 2;
const LEGACY_STORAGE_SCHEMA_VERSION = 1;
const DATASET_REF_KEY = '__nemosyneDatasetRef';

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

type DatasetSnapshot = Record<string, unknown> & {
  name: string;
  columns: unknown[];
  rows: unknown[];
};

interface DatasetReference {
  [DATASET_REF_KEY]: string;
}

interface StoredDatasetV2 {
  metadata: Record<string, unknown>;
  rowRefs: string[];
}

interface StoredSessionSnapshotV1 {
  storageSchemaVersion: typeof LEGACY_STORAGE_SCHEMA_VERSION;
  snapshot: unknown;
  datasets: Record<string, DatasetSnapshot>;
}

interface StoredSessionSnapshotV2 {
  storageSchemaVersion: typeof STORAGE_SCHEMA_VERSION;
  snapshot: unknown;
  datasets: Record<string, StoredDatasetV2>;
  rows: Record<string, unknown>;
}

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isDatasetSnapshot(value: unknown): value is DatasetSnapshot {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    Array.isArray(value.columns) &&
    Array.isArray(value.rows)
  );
}

function isDatasetReference(value: unknown): value is DatasetReference {
  return (
    isRecord(value) &&
    Object.keys(value).length === 1 &&
    typeof value[DATASET_REF_KEY] === 'string'
  );
}

function isStoredDatasetV2(value: unknown): value is StoredDatasetV2 {
  return (
    isRecord(value) &&
    isRecord(value.metadata) &&
    Array.isArray(value.rowRefs) &&
    value.rowRefs.every((ref) => typeof ref === 'string')
  );
}

function isStoredSessionSnapshotV1(value: unknown): value is StoredSessionSnapshotV1 {
  return (
    isRecord(value) &&
    value.storageSchemaVersion === LEGACY_STORAGE_SCHEMA_VERSION &&
    'snapshot' in value &&
    isRecord(value.datasets)
  );
}

function isStoredSessionSnapshotV2(value: unknown): value is StoredSessionSnapshotV2 {
  return (
    isRecord(value) &&
    value.storageSchemaVersion === STORAGE_SCHEMA_VERSION &&
    'snapshot' in value &&
    isRecord(value.datasets) &&
    isRecord(value.rows) &&
    Object.values(value.datasets).every(isStoredDatasetV2)
  );
}

function datasetStorageIdentity(dataset: DatasetSnapshot): string {
  // Session snapshots are already JSON-compatible values. Stringifying the
  // complete DatasetJSON gives an exact persistence identity without creating a
  // second scientific fingerprint authority. This key never leaves storage.
  return JSON.stringify(dataset);
}

function rowStorageIdentity(row: unknown): string {
  // Same rule as datasetStorageIdentity: this is storage-local exact-value
  // deduplication, not a scientific fingerprint or cross-runtime identity.
  return JSON.stringify(row);
}

/**
 * RF-050 residual hardening: compact a logical schema-v2 session for IndexedDB
 * without changing the logical/session/export schema.
 *
 * Storage schema v2 performs two layers of exact-value deduplication:
 * 1. repeated DatasetJSON snapshots become dataset references; and
 * 2. rows shared across distinct derived datasets become row-pool references.
 *
 * The second layer prevents filter/sort/slice-style histories from copying the
 * same large row payload once per analytical operation. Metadata and row-order
 * references may still grow with operation count because exact undo/replay state
 * is durable; the expensive row payload is stored once per distinct row value.
 */
export function compactSessionSnapshotForStorage(snapshot: SessionSnapshot): StoredSessionSnapshotV2 {
  const datasets: Record<string, StoredDatasetV2> = {};
  const rows: Record<string, unknown> = {};
  const datasetIdsByValue = new Map<string, string>();
  const rowIdsByValue = new Map<string, string>();

  const internRow = (row: unknown): string => {
    const identity = rowStorageIdentity(row);
    let id = rowIdsByValue.get(identity);
    if (!id) {
      id = `r${rowIdsByValue.size}`;
      rowIdsByValue.set(identity, id);
      rows[id] = structuredClone(row);
    }
    return id;
  };

  const visit = (value: unknown): unknown => {
    if (isDatasetSnapshot(value)) {
      const identity = datasetStorageIdentity(value);
      let id = datasetIdsByValue.get(identity);
      if (!id) {
        id = `d${datasetIdsByValue.size}`;
        datasetIdsByValue.set(identity, id);
        const { rows: datasetRows, ...metadata } = value;
        datasets[id] = {
          metadata: structuredClone(metadata),
          rowRefs: datasetRows.map(internRow),
        };
      }
      return { [DATASET_REF_KEY]: id } satisfies DatasetReference;
    }
    if (Array.isArray(value)) return value.map(visit);
    if (!isRecord(value)) return value;

    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) output[key] = visit(child);
    return output;
  };

  return {
    storageSchemaVersion: STORAGE_SCHEMA_VERSION,
    snapshot: visit(snapshot),
    datasets,
    rows,
  };
}

function expandStoredSnapshotV1(value: StoredSessionSnapshotV1): SessionSnapshot {
  const visit = (node: unknown): unknown => {
    if (isDatasetReference(node)) {
      const id = node[DATASET_REF_KEY];
      const dataset = value.datasets[id];
      if (!isDatasetSnapshot(dataset)) {
        throw new Error(`Session storage references missing dataset ${id}`);
      }
      return structuredClone(dataset);
    }
    if (Array.isArray(node)) return node.map(visit);
    if (!isRecord(node)) return node;

    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(node)) output[key] = visit(child);
    return output;
  };

  const expanded = visit(value.snapshot);
  if (!isRecord(expanded)) throw new Error('Expanded session snapshot is not an object');
  return expanded as SessionSnapshot;
}

function expandStoredSnapshotV2(value: StoredSessionSnapshotV2): SessionSnapshot {
  const expandDataset = (id: string): DatasetSnapshot => {
    const stored = value.datasets[id];
    if (!isStoredDatasetV2(stored)) {
      throw new Error(`Session storage references missing dataset ${id}`);
    }
    const datasetRows = stored.rowRefs.map((rowId) => {
      if (!(rowId in value.rows)) {
        throw new Error(`Session storage references missing row ${rowId}`);
      }
      return structuredClone(value.rows[rowId]);
    });
    const dataset = {
      ...structuredClone(stored.metadata),
      rows: datasetRows,
    };
    if (!isDatasetSnapshot(dataset)) {
      throw new Error(`Session storage dataset ${id} is malformed`);
    }
    return dataset;
  };

  const visit = (node: unknown): unknown => {
    if (isDatasetReference(node)) return expandDataset(node[DATASET_REF_KEY]);
    if (Array.isArray(node)) return node.map(visit);
    if (!isRecord(node)) return node;

    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(node)) output[key] = visit(child);
    return output;
  };

  const expanded = visit(value.snapshot);
  if (!isRecord(expanded)) throw new Error('Expanded session snapshot is not an object');
  return expanded as SessionSnapshot;
}

/**
 * Restore the exact logical snapshot expected by NemosyneSession. Corrupt or
 * dangling storage references fail closed instead of producing a partial
 * investigation. Legacy compact storage-v1 and uncompact schema-v2 records
 * remain readable during migration.
 */
export function expandSessionSnapshotFromStorage(value: unknown): SessionSnapshot {
  if (isStoredSessionSnapshotV2(value)) return expandStoredSnapshotV2(value);
  if (isStoredSessionSnapshotV1(value)) return expandStoredSnapshotV1(value);
  if (!isRecord(value)) throw new Error('Session storage record is not an object');
  return structuredClone(value) as SessionSnapshot;
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
    const storedSnapshot = compactSessionSnapshotForStorage(snapshot);
    tx.objectStore(CLIENT_STORES.sessions).put({
      id,
      snapshot: storedSnapshot,
      savedAt: Date.now(),
    });
    await txDone(tx);
  }

  async loadSession(id: string): Promise<SessionSnapshot | null> {
    if (!this._idb) return null;
    try {
      const db = await this._db();
      const tx = db.transaction(CLIENT_STORES.sessions, 'readonly');
      const result = await requestResult(tx.objectStore(CLIENT_STORES.sessions).get(id)) as { snapshot?: unknown } | undefined;
      await txDone(tx);
      const expanded = result?.snapshot === undefined
        ? null
        : expandSessionSnapshotFromStorage(result.snapshot);
      return this._validateSnapshot(expanded);
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
