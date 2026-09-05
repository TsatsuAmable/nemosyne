import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin, ViteDevServer } from 'vite';
import {
  readValidationSessionEnv,
  type ValidationSessionIdentity,
} from '../src/validation/validation-session.ts';
import {
  VALIDATION_STATUS_ENDPOINT,
  VALIDATION_UX_ENDPOINT,
} from '../src/validation/validation-delivery.ts';
import { jsonError, jsonOk } from './http-utils.ts';
import { readPostValidationSession } from './loadtest-server.ts';
import {
  finalizeValidationSession,
  getValidationFinalizationStatus,
  isValidationSessionFinalized,
} from './validation-finalizer.ts';

export const VALIDATION_FINALIZATION_STATUS_ENDPOINT = '/__validation-finalization-status';
const LOAD_TEST_ENDPOINT = '/__loadtest-results';

export interface ValidationFinalizationPluginOptions {
  activeSession?: ValidationSessionIdentity | null;
  /** Override `<cwd>/logs` in tests. */
  logDir?: string;
}

function sameSession(
  active: ValidationSessionIdentity | null,
  request: ValidationSessionIdentity | null
): active is ValidationSessionIdentity {
  return Boolean(
    active &&
      request &&
      active.label === request.label &&
      active.id === request.id
  );
}

function finalizeQuietly(validationLogRoot: string, sessionLabel: string): void {
  const result = finalizeValidationSession({ validationLogRoot, sessionLabel });
  if (result.status === 'failed' || result.status === 'tamper-detected') {
    console.error(`[validation-finalization] ${sessionLabel}: ${result.status}: ${result.reason}`);
  }
}

/**
 * QV4/QV8 dev-server guard layered in front of the existing evidence sink.
 *
 * It does not replace collection. Matching successful evidence writes flow to
 * the existing sink unchanged, then the frozen evidence is finalized after the
 * response completes. Once custody exists, later mutation attempts for the same
 * governed session fail closed instead of silently altering certified evidence.
 */
export function createValidationFinalizationHandler(
  options: ValidationFinalizationPluginOptions = {}
): (req: IncomingMessage, res: ServerResponse) => boolean {
  const logDir = options.logDir ?? path.resolve(process.cwd(), 'logs');
  const validationLogRoot = path.join(logDir, 'validation');
  const activeSession =
    options.activeSession !== undefined
      ? options.activeSession
      : readValidationSessionEnv(process.env);

  return (req, res): boolean => {
    if (!activeSession) return false;
    const requestSession = readPostValidationSession(
      req.headers as Record<string, string | string[] | undefined>
    );
    if (!sameSession(activeSession, requestSession)) return false;

    const evidenceDir = path.join(validationLogRoot, activeSession.label);

    if (req.method === 'GET' && req.url === VALIDATION_FINALIZATION_STATUS_ENDPOINT) {
      const status = getValidationFinalizationStatus(evidenceDir);
      if (status.state === 'tamper-detected') {
        jsonError(res, 409, status.reason ?? 'finalized validation evidence failed custody verification');
      } else {
        jsonOk(res, {
          status: 'ok',
          sessionLabel: activeSession.label,
          sessionId: activeSession.id,
          finalization: status,
        });
      }
      return true;
    }

    // Existing Device Validation status must fail closed if a formerly finalized
    // session has been altered, rather than displaying the stale disposition.
    if (req.method === 'GET' && req.url === VALIDATION_STATUS_ENDPOINT) {
      const status = getValidationFinalizationStatus(evidenceDir);
      if (status.state === 'tamper-detected') {
        jsonError(res, 409, status.reason ?? 'finalized validation evidence failed custody verification');
        return true;
      }
      return false;
    }

    const isEvidencePost =
      req.method === 'POST' &&
      (req.url === LOAD_TEST_ENDPOINT || req.url === VALIDATION_UX_ENDPOINT);
    if (!isEvidencePost) return false;

    if (isValidationSessionFinalized(evidenceDir)) {
      const status = getValidationFinalizationStatus(evidenceDir);
      if (status.state === 'tamper-detected') {
        jsonError(res, 409, status.reason ?? 'finalized validation evidence failed custody verification');
      } else {
        jsonError(
          res,
          409,
          `validation session is finalized and write-locked (bundle ${status.bundleDigest ?? 'unknown'})`
        );
      }
      return true;
    }

    res.once('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        finalizeQuietly(validationLogRoot, activeSession.label);
      }
    });
    return false;
  };
}

export function validationFinalizationPlugin(
  options: ValidationFinalizationPluginOptions = {}
): Plugin {
  const handle = createValidationFinalizationHandler(options);
  const logDir = options.logDir ?? path.resolve(process.cwd(), 'logs');
  const validationLogRoot = path.join(logDir, 'validation');
  const activeSession =
    options.activeSession !== undefined
      ? options.activeSession
      : readValidationSessionEnv(process.env);

  return {
    name: 'nemosyne-validation-finalization',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      // Crash/restart recovery: if raw terminal evidence was persisted before a
      // previous server exited, finish the same deterministic finalization now.
      if (activeSession) finalizeQuietly(validationLogRoot, activeSession.label);
      server.middlewares.use((req, res, next) => {
        if (!handle(req, res)) next();
      });
    },
  };
}
