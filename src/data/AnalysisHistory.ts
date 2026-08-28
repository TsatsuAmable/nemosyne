import { Dataset } from './Dataset.ts';
import type { DatasetJSON } from './types.ts';
import type { DatasetVersionRef } from './DatasetVersionStore.ts';

export interface HistoryFrame {
  operation: string;
  parameters: Record<string, unknown>;
  timestamp: number;
  datasetBefore: Dataset | null;
  datasetAfter: Dataset | null;
  /** RF-035B1: canonical logical state identity for lazy historical materialisation. */
  datasetBeforeRef?: DatasetVersionRef;
  /** RF-035B1: canonical logical state identity for lazy historical materialisation. */
  datasetAfterRef?: DatasetVersionRef;
  /** Cheap timeline metadata that does not require historical row materialisation. */
  rowCountBefore?: number;
  /** Cheap timeline metadata that does not require historical row materialisation. */
  rowCountAfter?: number;
}

export interface HistoryFrameJSON {
  operation: string;
  parameters: Record<string, unknown>;
  timestamp: number;
  datasetBefore: DatasetJSON | null;
  datasetAfter: DatasetJSON | null;
}

export interface HistorySnapshot {
  index: number;
  maxFrames: number;
  frames: HistoryFrameJSON[];
}

export interface HistoryEntry {
  operation: string;
  dataset: Dataset;
  parameters: Record<string, unknown>;
}

export type DatasetVersionResolver = (ref: DatasetVersionRef) => Dataset | null;

/**
 * Undo/redo stack for data-analysis operations.
 *
 * Direct callers retain the historical clone-isolated Dataset behavior. The
 * EvidenceLedger may instead build reference-backed frames whose datasets are
 * materialised only when navigation/serialization explicitly requires rows.
 */
export class AnalysisHistory {
  private _stack: HistoryFrame[];
  private _index: number;
  private readonly _resolveDatasetVersion: DatasetVersionResolver | null;
  maxFrames: number;

  constructor({
    maxFrames = 50,
    resolveDatasetVersion = null,
  }: {
    maxFrames?: number;
    resolveDatasetVersion?: DatasetVersionResolver | null;
  } = {}) {
    this._stack = [];
    this._index = -1;
    this._resolveDatasetVersion = resolveDatasetVersion;
    this.maxFrames = maxFrames;
  }

  /** Number of frames currently stored. */
  get length(): number {
    return this._stack.length;
  }

  /** True if there is at least one applied operation that can be undone. */
  get canUndo(): boolean {
    return this._index >= 0;
  }

  /** True if there is a previously undone operation that can be redone. */
  get canRedo(): boolean {
    return this._index < this._stack.length - 1;
  }

  private _discardRedoBranch(): void {
    if (this._index < this._stack.length - 1) {
      this._stack = this._stack.slice(0, this._index + 1);
    }
  }

  private _appendFrame(frame: HistoryFrame): number {
    this._discardRedoBranch();
    this._stack.push(frame);

    if (this._stack.length > this.maxFrames) {
      this._stack.shift();
    } else {
      this._index++;
    }

    return this._index;
  }

  /**
   * Record a data operation for direct/legacy callers. Input datasets are
   * cloned exactly as before so caller mutation cannot alter history.
   */
  push(
    operation: string,
    datasetBefore: Dataset | null,
    datasetAfter: Dataset | null,
    parameters: Record<string, unknown> = {}
  ): number {
    return this._appendFrame({
      operation,
      datasetBefore: datasetBefore?.clone?.() ?? datasetBefore,
      datasetAfter: datasetAfter?.clone?.() ?? datasetAfter,
      rowCountBefore: datasetBefore?.rowCount,
      rowCountAfter: datasetAfter?.rowCount,
      parameters,
      timestamp: performance.now?.() ?? Date.now?.() ?? 0,
    });
  }

  /**
   * RF-035B1: record a derived history transition by canonical version refs.
   * No Dataset is cloned or materialised here.
   */
  pushReference(
    operation: string,
    datasetBeforeRef: DatasetVersionRef | null,
    datasetAfterRef: DatasetVersionRef | null,
    parameters: Record<string, unknown> = {},
    rowCounts: { before?: number; after?: number } = {}
  ): number {
    return this._appendFrame({
      operation,
      datasetBefore: null,
      datasetAfter: null,
      datasetBeforeRef: datasetBeforeRef ? { ...datasetBeforeRef } : undefined,
      datasetAfterRef: datasetAfterRef ? { ...datasetAfterRef } : undefined,
      rowCountBefore: rowCounts.before,
      rowCountAfter: rowCounts.after,
      parameters,
      timestamp: performance.now?.() ?? Date.now?.() ?? 0,
    });
  }

  private _materialize(
    dataset: Dataset | null,
    ref: DatasetVersionRef | undefined,
    position: 'before' | 'after'
  ): Dataset {
    if (dataset) return dataset.clone();
    if (!ref) return new Dataset('empty', [], []);
    const materialized = this._resolveDatasetVersion?.(ref) ?? null;
    if (!materialized) {
      throw new Error(
        `[AnalysisHistory] ${position} dataset version ${ref.datasetVersion}:${ref.datasetFingerprint} is unavailable for materialization.`
      );
    }
    return materialized;
  }

