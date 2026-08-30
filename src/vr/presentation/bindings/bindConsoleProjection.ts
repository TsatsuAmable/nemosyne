import { WorldTopics } from '../../../utils/EventBus.ts';
import type { WorldEventBusLike } from '../../coordinators/types.ts';
import { combineBindingDisposers, type BindingDisposer } from './BindingDisposer.ts';

export interface ConsoleProjectionDependencies {
  eventBus: WorldEventBusLike;
  log: (level: 'log' | 'warn', args: unknown[]) => void;
}

/** Project event-bus console messages onto the investigator console. */
export function bindConsoleProjection({
  eventBus,
  log,
}: ConsoleProjectionDependencies): BindingDisposer {
  return combineBindingDisposers([
    eventBus.on(WorldTopics.CONSOLE_LOG, (payload: unknown) => {
      log('log', Array.isArray(payload) ? payload : [payload]);
    }),
    eventBus.on(WorldTopics.CONSOLE_WARN, (payload: unknown) => {
      log('warn', Array.isArray(payload) ? payload : [payload]);
    }),
  ]);
}
