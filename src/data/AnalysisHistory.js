/**
 * Undo/redo stack for data-analysis operations.
 *
 * Each recorded frame stores the dataset before the operation, the dataset after
 * the operation, the operation name, and any parameters needed to replay it. The
 * stack is pointer-based: `undo()` rewinds to the previous frame and returns
 * the dataset that was current before that frame, while `redo()` advances and
 * returns the dataset produced by the replayed operation.
 */

export class AnalysisHistory {
  constructor({ maxFrames = 50 } = {}) {
    this._stack = [];
    this._index = -1;
    this.maxFrames = maxFrames;
  }

  /** Number of frames currently stored. */
  get length() {
    return this._stack.length;
  }

  /** True if there is at least one applied operation that can be undone. */
  get canUndo() {
    return this._index >= 0;
  }

  /** True if there is a previously undone operation that can be redone. */
  get canRedo() {
    return this._index < this._stack.length - 1;
  }

  /**
   * Record a data operation.
   * @param {string} operation e.g. 'filter', 'sort', 'aggregate'
   * @param {import('./Dataset.js').Dataset} datasetBefore
   * @param {import('./Dataset.js').Dataset} datasetAfter
   * @param {object} [parameters]
   */
  push(operation, datasetBefore, datasetAfter, parameters = {}) {
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
   * @returns {{ operation: string, dataset: import('./Dataset.js').Dataset, parameters: object } | null}
   */
  undo() {
    if (!this.canUndo) return null;
    const frame = this._stack[this._index];
    this._index--;
    return {
      operation: frame.operation,
      dataset: frame.datasetBefore.clone(),
      parameters: frame.parameters,
    };
  }

  /**
   * Redo the next previously undone operation.
   * @returns {{ operation: string, dataset: import('./Dataset.js').Dataset, parameters: object } | null}
   */
  redo() {
    if (!this.canRedo) return null;
    this._index++;
    const frame = this._stack[this._index];
    return {
      operation: frame.operation,
      dataset: frame.datasetAfter.clone(),
      parameters: frame.parameters,
    };
  }

  /** Return the current frame, or null if the stack is empty. */
  current() {
    if (this._index < 0 || this._index >= this._stack.length) return null;
    const frame = this._stack[this._index];
    return { ...frame, dataset: frame.datasetAfter.clone() };
  }

  /** Clear all recorded frames and reset the pointer. */
  clear() {
    this._stack = [];
    this._index = -1;
  }

  /** Iterate from oldest to newest for inspection / replay. */
  frames() {
    return this._stack.slice();
  }

  /**
   * Serialize the history to a plain JSON-compatible object.
   * Requires the Dataset class to support fromJSON during restoration.
   */
  toJSON() {
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
  static fromJSON(obj) {
    if (!obj || typeof obj !== 'object') {
      throw new Error('AnalysisHistory.fromJSON requires an object');
    }
    const { Dataset } = require('./Dataset.js');
    const history = new AnalysisHistory({ maxFrames: obj.maxFrames ?? 50 });
    const frames = obj.frames || [];
    history._stack = frames.map((f) => ({
      operation: f.operation,
      parameters: f.parameters ?? {},
      timestamp: f.timestamp ?? 0,
      datasetBefore: f.datasetBefore ? Dataset.fromJSON(f.datasetBefore) : null,
      datasetAfter: f.datasetAfter ? Dataset.fromJSON(f.datasetAfter) : null,
    }));
    history._index = Math.max(-1, Math.min(frames.length - 1, obj.index ?? -1));
    return history;
  }
}
