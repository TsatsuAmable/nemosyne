import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  deriveValidationManifest,
  type QuestDeviceIdentity,
  type ValidationManifest,
  type ValidationMode,
} from '../src/validation/validation-manifest.ts';
import { readBrowserValidationContext } from '../src/validation/browser-validation-session.ts';
import {
  VALIDATION_RECEIPT_VERSION,
  VALIDATION_RECEIPT_VERSION_HEADER,
  VALIDATION_STATUS_ENDPOINT,
  VALIDATION_UX_ENDPOINT,
} from '../src/validation/validation-delivery.ts';
import {
  GUIDED_UX_SCHEMA_VERSION,
  GUIDED_UX_TASKS,
  validateGuidedUxSubmission,
  type GuidedUxSubmission,
} from '../src/validation/guided-ux-validation.ts';
import {
  VALIDATION_SESSION_ID_HEADER,
  VALIDATION_SESSION_LABEL_HEADER,
  type ValidationSessionIdentity,
} from '../src/validation/validation-session.ts';
import { LOAD_TEST_THRESHOLDS } from '../src/vr/scalability/LoadTestThresholds.ts';
import { QUEST_PERF_STEP_POLICY } from '../dev/validation-adjudication.ts';
import {
  computeQualificationProgress,
  createLoadTestResultsHandler,
} from '../dev/loadtest-server.ts';
import { finalizeValidationSession } from '../dev/validation-finalizer.ts';

const BUILD = '277c2e73f9206f5b387a856bc8298d8247e39376';
const SESSION: ValidationSessionIdentity = {
  label: 'PERF04-277c2e7-20260905T020000',
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
};
const OTHER_SESSION: ValidationSessionIdentity = {
  label: 'RF029-277c2e7-20260905T021000',
  id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
};

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'nemosyne-qv-closed-loop-'));
  roots.push(root);
  return root;
}

function identity(fingerprint = 'oculus/panther/panther:12/SQ3A/5123456789:user/release-keys'): QuestDeviceIdentity {
  return {
    captureBasis: 'adb-system-property',
    model: 'Meta Quest 3S',
    manufacturer: 'Meta',
    buildIncremental: '5123456789012345678',
    buildDisplayId: 'SQ3A.220605.009.A1',
    buildFingerprint: fingerprint,
    securityPatch: '2026-08-01',
  };
}

function manifest(
  session: ValidationSessionIdentity = SESSION,
  mode: ValidationMode = 'quest-perf',
  device: QuestDeviceIdentity = identity()
): ValidationManifest {
  return deriveValidationManifest({
    sessionId: session.id,
    sessionLabel: session.label,
    buildId: BUILD,
    worktree: 'clean',
    mode,
    createdAt: '2026-09-05T02:00:00.000Z',
    deviceIdentity: device,
    declaredQuestModel: device.model,
    declaredFirmwareVersion: device.buildIncremental,
  });
}

function writeSession(logDir: string, value: ValidationManifest, lines: unknown[] = []): void {
  const dir = join(logDir, 'validation', value.sessionLabel);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'manifest.json'), `${JSON.stringify(value, null, 2)}\n`);
  writeFileSync(
    join(dir, 'disposition.json'),
    `${JSON.stringify({ gateDisposition: { status: null, reasons: [] } }, null, 2)}\n`
  );
  if (lines.length > 0) {
    writeFileSync(join(dir, 'loadtest-results.jsonl'), lines.map((line) => JSON.stringify(line)).join('\n') + '\n');
  }
}

function validPerfReport(value: ValidationManifest) {
  return {
    version: '2',
    profileName: 'quest-3s-qualification',
    xrActive: true,
    aborted: false,
    thresholds: { ...LOAD_TEST_THRESHOLDS },
    device: {
      buildId: value.buildId,
      declaredDeviceTarget: 'META_QUEST_3S',
      identityBasis: 'adb-system-property',
      declaredFirmwareVersion: value.deviceIdentity?.buildIncremental,
      xr: { active: true },
    },
    collection: {
      rawFrameTraceIncluded: false,
      datasetRowsIncluded: false,
      cameraPosesIncluded: false,
    },
    steps: QUEST_PERF_STEP_POLICY.map((policy) => ({
      spec: { topology: 'TABULAR', rowCount: policy.rowCount, durationSec: policy.durationSec },
      frames: { p95Ms: 10, p99Ms: 12, droppedPct: 1 },
      criticalViolations: 0,
      grade: 'green',
    })),
  };
}

function validBoundaryReport(
  value: ValidationManifest,
  outcome: 'completed' | 'failed' | 'aborted' = 'failed'
) {
  return {
    version: '1',
    profileName: 'quest-3s-rust-boundary-10m',
    xrActive: true,
    device: {
      buildId: value.buildId,
      declaredDeviceTarget: 'META_QUEST_3S',
      identityBasis: 'adb-system-property',
      declaredFirmwareVersion: value.deviceIdentity?.buildIncremental,
      xr: { active: true },
    },
    collection: {
      rawFrameTraceIncluded: false,
      datasetRowsIncluded: false,
      cameraPosesIncluded: false,
    },
    scenario: { rows: 10_000_000 },
    outcome: { status: outcome },
    qualification: {
      deviceQualifiedAt10m: false,
      promotionBlockedByAudits: true,
    },
    ...(outcome === 'completed'
      ? {
          evidence: {
            structureProfileRowCount: 10_000_000,
            rowMaterialisations: 0,
            checksumParity: true,
          },
        }
      : {}),
  };
}

