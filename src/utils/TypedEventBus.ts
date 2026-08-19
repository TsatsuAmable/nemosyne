/**
 * Zero-Overhead Typed Event Bus (<100 Bytes).
 *
 * Wraps `nanoevents` for high-performance, strictly typed event dispatching across subsystems.
 */

import { createNanoEvents, type Emitter, type Unsubscribe } from 'nanoevents';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SubsystemEventsMap = Record<string, (...args: any[]) => void>;

export class TypedEventBus<Events extends SubsystemEventsMap = SubsystemEventsMap> {
  private _emitter: Emitter<Events>;

  constructor() {
    this._emitter = createNanoEvents<Events>();
  }

  /**
   * Listen to an event. Returns an unsubscription callback.
   */
  on<E extends keyof Events>(event: E, callback: Events[E]): Unsubscribe {
    return this._emitter.on(event, callback);
  }

  /**
   * Dispatches an event with arguments to all registered listeners.
   */
  emit<E extends keyof Events>(event: E, ...args: Parameters<Events[E]>): void {
    this._emitter.emit(event, ...args);
  }

  /**
   * Removes all listeners for all events.
   */
  clear(): void {
    this._emitter.events = {};
  }
}
