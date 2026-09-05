/**
 * UX trace recorder composition.
 *
 * Owns recorder construction while the application composition root supplies
 * the exact runtime capabilities and callback wiring it needs. Development may
 * flush traces to the dev endpoint; production must remain local-only.
 *
 * This composition layer is also the policy boundary for production tracing:
 * - production construction is fail-closed unless explicitly enabled;
 * - event-bus callbacks are consent-gated before they can build spatial context;
 * - validation-session identity is accepted only as one canonical validated pair;
 * - development tracing can be pinned on so a runtime settings toggle cannot
 *   silently remove validation evidence.
 */

import {
  UXTraceRecorder,
  type SessionManifestInfo,
  type UXTraceRecorderOptions,
} from '../vr/trace/UXTraceRecorder.ts';
import {
  readValidationSessionEnv,
  VALIDATION_SESSION_ID_ENV,
  VALIDATION_SESSION_LABEL_ENV,
} from '../validation/validation-session.ts';

export interface DevTraceBindings {
  recorderOptions: UXTraceRecorderOptions;
  bind(recorder: UXTraceRecorder): void;
}

export interface DevTraceSetupOptions {
  /**
   * Whether the recorder may use its network transport. Defaults to the Vite
   * development flag so production composition is fail-closed even if the
   * same-origin trace route exists or is accidentally proxied.
   */
  allowNetworkFlush?: boolean;
  /**
   * Pin recording on regardless of later setEnabled(false) calls. Defaults to
   * the Vite development flag so governed dev/Quest validation evidence cannot
   * be silently disabled by the production-only settings toggle.
   */
  alwaysEnabled?: boolean;
}

type TraceEventBus = NonNullable<UXTraceRecorderOptions['eventBus']>;

/**
 * Gate event-bus delivery before UXTraceRecorder's handlers execute. This is
 * deliberately earlier than the recorder sink because those handlers build a
 * spatial context (head/gaze/hand/UI state) before pushing a record.
 */
function consentGatedEventBus(
  eventBus: TraceEventBus | null | undefined,
  isEnabled: () => boolean
): TraceEventBus | null | undefined {
  if (!eventBus) return eventBus;
  return {
    on(topic, handler) {
      return eventBus.on(topic, (payload) => {
        if (!isEnabled()) return;
        handler(payload);
      });
    },
  };
}

/**
 * Validation identity is an atomic chain-of-custody fact. A malformed or
 * half-present label/id pair is omitted rather than exported as plausible
 * correlation metadata.
 */
function canonicalizeManifest(
  manifest: Partial<SessionManifestInfo>
): Partial<SessionManifestInfo> {
  const {
    validationSessionLabel: _validationSessionLabel,
    validationSessionId: _validationSessionId,
    ...rest
  } = manifest;
  const session = readValidationSessionEnv({
    [VALIDATION_SESSION_LABEL_ENV]: manifest.validationSessionLabel,
    [VALIDATION_SESSION_ID_ENV]: manifest.validationSessionId,
  });
  return session
    ? {
        ...rest,
        validationSessionLabel: session.label,
        validationSessionId: session.id,
      }
    : rest;
}

/**
 * Recorder variant used by the application composition root. The base recorder
 * remains responsible for trace mechanics; this subclass enforces app policy.
 */
class PolicyUXTraceRecorder extends UXTraceRecorder {
  private readonly _alwaysEnabled: boolean;

  constructor(options: UXTraceRecorderOptions, alwaysEnabled: boolean) {
    super(options);
    this._alwaysEnabled = alwaysEnabled;
    if (alwaysEnabled) super.setEnabled(true);
  }

  override setEnabled(value: boolean): void {
    super.setEnabled(this._alwaysEnabled || value);
  }

  override recordSessionManifest(manifest: Partial<SessionManifestInfo> = {}): void {
    super.recordSessionManifest(canonicalizeManifest(manifest));
  }
}

export function setupDevTraceRecorder(
  bindings: DevTraceBindings,
  options: DevTraceSetupOptions = {}
): UXTraceRecorder {
  const allowNetworkFlush = options.allowNetworkFlush ?? import.meta.env.DEV;
  const alwaysEnabled = options.alwaysEnabled ?? import.meta.env.DEV;

  // No production interaction should be observed between construction and the
  // bootstrap's persisted-consent check. Dev remains on by policy; production
  // defaults off unless a caller explicitly supplies enabled:true.
  const requestedInitialEnabled = bindings.recorderOptions.enabled;
  const initialEnabled = alwaysEnabled ? true : (requestedInitialEnabled ?? false);

  let recorder: UXTraceRecorder | null = null;
  const gatedEventBus = consentGatedEventBus(
    bindings.recorderOptions.eventBus,
    () => recorder?.enabled === true
  );

  const baseOptions: UXTraceRecorderOptions = {
    ...bindings.recorderOptions,
    eventBus: gatedEventBus,
    enabled: initialEnabled,
  };
  const recorderOptions: UXTraceRecorderOptions = allowNetworkFlush
    ? baseOptions
    : {
        ...baseOptions,
        // Production UX trace is an on-device export feature. Replace the
        // transport at composition time rather than relying on a 404 from a
        // deployment route: no production trace bytes can reach fetch().
        fetchImpl: async () => ({ ok: false, status: 404 }),
      };

  recorder = new PolicyUXTraceRecorder(recorderOptions, alwaysEnabled);
  bindings.bind(recorder);
  return recorder;
}
