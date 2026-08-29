import type { Dataset } from '../../../data/Dataset.ts';
import { WorldTopics } from '../../../utils/EventBus.ts';
import type { ArtifactRef, WorldEventBusLike } from '../../coordinators/types.ts';
import { combineBindingDisposers, type BindingDisposer } from './BindingDisposer.ts';

interface OperationPreviewEvent {
  operation: string;
  previewDataset: Dataset;
  originalDataset: Dataset | null;
  artifact: ArtifactRef;
}

export interface OperationPreviewProjectionDependencies {
  eventBus: WorldEventBusLike;
  preview: (
    operation: string,
    previewDataset: Dataset,
    originalDataset: Dataset,
    artifact: ArtifactRef
  ) => void;
  clear: () => void;
}

/** Own the event-to-transient-preview presentation reaction. */
export function bindOperationPreviewProjection({
  eventBus,
  preview,
  clear,
}: OperationPreviewProjectionDependencies): BindingDisposer {
  return combineBindingDisposers([
    eventBus.on(WorldTopics.OPERATION_PREVIEW, (payload: unknown) => {
      const event = payload as OperationPreviewEvent;
      preview(
        event.operation,
        event.previewDataset,
        event.originalDataset ?? event.previewDataset,
        event.artifact
      );
    }),
    eventBus.on(WorldTopics.OPERATION_CLEAR_PREVIEW, clear),
  ]);
}
