import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { createPersistence, deleteDatabase } from '../../src/gesture/store.ts';
import type { StoredProfile } from '../../src/gesture/contracts.ts';

let dbNameSeq = 0;
const nextDbName = (): string => `gesture_store_test_${++dbNameSeq}`;

const makeProfile = (profileId: string, salt = 0): StoredProfile => ({
  schemaVersion: 2,
  profileId,
  updatedAt: 1700000000000 + salt,
  calibration: {
    moveThreshold: 0.0311 + salt * 0.00017,
    pinchThreshold: 0.0417 + salt * 0.00013,
    releaseThreshold: 0.0523,
    meanSpeedEma: 0.8123,
    updatedAt: 1700000000000 + salt,
  },
  feedbackStats: {
    confirms: 3 + salt,
    corrections: 1 + salt,
    lastUpdatedAt: 1700000000000 + salt,
  },
});

const plantRawRecord = async (dbName: string, key: string, value: unknown): Promise<void> => {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = globalThis.indexedDB.open(dbName, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('profiles')) {
        request.result.createObjectStore('profiles');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction('profiles', 'readwrite');
    tx.objectStore('profiles').put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  database.close();
};

describe('gesture persistence (indexeddb backend)', () => {
  it('reports the indexeddb backend when available', () => {
    const persistence = createPersistence({ dbName: nextDbName() });
    expect(persistence.backend).toBe('indexeddb');
    persistence.close();
  });

  it('round-trips a saved profile with calibration floats intact', async () => {
    const persistence = createPersistence({ dbName: nextDbName() });
    const profile = makeProfile('p-roundtrip', 5);
    await expect(persistence.saveProfile('p-roundtrip', profile)).resolves.toBe(true);
    await expect(persistence.loadProfile('p-roundtrip')).resolves.toEqual(profile);
    persistence.close();
  });

  it('resolves load of a missing key to null', async () => {
    const persistence = createPersistence({ dbName: nextDbName() });
    await expect(persistence.loadProfile('never-saved')).resolves.toBeNull();
    persistence.close();
  });

  it('overwrites on save and reports delete existence', async () => {
    const persistence = createPersistence({ dbName: nextDbName() });
    await persistence.saveProfile('p-overwrite', makeProfile('p-overwrite', 1));
    const replacement = makeProfile('p-overwrite', 9);
    await expect(persistence.saveProfile('p-overwrite', replacement)).resolves.toBe(true);
    await expect(persistence.loadProfile('p-overwrite')).resolves.toEqual(replacement);
    await expect(persistence.deleteProfile('p-overwrite')).resolves.toBe(true);
    await expect(persistence.loadProfile('p-overwrite')).resolves.toBeNull();
    await expect(persistence.deleteProfile('p-overwrite')).resolves.toBe(false);
    persistence.close();
  });

  it('resolves concurrent saves on the same key consistently (last write wins)', async () => {
    const persistence = createPersistence({ dbName: nextDbName() });
    const profiles = [0, 1, 2, 3, 4].map((salt) => makeProfile('p-concurrent', salt));
    const results = await Promise.all(
      profiles.map((profile) => persistence.saveProfile('p-concurrent', profile))
    );
    expect(results).toEqual([true, true, true, true, true]);
    const loaded = await persistence.loadProfile('p-concurrent');
    expect(loaded).toEqual(profiles[4]);
    persistence.close();
  });

  it('is idempotent and safe to close before the connection was ever opened', () => {
    const persistence = createPersistence({ dbName: nextDbName() });
    expect(() => {
      persistence.close();
      persistence.close();
    }).not.toThrow();
  });

  it('lazily reopens the connection after close()', async () => {
    const dbName = nextDbName();
    const persistence = createPersistence({ dbName });
    await persistence.saveProfile('p-reopen', makeProfile('p-reopen', 2));
    persistence.close();
    await expect(persistence.loadProfile('p-reopen')).resolves.toEqual(makeProfile('p-reopen', 2));
    persistence.close();
  });

  it('rejects a save whose transaction lost the race with close()', async () => {
    const dbName = nextDbName();
    const persistence = createPersistence({ dbName });
    await persistence.saveProfile('p-race', makeProfile('p-race', 0));
    const pending = persistence.saveProfile('p-race', makeProfile('p-race', 7));
    persistence.close();
    await expect(pending).rejects.toMatchObject({ name: 'InvalidStateError' });
    const reader = createPersistence({ dbName });
    await expect(reader.loadProfile('p-race')).resolves.toEqual(makeProfile('p-race', 0));
    reader.close();
  });

  it('accepts saves started after close() by lazily reopening the connection', async () => {
    const dbName = nextDbName();
    const persistence = createPersistence({ dbName });
    await persistence.saveProfile('p-after', makeProfile('p-after', 0));
    persistence.close();
    await expect(persistence.saveProfile('p-after', makeProfile('p-after', 2))).resolves.toBe(true);
    await expect(persistence.loadProfile('p-after')).resolves.toEqual(makeProfile('p-after', 2));
    persistence.close();
  });

  it('returns null and warns once per key for a planted v1 (schemaVersion 1) record', async () => {
    const dbName = nextDbName();
    const persistence = createPersistence({ dbName });
    await expect(persistence.loadProfile('warmup')).resolves.toBeNull();
    await plantRawRecord(dbName, 'legacy-1', { ...makeProfile('legacy-1'), schemaVersion: 1 });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await expect(persistence.loadProfile('legacy-1')).resolves.toBeNull();
      await expect(persistence.loadProfile('legacy-1')).resolves.toBeNull();
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
    persistence.close();
  });

  it('returns null and warns for a v2 record with a non-numeric calibration.moveThreshold', async () => {
    const dbName = nextDbName();
    const persistence = createPersistence({ dbName });
    await expect(persistence.loadProfile('warmup')).resolves.toBeNull();
    const clean = makeProfile('corrupt-1', 0);
    await plantRawRecord(dbName, 'corrupt-1', {
      ...clean,
      calibration: { ...clean.calibration, moveThreshold: 'big' },
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await expect(persistence.loadProfile('corrupt-1')).resolves.toBeNull();
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
    persistence.close();
  });

  it('rejects saveProfile when the profile is not structured-cloneable', async () => {
    const persistence = createPersistence({ dbName: nextDbName() });
    const tainted = makeProfile('p-fn', 0) as StoredProfile & { oops: () => string };
    tainted.oops = () => 'nope';
    await expect(persistence.saveProfile('p-fn', tainted)).rejects.toMatchObject({
      name: 'DataCloneError',
    });
    await expect(persistence.loadProfile('p-fn')).resolves.toBeNull();
    persistence.close();
  });

  it('deletes a database so a fresh reopen sees no data', async () => {
    const dbName = nextDbName();
    const persistence = createPersistence({ dbName });
    await persistence.saveProfile('p-gone', makeProfile('p-gone', 3));
    persistence.close();
    await new Promise((resolve) => setImmediate(resolve));
    await deleteDatabase(dbName);
    const reopened = createPersistence({ dbName });
    await expect(reopened.loadProfile('p-gone')).resolves.toBeNull();
    reopened.close();
  });
});

describe('gesture persistence (memory fallback)', () => {
  const stubIndexedDbUndefined = <T>(body: () => Promise<T>): Promise<T> => {
    const scope = globalThis as { indexedDB: IDBFactory | undefined };
    const saved = scope.indexedDB;
    scope.indexedDB = undefined;
    return body().finally(() => {
      scope.indexedDB = saved;
    });
  };

  it('uses a visible memory backend with full round-trip, delete, and clone rejection', async () => {
    await stubIndexedDbUndefined(async () => {
      const persistence = createPersistence({ dbName: nextDbName() });
      expect(persistence.backend).toBe('memory');
      const profile = makeProfile('p-mem', 4);
      await expect(persistence.saveProfile('p-mem', profile)).resolves.toBe(true);
      await expect(persistence.loadProfile('p-mem')).resolves.toEqual(profile);
      const tainted = makeProfile('p-mem-fn', 0) as StoredProfile & { oops: () => string };
      tainted.oops = () => 'nope';
      await expect(persistence.saveProfile('p-mem-fn', tainted)).rejects.toMatchObject({
        name: 'DataCloneError',
      });
      await expect(persistence.deleteProfile('p-mem')).resolves.toBe(true);
      await expect(persistence.loadProfile('p-mem')).resolves.toBeNull();
      await expect(persistence.deleteProfile('p-mem')).resolves.toBe(false);
      persistence.close();
    });
  });

  it('memory close() clears data and is idempotent', async () => {
    await stubIndexedDbUndefined(async () => {
      const persistence = createPersistence({ dbName: nextDbName() });
      await persistence.saveProfile('p-mem-close', makeProfile('p-mem-close', 1));
      persistence.close();
      persistence.close();
      await expect(persistence.loadProfile('p-mem-close')).resolves.toBeNull();
    });
  });
});
