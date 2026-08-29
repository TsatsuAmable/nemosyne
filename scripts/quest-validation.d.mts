/**
 * Type declarations for the QV1 launcher (`scripts/quest-validation.mjs`).
 *
 * The launcher itself is plain ESM JavaScript; this sidecar gives TypeScript
 * consumers (tests) an accurate type surface without enabling `allowJs`.
 * At runtime vitest/Node resolve the real `.mjs`.
 */

import type { execFileSync } from 'node:child_process';
import type { ProcessEnv } from 'node:process';
import type {
  ValidationManifest,
  ValidationMode,
  WorktreeState,
} from '../src/validation/validation-manifest.ts';

export declare const VALIDATION_LOG_ROOT: string;
export declare const FALLBACK_BUILD_ID: string;

export interface GitResult {
  ok: boolean;
  stdout?: string;
  error?: unknown;
}

export type GitFn = (args: string[], options?: { execFileSyncFn?: typeof execFileSync }) => GitResult;

export interface DeviceDeclaration {
  declaredQuestModel: string | null;
  declaredFirmwareVersion: string | null;
}

export interface BuildValidationContextOptions {
  mode: ValidationMode;
  git?: GitFn;
  sessionId?: string;
  now?: () => Date;
  device?: DeviceDeclaration;
}

export declare function runGit(
  args: string[],
  options?: { execFileSyncFn?: typeof execFileSync }
): GitResult;

export declare function resolveGitHead(git?: GitFn): string;

export declare function resolveWorktreeState(git?: GitFn): WorktreeState;

export declare function generateSessionId(): string;

export declare function generateSessionLabel(mode: string, buildId: string, now?: () => Date): string;

export declare function readDeviceDeclaration(root?: string): DeviceDeclaration;

export declare function buildValidationContext(
  options: BuildValidationContextOptions
): ValidationManifest;

export declare function writeManifestFile(
  manifest: Pick<ValidationManifest, 'evidenceDir'>,
  root?: string
): string;

export declare function printSessionSummary(manifest: ValidationManifest): void;

export declare function main(
  argv?: string[],
  env?: ProcessEnv,
  root?: string
): number | undefined;