import { describe, expect, it, afterEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  readValidationSessionEnv,
  isValidSessionLabel,
  isValidSessionId,
  VALIDATION_SESSION_LABEL_HEADER,
  VALIDATION_SESSION_ID_HEADER,
  type ValidationSessionIdentity,
} from '../src/validation/validation-session.ts';
import {
  createLoadTestResultsHandler,
  readPostValidationSession,
  resolveLoadTestSink,
} from '../dev/loadtest-server.ts';
import {
  VALIDATION_LOG_ROOT,
  buildValidationContext,
  deriveLaunchDisposition,
  writeDispositionFile,
  writeEvidencePlaceholders,
  type GitResult,
  type GitFn,
} from '../scripts/quest-validation.mjs';
import {
  validateValidationManifest,
  type QuestDeviceIdentity,
  type ValidationMode,
} from '../src/validation/validation-manifest.ts';

const FAKE_SHA = 'a8be01af10e36e595e52571c91613cc070035b51';
const FAKE_UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const OTHER_UUID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

const SESSION_A: ValidationSessionIdentity = {
  label: 'PERF04-a8be01a-20260829T104512',
  id: FAKE_UUID,
};

const tempDirectories: string[] = [];

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) rmSync(directory, { recursive: true });
});

function tempRoot(): string {
  const directory = mkdtempSync(join(tmpdir(), 'nemosyne-qv-b2-sink-'));
  tempDirectories.push(directory);
  return directory;
}

function fakeGitDispatch(stdoutByArgs: Record<string, string>): GitFn {
  return (args: string[]): GitResult => {
    const stdout = stdoutByArgs[args.join(' ')];
    return stdout === undefined ? { ok: true, stdout: '' } : { ok: true, stdout };
  };
}

