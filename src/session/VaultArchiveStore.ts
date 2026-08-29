/**
 * VaultArchiveStore — immutable-return archive slot manager.
 *
 * Wraps a {@link SessionStoreLike} to provide named, frozen investigation
 * snapshots. Each archive slot carries durable metadata (dataset fingerprint,
 * investigation digest, event/discovery counts, freeze timestamp) so the Vault
 * UI can display archive provenance without deserializing the full snapshot.
 *
 * Archive IDs are prefixed `archive:` to namespace them from the live
 * `autosave` / `manual` session slots.
 *
 * Strong archive-integrity claims are gated on RF-046/RF-047 completion;
 * the investigation digest field is best-effort until those contracts close.
 */

import type { SessionStoreLike } from '../data/SessionStore.ts';

export interface ArchiveMetadata {
  label: string;
  datasetFingerprint: string;
  datasetName: string;
  investigationDigest: string | null;
  eventCount: number;
  discoveryCount: number;
  frozenAt: number;
}

export interface ArchiveEntry extends ArchiveMetadata {
  archiveId: string;
}

const ARCHIVE_PREFIX = 'archive:';
const ARCHIVE_INDEX_KEY = '__vault_archive_index__';

export class VaultArchiveStore {
  private _store: SessionStoreLike;

  constructor(store: SessionStoreLike) {
    this._store = store;
  }

  /** Freeze the current investigation state as an immutable archive snapshot. */
  async freezeInvestigation(
    label: string,
    snapshot: Record<string, unknown>,
    metadata: Omit<ArchiveMetadata, 'label' | 'frozenAt'>
  ): Promise<string> {
    const archiveId = `${ARCHIVE_PREFIX}${crypto.randomUUID()}`;
    const entry: ArchiveEntry = {
      archiveId,
      label: label || 'Untitled archive',
      frozenAt: Date.now(),
      ...metadata,
    };

    // Save the full snapshot under the archive ID.
    await this._store.saveSession(archiveId, {
      ...snapshot,
      __archiveMetadata__: entry,
    });

    // Update the archive index.
    const index = await this._loadIndex();
    index.push(entry);
    await this._store.saveSession(ARCHIVE_INDEX_KEY, { entries: index });

    return archiveId;
  }

  /** List all frozen archive summaries without loading full snapshots. */
  async listArchives(): Promise<ArchiveEntry[]> {
    return this._loadIndex();
  }

  /** Load a frozen archive snapshot by ID. Returns null if not found. */
  async loadArchive(archiveId: string): Promise<Record<string, unknown> | null> {
    if (!archiveId.startsWith(ARCHIVE_PREFIX)) return null;
    const raw = await this._store.loadSession(archiveId);
    if (!raw) return null;
    // Strip the metadata envelope before returning the session snapshot.
    const { __archiveMetadata__: _meta, ...snapshot } = raw;
    return snapshot;
  }

  /** Delete an archive slot and remove it from the index. */
  async deleteArchive(archiveId: string): Promise<void> {
    if (!archiveId.startsWith(ARCHIVE_PREFIX)) return;
    await this._store.deleteSession(archiveId);

    const index = await this._loadIndex();
    const filtered = index.filter((e) => e.archiveId !== archiveId);
    await this._store.saveSession(ARCHIVE_INDEX_KEY, { entries: filtered });
  }

  /** Check whether any archives exist. */
  async hasArchives(): Promise<boolean> {
    const index = await this._loadIndex();
    return index.length > 0;
  }

  private async _loadIndex(): Promise<ArchiveEntry[]> {
    const raw = await this._store.loadSession(ARCHIVE_INDEX_KEY);
    if (!raw || !Array.isArray((raw as Record<string, unknown>).entries)) return [];
    return (raw as Record<string, unknown>).entries as ArchiveEntry[];
  }
}
