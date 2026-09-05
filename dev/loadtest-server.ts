import fs from 'node:fs';
import path from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  handleBoundedJsonPost,
  jsonOk,
  jsonError,
  isShortString,
  MAX_BODY_BYTES,
} from './http-utils.ts';
import {
  VALIDATION_SESSION_LABEL_HEADER,
  VALIDATION_SESSION_ID_HEADER,
  readValidationSessionEnv,
  isValidSessionLabel,
  isValidSessionId,
  type ValidationSessionIdentity,
} from '../src/validation/validation-session.ts';
import {
  validateValidationManifest,
  type ValidationManifest,
} from '../src/validation/validation-manifest.ts';
import {
  VALIDATION_RECEIPT_VERSION_HEADER,
  VALIDATION_RECEIPT_VERSION,
  VALIDATION_STATUS_ENDPOINT,
  VALIDATION_UX_ENDPOINT,
  type QualificationProgress,
  type ValidationDeliveryReceipt,
} from '../src/validation/validation-delivery.ts';
import {
  validateGuidedUxSubmission,
  type GuidedUxSubmission,
} from '../src/validation/guided-ux-validation.ts';

interface LoadTestSummary {
  profileName?: unknown;
  xrActive?: unknown;
  aborted?: unknown;
  outcome?: { status?: unknown };
  verdict?: {
    jsPathSufficientTo?: unknown;
    commandBufferWarrantedAt?: unknown;
  };
}

export interface LoadTestSinkOptions {
  /** Active validation session; defaults to the VITE_* env set by the launcher. */
  activeSession?: ValidationSessionIdentity | null;
  /** Override the local logs root (tests); defaults to `<cwd>/logs`. */
  logDir?: string;
}

export interface LoadTestSinkResolution {
  /** Absolute path the summary must be appended to. */
  file: string;
  kind: 'session' | 'generic';
  sessionLabel: string | null;
  /** True when the POST claimed a session that is not the active one. */
  mismatch: boolean;
}

const MAX_PROGRESS_SESSIONS = 256;
const MAX_PROGRESS_FILE_BYTES = 16 * 1024 * 1024;
const MAX_PROGRESS_LINES_PER_SESSION = 512;

function firstHeader(value: string | string[] | undefined): string | null {
  if (typeof value === 'string' && value.length > 0) return value;
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') return value[0];
  return null;
}

/**
 * Read + validate a POST's declared session identity from its headers. Malformed
 * or absent identity yields null (fail closed to the generic sink).
 */
export function readPostValidationSession(
  headers: Record<string, string | string[] | undefined>
): ValidationSessionIdentity | null {
  const label = firstHeader(headers[VALIDATION_SESSION_LABEL_HEADER]);
  const id = firstHeader(headers[VALIDATION_SESSION_ID_HEADER]);
  if (!isValidSessionLabel(label) || !isValidSessionId(id)) return null;
  return { label, id };
}

/**
 * Decide where a summary line must be appended. Pure and fail-closed:
 * - no active validation session          -> generic sink (ordinary dev, unchanged);
 * - active session, no/malformed POST tag -> generic sink (never mix anonymous data
 *   into a governed session);
 * - active session, POST tag matches       -> per-session sink;
 * - active session, POST tag mismatch      -> generic sink (never mix other-identity
 *   evidence into the active session).
 */
export function resolveLoadTestSink(opts: {
  activeSession: ValidationSessionIdentity | null;
  postSession: ValidationSessionIdentity | null;
  genericSinkFile: string;
  validationLogRoot: string;
}): LoadTestSinkResolution {
  const { activeSession, postSession, genericSinkFile, validationLogRoot } = opts;
  if (
    !activeSession ||
    !isValidSessionLabel(activeSession.label) ||
    !isValidSessionId(activeSession.id)
  ) {
    return { file: genericSinkFile, kind: 'generic', sessionLabel: null, mismatch: false };
  }
  if (
    !postSession ||
    !isValidSessionLabel(postSession.label) ||
    !isValidSessionId(postSession.id)
  ) {
    return { file: genericSinkFile, kind: 'generic', sessionLabel: null, mismatch: false };
  }
  if (postSession.label === activeSession.label && postSession.id === activeSession.id) {
    return {
      file: path.join(validationLogRoot, activeSession.label, 'loadtest-results.jsonl'),
      kind: 'session',
      sessionLabel: activeSession.label,
      mismatch: false,
    };
  }
  return {
    file: genericSinkFile,
    kind: 'generic',
    sessionLabel: postSession.label,
    mismatch: true,
  };
}

