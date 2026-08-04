/**
 * Owns data-operation state: original/transformed datasets, analysis history,
 * and the mapping from operation names to dataset transforms and visual
 * transforms. Emits events so rendering, logging, and UI panels can react
 * without being hard-wired into `World`.
 */

import { AnalysisHistory } from '../../data/AnalysisHistory.ts';
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
  computeOperationDataset,
  buildWasmOperationSpec,
  captureBaseState,
  resetTransforms,
} from '../interactions/DataOperations.js';
import { WorldEventBus, WorldTopics } from '../../utils/EventBus.js';

const CAP_OPERATIONS_RUST = 1 << 2;

const VISUAL_APPLIERS = {
  filter: applyFilter,
  sort: applySort,
  aggregate: applyAggregate,
  cluster: applyCluster,
  hierarchical: applyHierarchicalCluster,
  density: applyDensityCluster,
  anomaly: applyAnomaly,
  timeSlice: applySlice,
};

export class DataOperationController {
  /**
   * @param {object} options
   * @param {WorldEventBus} [options.eventBus]
   * @param {() => { nodeMeshes: THREE.Mesh[], group: THREE.Group } | null} [options.getArtifact]
   * @param {number} [options.maxHistoryFrames]
   */
  constructor({ eventBus, getArtifact, maxHistoryFrames = 50 } = {}) {
    this.eventBus = eventBus ?? new WorldEventBus();
    this.getArtifact = getArtifact ?? (() => null);
    this._analysisHistory = new AnalysisHistory({ maxFrames: maxHistoryFrames });
    this._originalDataset = null;
    this._transformedDataset = null;
    this._wasmRuntime = null;
    this._wasmCapabilities = 0;
  }

  /**
   * Optional Rust/WASM bridge. When present and the OPERATIONS_RUST capability
   * is enabled, selected operations are computed in Rust and the result is
   * converted back to a JS Dataset.
   *
   * @param {object|null} bridge
   * @param {number} capabilities
   */
  setWasmRuntime(bridge, capabilities = 0) {
    this._wasmRuntime = bridge;
    this._wasmCapabilities = capabilities;
  }

  /** @returns {import('../../data/AnalysisHistory.ts').AnalysisHistory} */
  get analysisHistory() {
    return this._analysisHistory;
  }

  /** @returns {import('../../data/Dataset.ts').Dataset | null} */
  get originalDataset() {
    return this._originalDataset;
  }

  /** @returns {import('../../data/Dataset.ts').Dataset | null} */
  get transformedDataset() {
    return this._transformedDataset;
  }

  /**
   * Set the original dataset and reset the analysis state. This is called
   * whenever a new dataset is loaded.
   * @param {import('../../data/Dataset.ts').Dataset} dataset
   */
  setOriginalDataset(dataset) {
    this._originalDataset = dataset?.clone?.() ?? null;
    this._transformedDataset = this._originalDataset?.clone?.() ?? null;
    this._analysisHistory.clear();
  }

  /**
   * Set the transformed dataset directly (used when restoring a session).
   * @param {import('../../data/Dataset.ts').Dataset} dataset
   */
  setTransformedDataset(dataset) {
    this._transformedDataset = dataset?.clone?.() ?? null;
  }

  /**
   * Apply a named operation to the current transformed dataset and artifact.
   * Supported: 'filter', 'sort', 'aggregate', 'cluster', 'hierarchical',
   * 'density', 'anomaly', 'timeSlice'.
   * @param {string} operation
   */
  apply(operation) {
    const artifact = this.getArtifact();
    if (!this._originalDataset || !artifact) return;

    if (!this._transformedDataset) {
      this._transformedDataset = this._originalDataset.clone();
    }

    const datasetBefore = this._transformedDataset.clone();
    captureBaseState(artifact);

    this._transformedDataset = this._computeDataset(
      operation,
      this._transformedDataset,
      this._originalDataset
    );

    this.applyVisual(operation, this._transformedDataset);
    this.clearPreview();
    this._pushAnalysisHistory(operation, datasetBefore, this._transformedDataset);
  }

  /**
   * Compute the result dataset for an operation, routing to the WASM data layer
   * when the operation is supported there and the runtime is ready. Otherwise
   * falls back to the JS implementation.
   *
   * @param {string} operation
   * @param {import('../../data/Dataset.ts').Dataset} dataset
   * @param {import('../../data/Dataset.ts').Dataset} originalDataset
   * @returns {import('../../data/Dataset.ts').Dataset}
   */
  _computeDataset(operation, dataset, originalDataset) {
    if (
      this._wasmRuntime &&
      (this._wasmCapabilities & CAP_OPERATIONS_RUST) !== 0
    ) {
      const op = buildWasmOperationSpec(operation, dataset, originalDataset);
      if (op) {
        const result = this._wasmRuntime.executeOperation(dataset.toJSON(), op);
        if (result) {
          return Dataset.fromJSON(result);
        }
      }
    }
    return computeOperationDataset(operation, dataset, originalDataset);
  }

