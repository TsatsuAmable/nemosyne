import { Dataset } from '../../data/Dataset.ts';
import type { AtlasCore } from '../../atlas/AtlasCore.ts';
import type { NemosyneSession } from '../../session/NemosyneSession.ts';
import type { DatasetJSON, EncodingMapping } from '../../data/types.ts';
import type {
  ComfortSettingsControllerLike,
  DatasetLoadEntry,
  DracoNodeFacadeLike,
  GuidedTourLike,
  LogInteraction,
  NarrativeStripLike,
  SessionStoreLike,
  UserModeControllerLike,
  VRConsoleLike,
  WorldEngineLike,
  WorldUIManagerLike,
} from './types.ts';
import { VaultArchiveStore } from '../../session/VaultArchiveStore.ts';

export interface WorldSessionHost {
  atlas: Pick<AtlasCore, 'analysisHistory'>;
  session: Pick<NemosyneSession, 'loadFromJSON' | 'serialize' | 'setPresentation'>;
  sessionStore: SessionStoreLike;
  engine: Pick<WorldEngineLike, 'cameraGroup' | 'theme'>;
  uiManager: Pick<WorldUIManagerLike, 'panelManager' | 'settingsPanel'>;
  comfortSettingsController: ComfortSettingsControllerLike;
  userModeController: UserModeControllerLike;
  currentEntry?: DatasetLoadEntry | null;
  dracoNode?: DracoNodeFacadeLike | null;
  narrativeStrip?: NarrativeStripLike | null;
  guidedTour?: GuidedTourLike;
  vrConsole?: VRConsoleLike;
  /** RF-025: P1-F focus/context controller whose state is persisted/restored. */
  focusContext?: {
    exportState(): { currentLevel: string; focusedStructureId: string | null };
    restoreState(state: { currentLevel: string; focusedStructureId: string | null }): void;
    clearFocus(): void;
  } | null;
  _originalDataset?: Dataset | null;
  _transformedDataset?: Dataset | null;
  _disposed?: boolean;
  loadDataset(entry: DatasetLoadEntry): void;
  _logInteraction: LogInteraction;
  _updateNarrativeStrip(): void;
  _restoreDataset(dataset: Dataset | null, operation: string): void;
  reconstructRequirementsAndReArbitrate(): void;
  archiveStore: VaultArchiveStore;
}

/**
 * Thin save/load trigger delegating to {@link NemosyneSession} +
 * {@link SessionStore}. Snapshot authority lives on NemosyneSession
 * (schemaVersion 2); this controller reads the live world presentation state,
 * hands it to the session for serialization, and re-wires World on restore.
 */
export class WorldSessionController {
  private _world: WorldSessionHost;
  private _sessionAutoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private _disposed = false;
  private _generation = 0;

  /** Vault archive store for managing frozen investigation snapshots (P1-U6). */
  readonly archiveStore: VaultArchiveStore;

  constructor(world: WorldSessionHost) {
    this._world = world;
    // Expose the archive store from the host
    this.archiveStore = this._world.archiveStore;
  }

  async saveSession(id: string = 'autosave'): Promise<void> {
    const w = this._world;
    const generation = this._generation;
    if (!this._isCurrent(generation) || !w.currentEntry?.dataset || !w.dracoNode) return;

    // Refresh the session presentation from the live world state.
    w.session.setPresentation({
      camera: {
        position: w.engine.cameraGroup.position.toArray() as [number, number, number],
        rotationY: w.engine.cameraGroup.rotation.y,
      },
      settings: w.uiManager?.settingsPanel?.getAllSettings?.() ?? {},
      tour: {
        stepIndex: w.guidedTour?._stepIndex ?? 0,
        finished: w.guidedTour?._finished ?? true,
      },
      theme: w.engine.theme?.currentPreset ?? 'neonMidnight',
      panelPositions: w.uiManager?.panelManager?.getPanelPositions?.() ?? [],
      entry: {
        name: w.currentEntry.name ?? w._originalDataset?.name ?? w.currentEntry.label ?? 'dataset',
        topology: w.currentEntry.topology,
        encodings: w.currentEntry.encodings,
        maxDepth: w.currentEntry.maxDepth,
      },
      // RF-025: persist the durable focus/context snapshot so the Memory Palace
      // restores the focused structure across sessions.
      focus: w.focusContext?.exportState() ?? undefined,
    });

    const snapshot = w.session.serialize();

    try {
      await w.sessionStore.saveSession(id, snapshot as unknown as Record<string, unknown>);
      if (!this._isCurrent(generation)) return;
      w.vrConsole?.log?.('log', [`Session saved: ${id}`]);
      w._logInteraction('Save session', { result: id });
    } catch (err) {
      if (!this._isCurrent(generation)) return;
      console.warn('[World] failed to save session:', err);
      w.vrConsole?.log?.('warn', [`Session save failed: ${(err as Error).message}`]);
    }
  }