type FakeRes = { writeHead: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };

function request(
  handler: (req: IncomingMessage, res: ServerResponse) => boolean,
  method: 'GET' | 'POST',
  url: string,
  headers: Record<string, string>,
  body?: unknown
): FakeRes {
  const req = new EventEmitter() as EventEmitter & {
    url: string;
    method: string;
    headers: Record<string, string>;
    socket: { remoteAddress: string };
  };
  req.url = url;
  req.method = method;
  req.headers = headers;
  req.socket = { remoteAddress: '127.0.0.1' };
  const res: FakeRes = { writeHead: vi.fn(), end: vi.fn() };
  expect(handler(req as unknown as IncomingMessage, res as unknown as ServerResponse)).toBe(true);
  if (body !== undefined) req.emit('data', JSON.stringify(body));
  if (method === 'POST') req.emit('end');
  return res;
}

function headers(session: ValidationSessionIdentity = SESSION, receipt = false): Record<string, string> {
  return {
    [VALIDATION_SESSION_LABEL_HEADER]: session.label,
    [VALIDATION_SESSION_ID_HEADER]: session.id,
    ...(receipt ? { [VALIDATION_RECEIPT_VERSION_HEADER]: VALIDATION_RECEIPT_VERSION } : {}),
  };
}

function validUxSubmission(value: ValidationManifest): GuidedUxSubmission {
  return {
    schemaVersion: GUIDED_UX_SCHEMA_VERSION,
    sessionId: value.sessionId,
    sessionLabel: value.sessionLabel,
    buildId: value.buildId,
    deviceBuildFingerprint: value.deviceIdentity?.buildFingerprint ?? null,
    evidenceKind: 'guided-physical-ux',
    results: GUIDED_UX_TASKS.map((task, index) => ({
      taskId: task.id,
      outcome: index === 3 ? 'not-run' : 'pass',
      inputModality: index % 2 === 0 ? 'controller' : 'hand',
      modalityBasis: 'investigator-selected',
      recordedAt: '2026-09-05T02:10:00.000Z',
      note: null,
    })),
    comfortObservation: {
      outcome: 'comfortable',
      recordedAt: '2026-09-05T02:20:00.000Z',
      note: null,
    },
    completedAt: '2026-09-05T02:20:01.000Z',
  };
}

describe('browser validation projection', () => {
  it('projects launcher session/build/ADB facts without treating them as sink-confirmed', () => {
    const ctx = readBrowserValidationContext({
      VITE_NEMOSYNE_VALIDATION_SESSION_LABEL: SESSION.label,
      VITE_NEMOSYNE_VALIDATION_SESSION_ID: SESSION.id,
      VITE_NEMOSYNE_BUILD_ID: BUILD,
      VITE_NEMOSYNE_VALIDATION_MODE: 'quest-perf',
      VITE_NEMOSYNE_WORKTREE: 'clean',
      VITE_NEMOSYNE_QUEST_IDENTITY_BASIS: 'adb-system-property',
      VITE_NEMOSYNE_QUEST_MODEL: 'Meta Quest 3S',
      VITE_NEMOSYNE_QUEST_BUILD_INCREMENTAL: '5123456789012345678',
      VITE_NEMOSYNE_QUEST_BUILD_FINGERPRINT: identity().buildFingerprint,
    });
    expect(ctx?.session).toEqual(SESSION);
    expect(ctx?.manifest.buildId).toBe(BUILD);
    expect(ctx?.manifest.deviceIdentity?.captureBasis).toBe('adb-system-property');
    expect(ctx?.source).toBe('launcher-env-provisional');
    expect(ctx?.attributionIssue).toMatch(/pending/i);
  });

  it('fails closed when the session identity is incomplete', () => {
    expect(
      readBrowserValidationContext({
        VITE_NEMOSYNE_VALIDATION_SESSION_LABEL: SESSION.label,
        VITE_NEMOSYNE_BUILD_ID: BUILD,
        VITE_NEMOSYNE_VALIDATION_MODE: 'quest-perf',
        VITE_NEMOSYNE_WORKTREE: 'clean',
      })
    ).toBeNull();
  });
});

