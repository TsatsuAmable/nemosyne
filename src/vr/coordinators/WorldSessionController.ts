import { Dataset } from '../../data/Dataset.ts';
import { AnalysisHistory } from '../../data/AnalysisHistory.ts';
import type { DatasetJSON, EncodingMapping } from '../../data/types.ts';
import type { DatasetLoadEntry } from './types.ts';

export class WorldSessionController {
  private _world: any;
  private _sessionAutoSaveTimer: any = null;

  constructor(world: any) {
    this._world = world;
  }

  async saveSession(id: string = 'autosave'): Promise<void> {
    const w = this._world;
    if (w._disposed || !w.currentEntry?.dataset || !w.dracoNode) return;

    const snapshot: Record<string, unknown> = {
      schemaVersion: 1,
      savedAt: Date.now(),
      dataset: w._originalDataset?.toJSON?.() ?? null,
      entry: {
        name:
          w.currentEntry.name ??
          w._originalDataset?.name ??
          w.currentEntry.label ??
          'dataset',
        topology: w.currentEntry.topology,
        encodings: w.currentEntry.encodings,
        maxDepth: w.currentEntry.maxDepth,
      },
      originalDataset: w._originalDataset?.toJSON?.() ?? null,
      transformedDataset: w._transformedDataset?.toJSON?.() ?? null,
      analysisHistory: w.analysisHistory?.toJSON?.() ?? null,
      camera: {
        position: w.engine.cameraGroup.position.toArray(),
        rotationY: w.engine.cameraGroup.rotation.y,
      },
      settings: w.settingsPanel?.getAllSettings?.() ?? {},
      tour: {
        stepIndex: w.guidedTour?._stepIndex ?? 0,
        finished: w.guidedTour?._finished ?? true,
      },
      theme: w.engine.theme?.currentPreset ?? 'neonMidnight',
      panelPositions: w.panelManager?.getPanelPositions?.() ?? [],
    };

    try {
      await w.sessionStore.saveSession(id, snapshot);
      w.vrConsole?.log?.('log', [`Session saved: ${id}`]);
      w._logInteraction('Save session', { result: id });
    } catch (err) {
      if (w._disposed) return;
      console.warn('[World] failed to save session:', err);
      w.vrConsole?.log?.('warn', [`Session save failed: ${(err as Error).message}`]);
    }
  }

  async loadSession(id: string = 'autosave'): Promise<boolean> {
    const w = this._world;
    if (w._disposed) return false;
    const snapshot = await w.sessionStore.loadSession(id);
    if (!snapshot) {
      if (w._disposed) return false;
      w.vrConsole?.log?.('log', [`No saved session: ${id}`]);
      return false;
    }

    const s = snapshot as Record<string, unknown>;
    const originalDataset = s.originalDataset as DatasetJSON | null;
    if (!originalDataset) {
      if (w._disposed) return false;
      w.vrConsole?.log?.('warn', [`Session ${id} has no dataset`]);
      return false;
    }

    const original = Dataset.fromJSON(originalDataset);
    const transformedDataset = s.transformedDataset as DatasetJSON | null;
    const transformed = transformedDataset ? Dataset.fromJSON(transformedDataset) : original.clone();

    const entryData = (s.entry ?? {}) as Record<string, unknown>;
    const entry: DatasetLoadEntry = {
      name: (entryData.name as string | undefined) ?? original.name,
      topology: (entryData.topology as string | undefined) ?? 'TABULAR',
      dataset: original,
      maxDepth: entryData.maxDepth as number | undefined,
      encodings: entryData.encodings as EncodingMapping | undefined,
    };

    w.loadDataset(entry);
    w._originalDataset = original.clone();
    w._transformedDataset = transformed.clone();

    const historyData = s.analysisHistory;
    if (historyData) {
      w.analysisHistory = AnalysisHistory.fromJSON(historyData as any);
    } else {
      w.analysisHistory.clear();
    }
    w.narrativeStrip?.setHistory?.(w.analysisHistory);
    w._updateNarrativeStrip();

    const current = w.analysisHistory.current();
    if (current) {
      w._restoreDataset(current.datasetAfter, current.operation);
    } else {
      w._restoreDataset(w._transformedDataset, 'reset');
    }

    const cameraData = (s.camera ?? {}) as Record<string, unknown>;
    const cameraPos = cameraData.position as number[] | undefined;
    if (cameraPos) {
      w.engine.cameraGroup.position.fromArray(cameraPos);
    }
    const rotationY = cameraData.rotationY as number | undefined;
    if (typeof rotationY === 'number') {
      w.engine.cameraGroup.rotation.y = rotationY;
    }

    const settingsData = s.settings as Record<string, any> | undefined;
    if (settingsData) {
      for (const [key, value] of Object.entries(settingsData)) {
        w.settingsPanel?.setSetting?.(key as any, value as never);
      }
      w.comfortSettingsController.apply(w.settingsPanel.getAllSettings());
      w.comfortSettingsController.applyPanelDistance(
        w.settingsPanel.getAllSettings().defaultPanelDistance
      );
    }

    const themeName = s.theme as string | undefined;
    if (themeName && w.engine.theme?.applyPreset) {
      w.engine.theme.applyPreset(themeName);
    }

    const panelPositions = s.panelPositions as { title?: string; position?: number[]; visible?: boolean }[] | undefined;
    if (panelPositions && w.panelManager) {
      w.panelManager.setPanelPositions(panelPositions);
    }

    const tourData = s.tour as { finished?: boolean; stepIndex?: number } | undefined;
    if (w.guidedTour && tourData && !tourData.finished) {
      w.guidedTour._stepIndex = tourData.stepIndex ?? 0;
      w.guidedTour._finished = false;
      w.guidedTour._active = true;
      w.guidedTour._cardGroup.visible = true;
      w.guidedTour._renderStep();
    }

    if (w._disposed) return true;
    w.vrConsole?.log?.('log', [`Session restored: ${id}`]);
    return true;
  }

  async deleteSession(id: string): Promise<void> {
    const w = this._world;
    if (w._disposed) return;
    try {
      await w.sessionStore.deleteSession(id);
      w.vrConsole?.log?.('log', [`Session deleted: ${id}`]);
    } catch (err) {
      if (w._disposed) return;
      console.warn('[World] failed to delete session:', err);
    }
  }

  requestAutoSave(): void {
    const w = this._world;
    if (w._disposed) return;
    if (this._sessionAutoSaveTimer) clearTimeout(this._sessionAutoSaveTimer);
    this._sessionAutoSaveTimer = setTimeout(() => this.saveSession('autosave'), 2000);
  }

  async restoreAutoSave(): Promise<unknown> {
    const w = this._world;
    try {
      const has = await w.sessionStore.hasSession('autosave');
      if (!has) return;
      if (w._disposed) return;
      w.vrConsole?.log?.('log', ['Restoring autosave...']);
      const restored = await this.loadSession('autosave');
      if (restored && !w._disposed) w.userModeController.apply();
      return restored;
    } catch (err) {
      if (w._disposed) return;
      console.warn('[World] autosave restore failed:', err);
    }
    return;
  }

  dispose(): void {
    if (this._sessionAutoSaveTimer) {
      clearTimeout(this._sessionAutoSaveTimer);
      this._sessionAutoSaveTimer = null;
    }
  }
}