  async loadSession(id: string = 'autosave'): Promise<boolean> {
    return this._loadSession(id, this._generation);
  }

  private async _loadSession(id: string, generation: number): Promise<boolean> {
    const w = this._world;
    if (!this._isCurrent(generation)) return false;
    const snapshot = await w.sessionStore.loadSession(id);
    if (!this._isCurrent(generation)) return false;
    if (!snapshot) {
      w.vrConsole?.log?.('log', [`No saved session: ${id}`]);
      return false;
    }

    const s = snapshot as Record<string, unknown>;
    const originalDataset = (s.originalDataset as DatasetJSON | null) ?? null;
    if (!originalDataset) {
      w.vrConsole?.log?.('warn', [`Session ${id} has no dataset`]);
      return false;
    }

    // Restore atlas state + presentation in place on the shared atlas/session.
    w.session.loadFromJSON(s as unknown as Parameters<NemosyneSession['loadFromJSON']>[0]);

    const original = Dataset.fromJSON(originalDataset);
    const currentDataset = (s.currentDataset as DatasetJSON | null) ?? null;
    const transformed = currentDataset ? Dataset.fromJSON(currentDataset) : original.clone();

    const entryData = (s.entry ?? {}) as Record<string, unknown>;
    const entry: DatasetLoadEntry = {
      name: (entryData.name as string | undefined) ?? original.name,
      topology: (entryData.topology as string | undefined) ?? 'TABULAR',
      dataset: original,
      maxDepth: entryData.maxDepth as number | undefined,
      encodings: entryData.encodings as EncodingMapping | undefined,
    };

    if (!this._isCurrent(generation)) return false;

    // Rebuild the Draco palace from the original dataset first. loadDataset
    // routes through AtlasCore.loadDataset which resets the ledger/results/
    // history; restore the persisted atlas state AFTERWARDS so the provenance
    // chain + cursor survive.
    w.loadDataset(entry);
    if (!this._isCurrent(generation)) return false;
    w.session.loadFromJSON(s as unknown as Parameters<NemosyneSession['loadFromJSON']>[0]);
    if (w.reconstructRequirementsAndReArbitrate) {
      w.reconstructRequirementsAndReArbitrate();
    }

    // Point the current dataset at the restored transformed state.
    w._transformedDataset = transformed.clone();

    w.narrativeStrip?.setHistory?.(w.atlas.analysisHistory);
    w._updateNarrativeStrip();

    const current = w.atlas.analysisHistory.current();
    if (current) {
      w._restoreDataset(current.datasetAfter, current.operation);
    } else {
      w._restoreDataset(w._transformedDataset, 'reset');
    }

    const presentation = (s.presentation ?? {}) as Record<string, unknown>;
    const cameraData = (presentation.camera ?? s.camera ?? {}) as Record<string, unknown>;
    const cameraPos = cameraData.position as number[] | undefined;
    if (cameraPos) {
      w.engine.cameraGroup.position.fromArray(cameraPos);
    }
    const rotationY = cameraData.rotationY as number | undefined;
    if (typeof rotationY === 'number') {
      w.engine.cameraGroup.rotation.y = rotationY;
    }

    const settingsData = (presentation.settings ?? s.settings ?? {}) as Record<string, unknown>;
    if (settingsData) {
      for (const [key, value] of Object.entries(settingsData)) {
        w.uiManager?.settingsPanel?.setSetting?.(key, value);
      }
      if (w.uiManager?.settingsPanel) {
        w.comfortSettingsController.apply(w.uiManager.settingsPanel.getAllSettings());
        w.comfortSettingsController.applyPanelDistance(
          w.uiManager.settingsPanel.getAllSettings().defaultPanelDistance
        );
      }
    }

    const themeName = (presentation.theme ?? s.theme) as string | undefined;
    if (themeName && w.engine.theme?.applyPreset) {
      w.engine.theme.applyPreset(themeName);
    }

    const panelPositions = (presentation.panelPositions ?? s.panelPositions) as
      { title?: string; position?: number[]; visible?: boolean }[] | undefined;
    if (panelPositions && w.uiManager?.panelManager) {
      w.uiManager.panelManager.setPanelPositions?.(panelPositions);
    }

    const tourData = (presentation.tour ?? s.tour) as
      { finished?: boolean; stepIndex?: number } | undefined;
    if (w.guidedTour && tourData) {
      if (tourData.finished) {
        w.guidedTour._finished = true;
        w.guidedTour._active = false;
        w.guidedTour._cardGroup.visible = false;
      } else {
        w.guidedTour._stepIndex = tourData.stepIndex ?? 0;
        w.guidedTour._finished = false;
        w.guidedTour._active = true;
        w.guidedTour._cardGroup.visible = true;
        w.guidedTour._renderStep();
      }
    }

    // RF-025: restore the durable focus/context snapshot. `restoreState`
    // validates the level/structureId pair and fails closed for impossible
    // states, so a stale or corrupt snapshot cannot corrupt the controller.
    const focusData = presentation.focus as
      { currentLevel?: string; focusedStructureId?: string | null } | undefined;
    if (w.focusContext && focusData && typeof focusData.currentLevel === 'string') {
      try {
        w.focusContext.restoreState({
          currentLevel: focusData.currentLevel as never,
          focusedStructureId: focusData.focusedStructureId ?? null,
        });
      } catch {
        // A corrupt/incompatible focus snapshot must not abort session restore.
        w.focusContext.clearFocus();
      }
    }

    if (!this._isCurrent(generation)) return false;
    w.vrConsole?.log?.('log', [`Session restored: ${id}`]);
    return true;
  }

