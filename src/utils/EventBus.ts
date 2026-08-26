/**
 * Lightweight strongly-typed pub/sub used by the UI and coordinator layer
 * for cross-cutting concerns (interaction logging, auto-save, telemetry, UI refresh).
 *
 * Handlers are called synchronously and in registration order. Errors in one
 * handler do not prevent subsequent handlers from running.
 */

export interface WorldEventBusOptions {
  debug?: boolean;
}

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
  LOADTEST_START: 'loadtest:start',
  LOADTEST_SAMPLE: 'loadtest:sample',
  LOADTEST_STEP: 'loadtest:step',
  LOADTEST_COMPLETE: 'loadtest:complete',
  QUEST_BOUNDARY_START: 'quest-boundary:start',
  QUEST_BOUNDARY_PROGRESS: 'quest-boundary:progress',
  QUEST_BOUNDARY_COMPLETE: 'quest-boundary:complete',
  USER_MODE_APPLIED: 'userMode:applied',
  JOURNEY_PHASE_CHANGED: 'journey:phase-changed',
} as const;

export type WorldTopicName = (typeof WorldTopics)[keyof typeof WorldTopics];

export interface NemosyneEventMap {
  interaction: unknown;
  'interaction:log': unknown;
  'console:log': string;
  'console:warn': string;
  'session:capture': unknown;
  'settings:changed': Record<string, unknown>;
  'dataset:loaded': unknown;
  'operation:applied': unknown;
  'operation:preview': unknown;
  'operation:clear-preview': void;
  'history:seek': { index: number; operation: string; dataset: unknown };
  'session:autosave-request': void;
  'session:saved': { sessionId?: string; success?: boolean; [key: string]: unknown };
  'gesture:recognized': unknown;
  'input:paused': void;
  'input:resumed': void;
  'view:reset': void;
  'data:reset': void;
  'performance:throttle': { lodScaleFactor: number; averageFrameTimeMs: number };
  'loadtest:start': unknown;
  'loadtest:sample': unknown;
  'loadtest:step': unknown;
  'loadtest:complete': unknown;
  'quest-boundary:start': unknown;
  'quest-boundary:progress': unknown;
  'quest-boundary:complete': unknown;
  'userMode:applied': { mode: string };
  'journey:phase-changed': { journeyPhase: string; metadata?: Record<string, unknown> };
}

export type EventHandler<T = unknown> = (payload: T) => void;

export class WorldEventBus<TEvents extends object = NemosyneEventMap> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _handlers: Map<string, EventHandler<any>[]>;
  private _debug: boolean;

  constructor({ debug = false }: WorldEventBusOptions = {}) {
    this._handlers = new Map();
    this._debug = debug;
  }

  /**
   * Internal core: register a handler for a raw topic string. All public
   * variants (typed `on` and `onDynamic`) delegate here so the overload
   * resolution never has to accept an arbitrary string on its typed surface.
   */
  private _onCore(topic: string, handler: (payload: unknown) => void): () => void {
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

    return () => this._offCore(topic, handler);
  }

  private _offCore(topic: string, handler: (payload: unknown) => void): void {
    const list = this._handlers.get(topic);
    if (!list) return;
    const index = list.indexOf(handler);
    if (index >= 0) {
      list.splice(index, 1);
    }
  }

  private _emitCore(topic: string, payload: unknown): void {
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
   * Register a handler for a typed topic. Returns an unsubscribe function.
   * Only topics declared in the event map are accepted here; accidental
   * typos (e.g. `bus.on('operation:aplied', ...)`) are a compile error rather
   * than a silently-dropped subscription.
   *
   * For genuinely dynamic / runtime-computed topics, use {@link onDynamic}.
   */
  on<K extends keyof TEvents & string>(topic: K, handler: EventHandler<TEvents[K]>): () => void;
  on(topic: string, handler: EventHandler<unknown>): () => void {
    return this._onCore(topic, handler);
  }

  /**
   * Register a handler for a dynamic (non-typed) topic. Prefer {@link on}
   * with a declared topic; this escape hatch exists for runtime-computed
   * topic names so accidental use is visible at the call site.
   */
  onDynamic(topic: string, handler: EventHandler<unknown>): () => void {
    return this._onCore(topic, handler);
  }

  /**
   * Remove a handler from a typed topic.
   */
  off<K extends keyof TEvents & string>(topic: K, handler: EventHandler<TEvents[K]>): void;
  off(topic: string, handler: EventHandler<unknown>): void {
    this._offCore(topic, handler);
  }

  /**
   * Remove a handler from a dynamic topic.
   */
  offDynamic(topic: string, handler: EventHandler<unknown>): void {
    this._offCore(topic, handler);
  }

  /**
   * Remove all handlers for a topic, or all handlers if no topic is given.
   */
  removeAll(topic?: (keyof TEvents & string) | string): void {
    if (topic === undefined) {
      this._handlers.clear();
      return;
    }
    this._handlers.delete(topic);
  }

  /**
   * Emit a payload to all handlers on a typed topic. Handlers are invoked
   * synchronously and errors are caught so a bad subscriber cannot break the
   * rest of the system.
   */
  emit<K extends keyof TEvents & string>(topic: K, payload?: TEvents[K]): void;
  emit(topic: string, payload?: unknown): void {
    this._emitCore(topic, payload);
  }

  /**
   * Emit a payload to a dynamic (non-typed) topic. Prefer {@link emit} with a
   * declared topic.
   */
  emitDynamic(topic: string, payload?: unknown): void {
    this._emitCore(topic, payload);
  }

  /**
   * Register a one-time handler for a typed topic. The handler is removed
   * after the first emit.
   */
  once<K extends keyof TEvents & string>(topic: K, handler: EventHandler<TEvents[K]>): () => void;
  once(topic: string, handler: EventHandler<unknown>): () => void {
    const wrapper = (payload: unknown) => {
      this._offCore(topic, wrapper);
      handler(payload);
    };
    return this._onCore(topic, wrapper);
  }

  /**
   * Register a one-time handler for a dynamic topic.
   */
  onceDynamic(topic: string, handler: EventHandler<unknown>): () => void {
    const wrapper = (payload: unknown) => {
      this._offCore(topic, wrapper);
      handler(payload);
    };
    return this._onCore(topic, wrapper);
  }

  /**
   * Return the number of registered handlers for a topic.
   */
  listenerCount(topic: (keyof TEvents & string) | string): number {
    const list = this._handlers.get(topic);
    return list ? list.length : 0;
  }
}
