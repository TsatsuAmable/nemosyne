import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import {
  appendFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  deriveValidationManifest,
  type QuestDeviceIdentity,
  type ValidationManifest,
} from '../src/validation/validation-manifest.ts';
import { LOAD_TEST_THRESHOLDS } from '../src/vr/scalability/LoadTestThresholds.ts';
import { QUEST_PERF_STEP_POLICY } from '../dev/validation-adjudication.ts';
import {
  finalizeValidationSession,
  getValidationFinalizationStatus,
  verifyFinalizedCustody,
} from '../dev/validation-finalizer.ts';
import {
  createValidationFinalizationHandler,
  VALIDATION_FINALIZATION_STATUS_ENDPOINT,
} from '../dev/validation-finalization-plugin.ts';
import {
  VALIDATION_SESSION_ID_HEADER,
  VALIDATION_SESSION_LABEL_HEADER,
  type ValidationSessionIdentity,
} from '../src/validation/validation-session.ts';

const BUILD = '4d54a76c49ebb57ae8cac5a5166fe8a3dfd7c318';
const SESSION: ValidationSessionIdentity = {
  label: 'PERF04-4d54a76-20260905T100000',
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
};
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'nemosyne-qv-custody-'));
  roots.push(root);
  return root;
}

function device(): QuestDeviceIdentity {
  return {
    captureBasis: 'adb-system-property',
    model: 'Meta Quest 3S',
    manufacturer: 'Meta',
    buildIncremental: '5123456789012345678',
    buildDisplayId: 'SQ3A.220605.009.A1',
    buildFingerprint: 'oculus/panther/panther:12/SQ3A/5123456789:user/release-keys',
    securityPatch: '2026-08-01',
  };
}

function manifest(): ValidationManifest {
  return deriveValidationManifest({
    sessionId: SESSION.id,
    sessionLabel: SESSION.label,
    buildId: BUILD,
    worktree: 'clean',
    mode: 'quest-perf',
    createdAt: '2026-09-05T09:00:00.000Z',
    deviceIdentity: device(),
  });
}

