/**
 * Shared validation-session identity contract between the QV launcher/dev
 * plugin and the browser runtime.
 *
 * This module is dependency-free (no Node, no DOM) so it can be imported by
 * the Vite dev plugin, the client runtime, the Node launcher, and tests alike.
 * It is the single authority for:
 * - the header names the client uses to tag load-test POSTs;
 * - the env keys the launcher sets and both sides read;
 * - the fail-closed label/id validators used before any session identity is
 *   allowed to name a local evidence path.
 */

export const VALIDATION_SESSION_LABEL_HEADER = 'x-nemosyne-validation-session';
export const VALIDATION_SESSION_ID_HEADER = 'x-nemosyne-validation-session-id';

export const VALIDATION_SESSION_LABEL_ENV = 'VITE_NEMOSYNE_VALIDATION_SESSION_LABEL';
export const VALIDATION_SESSION_ID_ENV = 'VITE_NEMOSYNE_VALIDATION_SESSION_ID';

/**
 * Session labels are launcher-generated (`<gate-or-mode>-<sha7>-<yyyymmddThhmmss>`)
 * but arrive from untrusted request headers on the server side, so they must be
 * validated before they may name a path component. Only a single safe component
 * is allowed: alphanumeric start, then `[A-Za-z0-9._-]`, bounded to 128 chars.
 */
const SESSION_LABEL_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SESSION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ValidationSessionIdentity {
  label: string;
  id: string;
}

export function isValidSessionLabel(value: unknown): value is string {
  return typeof value === 'string' && SESSION_LABEL_RE.test(value);
}

export function isValidSessionId(value: unknown): value is string {
  return typeof value === 'string' && SESSION_ID_RE.test(value);
}

/**
 * Read the validation-session identity from an env record (the launcher's
 * child-process env on the server side, or `import.meta.env` in the browser).
 * Fails closed: returns null unless both label and id are present and valid.
 */
export function readValidationSessionEnv(
  env: Record<string, unknown>
): ValidationSessionIdentity | null {
  const label = env[VALIDATION_SESSION_LABEL_ENV];
  const id = env[VALIDATION_SESSION_ID_ENV];
  if (!isValidSessionLabel(label) || !isValidSessionId(id)) return null;
  return { label, id };
}
