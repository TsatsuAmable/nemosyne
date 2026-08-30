import { WorldTopics } from '../../../utils/EventBus.ts';
import type { WorldEventBusLike } from '../../coordinators/types.ts';
import { combineBindingDisposers, type BindingDisposer } from './BindingDisposer.ts';

interface OperationEvent {
  operation: string;
}

export interface DerivedAnalysisProjectionDependencies {
  eventBus: WorldEventBusLike;
  schedule: (operation: string) => void;
  recomputeTda: () => void;
}

/** React to authoritative dataset transitions by scheduling derived analysis. */
export function bindDerivedAnalysisProjection({
  eventBus,
  schedule,
  recomputeTda,
}: DerivedAnalysisProjectionDependencies): BindingDisposer {
  return combineBindingDisposers([
    eventBus.on(WorldTopics.OPERATION_APPLIED, (payload: unknown) => {
      schedule((payload as OperationEvent).operation);
    }),
    eventBus.on(WorldTopics.HISTORY_SEEK, (payload: unknown) => {
      if ((payload as OperationEvent).operation !== 'anomaly') recomputeTda();
    }),
  ]);
}
