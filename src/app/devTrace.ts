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
 *   silently remove validation evidence;
 * - build/validation attribution is write-once outside the evictable event ring;
 * - application exports use a v2 whole-payload digest rather than v1 records-only integrity.
 */

import { canonicalSha256Hex } from '../security/CryptoHash.ts';
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

export const UX_TRACE_APP_EXPORT_SCHEMA_VERSION = 2 as const;
export const UX_TRACE_APP_INTEGRITY_ALGORITHM = 'NEMOSYNE_UX_TRACE_ENVELOPE_SHA256_V2' as const;

interface TraceExportRecord {
  sid?: unknown;
  type?: unknown;
  buildHash?: unknown;
  validationSessionLabel?: unknown;
  validationSessionId?: unknown;
  [key: string]: unknown;
}

interface LegacyTraceEnvelope {
  createdAt: string;
  exportedAt: string;
  sid: string;
  recordCount: number;
  droppedCount: number;
  firstSeq: number | null;
  lastSeq: number | null;
  traceOpen: boolean;
  endpointDead: boolean;
  records: TraceExportRecord[];
}

interface TraceEnvelopePayloadV2 extends LegacyTraceEnvelope {
  schemaVersion: typeof UX_TRACE_APP_EXPORT_SCHEMA_VERSION;
  buildHash?: string;
  validationSession?: { label: string; id: string };
}

export interface UXTraceAppExportEnvelopeV2 extends TraceEnvelopePayloadV2 {
  integrity: {
    algorithm: typeof UX_TRACE_APP_INTEGRITY_ALGORITHM;
    payloadSha256: string;
  };
}

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

function validationSessionFromManifest(
  manifest: Partial<SessionManifestInfo>
): { label: string; id: string } | null {
  return typeof manifest.validationSessionLabel === 'string' &&
    typeof manifest.validationSessionId === 'string'
    ? { label: manifest.validationSessionLabel, id: manifest.validationSessionId }
    : null;
}

/**
 * Recorder variant used by the application composition root. The base recorder
 * remains responsible for trace mechanics; this subclass enforces app policy
 * and the promotion-grade v2 export boundary.
 */
class PolicyUXTraceRecorder extends UXTraceRecorder {
  private readonly _alwaysEnabled: boolean;
  private _lockedBuildHash: string | null = null;
  private _lockedValidationSession: { label: string; id: string } | null = null;
  private _provenanceConflict: string | null = null;

  constructor(options: UXTraceRecorderOptions, alwaysEnabled: boolean) {
    super(options);
    this._alwaysEnabled = alwaysEnabled;
    if (alwaysEnabled) super.setEnabled(true);
  }

  override setEnabled(value: boolean): void {
    super.setEnabled(this._alwaysEnabled || value);
  }

  override recordSessionManifest(manifest: Partial<SessionManifestInfo> = {}): void {
    const canonical = canonicalizeManifest(manifest);
    this._lockProvenance(canonical);
    super.recordSessionManifest(canonical);
  }

  override exportJson(): string {
    if (this._provenanceConflict) {
      throw new Error(`UX trace provenance conflict: ${this._provenanceConflict}`);
    }

    // The base recorder remains the mechanics authority for lifecycle/export
    // snapshotting and ring-buffer bounds. Its v1 digest is intentionally not
    // carried forward because v2 authenticates the complete payload instead.
    const legacy = JSON.parse(super.exportJson()) as LegacyTraceEnvelope;
    this._crossCheckSurvivingManifests(legacy.records);

    const payload: TraceEnvelopePayloadV2 = {
      schemaVersion: UX_TRACE_APP_EXPORT_SCHEMA_VERSION,
      createdAt: legacy.createdAt,
      exportedAt: legacy.exportedAt,
      sid: legacy.sid,
      recordCount: legacy.recordCount,
      droppedCount: legacy.droppedCount,
      firstSeq: legacy.firstSeq,
      lastSeq: legacy.lastSeq,
      traceOpen: legacy.traceOpen,
      endpointDead: legacy.endpointDead,
      ...(this._lockedBuildHash ? { buildHash: this._lockedBuildHash } : {}),
      ...(this._lockedValidationSession
        ? { validationSession: { ...this._lockedValidationSession } }
        : {}),
      records: legacy.records,
    };

    const envelope: UXTraceAppExportEnvelopeV2 = {
      ...payload,
      integrity: {
        algorithm: UX_TRACE_APP_INTEGRITY_ALGORITHM,
        payloadSha256: canonicalSha256Hex(payload),
      },
    };
    return JSON.stringify(envelope, null, 2);
  }

  private _lockProvenance(manifest: Partial<SessionManifestInfo>): void {
    if (typeof manifest.buildHash === 'string' && manifest.buildHash.length > 0) {
      if (this._lockedBuildHash && this._lockedBuildHash !== manifest.buildHash) {
        this._provenanceConflict = `buildHash changed from ${this._lockedBuildHash} to ${manifest.buildHash}`;
      } else {
        this._lockedBuildHash = manifest.buildHash;
      }
    }

    const session = validationSessionFromManifest(manifest);
    if (session) {
      if (
        this._lockedValidationSession &&
        (this._lockedValidationSession.label !== session.label ||
          this._lockedValidationSession.id !== session.id)
      ) {
        this._provenanceConflict = `validation session changed from ${this._lockedValidationSession.label}/${this._lockedValidationSession.id} to ${session.label}/${session.id}`;
      } else {
        this._lockedValidationSession = session;
      }
    }
  }

  private _crossCheckSurvivingManifests(records: TraceExportRecord[]): void {
    for (const record of records) {
      if (record.type !== 'session-manifest') continue;

      if (
        this._lockedBuildHash &&
        typeof record.buildHash === 'string' &&
        record.buildHash !== this._lockedBuildHash
      ) {
        throw new Error(
          `UX trace provenance conflict: surviving manifest buildHash ${record.buildHash} does not match locked ${this._lockedBuildHash}`
        );
      }

      const label = record.validationSessionLabel;
      const id = record.validationSessionId;
      if (
        this._lockedValidationSession &&
        typeof label === 'string' &&
        typeof id === 'string' &&
        (label !== this._lockedValidationSession.label || id !== this._lockedValidationSession.id)
      ) {
        throw new Error(
          `UX trace provenance conflict: surviving manifest validation session ${label}/${id} does not match locked ${this._lockedValidationSession.label}/${this._lockedValidationSession.id}`
        );
      }
    }
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
