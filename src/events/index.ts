/**
 * Core Event Infrastructure Subsystem.
 *
 * `WorldEventBus` is the single event authority (skill §20 convergence):
 * typed topic map, synchronous dispatch, per-handler error isolation.
 * The former nanoevents-backed `TypedEventBus` was retired — it had no
 * consumers and duplicated dispatch ownership.
 */

export { WorldEventBus, WorldTopics, type WorldEventBusOptions, type NemosyneEventMap } from '../utils/EventBus.ts';