function readJsonFile(file: string): unknown | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function readSessionManifest(
  validationLogRoot: string,
  session: ValidationSessionIdentity
): ValidationManifest | null {
  const raw = readJsonFile(path.join(validationLogRoot, session.label, 'manifest.json'));
  const validated = validateValidationManifest(raw);
  if (!validated.ok) return null;
  if (
    validated.manifest.sessionLabel !== session.label ||
    validated.manifest.sessionId !== session.id
  ) {
    return null;
  }
  return validated.manifest;
}

function readGateDisposition(validationLogRoot: string, sessionLabel: string): {
  status: string | null;
  reasons: string[];
} | null {
  const raw = readJsonFile(path.join(validationLogRoot, sessionLabel, 'disposition.json'));
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const gate = (raw as { gateDisposition?: unknown }).gateDisposition;
  if (!gate || typeof gate !== 'object' || Array.isArray(gate)) return null;
  const statusValue = (gate as { status?: unknown }).status;
  const reasonsValue = (gate as { reasons?: unknown }).reasons;
  return {
    status: typeof statusValue === 'string' ? statusValue : null,
    reasons: Array.isArray(reasonsValue)
      ? reasonsValue.filter((value): value is string => typeof value === 'string').slice(0, 32)
      : [],
  };
}

function sameQualificationDevice(a: ValidationManifest, b: ValidationManifest): boolean {
  const af = a.deviceIdentity?.buildFingerprint ?? null;
  const bf = b.deviceIdentity?.buildFingerprint ?? null;
  return Boolean(af && bf && af === bf && a.buildId === b.buildId);
}

function readBoundedJsonLines(file: string): LoadTestSummary[] {
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size > MAX_PROGRESS_FILE_BYTES) return [];
    return fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .filter(Boolean)
      .slice(-MAX_PROGRESS_LINES_PER_SESSION)
      .map((line) => {
        try {
          const value = JSON.parse(line);
          return value && typeof value === 'object' && !Array.isArray(value)
            ? (value as LoadTestSummary)
            : null;
        } catch {
          return null;
        }
      })
      .filter((value): value is LoadTestSummary => value !== null);
  } catch {
    return [];
  }
}

/**
 * Count only evidence that was actually written under a validation session with
 * the same exact build and machine-captured device fingerprint. The UI never
 * increments a local counter and cannot make an uncaptured run "count".
 */
