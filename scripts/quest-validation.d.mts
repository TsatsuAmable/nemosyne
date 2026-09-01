/** Type declarations for `scripts/quest-validation.mjs`. */

import type { execFileSync } from 'node:child_process';
import type { ProcessEnv } from 'node:process';
import type {
  GateDispositionStatus,
  QuestDeviceIdentity,
  ValidationManifest,
  ValidationMode,
  WorktreeState,
} from '../src/validation/validation-manifest.ts';
import type { AdbQuestCapture } from './quest-adb-device.mjs';

export declare const VALIDATION_LOG_ROOT: string;
export declare const FALLBACK_BUILD_ID: string;
export declare const DEVICE_DECLARATION_FILE: string;
export declare const DEVICE_DECLARATION_FIELDS: string[];

export interface GitResult {
  ok: boolean;
  stdout?: string;
  error?: unknown;
}

export type GitFn = (
  args: string[],
  options?: { execFileSyncFn?: typeof execFileSync }
) => GitResult;

export interface DeviceDeclaration {
  label: string | null;
  declaredQuestModel: string | null;
  declaredFirmwareVersion: string | null;
  investigator: string | null;
}

export interface BuildValidationContextOptions {
  mode: ValidationMode;
  git?: GitFn;
  sessionId?: string;
  now?: () => Date;
  device?: Partial<DeviceDeclaration>;
  deviceCapture?: AdbQuestCapture;
}

export interface GateDisposition {
  status: GateDispositionStatus | null;
  reasons: string[];
}

export declare function runGit(
  args: string[],
  options?: { execFileSyncFn?: typeof execFileSync }
): GitResult;

export declare function resolveGitHead(git?: GitFn): string;
export declare function resolveWorktreeState(git?: GitFn): WorktreeState;
export declare function generateSessionId(): string;
export declare function generateSessionLabel(
  mode: string,
  buildId: string,
  now?: () => Date
): string;

export declare function readDeviceDeclaration(root?: string): DeviceDeclaration;
export declare function mergeDeviceDeclaration(
  current?: Partial<DeviceDeclaration>,
  updates?: Partial<Record<keyof DeviceDeclaration, string>>
): DeviceDeclaration;
export declare function writeDeviceDeclaration(
  declaration: DeviceDeclaration,
  root?: string
): string;

export declare function applyDeviceIdentityGate(manifest: ValidationManifest): ValidationManifest;
export declare const applyDeviceDeclarationGate: typeof applyDeviceIdentityGate;

export declare function resolveEvidenceDir(
  manifest: Pick<ValidationManifest, 'evidenceDir'>,
  root?: string
): string;
export declare function deriveLaunchDisposition(manifest: ValidationManifest): GateDisposition;
export declare function writeDispositionFile(
  manifest: ValidationManifest,
  disposition: GateDisposition,
  root?: string
): string;
export declare function writeAnalysisPlaceholder(
  manifest: ValidationManifest,
  root?: string
): string;
export declare function writeUxPlaceholders(manifest: ValidationManifest, root?: string): string[];
export declare function writeEvidencePlaceholders(
  manifest: ValidationManifest,
  root?: string
): string[];
export declare function buildValidationContext(
  options: BuildValidationContextOptions
): ValidationManifest;
export declare function writeManifestFile(
  manifest: Pick<ValidationManifest, 'evidenceDir'>,
  root?: string
): string;
export declare function printSessionSummary(manifest: ValidationManifest): void;
export declare function main(argv?: string[], env?: ProcessEnv, root?: string): number | undefined;

export type { QuestDeviceIdentity };
