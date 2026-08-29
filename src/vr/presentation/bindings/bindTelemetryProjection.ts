import { WorldTopics } from '../../../utils/EventBus.ts';
import type { WorldEventBusLike } from '../../coordinators/types.ts';
import { combineBindingDisposers, type BindingDisposer } from './BindingDisposer.ts';

export interface TelemetryProjectionDependencies {
  eventBus: WorldEventBusLike;
  recordGesture: (name: string) => void;
  recordOperation: (operation: string) => void;
}

/** Project governed interaction outcomes into opt-in aggregate telemetry. */
export function bindTelemetryProjection({
  eventBus,
  recordGesture,
  recordOperation,
}: TelemetryProjectionDependencies): BindingDisposer {
  return combineBindingDisposers([
    eventBus.on(WorldTopics.GESTURE_RECOGNIZED, (payload: unknown) => {
      recordGesture((payload as { name: string }).name);
    }),
    eventBus.on(WorldTopics.OPERATION_APPLIED, (payload: unknown) => {
      recordOperation((payload as { operation: string }).operation);
    }),
  ]);
}
