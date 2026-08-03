/**
 * Base class for live data connectors.
 *
 * Implementations should:
 *  - Open/close an external stream.
 *  - Normalize incoming messages into a {@link Dataset}.
 *  - Emit updates through `_emitUpdate(update)`.
 *  - Emit status changes through `_setStatus(status, detail)`.
 *
 * Consumers subscribe via `onUpdate(cb)` / `onStatus(cb)`. Callbacks return an
 * unsubscribe function.
 */
export class DataConnector {
  constructor() {
    this._updateListeners = [];
    this._statusListeners = [];
    this.status = 'idle';
  }

  /** Start the live connection. */
  connect() {
    throw new Error('DataConnector#connect must be implemented by subclass');
  }

  /** Stop the live connection and cancel any reconnect timers. */
  disconnect() {
    throw new Error('DataConnector#disconnect must be implemented by subclass');
  }

  /** @returns {string} */
  getStatus() {
    return this.status;
  }

  /**
   * Subscribe to normalized live dataset updates.
   * @param {(update: LiveUpdate) => void} fn
   * @returns {() => void} unsubscribe
   */
  onUpdate(fn) {
    this._updateListeners.push(fn);
    return () => {
      this._updateListeners = this._updateListeners.filter((cb) => cb !== fn);
    };
  }

  /**
   * Subscribe to connection status changes.
   * @param {(status: string, detail?: string) => void} fn
   * @returns {() => void} unsubscribe
   */
  onStatus(fn) {
    this._statusListeners.push(fn);
    return () => {
      this._statusListeners = this._statusListeners.filter((cb) => cb !== fn);
    };
  }

  /** @protected */
  _emitUpdate(update) {
    this._updateListeners.forEach((cb) => {
      try {
        cb(update);
      } catch (err) {
        console.error('DataConnector update listener threw:', err);
      }
    });
  }

  /** @protected */
  _setStatus(status, detail = undefined) {
    this.status = status;
    this._statusListeners.forEach((cb) => {
      try {
        cb(status, detail);
      } catch (err) {
        console.error('DataConnector status listener threw:', err);
      }
    });
  }
}

/**
 * @typedef {Object} LiveUpdate
 * @property {import('../Dataset.js').Dataset} dataset
 * @property {string} mode
 * @property {string} topology
 */
