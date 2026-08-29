import { WorldTopics } from '../../../utils/EventBus.ts';
import type { WorldEventBusLike } from '../../coordinators/types.ts';
import { combineBindingDisposers, type BindingDisposer } from './BindingDisposer.ts';

export interface InteractionEvent {
  action: string;
  gesture?: string;
  controller?: string;
  result?: string;
}

export interface InteractionProjectionDependencies {
  eventBus: WorldEventBusLike;
  logInteraction: (event: InteractionEvent) => void;
}

/** Route semantic interaction events to the interaction-log projection. */
export function bindInteractionProjection({
  eventBus,
  logInteraction,
}: InteractionProjectionDependencies): BindingDisposer {
  return combineBindingDisposers([
    eventBus.on(WorldTopics.INTERACTION, (payload: unknown) => {
      eventBus.emit(WorldTopics.INTERACTION_LOG, payload);
    }),
    eventBus.on(WorldTopics.INTERACTION_LOG, (payload: unknown) => {
      logInteraction(payload as InteractionEvent);
    }),
  ]);
}
