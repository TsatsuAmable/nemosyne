import { Dataset } from '../../data/Dataset.ts';
import type { SessionStoreLike } from '../../data/SessionStore.ts';
import type { DatasetJSON, EncodingMapping } from '../../data/types.ts';
import type {
  NemosyneSession,
  NemosyneSessionJSON,
} from '../../session/NemosyneSession.ts';
import { VaultArchiveStore } from '../../session/VaultArchiveStore.ts';
import { WorldTopics } from '../../utils/EventBus.ts';
import type { PresentationSnapshotPort } from '../presentation/session/PresentationSnapshotPort.ts';
import type { DatasetLoadEntry, WorldEventBusLike } from './types.ts';

type SessionAuthority = Pick<
  NemosyneSession,
  'atlas' | 'loadFromJSON' | 'presentation' | 'serialize' | 'setPresentation'
>;

export interface WorldSessionControllerOptions {
  session: SessionAuthority;
  getSessionStore(): SessionStoreLike;
  presentation: PresentationSnapshotPort;
  loadDataset(entry: DatasetLoadEntry): void | Promise<void>;
  rebuildRepresentation(): void;
  eventBus: Pick<WorldEventBusLike, 'emit'>;
  archiveStore: VaultArchiveStore;
  log(level: 'log' | 'warn', message: string): void;
  recordInteraction(action: string, options: { result: string }): void;
  applyUserMode(): void;
  isRuntimeActive?(): boolean;
}

/**
 * Session persistence orchestration over explicit application and
 * presentation ports. Snapshot authority remains NemosyneSession; dataset
 * loading uses the same application path as live interaction, and restored
 * analysis is projected through the same HISTORY_SEEK outcome as undo/redo.
 */
export class WorldSessionController {
  private readonly session: SessionAuthority;
  private readonly getSessionStore: () => SessionStoreLike;
  private readonly presentation: PresentationSnapshotPort;
  private readonly loadDataset: (entry: DatasetLoadEntry) => void | Promise<void>;
  private readonly rebuildRepresentation: () => void;
  private readonly eventBus: Pick<WorldEventBusLike, 'emit'>;
  private readonly log: WorldSessionControllerOptions['log'];
  private readonly recordInteraction: WorldSessionControllerOptions['recordInteraction'];
  private readonly applyUserMode: () => void;
  private readonly isRuntimeActive: () => boolean;
  private sessionAutoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private generation = 0;

  /** Vault archive store for managing frozen investigation snapshots (P1-U6). */
  readonly archiveStore: VaultArchiveStore;

  constructor(options: WorldSessionControllerOptions) {
    this.session = options.session;
    this.getSessionStore = options.getSessionStore;
    this.presentation = options.presentation;
    this.loadDataset = options.loadDataset;
    this.rebuildRepresentation = options.rebuildRepresentation;
    this.eventBus = options.eventBus;
    this.archiveStore = options.archiveStore;
    this.log = options.log;
    this.recordInteraction = options.recordInteraction;
    this.applyUserMode = options.applyUserMode;
    this.isRuntimeActive = options.isRuntimeActive ?? (() => true);
  }

  /** Refresh live presentation state and return a self-contained current-session snapshot. */
  snapshotCurrentSession(): Record<string, unknown> | null {
    if (!this.isCurrent(this.generation)) return null;
    const presentation = this.presentation.capture();
    if (!presentation) return null;
    this.session.setPresentation(presentation);
    return this.session.serialize() as unknown as Record<string, unknown>;
  }

  async saveSession(id: string = 'autosave'): Promise<void> {
    const generation = this.generation;
    if (!this.isCurrent(generation)) return;
    const snapshot = this.snapshotCurrentSession();
    if (!snapshot) return;

    try {
      await this.getSessionStore().saveSession(
        id,
        snapshot as unknown as Parameters<SessionStoreLike['saveSession']>[1]
      );
      if (!this.isCurrent(generation)) return;
      this.log('log', `Session saved: ${id}`);
      this.recordInteraction('Save session', { result: id });
    } catch (error) {
      if (!this.isCurrent(generation)) return;
      console.warn('[WorldSessionController] failed to save session:', error);
      this.log('warn', `Session save failed: ${(error as Error).message}`);
    }
  }

