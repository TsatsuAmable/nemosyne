/**
 * Session Subsystem — production barrel export.
 */

export { NemosyneSession } from './NemosyneSession.ts';
export type { NemosyneSessionJSON, PresentationState } from './NemosyneSession.ts';

export { InvestigationBranchManager } from './InvestigationBranchManager.ts';
export type {
  InvestigationBranch,
  BranchComparisonResult,
} from './InvestigationBranchManager.ts';

export { NemosynePackageManager, NemosyneManifestSchema } from './NemosynePackage.ts';
export type { NemosynePackageManifest, NemosynePackagePayload } from './NemosynePackage.ts';

export { InvestigationReplayRunner } from './InvestigationReplayRunner.ts';
export type { ReplayVerificationResult } from './InvestigationReplayRunner.ts';

export { VaultArchiveStore } from './VaultArchiveStore.ts';
export type { ArchiveEntry, ArchiveMetadata } from './VaultArchiveStore.ts';