export function computeQualificationProgress(
  validationLogRoot: string,
  activeManifest: ValidationManifest | null
): QualificationProgress | null {
  const activeFingerprint = activeManifest?.deviceIdentity?.buildFingerprint ?? null;
  if (!activeManifest || !activeFingerprint) return null;
  let renderCompleted = 0;
  let boundaryAttempts = 0;
  let entries: fs.Dirent[] = [];
  try {
    entries = fs
      .readdirSync(validationLogRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .slice(0, MAX_PROGRESS_SESSIONS);
  } catch {
    return {
      target: 3,
      renderCompleted,
      boundaryAttempts,
      buildId: activeManifest.buildId,
      deviceBuildFingerprint: activeFingerprint,
    };
  }

  for (const entry of entries) {
    if (!isValidSessionLabel(entry.name)) continue;
    const raw = readJsonFile(path.join(validationLogRoot, entry.name, 'manifest.json'));
    const validated = validateValidationManifest(raw);
    if (!validated.ok) continue;
    const manifest = validated.manifest;
    if (manifest.worktree !== 'clean' || !sameQualificationDevice(activeManifest, manifest)) continue;
    const lines = readBoundedJsonLines(
      path.join(validationLogRoot, entry.name, 'loadtest-results.jsonl')
    );
    for (const summary of lines) {
      if (
        summary.profileName === 'quest-3s-qualification' &&
        summary.xrActive === true &&
        summary.aborted === false
      ) {
        renderCompleted += 1;
      }
      if (
        summary.profileName === 'quest-3s-rust-boundary-10m' &&
        summary.xrActive === true
      ) {
        boundaryAttempts += 1;
      }
    }
  }

  return {
    target: 3,
    renderCompleted,
    boundaryAttempts,
    buildId: activeManifest.buildId,
    deviceBuildFingerprint: activeFingerprint,
  };
}

function sessionMatches(
  activeSession: ValidationSessionIdentity | null,
  requestSession: ValidationSessionIdentity | null
): activeSession is ValidationSessionIdentity {
  return Boolean(
    activeSession &&
      requestSession &&
      activeSession.label === requestSession.label &&
      activeSession.id === requestSession.id
  );
}

function wantsReceipt(headers: Record<string, string | string[] | undefined>): boolean {
  return firstHeader(headers[VALIDATION_RECEIPT_VERSION_HEADER]) === VALIDATION_RECEIPT_VERSION;
}

function makeReceipt(
  session: ValidationSessionIdentity,
  artifact: string,
  progress: QualificationProgress | null
): ValidationDeliveryReceipt {
  return {
    version: '1',
    status: 'captured',
    receivedAt: new Date().toISOString(),
    artifact,
    sessionLabel: session.label,
    sessionId: session.id,
    progress,
  };
}

/**
 * The request handler mounted by `loadtestResultsPlugin`. Exported separately so
 * tests can exercise the real routing/write path with mocked req/res and a temp
 * logs root. Returns true when it handled the request.
 */
export function createLoadTestResultsHandler(
  options: LoadTestSinkOptions = {}
): (req: IncomingMessage, res: ServerResponse) => boolean {
  const logDir = options.logDir ?? path.resolve(process.cwd(), 'logs');
  const logFile = path.join(logDir, 'loadtest-results.jsonl');
  const validationLogRoot = path.join(logDir, 'validation');
  const activeSession =
    options.activeSession !== undefined
      ? options.activeSession
      : readValidationSessionEnv(process.env);

  try {
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  } catch {
    // Ignore error
  }

  function handleStatus(req: IncomingMessage, res: ServerResponse): boolean {
    if (req.url !== VALIDATION_STATUS_ENDPOINT || req.method !== 'GET') return false;
    const requestSession = readPostValidationSession(
      req.headers as Record<string, string | string[] | undefined>
    );
    if (!sessionMatches(activeSession, requestSession)) {
      jsonError(res, 409, 'request does not match the active validation session');
      return true;
    }
    const manifest = readSessionManifest(validationLogRoot, activeSession);
    if (!manifest) {
      jsonError(res, 409, 'active validation manifest is unavailable or invalid');
      return true;
    }
    jsonOk(res, {
      status: 'ok',
      sessionLabel: activeSession.label,
      sessionId: activeSession.id,
      manifest,
      progress: computeQualificationProgress(validationLogRoot, manifest),
      gateDisposition: readGateDisposition(validationLogRoot, activeSession.label),
    });
    return true;
  }

  function handleUx(req: IncomingMessage, res: ServerResponse): boolean {
    if (req.url !== VALIDATION_UX_ENDPOINT || req.method !== 'POST') return false;
    const requestSession = readPostValidationSession(
      req.headers as Record<string, string | string[] | undefined>
    );
    if (!sessionMatches(activeSession, requestSession)) {
      jsonError(res, 409, 'guided UX evidence does not match the active validation session');
      return true;
    }
    const manifest = readSessionManifest(validationLogRoot, activeSession);
    if (!manifest || manifest.validationMode !== 'quest-ux') {
      jsonError(res, 409, 'guided UX evidence requires an active quest-ux manifest');
      return true;
    }
    return handleBoundedJsonPost<GuidedUxSubmission>(req, res, MAX_BODY_BYTES, (submission, response) => {
      const errors = validateGuidedUxSubmission(submission);
      if (errors.length > 0) {
        jsonError(response, 400, errors[0]);
        return;
      }
      if (
        submission.sessionId !== activeSession.id ||
        submission.sessionLabel !== activeSession.label ||
        submission.buildId !== manifest.buildId ||
        submission.deviceBuildFingerprint !== (manifest.deviceIdentity?.buildFingerprint ?? null)
      ) {
        jsonError(response, 409, 'guided UX evidence identity does not match the active manifest');
        return;
      }
      const evidenceDir = path.join(validationLogRoot, activeSession.label);
      try {
        fs.mkdirSync(evidenceDir, { recursive: true });
        fs.writeFileSync(
          path.join(evidenceDir, 'ux-results.json'),
          `${JSON.stringify({
            schemaVersion: submission.schemaVersion,
            sessionId: submission.sessionId,
            sessionLabel: submission.sessionLabel,
            buildId: submission.buildId,
            deviceBuildFingerprint: submission.deviceBuildFingerprint,
            evidenceKind: submission.evidenceKind,
            results: submission.results,
            completedAt: submission.completedAt,
          }, null, 2)}\n`,
          'utf8'
        );
        fs.writeFileSync(
          path.join(evidenceDir, 'comfort-observation.json'),
          `${JSON.stringify({
            schemaVersion: submission.schemaVersion,
            sessionId: submission.sessionId,
            sessionLabel: submission.sessionLabel,
            buildId: submission.buildId,
            deviceBuildFingerprint: submission.deviceBuildFingerprint,
            ...submission.comfortObservation,
          }, null, 2)}\n`,
          'utf8'
        );
      } catch (error) {
        console.error('[validation-ux] failed to write guided UX evidence:', error);
        jsonError(response, 500, 'write failed');
        return;
      }
      jsonOk(response, {
        status: 'ok',
        receipt: makeReceipt(
          activeSession,
          'ux-results.json + comfort-observation.json',
          computeQualificationProgress(validationLogRoot, manifest)
        ),
      });
    });
  }

  function handleLoadTest(req: IncomingMessage, res: ServerResponse): boolean {
    if (req.url !== '/__loadtest-results' || req.method !== 'POST') return false;
    const headers = req.headers as Record<string, string | string[] | undefined>;
    const postSession = readPostValidationSession(headers);
    const routing = resolveLoadTestSink({
      activeSession,
      postSession,
      genericSinkFile: logFile,
      validationLogRoot,
    });
    if (routing.mismatch) {
      console.warn(
        `[loadtest-results] POST declares session '${routing.sessionLabel}' which does not match ` +
          `the active validation session; routed to the generic sink (no mixing)`
      );
    }
    return handleBoundedJsonPost<LoadTestSummary>(req, res, MAX_BODY_BYTES, (summary, response) => {
      if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
        jsonError(response, 400, 'expected a summary object');
        return;
      }
      try {
        if (routing.kind === 'session') {
          fs.mkdirSync(path.dirname(routing.file), { recursive: true });
        }
        fs.appendFileSync(routing.file, JSON.stringify(summary) + '\n', 'utf-8');
      } catch (err) {
        console.error('[loadtest-results] failed to append summary:', err);
        jsonError(response, 500, 'write failed');
        return;
      }
      const verdict = summary.verdict ?? {};
      const profileName = isShortString(summary.profileName, 128) ? summary.profileName : '?';
      const line =
        `[LOAD TEST] ${profileName} | XR=${summary.xrActive} | ` +
        `sufficientTo=${verdict.jsPathSufficientTo} warrantedAt=${verdict.commandBufferWarrantedAt}`;
      // eslint-disable-next-line no-console
      console.log(`\x1b[35m${line}\x1b[0m`);

      // Backwards-compatible default response for ordinary dev/legacy clients.
      if (!wantsReceipt(headers) || routing.kind !== 'session' || !activeSession) {
        jsonOk(response, { status: 'ok' });
        return;
      }
      const manifest = readSessionManifest(validationLogRoot, activeSession);
      if (!manifest) {
        jsonError(response, 409, 'evidence was written but active manifest confirmation failed');
        return;
      }
      jsonOk(response, {
        status: 'ok',
        receipt: makeReceipt(
          activeSession,
          'loadtest-results.jsonl',
          computeQualificationProgress(validationLogRoot, manifest)
        ),
      });
    });
  }

  return (req, res) => handleStatus(req, res) || handleUx(req, res) || handleLoadTest(req, res);
}

export function loadtestResultsPlugin(options: LoadTestSinkOptions = {}): Plugin {
  const handleLoadTest = createLoadTestResultsHandler(options);
  return {
    name: 'nemosyne-loadtest-results',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        if (!handleLoadTest(req, res)) next();
      });
    },
  };
}
