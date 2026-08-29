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

interface LoadTestSummary {
  profileName?: unknown;
  xrActive?: unknown;
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

  function handleLoadTest(req: IncomingMessage, res: ServerResponse): boolean {
    if (req.url !== '/__loadtest-results' || req.method !== 'POST') return false;
    const postSession = readPostValidationSession(
      req.headers as Record<string, string | string[] | undefined>
    );
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
      // One JSON object per line (JSONL). The body cap already bounds total size.
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
      // Echo a compact verdict line to the dev console (bound the strings).
      const verdict = summary.verdict ?? {};
      const profileName = isShortString(summary.profileName, 128) ? summary.profileName : '?';
      const line =
        `[LOAD TEST] ${profileName} | XR=${summary.xrActive} | ` +
        `sufficientTo=${verdict.jsPathSufficientTo} warrantedAt=${verdict.commandBufferWarrantedAt}`;
      // eslint-disable-next-line no-console
      console.log(`\x1b[35m${line}\x1b[0m`);
      jsonOk(response, { status: 'ok' });
    });
  }

  return handleLoadTest;
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
