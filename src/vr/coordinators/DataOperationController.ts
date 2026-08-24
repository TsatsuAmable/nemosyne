/**
 * Owns data-operation state: original/transformed datasets, analysis history,
 * and the mapping from operation names to dataset transforms and visual
 * transforms. Emits events so rendering, logging, and UI panels can react
 * without being hard-wired into `World`.
 *
 * Wave 4: the controller NO LONGER calls the kernel directly. It holds an
 * {@link AtlasCore} ref and issues typed {@link AnalysisSpec} commands.
 * AtlasCore calls the kernel + records the provenance ledger/results chain +
 * keeps AnalysisHistory (the undo/redo cursor) in sync. The controller does
 * only visual apply + event emission. When no atlas is set (smoke/no-atlas
 * construction paths), a local fallback dataset/history keeps the controller
 * non-throwing; no JS analytical fallback exists.
 */

import { AnalysisHistory, type HistoryEntry } from '../../data/AnalysisHistory.ts';
import { Dataset } from '../../data/Dataset.ts';
import {
  applyFilter,
  applySort,
  applyAggregate,
  applyCluster,
  applyHierarchicalCluster,
  applyDensityCluster,
  applyAnomaly,
  applySlice,
  toAnalysisSpec,
  captureBaseState,
  resetTransforms,
} from '../interactions/DataOperations.ts';
import { WorldEventBus, WorldTopics } from '../../utils/EventBus.ts';
import { KernelUnavailableError } from '../../wasm/RuntimeBridge.ts';
import type { AtlasCore } from '../../atlas/AtlasCore.ts';
import type { ArtifactRef, VisualApplier, VisualOperation, WorldEventBusLike } from './types.ts';

export interface DataOperationControllerOptions {
  eventBus?: WorldEventBusLike;
  getArtifact?: () => ArtifactRef | null;
  maxHistoryFrames?: number;
  atlas?: AtlasCore | null;
}

const VISUAL_APPLIERS: Record<string, VisualApplier> = {
  filter: applyFilter as VisualApplier,
  sort: applySort as VisualApplier,
  aggregate: applyAggregate as VisualApplier,
  cluster: applyCluster as VisualApplier,
  hierarchical: applyHierarchicalCluster as VisualApplier,
  density: applyDensityCluster as VisualApplier,
  anomaly: applyAnomaly as VisualApplier,
  timeSlice: applySlice as VisualApplier,
};

export class DataOperationController {
  eventBus: WorldEventBusLike;
  getArtifact: () => ArtifactRef | null;
  _atlas: AtlasCore | null;
  // Local fallback state used ONLY when no atlas is wired (smoke tests).
  _fallbackHistory: AnalysisHistory;
  _localOriginal: Dataset | null;
  _localTransformed: Dataset | null;

  constructor({
    eventBus,
    getArtifact,
    maxHistoryFrames = 50,
    atlas = null,
  }: DataOperationControllerOptions = {}) {
    this.eventBus = eventBus ?? new WorldEventBus();
    this.getArtifact = getArtifact ?? (() => null);
    this._atlas = atlas;
    this._fallbackHistory = new AnalysisHistory({ maxFrames: maxHistoryFrames });
    this._localOriginal = null;
    this._localTransformed = null;
  }

  /** Bind the analytical authority. The kernel is MANDATORY for analytics. */
  setAtlas(atlas: AtlasCore | null): void {
    this._atlas = atlas;
  }

  get analysisHistory(): AnalysisHistory {
    return this._atlas?.analysisHistory ?? this._fallbackHistory;
  }

  get originalDataset(): Dataset | null {
    return this._atlas ? this._atlas.originalDataset : this._localOriginal;
  }

  get transformedDataset(): Dataset | null {
    return this._atlas ? this._atlas.dataset : this._localTransformed;
  }

  /**
   * Set the original dataset and reset the analysis state. Routes through
   * AtlasCore when present; otherwise updates the local fallback.
   */
  setOriginalDataset(dataset: Dataset): void {
    if (this._atlas) {
      this._atlas.setOriginalDataset(dataset);
      return;
    }
    this._localOriginal = dataset?.clone?.() ?? null;
    this._localTransformed = this._localOriginal?.clone?.() ?? null;
    this._fallbackHistory.clear();
  }

  /** Set the transformed dataset directly (session restore / _restoreDataset). */
  setTransformedDataset(dataset: Dataset): void {
    if (this._atlas) {
      this._atlas.setCurrentDataset(dataset);
      return;
    }
    this._localTransformed = dataset?.clone?.() ?? null;
  }

  /**
   * Apply a named operation to the current transformed dataset and artifact.
   */
  apply(operation: VisualOperation | string): void {
    const artifact = this.getArtifact();
    if (!this.originalDataset || !artifact) return;

    if (!this.transformedDataset) {
      this.setTransformedDataset(this.originalDataset.clone());
    }
    const current = this.transformedDataset;
    if (!current) return;

    const datasetBefore = current.clone();
    captureBaseState(artifact);

    let next: Dataset;
    try {
      next = this._computeViaAtlas(operation, current);
    } catch (err) {
      // The kernel is the only analytical path. If it rejects the op, abort
      // cleanly without leaving the controller in a half-applied state. Do NOT
      // fall back to JS analytics.
      console.error(`[DataOperationController] kernel rejected "${operation}":`, err);
      return;
    }

    this.setTransformedDataset(next);
    this.applyVisual(operation, this.transformedDataset!);
    this.clearPreview();
    this.eventBus.emit(WorldTopics.OPERATION_APPLIED, {
      operation,
      datasetBefore,
      datasetAfter: next,
      rowCount: next.rowCount,
    });
    this.eventBus.emit(WorldTopics.SESSION_AUTOSAVE_REQUEST);
  }