describe('sink-owned qualification progress', () => {
  it('projects only QV4-valid active evidence and custody-verified prior sessions for the same build/device', () => {
    const logDir = tempRoot();
    const active = manifest();
    writeSession(logDir, active, [validPerfReport(active)]);

    const boundary = manifest(OTHER_SESSION, 'quest-10m');
    writeSession(logDir, boundary, [validBoundaryReport(boundary)]);
    expect(
      finalizeValidationSession({
        validationLogRoot: join(logDir, 'validation'),
        sessionLabel: boundary.sessionLabel,
      }).status
    ).toBe('finalized');

    const foreign = deriveValidationManifest({
      sessionId: '8f14e45f-ea31-4a5f-8cbb-9e2c1a0f0f99',
      sessionLabel: 'PERF04-277c2e7-foreign-device',
      buildId: BUILD,
      worktree: 'clean',
      mode: 'quest-perf',
      deviceIdentity: identity('different/device/fingerprint'),
    });
    writeSession(logDir, foreign, [validPerfReport(foreign)]);

    expect(computeQualificationProgress(join(logDir, 'validation'), active)).toMatchObject({
      target: 3,
      renderCompleted: 1,
      boundaryAttempts: 1,
      buildId: BUILD,
      deviceBuildFingerprint: identity().buildFingerprint,
    });
  });
});

describe('governed delivery receipt and status', () => {
  it('returns an attributable receipt only when the client opts into receipt v1', () => {
    const logDir = tempRoot();
    const active = manifest();
    writeSession(logDir, active);
    const handler = createLoadTestResultsHandler({ logDir, activeSession: SESSION });
    const res = request(
      handler,
      'POST',
      '/__loadtest-results',
      headers(SESSION, true),
      validPerfReport(active)
    );
    const payload = JSON.parse(res.end.mock.calls.at(-1)?.[0] as string);
    expect(payload.status).toBe('ok');
    expect(payload.receipt).toMatchObject({
      version: '1',
      status: 'captured',
      artifact: 'loadtest-results.jsonl',
      sessionLabel: SESSION.label,
      sessionId: SESSION.id,
    });
    expect(payload.receipt.progress.renderCompleted).toBe(1);
  });

  it('returns the exact launcher-written manifest and current adjudicable evidence progress', () => {
    const logDir = tempRoot();
    const active = manifest();
    writeSession(logDir, active, [validPerfReport(active)]);
    const handler = createLoadTestResultsHandler({ logDir, activeSession: SESSION });
    const res = request(handler, 'GET', VALIDATION_STATUS_ENDPOINT, headers(), undefined);
    const payload = JSON.parse(res.end.mock.calls.at(-1)?.[0] as string);
    expect(payload.status).toBe('ok');
    expect(payload.manifest).toEqual(active);
    expect(payload.progress.renderCompleted).toBe(1);
    expect(payload.gateDisposition).toEqual({ status: null, reasons: [] });
  });

  it('fails status closed for a foreign browser session', () => {
    const logDir = tempRoot();
    writeSession(logDir, manifest());
    const handler = createLoadTestResultsHandler({ logDir, activeSession: SESSION });
    const res = request(handler, 'GET', VALIDATION_STATUS_ENDPOINT, headers(OTHER_SESSION), undefined);
    expect(res.writeHead).toHaveBeenCalledWith(409, expect.any(Object));
  });
});

describe('QV5 guided physical UX evidence', () => {
  it('requires the complete governed task vocabulary and bounded semantic outcomes', () => {
    const uxManifest = manifest(SESSION, 'quest-ux');
    const submission = validUxSubmission(uxManifest);
    expect(validateGuidedUxSubmission(submission)).toEqual([]);
    expect(
      validateGuidedUxSubmission({ ...submission, results: submission.results.slice(1) })
    ).toContain(`results must contain exactly ${GUIDED_UX_TASKS.length} governed tasks`);
  });

  it('writes UX and comfort artifacts only into the matching quest-ux session', () => {
    const logDir = tempRoot();
    const uxManifest = manifest(SESSION, 'quest-ux');
    writeSession(logDir, uxManifest);
    const handler = createLoadTestResultsHandler({ logDir, activeSession: SESSION });
    const submission = validUxSubmission(uxManifest);
    const res = request(handler, 'POST', VALIDATION_UX_ENDPOINT, headers(SESSION, true), submission);
    const payload = JSON.parse(res.end.mock.calls.at(-1)?.[0] as string);
    expect(payload.receipt.status).toBe('captured');
    const dir = join(logDir, 'validation', SESSION.label);
    expect(existsSync(join(dir, 'ux-results.json'))).toBe(true);
    expect(existsSync(join(dir, 'comfort-observation.json'))).toBe(true);
    const ux = JSON.parse(readFileSync(join(dir, 'ux-results.json'), 'utf8'));
    expect(ux.results).toHaveLength(GUIDED_UX_TASKS.length);
    expect(ux.results.some((result: { inputModality: string }) => result.inputModality === 'hand')).toBe(true);
  });

  it('rejects guided UX evidence that disagrees with the launcher manifest', () => {
    const logDir = tempRoot();
    const uxManifest = manifest(SESSION, 'quest-ux');
    writeSession(logDir, uxManifest);
    const handler = createLoadTestResultsHandler({ logDir, activeSession: SESSION });
    const submission = { ...validUxSubmission(uxManifest), buildId: 'a'.repeat(40) };
    const res = request(handler, 'POST', VALIDATION_UX_ENDPOINT, headers(SESSION, true), submission);
    expect(res.writeHead).toHaveBeenCalledWith(409, expect.any(Object));
    expect(existsSync(join(logDir, 'validation', SESSION.label, 'ux-results.json'))).toBe(false);
  });
});
