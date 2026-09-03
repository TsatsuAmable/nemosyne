import { afterEach, describe, expect, it } from 'vitest';

import { SessionStore } from '../src/data/SessionStore.ts';
import {
  CLIENT_DB_NAME,
  CLIENT_DB_VERSION,
  CLIENT_STORES,
  installClientPersistenceStorageBridge,
  persistBootstrappedValue,
  readBootstrappedValue,
  resetClientPersistenceForTests,
} from '../src/persistence/ClientPersistence.ts';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear() { values.clear(); },
    getItem(key: string) { return values.get(key) ?? null; },
    key(index: number) { return [...values.keys()][index] ?? null; },
    removeItem(key: string) { values.delete(key); },
    setItem(key: string, value: string) { values.set(key, value); },
  };
}

afterEach(() => resetClientPersistenceForTests());

describe('PT4B9C unified client persistence', () => {
  it('declares one versioned client database with purpose-separated stores', () => {
    expect(CLIENT_DB_NAME).toBe('nemosyne-client');
    expect(CLIENT_DB_VERSION).toBe(1);
    expect(new Set(Object.values(CLIENT_STORES)).size).toBe(5);
    expect(CLIENT_STORES).toMatchObject({
      sessions: 'sessions',
      settings: 'settings',
      telemetry: 'telemetry',
      gestureProfiles: 'gesture-profiles',
      migrations: 'migrations',
    });
  });

  it('routes production settings and telemetry keys away from localStorage bytes', () => {
    const storage = memoryStorage();
    installClientPersistenceStorageBridge(storage);

    storage.setItem('nemosyne-vr-settings', JSON.stringify({ textScale: 1.5 }));
    storage.setItem('nemosyne-telemetry-consent', JSON.stringify({ enabled: true }));

    expect(storage.length).toBe(0);
    expect(JSON.parse(storage.getItem('nemosyne-vr-settings') ?? '{}')).toEqual({ textScale: 1.5 });
    expect(JSON.parse(storage.getItem('nemosyne-telemetry-consent') ?? '{}')).toEqual({ enabled: true });
    expect(readBootstrappedValue('settings', 'vr')).toEqual({ textScale: 1.5 });
    expect(readBootstrappedValue('telemetry', 'consent')).toEqual({ enabled: true });
  });

  it('does not redirect unrelated Storage keys', () => {
    const storage = memoryStorage();
    installClientPersistenceStorageBridge(storage);
    storage.setItem('third-party-key', 'unchanged');
    expect(storage.getItem('third-party-key')).toBe('unchanged');
    expect(storage.length).toBe(1);
  });

  it('keeps the bootstrapped mirror coherent even when durable IndexedDB is unavailable', () => {
    persistBootstrappedValue('settings', 'vr', { reducedMotion: true });
    expect(readBootstrappedValue('settings', 'vr')).toEqual({ reducedMotion: true });
  });

  it('fails session persistence closed without silently inventing another backend', async () => {
    const store = new SessionStore({ indexedDB: null });
    await expect(store.loadSession('missing')).resolves.toBeNull();
    await expect(store.hasSession('missing')).resolves.toBe(false);
    await expect(store.listSessions()).resolves.toEqual([]);
  });
});