function greenReport(value: ValidationManifest) {
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

function writeRawSession(root: string): {
  validationRoot: string;
  evidenceDir: string;
  value: ValidationManifest;
} {
  const value = manifest();
  const validationRoot = join(root, 'logs', 'validation');
  const evidenceDir = join(validationRoot, value.sessionLabel);
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(join(evidenceDir, 'manifest.json'), `${JSON.stringify(value, null, 2)}\n`);
  writeFileSync(join(evidenceDir, 'analysis.json'), `${JSON.stringify({ status: 'pending' })}\n`);
  writeFileSync(
    join(evidenceDir, 'disposition.json'),
    `${JSON.stringify({ gateDisposition: { status: null, reasons: [] } })}\n`
  );
  writeFileSync(
    join(evidenceDir, 'loadtest-results.jsonl'),
    `${JSON.stringify(greenReport(value))}\n`
  );
  return { validationRoot, evidenceDir, value };
}

function headers() {
  return {
    [VALIDATION_SESSION_LABEL_HEADER]: SESSION.label,
    [VALIDATION_SESSION_ID_HEADER]: SESSION.id,
  };
}

type FakeRes = EventEmitter & {
  statusCode: number;
  writeHead: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
};

function fakeResponse(): FakeRes {
  const res = new EventEmitter() as FakeRes;
  res.statusCode = 200;
  res.writeHead = vi.fn((status: number) => {
    res.statusCode = status;
    return res;
  });
  res.end = vi.fn();
  return res;
}

function fakeRequest(method: string, url: string): IncomingMessage {
  const req = new EventEmitter() as EventEmitter & {
    method: string;
    url: string;
    headers: Record<string, string>;
  };
  req.method = method;
  req.url = url;
  req.headers = headers();
  return req as unknown as IncomingMessage;
}

describe('QV4 evidence finalization and custody', () => {
  it('freezes raw evidence before adjudication and emits a verifiable complete bundle', () => {
    const root = tempRoot();
    const { validationRoot, evidenceDir } = writeRawSession(root);
    const result = finalizeValidationSession({
      validationLogRoot: validationRoot,
      sessionLabel: SESSION.label,
      now: () => new Date('2026-09-05T09:30:00.000Z'),
    });
    expect(result).toMatchObject({ status: 'finalized', aggregateStatus: 'PARTIAL' });
    for (const name of [
      'evidence-index.json',
      'analysis.json',
      'disposition.json',
      'custody.json',
      'report.md',
    ]) {
      expect(existsSync(join(evidenceDir, name))).toBe(true);
    }
    expect(existsSync(join(validationRoot, 'VALIDATION_LEDGER.md'))).toBe(true);
    expect(verifyFinalizedCustody(evidenceDir).ok).toBe(true);

    const analysis = JSON.parse(readFileSync(join(evidenceDir, 'analysis.json'), 'utf8'));
    expect(analysis.status).toBe('complete');
    expect(
      analysis.gateResults.find((gate: { gate: string }) => gate.gate === 'PERF-04').status
    ).toBe('PARTIAL');
  });

  it('detects raw evidence mutation after finalization', () => {
    const root = tempRoot();
    const { validationRoot, evidenceDir } = writeRawSession(root);
    expect(
      finalizeValidationSession({
        validationLogRoot: validationRoot,
        sessionLabel: SESSION.label,
      }).status
    ).toBe('finalized');
    appendFileSync(
      join(evidenceDir, 'loadtest-results.jsonl'),
      `${JSON.stringify({ injected: true })}\n`
    );
    expect(verifyFinalizedCustody(evidenceDir)).toMatchObject({ ok: false });
    expect(getValidationFinalizationStatus(evidenceDir)).toMatchObject({
      state: 'tamper-detected',
    });
  });

  it('preserves malformed terminal evidence but adjudicates it INVALID_RUN', () => {
    const root = tempRoot();
    const { validationRoot, evidenceDir } = writeRawSession(root);
    writeFileSync(
      join(evidenceDir, 'loadtest-results.jsonl'),
      `${JSON.stringify({ profileName: 'quest-3s-qualification', xrActive: true })}\n`
    );
    const result = finalizeValidationSession({
      validationLogRoot: validationRoot,
      sessionLabel: SESSION.label,
    });
    expect(result).toMatchObject({ status: 'finalized', aggregateStatus: 'INVALID_RUN' });
    expect(readFileSync(join(evidenceDir, 'loadtest-results.jsonl'), 'utf8')).toContain(
      'quest-3s-qualification'
    );
  });

  it('does not count duplicate reports from one session as independent qualification runs', () => {
    const root = tempRoot();
    const { validationRoot, evidenceDir, value } = writeRawSession(root);
    appendFileSync(
      join(evidenceDir, 'loadtest-results.jsonl'),
      `${JSON.stringify(greenReport(value))}\n`
    );

    const result = finalizeValidationSession({
      validationLogRoot: validationRoot,
      sessionLabel: SESSION.label,
    });
    expect(result).toMatchObject({ status: 'finalized', aggregateStatus: 'INVALID_RUN' });

    const analysis = JSON.parse(readFileSync(join(evidenceDir, 'analysis.json'), 'utf8'));
    expect(analysis.cohort.perfCompletedRunCount).toBe(0);
    expect(analysis.cohort.perfPassingRunCount).toBe(0);
    expect(analysis.validationErrors.join(' ')).toContain('exactly one report per session');
  });
});

describe('QV8 dev-server custody guard', () => {
  it('auto-finalizes a successful matching evidence write and rejects later mutation attempts', () => {
    const root = tempRoot();
    const { evidenceDir } = writeRawSession(root);
    const handler = createValidationFinalizationHandler({
      logDir: join(root, 'logs'),
      activeSession: SESSION,
    });
    const firstRes = fakeResponse();
    expect(
      handler(
        fakeRequest('POST', '/__loadtest-results'),
        firstRes as unknown as ServerResponse
      )
    ).toBe(false);
    firstRes.emit('finish');
    expect(getValidationFinalizationStatus(evidenceDir).state).toBe('finalized');

    const secondRes = fakeResponse();
    expect(
      handler(
        fakeRequest('POST', '/__loadtest-results'),
        secondRes as unknown as ServerResponse
      )
    ).toBe(true);
    expect(secondRes.writeHead).toHaveBeenCalledWith(409, expect.any(Object));
  });

  it('exposes finalization state only to the matching active validation session', () => {
    const root = tempRoot();
    const { validationRoot } = writeRawSession(root);
    finalizeValidationSession({ validationLogRoot: validationRoot, sessionLabel: SESSION.label });
    const handler = createValidationFinalizationHandler({
      logDir: join(root, 'logs'),
      activeSession: SESSION,
    });
    const res = fakeResponse();
    expect(
      handler(
        fakeRequest('GET', VALIDATION_FINALIZATION_STATUS_ENDPOINT),
        res as unknown as ServerResponse
      )
    ).toBe(true);
    const payload = JSON.parse(res.end.mock.calls.at(-1)?.[0] as string);
    expect(payload.finalization.state).toBe('finalized');
    expect(payload.finalization.bundleDigest).toMatch(/^[0-9a-f]{64}$/);
  });
});
