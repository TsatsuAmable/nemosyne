import type { Dataset } from '../Dataset.ts';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

export interface LiveUpdate {
  dataset: Dataset;
  mode: string;
  topology: string;
}

type StatusListener = (status: ConnectionStatus | string, detail?: string) => void;
type UpdateListener = (update: LiveUpdate) => void;

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
  protected _updateListeners: UpdateListener[];
  protected _statusListeners: StatusListener[];
  status: ConnectionStatus | string;

  constructor() {
    this._updateListeners = [];
    this._statusListeners = [];
    this.status = 'idle';
  }

  /** Start the live connection. */
  connect(): void {
    throw new Error('DataConnector#connect must be implemented by subclass');
  }

  /** Stop the live connection and cancel any reconnect timers. */
  disconnect(): void {
    throw new Error('DataConnector#disconnect must be implemented by subclass');
  }

  getStatus(): ConnectionStatus | string {
    return this.status;
  }

  /**
   * Subscribe to normalized live dataset updates.
   */
  onUpdate(fn: UpdateListener): () => void {
    this._updateListeners.push(fn);
    return () => {
      this._updateListeners = this._updateListeners.filter((cb) => cb !== fn);
    };
  }

  /**
   * Subscribe to connection status changes.
   */
  onStatus(fn: StatusListener): () => void {
    this._statusListeners.push(fn);
    return () => {
      this._statusListeners = this._statusListeners.filter((cb) => cb !== fn);
    };
  }

  /** @protected */
  protected _emitUpdate(update: LiveUpdate): void {
    this._updateListeners.forEach((cb) => {
      try {
        cb(update);
      } catch (err) {
        console.error('DataConnector update listener threw:', err);
      }
    });
  }

  /** @protected */
  protected _setStatus(status: ConnectionStatus | string, detail?: string): void {
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