  /**
   * Apply only the visual transform for an operation without mutating the
   * dataset. Used by `World._restoreDataset` after undo/redo/seek or a full
   * re-solve.
   * @param {string} operation
   * @param {import('../../data/Dataset.ts').Dataset} dataset
   */
  applyVisual(operation, dataset) {
    const artifact = this.getArtifact();
    if (!artifact || !dataset) return;

    const applier = VISUAL_APPLIERS[operation];
    if (!applier) {
      resetTransforms(artifact);
      return;
    }

    if (operation === 'timeSlice') {
      applier(artifact, dataset, this._originalDataset);
    } else {
      applier(artifact, dataset);
    }
  }

  /**
   * Show a transient preview of what `operation` would do. The actual preview
   * rendering is performed by a subscriber to `WorldTopics.OPERATION_PREVIEW`.
   * @param {string} operation
   */
  preview(operation) {
    const artifact = this.getArtifact();
    if (!this._originalDataset || !artifact) return;

    if (!this._transformedDataset) {
      this._transformedDataset = this._originalDataset.clone();
    }

    const previewDataset = this._computeDataset(
      operation,
      this._transformedDataset,
      this._originalDataset
    );

    this.eventBus.emit(WorldTopics.OPERATION_PREVIEW, {
      operation,
      previewDataset,
      originalDataset: this._originalDataset,
      transformedDataset: this._transformedDataset,
      artifact,
    });
  }

  /** Clear any transient operation preview. */
  clearPreview() {
    this.eventBus.emit(WorldTopics.OPERATION_CLEAR_PREVIEW);
  }

  /**
   * Restore the original dataset and reset artefact transforms. Does not emit
   * `operation:applied`; the caller is responsible for re-solving, updating
   * dashboards/TDA, logging, and emitting any UI events after the reset is
   * complete.
   */
  reset() {
    const artifact = this.getArtifact();
    if (!this._originalDataset || !artifact) return;

    this.clearPreview();
    const datasetBefore = this._transformedDataset?.clone?.() ?? null;
    this._transformedDataset = this._originalDataset.clone();
    resetTransforms(artifact);
    this._analysisHistory.push('reset', datasetBefore, this._transformedDataset);
    this.eventBus.emit(WorldTopics.SESSION_AUTOSAVE_REQUEST);
  }

  /**
   * Undo the most recent operation. Returns the frame to restore, or null if
   * there is nothing to undo.
   * @returns {{ operation: string, dataset: import('../../data/Dataset.ts').Dataset, parameters: object } | null}
   */
  undo() {
    if (!this._analysisHistory.canUndo) return null;
    const frame = this._analysisHistory.undo();
    this.eventBus.emit(WorldTopics.HISTORY_SEEK, {
      index: this._analysisHistory.currentIndex,
      operation: frame.operation,
      dataset: frame.dataset,
    });
    return frame;
  }

  /**
   * Redo the next operation. Returns the frame to restore, or null if there is
   * nothing to redo.
   * @returns {{ operation: string, dataset: import('../../data/Dataset.ts').Dataset, parameters: object } | null}
   */
  redo() {
    if (!this._analysisHistory.canRedo) return null;
    const frame = this._analysisHistory.redo();
    this.eventBus.emit(WorldTopics.HISTORY_SEEK, {
      index: this._analysisHistory.currentIndex,
      operation: frame.operation,
      dataset: frame.dataset,
    });
    return frame;
  }

  /**
   * Jump to a specific history frame. Returns the frame to restore, or null.
   * @param {number} index
   * @returns {{ operation: string, dataset: import('../../data/Dataset.ts').Dataset, parameters: object } | null}
   */
  seekHistory(index) {
    const frame = this._analysisHistory?.seek?.(index);
    if (!frame) return null;
    this.eventBus.emit(WorldTopics.HISTORY_SEEK, {
      index: this._analysisHistory.currentIndex,
      operation: frame.operation,
      dataset: frame.dataset,
    });
    return frame;
  }

  _pushAnalysisHistory(operation, datasetBefore, datasetAfter) {
    this._analysisHistory.push(operation, datasetBefore, datasetAfter);
    this.eventBus.emit(WorldTopics.OPERATION_APPLIED, {
      operation,
      datasetBefore,
      datasetAfter,
      rowCount: datasetAfter.rowCount,
    });
    this.eventBus.emit(WorldTopics.SESSION_AUTOSAVE_REQUEST);
  }
}
