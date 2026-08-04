import { Dataset } from './Dataset.ts';
import type { DatasetJSON } from './types.ts';

export interface HistoryFrame {
  operation: string;
  parameters: Record<string, unknown>;
  timestamp: number;
  datasetBefore: Dataset | null;
  datasetAfter: Dataset | null;
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

/**
 * Undo/redo stack for data-analysis operations.
 */
export class AnalysisHistory {
  private _stack: HistoryFrame[];
  private _index: number;
  maxFrames: number;

  constructor({ maxFrames = 50 }: { maxFrames?: number } = {}) {
    this._stack = [];
    this._index = -1;
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

  /**
   * Record a data operation.
   */
  push(
    operation: string,
    datasetBefore: Dataset | null,
    datasetAfter: Dataset | null,
    parameters: Record<string, unknown> = {}
  ): number {
    // Discard any redo branch whenever a new operation is recorded.
    if (this._index < this._stack.length - 1) {
      this._stack = this._stack.slice(0, this._index + 1);
    }

    this._stack.push({
      operation,
      datasetBefore: datasetBefore?.clone?.() ?? datasetBefore,
      datasetAfter: datasetAfter?.clone?.() ?? datasetAfter,
      parameters,
      timestamp: performance.now?.() ?? Date.now?.() ?? 0,
    });

    // Trim oldest frames if the stack exceeds the cap.
    if (this._stack.length > this.maxFrames) {
      this._stack.shift();
    } else {
      this._index++;
    }

    return this._index;
  }

  /**
   * Undo the most recently applied operation.
   */
  undo(): HistoryEntry | null {
    if (!this.canUndo) return null;
    const frame = this._stack[this._index];
    this._index--;
    return {
      operation: frame.operation,
      dataset: frame.datasetBefore ? frame.datasetBefore.clone() : new Dataset('empty', [], []),
      parameters: frame.parameters,
    };
  }

  /**
   * Redo the next previously undone operation.
   */
  redo(): HistoryEntry | null {
    if (!this.canRedo) return null;
    this._index++;
    const frame = this._stack[this._index];
    return {
      operation: frame.operation,
      dataset: frame.datasetAfter ? frame.datasetAfter.clone() : new Dataset('empty', [], []),
      parameters: frame.parameters,
    };
  }

  /** Index of the current frame, or -1 when the stack is empty. */
  get currentIndex(): number {
    return this._index;
  }

  /** Return the current frame, or null if the stack is empty. */
  current(): HistoryFrame | null {
    if (this._index < 0 || this._index >= this._stack.length) return null;
    const frame = this._stack[this._index];
    return {
      ...frame,
      datasetAfter: frame.datasetAfter ? frame.datasetAfter.clone() : new Dataset('empty', [], []),
    };
  }

  /**
   * Jump directly to a specific frame index.
   */
  seek(index: number): HistoryEntry | null {
    if (this.length === 0) return null;
    this._index = Math.max(0, Math.min(this.length - 1, index));
    const frame = this._stack[this._index];
    return {
      operation: frame.operation,
      dataset: frame.datasetAfter ? frame.datasetAfter.clone() : new Dataset('empty', [], []),
      parameters: frame.parameters,
    };
  }

  /** Clear all recorded frames and reset the pointer. */
  clear(): void {
    this._stack = [];
    this._index = -1;
  }

  /** Iterate from oldest to newest for inspection / replay. */
  frames(): HistoryFrame[] {
    return this._stack.slice();
  }

  /**
   * Serialize the history to a plain JSON-compatible object.
   * Requires the Dataset class to support fromJSON during restoration.
   */
  toJSON(): HistorySnapshot {
    return {
      index: this._index,
      maxFrames: this.maxFrames,
      frames: this._stack.map((f) => ({
        operation: f.operation,
        parameters: f.parameters,
        timestamp: f.timestamp,
        datasetBefore: f.datasetBefore?.toJSON?.() ?? null,
        datasetAfter: f.datasetAfter?.toJSON?.() ?? null,
      })),
    };
  }

  /**
   * Reconstruct an AnalysisHistory from a plain JSON object.
   */
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
    }));
    history._index = Math.max(-1, Math.min(frames.length - 1, typedObj.index ?? -1));
    return history;
  }
}
