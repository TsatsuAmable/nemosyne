import {
  validateValidationManifest,
  type ValidationManifest,
} from './validation-manifest.ts';
import {
  readValidationSessionEnv,
  type ValidationSessionIdentity,
} from './validation-session.ts';

export const VALIDATION_MANIFEST_ENV = 'VITE_NEMOSYNE_VALIDATION_MANIFEST_JSON';

export interface BrowserValidationContext {
  session: ValidationSessionIdentity;
  manifest: ValidationManifest;
  /** True only when the launcher-provided session id/label and manifest agree. */
  attributable: boolean;
  /** Human-readable reason when browser projection had to fail closed. */
  attributionIssue: string | null;
}

function envString(env: Record<string, unknown>, key: string): string | null {
  const value = env[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Read the exact launcher-owned validation manifest from Vite-visible env.
 *
 * This is deliberately a projection, not a second validation authority:
 * - the Node launcher derives + validates the manifest before Vite starts;
 * - the browser re-validates the same serialized manifest schema;
 * - the browser session label/id must match the separately propagated session
 *   headers contract before the context is considered attributable.
 *
 * Ordinary development does not set the manifest env and therefore returns null.
 */
export function readBrowserValidationContext(
  env: Record<string, unknown>
): BrowserValidationContext | null {
  const raw = envString(env, VALIDATION_MANIFEST_ENV);
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const validated = validateValidationManifest(parsed);
  if (!validated.ok) return null;

  const session = readValidationSessionEnv(env);
  if (!session) {
    return {
      session: {
        label: validated.manifest.sessionLabel,
        id: validated.manifest.sessionId,
      },
      manifest: validated.manifest,
      attributable: false,
      attributionIssue: 'validation manifest is present but the browser session identity is missing or malformed',
    };
  }

  const attributable =
    session.label === validated.manifest.sessionLabel &&
    session.id === validated.manifest.sessionId;

  return {
    session,
    manifest: validated.manifest,
    attributable,
    attributionIssue: attributable
      ? null
      : 'browser session identity does not match the launcher-owned validation manifest',
  };
}

export function validationContextSummary(context: BrowserValidationContext): string {
  const { manifest } = context;
  const device = manifest.deviceIdentity;
  const build = manifest.buildId.slice(0, 7);
  const deviceLabel = device
    ? `${device.model} / ${device.buildIncremental}`
    : 'device identity unavailable';
  const eligibility = manifest.promotionEligible ? 'ELIGIBLE' : 'NOT ELIGIBLE';
  return `${manifest.validationMode} · ${build} · ${deviceLabel} · ${eligibility}`;
}
