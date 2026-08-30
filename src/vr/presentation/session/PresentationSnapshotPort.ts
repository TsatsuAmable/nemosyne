import type { PresentationState } from '../../../session/NemosyneSession.ts';

/** Durable presentation boundary used by session save/restore orchestration. */
export interface PresentationSnapshotPort {
  capture(): PresentationState | null;
  restore(snapshot: PresentationState): Promise<void>;
}
