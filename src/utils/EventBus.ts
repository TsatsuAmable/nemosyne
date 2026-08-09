/**
 * Lightweight typed pub/sub used by the UI refactor for cross-cutting
 * concerns (interaction logging, auto-save, telemetry, UI refresh).
 *
 * Handlers are called synchronously and in registration order. Errors in one
 * handler do not prevent subsequent handlers from running.
 */

export interface WorldEventBusOptions {
  debug?: boolean;
}

export type EventHandler = (payload?: unknown) => void;

export const WorldTopics = {
  INTERACTION: 'interaction',
  INTERACTION_LOG: 'interaction:log',
  CONSOLE_LOG: 'console:log',
  CONSOLE_WARN: 'console:warn',
  SESSION_CAPTURE: 'session:capture',
  SETTINGS_CHANGED: 'settings:changed',
  DATASET_LOADED: 'dataset:loaded',
  OPERATION_APPLIED: 'operation:applied',
  OPERATION_PREVIEW: 'operation:preview',
  OPERATION_CLEAR_PREVIEW: 'operation:clear-preview',
  HISTORY_SEEK: 'history:seek',
  SESSION_AUTOSAVE_REQUEST: 'session:autosave-request',
  SESSION_SAVED: 'session:saved',
  GESTURE_RECOGNIZED: 'gesture:recognized',
  INPUT_PAUSED: 'input:paused',
  INPUT_RESUMED: 'input:resumed',
  VIEW_RESET: 'view:reset',
  DATA_RESET: 'data:reset',
  PERFORMANCE_THROTTLE: 'performance:throttle',
} as const;

export class WorldEventBus {
  private _handlers: Map<string, EventHandler[]>;
  private _debug: boolean;

  constructor({ debug = false }: WorldEventBusOptions = {}) {
    this._handlers = new Map();
    this._debug = debug;
  }

  /**
   * Register a handler for a topic. Returns an unsubscribe function.
   */
  on(topic: string, handler: EventHandler): () => void {
    if (typeof topic !== 'string' || topic === '') {
      throw new TypeError('Event topic must be a non-empty string');
    }
    if (typeof handler !== 'function') {
      throw new TypeError('Event handler must be a function');
    }

    let list = this._handlers.get(topic);
    if (!list) {
      list = [];
      this._handlers.set(topic, list);
    }
    list.push(handler);

    return () => this.off(topic, handler);
  }

  /**
   * Remove a handler from a topic.
   */
  off(topic: string, handler: EventHandler): void {
    const list = this._handlers.get(topic);
    if (!list) return;
    const index = list.indexOf(handler);
    if (index >= 0) {
      list.splice(index, 1);
    }
  }

  /**
   * Remove all handlers for a topic, or all handlers if no topic is given.
   */
  removeAll(topic?: string): void {
    if (topic === undefined) {
      this._handlers.clear();
      return;
    }
    this._handlers.delete(topic);
  }

  /**
   * Emit a payload to all handlers on a topic. Handlers are invoked
   * synchronously and errors are caught so a bad subscriber cannot break the
   * rest of the system.
   */
  emit(topic: string, payload?: unknown): void {
    if (typeof topic !== 'string' || topic === '') {
      throw new TypeError('Event topic must be a non-empty string');
    }

    if (this._debug) {
      // eslint-disable-next-line no-console
      console.log('[WorldEventBus]', topic, payload);
    }

    const list = this._handlers.get(topic);
    if (!list || list.length === 0) return;

    for (const handler of list) {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[WorldEventBus] handler for "${topic}" threw:`, err);
      }
    }
  }

  /**
   * Register a one-time handler. The handler is removed after the first emit.
   */
  once(topic: string, handler: EventHandler): () => void {
    const wrapper = (payload?: unknown) => {
      this.off(topic, wrapper);
      handler(payload);
    };
    return this.on(topic, wrapper);
  }

  /**
   * Return the number of registered handlers for a topic.
   */
  listenerCount(topic: string): number {
    const list = this._handlers.get(topic);
    return list ? list.length : 0;
  }
}
