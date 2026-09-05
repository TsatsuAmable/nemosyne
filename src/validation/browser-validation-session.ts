import {
  deriveValidationManifest,
  validateValidationManifest,
  type QuestDeviceIdentity,
  type ValidationManifest,
  type ValidationMode,
  type WorktreeState,
} from './validation-manifest.ts';
import {
  readValidationSessionEnv,
  type ValidationSessionIdentity,
} from './validation-session.ts';

export const VALIDATION_MANIFEST_ENV = 'VITE_NEMOSYNE_VALIDATION_MANIFEST_JSON';

export interface BrowserValidationContext {
  session: ValidationSessionIdentity;
  /** Provisional launcher-env projection until the sink returns the exact manifest. */
  manifest: ValidationManifest;
  /** True only when the browser session identity itself is complete and coherent. */
  attributable: boolean;
  /** Human-readable note about whether server confirmation is still required. */
  attributionIssue: string | null;
  source: 'serialized-manifest' | 'launcher-env-provisional';
}

function envString(env: Record<string, unknown>, key: string): string | null {
  const value = env[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function provisionalContext(env: Record<string, unknown>): BrowserValidationContext | null {
  const session = readValidationSessionEnv(env);
  const buildId = envString(env, 'VITE_NEMOSYNE_BUILD_ID');
  const mode = envString(env, 'VITE_NEMOSYNE_VALIDATION_MODE') as ValidationMode | null;
  const worktree = envString(env, 'VITE_NEMOSYNE_WORKTREE') as WorktreeState | null;
  if (
    !session ||
    !buildId ||
    !/^[0-9a-f]{40}$/i.test(buildId) ||
    !mode ||
    !['quest', 'quest-perf', 'quest-ux', 'quest-10m', 'quest-validate'].includes(mode) ||
    !worktree ||
    !['clean', 'dirty', 'unknown'].includes(worktree)
  ) {
    return null;
  }

  const identityBasis = envString(env, 'VITE_NEMOSYNE_QUEST_IDENTITY_BASIS');
  const model = envString(env, 'VITE_NEMOSYNE_QUEST_MODEL');
  const buildIncremental = envString(env, 'VITE_NEMOSYNE_QUEST_BUILD_INCREMENTAL');
  const buildFingerprint = envString(env, 'VITE_NEMOSYNE_QUEST_BUILD_FINGERPRINT');
  const deviceIdentity: QuestDeviceIdentity | null =
    identityBasis === 'adb-system-property' && model && buildIncremental && buildFingerprint
      ? {
          captureBasis: 'adb-system-property',
          model,
          manufacturer: null,
          buildIncremental,
          buildDisplayId: envString(env, 'VITE_NEMOSYNE_QUEST_BUILD_DISPLAY_ID'),
          buildFingerprint,
          securityPatch: envString(env, 'VITE_NEMOSYNE_QUEST_SECURITY_PATCH'),
        }
      : null;

  const manifest = deriveValidationManifest({
    sessionId: session.id,
    sessionLabel: session.label,
    buildId,
    worktree,
    mode,
    deviceIdentity,
    deviceIdentityError: deviceIdentity ? null : 'awaiting server-owned launcher manifest confirmation',
    declaredQuestModel: model,
    declaredFirmwareVersion: buildIncremental,
  });

  return {
    session,
    manifest,
    attributable: true,
    attributionIssue: 'launcher env projected; exact manifest confirmation is pending from the evidence sink',
    source: 'launcher-env-provisional',
  };
}

/**
 * Read browser validation identity without creating a new governance authority.
 *
 * Preferred path: validate an exact serialized launcher manifest when present.
 * Current launcher compatibility path: project only the already-propagated
 * session/build/ADB env fields and mark them provisional. The QV6 panel must
 * obtain the exact manifest from `/__validation-status` before enabling a
 * governed start.
 */
export function readBrowserValidationContext(
  env: Record<string, unknown>
): BrowserValidationContext | null {
  const raw = envString(env, VALIDATION_MANIFEST_ENV);
  if (!raw) return provisionalContext(env);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return provisionalContext(env);
  }

  const validated = validateValidationManifest(parsed);
  if (!validated.ok) return provisionalContext(env);

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
      source: 'serialized-manifest',
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
    source: 'serialized-manifest',
  };
}

export function validationContextSummary(context: BrowserValidationContext): string {
  const { manifest } = context;
  const device = manifest.deviceIdentity;
  const build = manifest.buildId.slice(0, 7);
  const deviceLabel = device
    ? `${device.model} / ${device.buildIncremental}`
    : 'device identity unavailable';
  const confirmation = context.source === 'serialized-manifest' ? 'CONFIRMED' : 'PENDING SINK';
  return `${manifest.validationMode} · ${build} · ${deviceLabel} · ${confirmation}`;
}
