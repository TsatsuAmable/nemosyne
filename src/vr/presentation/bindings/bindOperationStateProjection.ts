import type { Dataset } from '../../../data/Dataset.ts';
import { WorldTopics } from '../../../utils/EventBus.ts';
import type { WorldEventBusLike } from '../../coordinators/types.ts';
import { combineBindingDisposers, type BindingDisposer } from './BindingDisposer.ts';

interface OperationAppliedEvent {
  operation: string;
}

interface HistorySeekEvent {
  operation: string;
  dataset: Dataset;
}

export interface OperationStateProjectionDependencies {
  eventBus: WorldEventBusLike;
  invalidateSpatialAcceleration: () => void;
  getTransformedDataset: () => Dataset | null;
  restoreDataset: (dataset: Dataset | null, operation: string) => void;
  updateDashboardDatasets: (dataset: Dataset | null) => void;
}

/**
 * Keep rendered dataset state synchronized with authoritative operation and
 * history outcomes. Analytical computation remains upstream in Atlas/Rust.
 */
export function bindOperationStateProjection({
  eventBus,
  invalidateSpatialAcceleration,
  getTransformedDataset,
  restoreDataset,
  updateDashboardDatasets,
}: OperationStateProjectionDependencies): BindingDisposer {
  return combineBindingDisposers([
    eventBus.on(WorldTopics.OPERATION_APPLIED, (payload: unknown) => {
      const { operation } = payload as OperationAppliedEvent;
      invalidateSpatialAcceleration();
      if (operation === 'compare') restoreDataset(getTransformedDataset(), operation);
      updateDashboardDatasets(getTransformedDataset());
    }),
    eventBus.on(WorldTopics.HISTORY_SEEK, (payload: unknown) => {
      const { operation, dataset } = payload as HistorySeekEvent;
      restoreDataset(dataset, operation);
    }),
  ]);
}