  async loadSession(id: string = 'autosave'): Promise<boolean> {
    return this.loadSessionAtGeneration(id, this.generation);
  }

  private async loadSessionAtGeneration(id: string, generation: number): Promise<boolean> {
    if (!this.isCurrent(generation)) return false;
    const snapshot = await this.getSessionStore().loadSession(id);
    if (!this.isCurrent(generation)) return false;
    if (!snapshot) {
      this.log('log', `No saved session: ${id}`);
      return false;
    }

    const sessionJson = snapshot as unknown as NemosyneSessionJSON;
    const originalDataset = (snapshot.originalDataset as DatasetJSON | null) ?? null;
    if (!originalDataset) {
      this.log('warn', `Session ${id} has no dataset`);
      return false;
    }

    const original = Dataset.fromJSON(originalDataset);
    const entryData = (snapshot.entry ?? {}) as Record<string, unknown>;
    const entry: DatasetLoadEntry = {
      name: (entryData.name as string | undefined) ?? original.name,
      topology: (entryData.topology as string | undefined) ?? 'TABULAR',
      dataset: original,
      maxDepth: entryData.maxDepth as number | undefined,
      encodings: entryData.encodings as EncodingMapping | undefined,
    };

    // Use the same production dataset-load pathway as live interaction. That
    // transition intentionally resets Atlas; only then restore the persisted
    // authoritative session over the newly embodied dataset.
    await this.loadDataset(entry);
    if (!this.isCurrent(generation)) return false;
    this.session.loadFromJSON(sessionJson);
    this.rebuildRepresentation();

    // NemosyneSession.loadFromJSON already restored Atlas's current dataset.
    // Publish the ordinary history outcome rather than mutating World/Atlas/UI
    // private fields or inventing a session-only presentation path.
    const history = this.session.atlas.analysisHistory;
    const current = history.current();
    this.eventBus.emit(WorldTopics.HISTORY_SEEK, {
      index: history.currentIndex,
      operation: current?.operation ?? 'reset',
      dataset: current?.datasetAfter ?? this.session.atlas.dataset,
    });

    await this.presentation.restore(this.session.presentation);
    if (!this.isCurrent(generation)) return false;
    this.log('log', `Session restored: ${id}`);
    return true;
  }

  async deleteSession(id: string): Promise<void> {
    const generation = this.generation;
    if (!this.isCurrent(generation)) return;
    try {
      await this.getSessionStore().deleteSession(id);
      if (!this.isCurrent(generation)) return;
      this.log('log', `Session deleted: ${id}`);
    } catch (error) {
      if (!this.isCurrent(generation)) return;
      console.warn('[WorldSessionController] failed to delete session:', error);
    }
  }

  requestAutoSave(): void {
    if (!this.isCurrent(this.generation)) return;
    if (this.sessionAutoSaveTimer) clearTimeout(this.sessionAutoSaveTimer);
    this.sessionAutoSaveTimer = setTimeout(() => this.saveSession('autosave'), 2000);
  }

  async restoreAutoSave(): Promise<unknown> {
    const generation = this.generation;
    if (!this.isCurrent(generation)) return;
    try {
      const hasAutosave = await this.getSessionStore().hasSession('autosave');
      if (!this.isCurrent(generation) || !hasAutosave) return;
      this.log('log', 'Restoring autosave...');
      const restored = await this.loadSessionAtGeneration('autosave', generation);
      if (restored && this.isCurrent(generation)) this.applyUserMode();
      return restored;
    } catch (error) {
      if (!this.isCurrent(generation)) return;
      console.warn('[WorldSessionController] autosave restore failed:', error);
    }
    return;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.generation += 1;
    if (this.sessionAutoSaveTimer) {
      clearTimeout(this.sessionAutoSaveTimer);
      this.sessionAutoSaveTimer = null;
    }
  }

  private isCurrent(generation: number): boolean {
    return !this.disposed && this.isRuntimeActive() && generation === this.generation;
  }
}