function quest3sIdentity(): QuestDeviceIdentity {
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

function machineCapture() {
  return { ok: true as const, identity: quest3sIdentity() };
}

function context(mode: ValidationMode = 'quest-perf') {
  return buildValidationContext({
    mode,
    git: fakeGitDispatch({ 'rev-parse HEAD': FAKE_SHA, 'status --porcelain': '' }),
    sessionId: FAKE_UUID,
    now: () => new Date('2026-08-29T10:45:12.000Z'),
    deviceCapture: machineCapture(),
  });
}

describe('QV3 session identity contract', () => {
  it('reads a valid validation session from an env record', () => {
    expect(
      readValidationSessionEnv({
        VITE_NEMOSYNE_VALIDATION_SESSION_LABEL: SESSION_A.label,
        VITE_NEMOSYNE_VALIDATION_SESSION_ID: SESSION_A.id,
      })
    ).toEqual(SESSION_A);
  });

  it('fails closed when the env identity is missing or malformed', () => {
    expect(readValidationSessionEnv({})).toBeNull();
    expect(
      readValidationSessionEnv({
        VITE_NEMOSYNE_VALIDATION_SESSION_LABEL: SESSION_A.label,
      })
    ).toBeNull();
    expect(
      readValidationSessionEnv({
        VITE_NEMOSYNE_VALIDATION_SESSION_LABEL: SESSION_A.label,
        VITE_NEMOSYNE_VALIDATION_SESSION_ID: 'not-a-uuid',
      })
    ).toBeNull();
    expect(
      readValidationSessionEnv({
        VITE_NEMOSYNE_VALIDATION_SESSION_LABEL: '../escape',
        VITE_NEMOSYNE_VALIDATION_SESSION_ID: SESSION_A.id,
      })
    ).toBeNull();
  });

  it('validates labels and ids used as path/identity components', () => {
    expect(isValidSessionLabel('PERF04-a8be01a-20260829T104512')).toBe(true);
    expect(isValidSessionLabel('../escape')).toBe(false);
    expect(isValidSessionLabel('a/b')).toBe(false);
    expect(isValidSessionLabel('.')).toBe(false);
    expect(isValidSessionLabel('..')).toBe(false);
    expect(isValidSessionId(FAKE_UUID)).toBe(true);
    expect(isValidSessionId('short')).toBe(false);
  });

  it('parses a POST validation session from headers, fail-closed on malformed input', () => {
    const headers = {
      [VALIDATION_SESSION_LABEL_HEADER]: SESSION_A.label,
      [VALIDATION_SESSION_ID_HEADER]: SESSION_A.id,
    };
    expect(readPostValidationSession(headers)).toEqual(SESSION_A);
    expect(readPostValidationSession({})).toBeNull();
    expect(
      readPostValidationSession({
        [VALIDATION_SESSION_LABEL_HEADER]: '../escape',
        [VALIDATION_SESSION_ID_HEADER]: SESSION_A.id,
      })
    ).toBeNull();
    expect(
      readPostValidationSession({
        [VALIDATION_SESSION_LABEL_HEADER]: SESSION_A.label,
        [VALIDATION_SESSION_ID_HEADER]: 'nope',
      })
    ).toBeNull();
    expect(
      readPostValidationSession({
        [VALIDATION_SESSION_LABEL_HEADER]: [SESSION_A.label, 'extra'],
        [VALIDATION_SESSION_ID_HEADER]: [SESSION_A.id],
      })
    ).toEqual(SESSION_A);
  });
});

describe('QV3 sink routing', () => {
  const generic = '/logs/loadtest-results.jsonl';
  const validationRoot = '/logs/validation';

  it('routes to the generic sink when no active session exists', () => {
    const result = resolveLoadTestSink({
      activeSession: null,
      postSession: SESSION_A,
      genericSinkFile: generic,
      validationLogRoot: validationRoot,
    });
    expect(result.file).toBe(generic);
    expect(result.kind).toBe('generic');
    expect(result.mismatch).toBe(false);
  });

  it('routes a matching POST to the per-session sink', () => {
    const result = resolveLoadTestSink({
      activeSession: SESSION_A,
      postSession: SESSION_A,
      genericSinkFile: generic,
      validationLogRoot: validationRoot,
    });
    expect(result.file).toBe(join(validationRoot, SESSION_A.label, 'loadtest-results.jsonl'));
    expect(result.kind).toBe('session');
    expect(result.mismatch).toBe(false);
  });

  it('routes an untagged POST to the generic sink under an active session', () => {
    const result = resolveLoadTestSink({
      activeSession: SESSION_A,
      postSession: null,
      genericSinkFile: generic,
      validationLogRoot: validationRoot,
    });
    expect(result.kind).toBe('generic');
    expect(result.file).toBe(generic);
  });

  it('never routes a mismatched POST into the active session', () => {
    for (const other of [
      { label: SESSION_A.label, id: OTHER_UUID },
      { label: 'PERF04-bbbbbbb-20260829T104512', id: SESSION_A.id },
    ]) {
      const result = resolveLoadTestSink({
        activeSession: SESSION_A,
        postSession: other,
        genericSinkFile: generic,
        validationLogRoot: validationRoot,
      });
      expect(result.kind).toBe('generic');
      expect(result.file).toBe(generic);
      expect(result.mismatch).toBe(true);
    }
  });

  it('fails closed on a malicious active-session label', () => {
    const result = resolveLoadTestSink({
      activeSession: { label: '../escape', id: SESSION_A.id },
      postSession: SESSION_A,
      genericSinkFile: generic,
      validationLogRoot: validationRoot,
    });
    expect(result.file).toBe(generic);
    expect(result.kind).toBe('generic');
  });
});

describe('QV3 loadtest plugin handler', () => {
  type FakeRes = { writeHead: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };

  function postToHandler(
    handler: (req: IncomingMessage, res: ServerResponse) => boolean,
    headers: Record<string, string> = {},
    body: unknown = { profileName: 'test', xrActive: false, verdict: {} }
  ): { res: FakeRes; handled: boolean } {
    const req = new EventEmitter() as EventEmitter & {
      url: string;
      method: string;
      headers: Record<string, string>;
      socket: { remoteAddress: string };
    };
    req.url = '/__loadtest-results';
    req.method = 'POST';
    req.headers = headers;
    req.socket = { remoteAddress: '127.0.0.1' };
    const res: FakeRes = { writeHead: vi.fn(), end: vi.fn() };
    const handled = handler(req as unknown as IncomingMessage, res as unknown as ServerResponse);
    req.emit('data', JSON.stringify(body));
    req.emit('end');
    return { res, handled };
  }

  function summaryLine(): string {
    return `${JSON.stringify({ profileName: 'test', xrActive: false, verdict: {} })}\n`;
  }

  it('routes a session-tagged POST into the per-session evidence file', () => {
    const logDir = tempRoot();
    const handler = createLoadTestResultsHandler({
      logDir,
      activeSession: SESSION_A,
    });
    const { res, handled } = postToHandler(handler, {
      [VALIDATION_SESSION_LABEL_HEADER]: SESSION_A.label,
      [VALIDATION_SESSION_ID_HEADER]: SESSION_A.id,
    });
    expect(handled).toBe(true);
    expect(res.end).toHaveBeenCalledWith(JSON.stringify({ status: 'ok' }));

    const sessionFile = join(logDir, 'validation', SESSION_A.label, 'loadtest-results.jsonl');
    expect(readFileSync(sessionFile, 'utf8')).toBe(summaryLine());
    expect(readdirSync(join(logDir, 'validation', SESSION_A.label))).toContain(
      'loadtest-results.jsonl'
    );
  });

  it('keeps generic dev behavior: no session -> existing sink file', () => {
    const logDir = tempRoot();
    const handler = createLoadTestResultsHandler({ logDir, activeSession: null });
    const { res } = postToHandler(handler, {});
    expect(res.end).toHaveBeenCalledWith(JSON.stringify({ status: 'ok' }));
    expect(readFileSync(join(logDir, 'loadtest-results.jsonl'), 'utf8')).toBe(summaryLine());
  });

  it('routes an untagged POST to the generic sink even when a session is active', () => {
    const logDir = tempRoot();
    const handler = createLoadTestResultsHandler({ logDir, activeSession: SESSION_A });
    const { res } = postToHandler(handler, {});
    expect(res.end).toHaveBeenCalledWith(JSON.stringify({ status: 'ok' }));
    expect(readFileSync(join(logDir, 'loadtest-results.jsonl'), 'utf8')).toBe(summaryLine());
    expect(existsSync(join(logDir, 'validation', SESSION_A.label))).toBe(false);
  });

  it('does not mix a mismatched session POST into the active session file', () => {
    const logDir = tempRoot();
    const handler = createLoadTestResultsHandler({ logDir, activeSession: SESSION_A });
    const mismatched = { label: SESSION_A.label, id: OTHER_UUID };
    const { res } = postToHandler(handler, {
      [VALIDATION_SESSION_LABEL_HEADER]: mismatched.label,
      [VALIDATION_SESSION_ID_HEADER]: mismatched.id,
    });
    expect(res.end).toHaveBeenCalledWith(JSON.stringify({ status: 'ok' }));
    expect(readFileSync(join(logDir, 'loadtest-results.jsonl'), 'utf8')).toBe(summaryLine());
    expect(existsSync(join(logDir, 'validation', SESSION_A.label))).toBe(false);
  });

  it('fails closed on a malicious session label in the POST (no path escape)', () => {
    const logDir = tempRoot();
    const handler = createLoadTestResultsHandler({ logDir, activeSession: SESSION_A });
    const { res } = postToHandler(handler, {
      [VALIDATION_SESSION_LABEL_HEADER]: '../escape',
      [VALIDATION_SESSION_ID_HEADER]: SESSION_A.id,
    });
    expect(res.end).toHaveBeenCalledWith(JSON.stringify({ status: 'ok' }));
    expect(readFileSync(join(logDir, 'loadtest-results.jsonl'), 'utf8')).toBe(summaryLine());
    expect(existsSync(join(logDir, 'escape'))).toBe(false);
    expect(existsSync(join(logDir, 'validation', SESSION_A.label))).toBe(false);
  });

  it('uses the default env-derived session when no options are passed', () => {
    const logDir = tempRoot();
    delete process.env.VITE_NEMOSYNE_VALIDATION_SESSION_LABEL;
    delete process.env.VITE_NEMOSYNE_VALIDATION_SESSION_ID;
    const handler = createLoadTestResultsHandler({ logDir });
    const { res } = postToHandler(handler, {});
    expect(res.end).toHaveBeenCalledWith(JSON.stringify({ status: 'ok' }));
    expect(readFileSync(join(logDir, 'loadtest-results.jsonl'), 'utf8')).toBe(summaryLine());
  });
});

describe('QV3 evidence files and disposition', () => {
  it('writes manifest, analysis, and disposition with launch-gate classification', () => {
    const root = tempRoot();
    const manifest = buildValidationContext({
      mode: 'quest-perf',
      git: fakeGitDispatch({ 'rev-parse HEAD': FAKE_SHA, 'status --porcelain': '' }),
      sessionId: FAKE_UUID,
      now: () => new Date('2026-08-29T10:45:12.000Z'),
      deviceCapture: { ok: false, error: 'no ADB device is attached' },
    });
    const files = writeEvidencePlaceholders(manifest, root);
    const names = files.map((file) => file.split('/').pop());
    expect(names).toContain('analysis.json');
    expect(names).toContain('disposition.json');
    expect(files[0]).toMatch(/analysis\.json$/);
    expect(files[1]).toMatch(/disposition\.json$/);

    const disposition = JSON.parse(readFileSync(files[1], 'utf8'));
    expect(disposition.status).toBeUndefined();
    expect(disposition.gateDisposition.status).toBe('INVALID_RUN');
    expect(disposition.gateDisposition.reasons.length).toBeGreaterThan(0);
    expect(disposition.promotionEligible).toBe(false);
    expect(disposition.invalidations.length).toBeGreaterThan(0);
    expect(disposition.sessionLabel).toBe(manifest.sessionLabel);
    expect(disposition.deviceIdentity).toBeNull();

    const analysis = JSON.parse(readFileSync(files[0], 'utf8'));
    expect(analysis.status).toBe('pending');
  });

  it('leaves an eligible governed run pending until QV4 adjudication', () => {
    const manifest = context('quest-perf');
    expect(validateValidationManifest(manifest).ok).toBe(true);
    expect(deriveLaunchDisposition(manifest)).toEqual({ status: null, reasons: [] });
  });

  it('classifies broken source or device attribution as INVALID_RUN with reasons', () => {
    const dirty = buildValidationContext({
      mode: 'quest-perf',
      git: fakeGitDispatch({
        'rev-parse HEAD': FAKE_SHA,
        'status --porcelain': ' M src/validation/validation-manifest.ts\n',
      }),
      sessionId: FAKE_UUID,
      now: () => new Date('2026-08-29T10:45:12.000Z'),
      deviceCapture: machineCapture(),
    });
    const disposition = deriveLaunchDisposition(dirty);
    expect(disposition.status).toBe('INVALID_RUN');
    expect(disposition.reasons.join('\n')).toMatch(/worktree state is 'dirty'/);

    const missingIdentity = buildValidationContext({
      mode: 'quest-perf',
      git: fakeGitDispatch({ 'rev-parse HEAD': FAKE_SHA, 'status --porcelain': '' }),
      sessionId: FAKE_UUID,
      now: () => new Date('2026-08-29T10:45:12.000Z'),
      device: { declaredQuestModel: 'Meta Quest 3S', declaredFirmwareVersion: 'v72' },
      deviceCapture: { ok: false, error: 'adb unavailable' },
    });
    const dispositionMissing = deriveLaunchDisposition(missingIdentity);
    expect(dispositionMissing.status).toBe('INVALID_RUN');
    expect(dispositionMissing.reasons.join('\n')).toMatch(/device identity:/);
  });

  it('keeps a valid non-qualification boundary run pending, not INVALID_RUN', () => {
    const tenM = buildValidationContext({
      mode: 'quest-10m',
      git: fakeGitDispatch({ 'rev-parse HEAD': FAKE_SHA, 'status --porcelain': '' }),
      sessionId: FAKE_UUID,
      now: () => new Date('2026-08-29T10:45:12.000Z'),
      deviceCapture: machineCapture(),
    });
    expect(tenM.promotionEligible).toBe(false);
    expect(tenM.invalidations.some((reason) => reason.includes('boundary probe'))).toBe(true);
    const disposition = deriveLaunchDisposition(tenM);
    expect(disposition.status).toBeNull();
    expect(disposition.reasons).toEqual([]);
  });

  it('classifies a failed/aborted run instead of discarding it', () => {
    const root = tempRoot();
    const manifest = context('quest-perf');
    const file = writeDispositionFile(
      manifest,
      { status: 'FAIL', reasons: ['WASM dev build failed; session aborted before Vite start'] },
      root
    );
    const disposition = JSON.parse(readFileSync(file, 'utf8'));
    expect(disposition.gateDisposition.status).toBe('FAIL');
    expect(disposition.gateDisposition.reasons).toContain(
      'WASM dev build failed; session aborted before Vite start'
    );
    expect(disposition.sessionId).toBe(manifest.sessionId);
    expect(disposition.buildId).toBe(manifest.buildId);
    expect(disposition.deviceIdentity.captureBasis).toBe('adb-system-property');
  });

  it('adds UX placeholders only for the quest-ux mode', () => {
    const root = tempRoot();
    const uxFiles = writeEvidencePlaceholders(context('quest-ux'), root);
    const uxNames = uxFiles.map((file) => file.split('/').pop());
    expect(uxNames).toContain('ux-results.json');
    expect(uxNames).toContain('comfort-observation.json');

    const perfRoot = tempRoot();
    const perfFiles = writeEvidencePlaceholders(context('quest-perf'), perfRoot);
    const perfNames = perfFiles.map((file) => file.split('/').pop());
    expect(perfNames).not.toContain('ux-results.json');
  });

  it('writes everything inside logs/validation (git-ignored) and refuses escapes', () => {
    const root = tempRoot();
    const manifest = context('quest-perf');
    for (const file of writeEvidencePlaceholders(manifest, root)) {
      expect(file.startsWith(join(root, VALIDATION_LOG_ROOT))).toBe(true);
    }
    expect(() =>
      writeDispositionFile(
        { ...manifest, evidenceDir: '../escape' },
        { status: 'FAIL', reasons: [] },
        root
      )
    ).toThrow();
  });
});
