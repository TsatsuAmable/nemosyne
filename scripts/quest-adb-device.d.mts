import type { execFileSync } from 'node:child_process';
import type { ProcessEnv } from 'node:process';
import type { QuestDeviceIdentity } from '../src/validation/validation-manifest.ts';

export declare const QUEST_ADB_SERIAL_ENV: string;
export declare const ADB_CAPTURE_BASIS: 'adb-system-property';

export interface AdbResult {
  ok: boolean;
  stdout?: string;
  error?: unknown;
}

export type AdbFn = (
  args: string[],
  options?: { execFileSyncFn?: typeof execFileSync }
) => AdbResult;

export interface AdbDeviceEntry {
  serial: string;
  state: string;
  metadata: string;
}

export type AdbQuestCapture =
  | { ok: true; identity: QuestDeviceIdentity }
  | { ok: false; error: string };

export declare function runAdb(
  args: string[],
  options?: { execFileSyncFn?: typeof execFileSync }
): AdbResult;

export declare function parseAdbDevices(stdout: string): AdbDeviceEntry[];

export declare function captureAdbQuestDevice(options?: {
  adb?: AdbFn;
  selectedSerial?: string | null;
}): AdbQuestCapture;

export declare function formatAdbQuestIdentity(capture: AdbQuestCapture): string;

export declare function main(
  argv?: string[],
  env?: ProcessEnv,
  write?: (text: string) => void
): number;