  private _forSerialization(
    dataset: Dataset | null,
    ref: DatasetVersionRef | undefined,
    position: 'before' | 'after'
  ): Dataset | null {
    if (dataset) return dataset;
    if (!ref) return null;
    const materialized = this._resolveDatasetVersion?.(ref) ?? null;
    if (!materialized) {
      throw new Error(
        `[AnalysisHistory] ${position} dataset version ${ref.datasetVersion}:${ref.datasetFingerprint} is unavailable for serialization.`
      );
    }
    return materialized;
  }

  /** Undo the most recently applied operation, materialising only that state. */
  undo(): HistoryEntry | null {
    if (!this.canUndo) return null;
    const frame = this._stack[this._index];
    this._index--;
    return {
      operation: frame.operation,
      dataset: this._materialize(frame.datasetBefore, frame.datasetBeforeRef, 'before'),
      parameters: frame.parameters,
    };
  }

  /** Redo the next previously undone operation, materialising only that state. */
  redo(): HistoryEntry | null {
    if (!this.canRedo) return null;
    this._index++;
    const frame = this._stack[this._index];
    return {
      operation: frame.operation,
      dataset: this._materialize(frame.datasetAfter, frame.datasetAfterRef, 'after'),
      parameters: frame.parameters,
    };
  }

  /** Index of the current frame, or -1 when the stack is empty. */
  get currentIndex(): number {
    return this._index;
  }

  /** Return the current frame, materialising its post-state only on request. */
  current(): HistoryFrame | null {
    if (this._index < 0 || this._index >= this._stack.length) return null;
    const frame = this._stack[this._index];
    return {
      ...frame,
      datasetAfter: this._materialize(frame.datasetAfter, frame.datasetAfterRef, 'after'),
    };
  }

  /** Jump directly to a specific frame index and materialise that post-state. */
  seek(index: number): HistoryEntry | null {
    if (this.length === 0) return null;
    this._index = Math.max(0, Math.min(this.length - 1, index));
    const frame = this._stack[this._index];
    return {
      operation: frame.operation,
      dataset: this._materialize(frame.datasetAfter, frame.datasetAfterRef, 'after'),
      parameters: frame.parameters,
    };
  }

  /**
   * Cursor-only variants used while replaying durable ledger navigation into a
   * derived history view. They never materialise Dataset rows.
   */
  moveUndoReference(): DatasetVersionRef | null {
    if (!this.canUndo) return null;
    const frame = this._stack[this._index];
    this._index--;
    return frame.datasetBeforeRef ? { ...frame.datasetBeforeRef } : null;
  }

  moveRedoReference(): DatasetVersionRef | null {
    if (!this.canRedo) return null;
    this._index++;
    const frame = this._stack[this._index];
    return frame.datasetAfterRef ? { ...frame.datasetAfterRef } : null;
  }

  moveSeekReference(index: number): DatasetVersionRef | null {
    if (this.length === 0) return null;
    this._index = Math.max(0, Math.min(this.length - 1, index));
    const frame = this._stack[this._index];
    return frame.datasetAfterRef ? { ...frame.datasetAfterRef } : null;
  }

  /** Clear all recorded frames and reset the pointer. */
  clear(): void {
    this._stack = [];
    this._index = -1;
  }

  /** Iterate from oldest to newest without materialising reference-backed rows. */
  frames(): HistoryFrame[] {
    return this._stack.slice();
  }

  /**
   * Serialize the history to the existing schema-v2 JSON-compatible shape.
   * Reference-backed frames materialise here deliberately because persistence
   * is an explicit full-state boundary in RF-035B1.
   */
  toJSON(): HistorySnapshot {
    return {
      index: this._index,
      maxFrames: this.maxFrames,
      frames: this._stack.map((f) => {
        const before = this._forSerialization(f.datasetBefore, f.datasetBeforeRef, 'before');
        const after = this._forSerialization(f.datasetAfter, f.datasetAfterRef, 'after');
        return {
          operation: f.operation,
          parameters: f.parameters,
          timestamp: f.timestamp,
          datasetBefore: before?.toJSON?.() ?? null,
          datasetAfter: after?.toJSON?.() ?? null,
        };
      }),
    };
  }

  /** Reconstruct a legacy/materialised AnalysisHistory from schema-v2 JSON. */
  static fromJSON(obj: unknown): AnalysisHistory {
    if (!obj || typeof obj !== 'object') {
      throw new Error('AnalysisHistory.fromJSON requires an object');
    }
    const typedObj = obj as HistorySnapshot;
    const history = new AnalysisHistory({ maxFrames: typedObj.maxFrames ?? 50 });
    const frames = typedObj.frames || [];
    history._stack = frames.map((f) => ({
      operation: f.operation,
      parameters: f.parameters ?? {},
      timestamp: f.timestamp ?? 0,
      datasetBefore: f.datasetBefore ? Dataset.fromJSON(f.datasetBefore) : null,
      datasetAfter: f.datasetAfter ? Dataset.fromJSON(f.datasetAfter) : null,
      rowCountBefore: f.datasetBefore?.rows.length,
      rowCountAfter: f.datasetAfter?.rows.length,
    }));
    history._index = Math.max(-1, Math.min(frames.length - 1, typedObj.index ?? -1));
    return history;
  }
}
