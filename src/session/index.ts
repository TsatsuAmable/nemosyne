/**
 * Session Subsystem — Barrel Export
 */

export { NemosyneSession } from './NemosyneSession.ts';
export type { NemosyneSessionJSON, PresentationState } from './NemosyneSession.ts';

export { InvestigationBranchManager } from './InvestigationBranchManager.ts';
export type {
  InvestigationBranch,
  BranchComparisonResult,
} from './InvestigationBranchManager.ts';

export { ShareableSessionURL } from './ShareableSessionURL.ts';
export type { ShareableSessionPayload } from './ShareableSessionURL.ts';

export { NemosynePackageManager, NemosyneManifestSchema } from './NemosynePackage.ts';
export type { NemosynePackageManifest, NemosynePackagePayload } from './NemosynePackage.ts';

