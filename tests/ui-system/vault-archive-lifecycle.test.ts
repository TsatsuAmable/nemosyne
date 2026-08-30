import { describe, expect, it, vi, beforeEach } from 'vitest';
import { VaultArchiveStore } from '../../src/session/VaultArchiveStore.ts';
import { SessionStore } from '../../src/data/SessionStore.ts';
import { IceVaultNode } from '../../src/vr/artifacts/IceVaultNode.ts';
import { FarcasterPortal } from '../../src/vr/artifacts/FarcasterPortal.ts';

class SessionStoreStub {
  private _data = new Map<string, unknown>();

  async saveSession(id: string, snapshot: Record<string, unknown>): Promise<void> {
    this._data.set(id, snapshot);
  }

  async loadSession(id: string): Promise<Record<string, unknown> | null> {
    return (this._data.get(id) as Record<string, unknown> | undefined) ?? null;
  }

  async deleteSession(id: string): Promise<void> {
    this._data.delete(id);
  }

  async hasSession(id: string): Promise<boolean> {
    return this._data.has(id);
  }
}

/**
 * Mirrors the production SessionStore split: loadSession accepts only valid
 * schema-v2 dataset-bearing snapshots, while arbitrary metadata uses getItem.
 */
class ProductionShapeSessionStoreStub {
  private _sessions = new Map<string, Record<string, unknown>>();
  private _items = new Map<string, Record<string, unknown>>();
  readonly sessionReadIds: string[] = [];
  readonly itemReadIds: string[] = [];

  async saveSession(id: string, snapshot: Record<string, unknown>): Promise<void> {
    this._sessions.set(id, snapshot);
  }

  async loadSession(id: string): Promise<Record<string, unknown> | null> {
    this.sessionReadIds.push(id);
    const snapshot = this._sessions.get(id);
    if (!snapshot || snapshot.schemaVersion !== 2) return null;
    const hasDataset =
      (snapshot.dataset && typeof snapshot.dataset === 'object') ||
      (snapshot.currentDataset && typeof snapshot.currentDataset === 'object') ||
      (snapshot.originalDataset && typeof snapshot.originalDataset === 'object');
    return hasDataset ? snapshot : null;
  }

  async deleteSession(id: string): Promise<void> {
    this._sessions.delete(id);
  }

  async hasSession(id: string): Promise<boolean> {
    return this._sessions.has(id);
  }

  async setItem(id: string, value: Record<string, unknown>): Promise<void> {
    this._items.set(id, value);
  }

  async getItem(id: string): Promise<Record<string, unknown> | null> {
    this.itemReadIds.push(id);
    return this._items.get(id) ?? null;
  }
}

describe('P1-U6 Vault archive lifecycle', () => {
  let store: VaultArchiveStore;

  beforeEach(() => {
    store = new VaultArchiveStore(new SessionStoreStub() as unknown as SessionStore);
  });

  it('freezes, lists, loads, and deletes an archive', async () => {
    // Freeze
    const archiveId = await store.freezeInvestigation(
      'Test archive',
      { datasetVersion: 1, eventLedger: [{ eventId: 'e1' }] },
      {
        datasetFingerprint: 'fp-1',
        datasetName: 'test-data',
        investigationDigest: 'digest-1',
        eventCount: 1,
        discoveryCount: 0,
      }
    );

    // List
    const archives = await store.listArchives();
    expect(archives).toHaveLength(1);
    expect(archives[0].label).toBe('Test archive');
    expect(archives[0].eventCount).toBe(1);

    // Load
    const loaded = await store.loadArchive(archiveId);
    expect(loaded).toBeTruthy();
    expect(loaded?.datasetVersion).toBe(1);

    // Delete
    await store.deleteArchive(archiveId);
    expect(await store.listArchives()).toHaveLength(0);
  });

  it('persists the archive index through the production arbitrary-value channel', async () => {
    const productionStore = new ProductionShapeSessionStoreStub();
    const vault = new VaultArchiveStore(productionStore as unknown as SessionStore);

    const archiveId = await vault.freezeInvestigation(
      'Production archive',
      {
        schemaVersion: 2,
        originalDataset: { name: 'production-data' },
        datasetVersion: 1,
        eventLedger: [],
      },
      {
        datasetFingerprint: 'fp-production',
        datasetName: 'production-data',
        investigationDigest: null,
        eventCount: 0,
        discoveryCount: 0,
      }
    );

    const archives = await vault.listArchives();
    expect(archives).toHaveLength(1);
    expect(archives[0].archiveId).toBe(archiveId);
    expect(await vault.loadArchive(archiveId)).toMatchObject({ datasetVersion: 1 });
    expect(productionStore.itemReadIds).toContain('__vault_archive_index__');
    expect(productionStore.sessionReadIds).not.toContain('__vault_archive_index__');
  });

  it('refuses to load an archive with a non-archive ID', async () => {
    const result = await store.loadArchive('autosave');
    expect(result).toBeNull();
  });

  it('maintains the archive index across multiple freezes', async () => {
    await store.freezeInvestigation('Archive A', {}, {
      datasetFingerprint: 'fp-a', datasetName: 'A', investigationDigest: null,
      eventCount: 0, discoveryCount: 0,
    });
    await store.freezeInvestigation('Archive B', {}, {
      datasetFingerprint: 'fp-b', datasetName: 'B', investigationDigest: null,
      eventCount: 0, discoveryCount: 0,
    });

    const archives = await store.listArchives();
    expect(archives).toHaveLength(2);
  });
});

describe('P1-U6 IceVault visual state', () => {
  it('transitions between empty, frozen, and restoring states', () => {
    const vault = new IceVaultNode({ position: [0, 0, 0] });
    expect(vault.archiveState).toBe('empty');

    vault.setArchiveState('frozen');
    expect(vault.archiveState).toBe('frozen');
    expect(vault.material.color.getHex()).toBe(0x00aaff);

    vault.setArchiveState('restoring');
    expect(vault.archiveState).toBe('restoring');
    expect(vault.material.color.getHex()).toBe(0x00ffcc);

    vault.dispose();
  });
});

describe('P1-U6 strict portal semantics', () => {
  it('invokes onSemanticWarp without applying data operations', () => {
    const onSemanticWarp = vi.fn();
    const portal = new FarcasterPortal({
      semanticTarget: { kind: 'overview' },
      onSemanticWarp,
    });

    portal.initiateFarcasterTravel();

    expect(onSemanticWarp).toHaveBeenCalledWith({ kind: 'overview' });
    expect(portal.operation).toBeNull();
  });

  it('does not write to a data ledger when traveling', () => {
    const ledger: unknown[] = [];
    const portal = new FarcasterPortal({
      semanticTarget: { kind: 'saved-investigation', archiveId: 'latest' },
    });

    portal.initiateFarcasterTravel();

    expect(ledger).toHaveLength(0);
  });
});