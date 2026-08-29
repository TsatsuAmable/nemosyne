import { WorldTopics } from '../../../utils/EventBus.ts';
import type { WorldEventBusLike } from '../../coordinators/types.ts';
import { combineBindingDisposers, type BindingDisposer } from './BindingDisposer.ts';

interface OperationAppliedEvent {
  operation: string;
  rowCount?: number;
}

export interface OperationUiProjectionDependencies {
  eventBus: WorldEventBusLike;
  updateOperationLog: () => void;
  updateNarrative: () => void;
  logConsole: (message: string) => void;
  recordInteraction: (operation: string, result: string) => void;
}

/** Project operation/history outcomes onto bounded investigator UI surfaces. */
export function bindOperationUiProjection({
  eventBus,
  updateOperationLog,
  updateNarrative,
  logConsole,
  recordInteraction,
}: OperationUiProjectionDependencies): BindingDisposer {
  return combineBindingDisposers([
    eventBus.on(WorldTopics.OPERATION_APPLIED, (payload: unknown) => {
      const { operation, rowCount } = payload as OperationAppliedEvent;
      const result = `${rowCount} rows`;
      updateOperationLog();
      updateNarrative();
      logConsole(`Operation: ${operation} → ${result}`);
      recordInteraction(operation, result);
    }),
    eventBus.on(WorldTopics.HISTORY_SEEK, () => {
      updateNarrative();
    }),
  ]);
}
