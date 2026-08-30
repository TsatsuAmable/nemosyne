import { WorldTopics } from '../../../utils/EventBus.ts';
import type { WorldEventBusLike } from '../../coordinators/types.ts';
import { combineBindingDisposers, type BindingDisposer } from './BindingDisposer.ts';

export interface AutosaveProjectionDependencies {
  eventBus: WorldEventBusLike;
  requestAutosave: () => void;
}

/** Route durable-state change notifications to the session autosave boundary. */
export function bindAutosaveProjection({
  eventBus,
  requestAutosave,
}: AutosaveProjectionDependencies): BindingDisposer {
  return combineBindingDisposers([
    eventBus.on(WorldTopics.SESSION_CAPTURE, requestAutosave),
    eventBus.on(WorldTopics.OPERATION_APPLIED, requestAutosave),
    eventBus.on(WorldTopics.SESSION_AUTOSAVE_REQUEST, requestAutosave),
  ]);
}
