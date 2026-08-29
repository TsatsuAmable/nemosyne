import { WorldTopics } from '../../../utils/EventBus.ts';
import type { WorldEventBusLike } from '../../coordinators/types.ts';
import { combineBindingDisposers, type BindingDisposer } from './BindingDisposer.ts';

export interface DevEvidenceProjectionDependencies<TLoadTestSummary, TQuestSummary> {
  eventBus: WorldEventBusLike;
  onLoadTestComplete: (summary: TLoadTestSummary) => void;
  onQuestBoundaryComplete: (summary: TQuestSummary) => void;
}

/** Temporary D-stage boundary for diagnostic outcomes; RF-062H isolates its installer. */
export function bindDevEvidenceProjection<TLoadTestSummary, TQuestSummary>({
  eventBus,
  onLoadTestComplete,
  onQuestBoundaryComplete,
}: DevEvidenceProjectionDependencies<TLoadTestSummary, TQuestSummary>): BindingDisposer {
  return combineBindingDisposers([
    eventBus.on(WorldTopics.LOADTEST_COMPLETE, (payload: unknown) => {
      onLoadTestComplete(payload as TLoadTestSummary);
    }),
    eventBus.on(WorldTopics.QUEST_BOUNDARY_COMPLETE, (payload: unknown) => {
      onQuestBoundaryComplete(payload as TQuestSummary);
    }),
  ]);
}