  /**
   * Compute the result dataset for an operation through AtlasCore (the sole
   * analytical path). Throws if the kernel is unavailable or the op fails.
   */
  private _computeViaAtlas(operation: string, dataset: Dataset): Dataset {
    if (!this._atlas || !this._atlas.isReady()) {
      throw new KernelUnavailableError(
        '[DataOperationController] analytical kernel unavailable — Rust/WASM is the sole analytical authority.'
      );
    }
    const spec = toAnalysisSpec(operation, dataset, this._atlas);
    const result = this._atlas.applyAnalysis(spec);
    return Dataset.fromJSON(result.dataset);
  }

  /**
   * Apply only the visual transform for an operation without mutating the
   * dataset. Used by `World._restoreDataset` after undo/redo/seek or a full
   * re-solve.
   */
  applyVisual(operation: string, dataset: Dataset): void {
    const artifact = this.getArtifact();
    if (!artifact || !dataset) return;

    const applier = VISUAL_APPLIERS[operation];
    if (!applier) {
      resetTransforms(artifact);
      return;
    }

    if (operation === 'timeSlice') {
      applier(artifact, dataset, this.originalDataset ?? undefined);
    } else {
      applier(artifact, dataset);
    }
  }

  /**
   * Show a transient preview of what `operation` would do.
   */
  preview(operation: VisualOperation | string): void {
    const artifact = this.getArtifact();
    if (!this.originalDataset || !artifact) return;

    if (!this.transformedDataset) {
      this.setTransformedDataset(this.originalDataset.clone());
    }
    const current = this.transformedDataset;
    if (!current) return;

    let previewDataset: Dataset;
    try {
      if (!this._atlas || !this._atlas.isReady()) {
        throw new KernelUnavailableError(
          '[DataOperationController] analytical kernel unavailable — Rust/WASM is the sole analytical authority.'
        );
      }
      const spec = toAnalysisSpec(operation, current, this._atlas);
      previewDataset = Dataset.fromJSON(this._atlas.previewAnalysis(spec).dataset);
    } catch (err) {
      console.error(`[DataOperationController] kernel rejected preview "${operation}":`, err);
      return;
    }

    this.eventBus.emit(WorldTopics.OPERATION_PREVIEW, {
      operation,
      previewDataset,
      originalDataset: this.originalDataset,
      transformedDataset: this.transformedDataset,
      artifact,
    });
  }

  /** Clear any transient operation preview. */
  clearPreview(): void {
    this.eventBus.emit(WorldTopics.OPERATION_CLEAR_PREVIEW);
  }

  /**
   * Restore the original dataset and reset artefact transforms.
   */
  reset(): void {
    const artifact = this.getArtifact();
    if (!this.originalDataset || !artifact) return;

    this.clearPreview();
    if (this._atlas) {
      this._atlas.resetAnalysis();
    } else {
      const datasetBefore = this._localTransformed?.clone?.() ?? null;
      this._localTransformed = this._localOriginal?.clone?.() ?? null;
      this._fallbackHistory.push('reset', datasetBefore, this._localTransformed);
    }
    resetTransforms(artifact);
    this.eventBus.emit(WorldTopics.SESSION_AUTOSAVE_REQUEST);
  }

  /** Undo the most recent operation. */
  undo(): HistoryEntry | null {
    if (!this.analysisHistory.canUndo) return null;
    const frame = (
      this._atlas ? this._atlas.undo() : this._fallbackHistory.undo()
    ) as HistoryEntry | null;
    if (!frame) return null;
    this.eventBus.emit(WorldTopics.HISTORY_SEEK, {
      index: this.analysisHistory.currentIndex,
      operation: frame.operation,
      dataset: frame.dataset,
    });
    return frame;
  }

  /** Redo the next operation. */
  redo(): HistoryEntry | null {
    if (!this.analysisHistory.canRedo) return null;
    const frame = (
      this._atlas ? this._atlas.redo() : this._fallbackHistory.redo()
    ) as HistoryEntry | null;
    if (!frame) return null;
    this.eventBus.emit(WorldTopics.HISTORY_SEEK, {
      index: this.analysisHistory.currentIndex,
      operation: frame.operation,
      dataset: frame.dataset,
    });
    return frame;
  }

  /** Jump to a specific history frame. */
  seekHistory(index: number): HistoryEntry | null {
    const frame = this._atlas ? this._atlas.seekHistory(index) : this._fallbackHistory.seek(index);
    if (!frame) return null;
    this.eventBus.emit(WorldTopics.HISTORY_SEEK, {
      index: this.analysisHistory.currentIndex,
      operation: frame.operation,
      dataset: frame.dataset,
    });
    return frame;
  }
}