  async deleteSession(id: string): Promise<void> {
    const w = this._world;
    const generation = this._generation;
    if (!this._isCurrent(generation)) return;
    try {
      await w.sessionStore.deleteSession(id);
      if (!this._isCurrent(generation)) return;
      w.vrConsole?.log?.('log', [`Session deleted: ${id}`]);
    } catch (err) {
      if (!this._isCurrent(generation)) return;
      console.warn('[World] failed to delete session:', err);
    }
  }

  requestAutoSave(): void {
    if (!this._isCurrent(this._generation)) return;
    if (this._sessionAutoSaveTimer) clearTimeout(this._sessionAutoSaveTimer);
    this._sessionAutoSaveTimer = setTimeout(() => this.saveSession('autosave'), 2000);
  }

  async restoreAutoSave(): Promise<unknown> {
    const w = this._world;
    const generation = this._generation;
    if (!this._isCurrent(generation)) return;
    try {
      const has = await w.sessionStore.hasSession('autosave');
      if (!this._isCurrent(generation)) return;
      if (!has) return;
      w.vrConsole?.log?.('log', ['Restoring autosave...']);
      const restored = await this._loadSession('autosave', generation);
      if (restored && this._isCurrent(generation)) w.userModeController.apply();
      return restored;
    } catch (err) {
      if (!this._isCurrent(generation)) return;
      console.warn('[World] autosave restore failed:', err);
    }
    return;
  }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    this._generation += 1;
    if (this._sessionAutoSaveTimer) {
      clearTimeout(this._sessionAutoSaveTimer);
      this._sessionAutoSaveTimer = null;
    }
  }

  private _isCurrent(generation: number): boolean {
    return !this._disposed && !this._world._disposed && generation === this._generation;
  }
}
