import type { AdbQuestCapture } from './quest-adb-device.mjs';
import type { QuestDeviceIdentity } from '../src/validation/validation-manifest.ts';

export declare const EVIDENCE_CLASS: 'unattended-device-smoke';
export declare const TRIGGER_RECORD_ROOT: string;
export declare const DEFAULT_PORT: number;
export declare const MAX_PORT: number;
export declare const DEFAULT_CDP_PORT: number;
export declare const MAX_CDP_PORT: number;
export declare const DEVTOOLS_SOCKET: string;
export declare const HEADSET_BROWSER_PACKAGE: string;
export declare const MAX_CONSOLE_ENTRIES: number;
export declare const CONSOLE_TEXT_LIMIT: number;

export interface AutoTriggerOptions {
  route: string;
  port: number | null;
  timeoutMs: number;
  settleMs: number;
  allowDirty: boolean;
  outDir: string | null;
  help?: boolean;
}

export interface SmokeConsoleEntry {
  source: 'console' | 'exception' | 'log';
  type: string;
  text: string | null;
}

export interface SmokeResult {
  tabId: string;
  loaded: boolean;
  title: string | null;
  readyState: string | null;
  consoleEntries: SmokeConsoleEntry[];
  errorCount: number;
}

export interface TabAudit {
  preExistingIntact: boolean;
  missingPreExisting: string[];
  unexpectedAdded: string[];
  ownTabLeftOpen: boolean;
}

export type TriggerVerdict = 'SMOKE_OK' | 'SMOKE_FAIL' | 'TRIGGER_FAILED';

export interface TriggerRecord {
  tool: 'quest-auto-trigger';
  evidenceClass: typeof EVIDENCE_CLASS;
  promotionEligible: false;
  unattendedBounds: string;
  startedAt?: string;
  finishedAt?: string;
  gitHead?: string;
  worktreeClean?: boolean;
  invalidations?: string[];
  deviceIdentity?: QuestDeviceIdentity;
  serverPort?: number;
  serverPid?: number | null;
  cdpPort?: number;
  route?: string;
  smoke?: Omit<SmokeResult, 'tabId'>;
  closeConfirmed?: boolean;
  tabAudit?: TabAudit;
  verdict?: TriggerVerdict;
  triggerError?: string;
  recordDir?: string;
}

export interface AutoTriggerDeps {
  readGitHead(): Promise<{ head: string; clean: boolean }>;
  captureDevice(): Promise<AdbQuestCapture>;
  deviceSerial(): Promise<string>;
  isPortFree(port: number): Promise<boolean>;
  startServer(port: number): Promise<{ pid?: number; kill(signal?: string): void }>;
  stopServer(server: { kill(signal?: string): void }): Promise<void>;
  waitForHttp(url: string, timeoutMs: number): Promise<void>;
  adbReverse(serial: string, port: number): Promise<void>;
  removeAdbReverse(serial: string, port: number): Promise<void>;
  adbForward(serial: string, cdpPort: number): Promise<void>;
  removeAdbForward(serial: string, cdpPort: number): Promise<void>;
  listTabs(cdpPort: number): Promise<string[]>;
  httpGet(url: string): Promise<string>;
  webSocketCtor: unknown;
  writeRecord(outDir: string, record: TriggerRecord): Promise<void>;
}

export declare function parseArgs(argv?: string[]): AutoTriggerOptions;
export declare function selectPort(
  isFree: (port: number) => Promise<boolean>,
  preferred?: number,
  max?: number
): Promise<number | null>;
export declare function isLocalPortFree(port: number): Promise<boolean>;
export declare function tabAudit(beforeIds: string[], afterIds: string[], ownTabId: string | null): TabAudit;
export declare function awaitTabGone(
  listTabs: () => Promise<string[]>,
  ownTabId: string,
  timeoutMs?: number,
  pollMs?: number
): Promise<boolean>;
export declare function buildTriggerRecord(input: Record<string, unknown>): TriggerRecord;
export declare function sleep(ms: number): Promise<void>;
export declare function runAutoTrigger(deps: AutoTriggerDeps, options: AutoTriggerOptions): Promise<TriggerRecord>;
export declare function main(argv?: string[], env?: NodeJS.ProcessEnv, root?: string): Promise<number>;

export declare class CdpClient {
  constructor(webSocketCtor?: unknown);
  connect(url: string, timeoutMs?: number): Promise<void>;
  send(method: string, params?: Record<string, unknown>, timeoutMs?: number): Promise<unknown>;
  waitForEvent(method: string, timeoutMs?: number): Promise<unknown>;
  close(): void;
}

export declare function collectSmoke(deps: {
  httpGet(url: string): Promise<string>;
  cdpBase: string;
  webSocketCtor: unknown;
  routeUrl: string;
  settleMs?: number;
  timeoutMs?: number;
  preExistingTabIds?: string[];
}): Promise<SmokeResult>;
