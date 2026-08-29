/**
 * Type declarations for the QV2 device-declaration CLI
 * (`scripts/quest-device-declaration.mjs`).
 *
 * The script itself is plain ESM JavaScript; this sidecar gives TypeScript
 * consumers (tests) an accurate type surface without enabling `allowJs`.
 * At runtime vitest/Node resolve the real `.mjs`.
 */

import type { DeviceDeclaration } from './quest-validation.mjs';

export interface DeclarationUpdates {
  label?: string;
  declaredQuestModel?: string;
  declaredFirmwareVersion?: string;
  investigator?: string;
}

export declare function printDeviceDeclaration(
  declaration: DeviceDeclaration,
  root?: string,
  write?: (text: string) => void
): void;

export declare function parseSetArgs(
  argv: string[]
): { updates: DeclarationUpdates } | { error: string };

export declare function main(
  argv?: string[],
  root?: string,
  write?: (text: string) => void
): number;
