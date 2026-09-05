import { createHmac, randomUUID } from 'node:crypto';
import { chmodSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import {
  DERIVED_GESTURE_AUTHORITY_REFERENCE,
  DERIVED_GESTURE_NOTICE_REFERENCE,
  DERIVED_GESTURE_OBSERVATION_FAMILY_ID,
  DERIVED_GESTURE_RETENTION_ARTIFACT,
  GESTURE_LEARNING_GOVERNED_EVENT_REGISTRY_V1,
  GOVERNED_PURPOSES,
  RAW_GESTURE_CONSENT_AUTHORITY_REFERENCE,
  RAW_GESTURE_NOTICE_REFERENCE,
  RAW_GESTURE_PROTOCOL_AUTHORITY_REFERENCE,
  RAW_GESTURE_PROTOCOL_POLICY_REFERENCE,
  RAW_GESTURE_RETENTION_ARTIFACT,
  RAW_GESTURE_TRAJECTORY_FAMILY_ID,
  admitGovernedEventEnvelopeV1,
  canonicalGovernedJsonV1,
  type AuthorizationEvidenceV1,
  type GovernanceAdmissionAuthorityV1,
  type GovernanceAuthorityContextV1,
  type GovernanceAuthorityDecisionV1,
  type ImmutableReferenceV1,
  type JsonValue,
} from '../governance/index.ts';
import { canonicalJsonStringify, sha256Hex } from '../security/CryptoHash.ts';
import {
  derivePurposePseudonymV1,
  type AuthenticatedPrincipalV1,
  type VersionedSecretKeyV1,
} from './ProductAnalyticsConsentAuthority.ts';

const SCHEMA_VERSION = '1' as const;
const DEFAULT_CAPTURE_AUTHORIZATION_TTL_MS = 30_000;
const PHYSICAL_DELETE_GRACE_MS = 24 * 60 * 60 * 1000;
const MAX_EXPORT_RECORDS = 5_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PURPOSE_PSEUDONYM_PATTERN = /^ppv1_[A-Za-z0-9._-]{1,32}_[0-9a-f]{64}$/;
const DELETION_HANDLE_DOMAIN = Buffer.from('nemosyne:deletion-handle:v1\n', 'utf8');

export type GestureLearningPurpose =
  | typeof GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING
  | typeof GOVERNED_PURPOSES.RAW_TRAJECTORY_RESEARCH;

export type GestureLearningFamilyId =
  | typeof DERIVED_GESTURE_OBSERVATION_FAMILY_ID
  | typeof RAW_GESTURE_TRAJECTORY_FAMILY_ID;

export type GestureLearningConsentStatus = 'GRANTED' | 'DENIED';

export interface GestureLearningConsentStateV1 {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly purpose: GestureLearningPurpose;
  readonly status: GestureLearningConsentStatus;
  readonly revision: string | null;
  readonly receipt: AuthorizationEvidenceV1 | null;
  readonly profilePseudonymId: string | null;
  readonly effectiveAt: string | null;
}

export interface GestureLearningGrantRequestV1 {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly purpose: GestureLearningPurpose;
  readonly notice: ImmutableReferenceV1;
  readonly confirmed: true;
  readonly actionId: string;
  readonly expectedPriorRevision: string | null;
}

export interface GestureLearningRevocationRequestV1 {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly purpose: GestureLearningPurpose;
  readonly actionId: string;
  readonly expectedCurrentRevision: string;
}

export interface GestureLearningCaptureAuthorizationRequestV1 {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly familyId: GestureLearningFamilyId;
  readonly eventId: string;
  readonly producerInstanceId: string;
  readonly streamId: string;
  readonly streamSequence: number;
  readonly protocolEvidence: AuthorizationEvidenceV1 | null;
}

export interface GestureLearningCaptureAuthorizationV1 {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly authorizationId: string;
  readonly purpose: GestureLearningPurpose;
  readonly familyId: GestureLearningFamilyId;
  readonly eventId: string;
  readonly producerInstanceId: string;
  readonly streamId: string;
  readonly streamSequence: number;
  readonly receipt: AuthorizationEvidenceV1;
  readonly protocolEvidence: AuthorizationEvidenceV1 | null;
  readonly profilePseudonymId: string;
  readonly authorizedAt: string;
  readonly expiresAt: string;
}

export type GestureLearningEventDispositionStatus =
  | 'STORED'
  | 'EXACT_DUPLICATE'
  | 'REFUSED_GOVERNANCE'
  | 'EVENT_ID_CONFLICT'
  | 'STREAM_OWNERSHIP_CONFLICT'
  | 'SEQUENCE_CONFLICT'
  | 'GAP_REFUSED'
  | 'STORAGE_FAILURE';

export interface GestureLearningEventDispositionV1 {
  readonly eventId: string | null;
  readonly status: GestureLearningEventDispositionStatus;
  readonly reasonCode: string | null;
}

export interface GestureLearningExportRequestV1 {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly actionId: string;
  readonly purpose: GestureLearningPurpose;
  readonly from: string;
  readonly to: string;
}

export interface GestureLearningExportResultV1 {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly purpose: GestureLearningPurpose;
  readonly recordCount: number;
  readonly contentType: 'application/x-ndjson';
  readonly body: string;
}

export interface GestureLearningErasureRequestV1 {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly actionId: string;
  readonly purpose: GestureLearningPurpose;
  readonly expectedConsentRevision: string;
}

export interface GestureLearningErasureResultV1 {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly actionId: string;
  readonly purpose: GestureLearningPurpose;
  readonly erasedEvents: number;
  readonly erasedCaptureAuthorizations: number;
  readonly result: 'SERVICE_SCOPE_RESOLVED';
  readonly dispositions: readonly Readonly<{ artifact: string; disposition: string }>[];
}

export interface GestureLearningRetentionReadinessV1 {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly readyForIngestion: boolean;
  readonly overduePhysicalDeletes: number;
  readonly purgedEvents: number;
}

export type GestureLearningAuthorityErrorCode =
  | 'INVALID_REQUEST'
  | 'CONSENT_REVISION_CONFLICT'
  | 'ACTION_ID_CONFLICT'
  | 'CONSENT_REQUIRED'
  | 'PROTOCOL_REQUIRED'
  | 'EXPORT_LIMIT_REFUSED'
  | 'LIFECYCLE_UNHEALTHY'
  | 'STORAGE_CONFIGURATION_INVALID';

export class GestureLearningAuthorityError extends Error {
  constructor(readonly code: GestureLearningAuthorityErrorCode, message: string) {
    super(message);
    this.name = 'GestureLearningAuthorityError';
  }
}

export interface SqliteGestureLearningGovernanceOptionsV1 {
  readonly dataDirectory: string;
  readonly purposePseudonymKey: VersionedSecretKeyV1;
  readonly deletionHandleKey: VersionedSecretKeyV1;
  readonly rawProtocolEvidence: AuthorizationEvidenceV1;
  readonly now?: () => Date;
  readonly uuid?: () => string;
  readonly captureAuthorizationTtlMs?: number;
}

interface ConsentRow {
  readonly revision: number;
  readonly status: GestureLearningConsentStatus;
  readonly receipt_json: string | null;
  readonly profile_pseudonym_id: string | null;
  readonly effective_at: string;
}

interface CaptureRow {
  readonly authorization_id: string;
  readonly purpose: GestureLearningPurpose;
  readonly producer_instance_id: string;
  readonly stream_id: string;
  readonly stream_sequence: number;
  readonly family_id: GestureLearningFamilyId;
  readonly consent_revision: number;
  readonly receipt_json: string;
  readonly protocol_json: string | null;
  readonly profile_pseudonym_id: string;
  readonly authorized_at: string;
  readonly expires_at: string;
  readonly consumed_at: string | null;
  readonly invalidated_at: string | null;
}

interface StreamRow {
  readonly principal_handle: string;
  readonly purpose: GestureLearningPurpose;
  readonly producer_instance_id: string;
  readonly profile_pseudonym_id: string;
  readonly family_id: GestureLearningFamilyId;
  readonly mode: string;
  readonly next_sequence: number;
}

interface StoredEventRow {
  readonly content_digest: string;
}

interface ExportRow {
  readonly event_id: string;
  readonly envelope_json: string;
  readonly server_received_at: string;
}

interface IdempotencyRow {
  readonly request_digest: string;
  readonly response_json: string;
}

function exactKeys(value: object, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((entry, index) => entry !== wanted[index])) {
    throw new GestureLearningAuthorityError('INVALID_REQUEST', `${label} must contain exactly ${wanted.join(', ')}`);
  }
}

function assertUuid(value: string, label: string): void {
  if (!UUID_PATTERN.test(value)) throw new GestureLearningAuthorityError('INVALID_REQUEST', `${label} must be a UUID`);
}

function assertActionId(value: string): void {
  assertUuid(value, 'actionId');
}

function assertRevision(value: string, label: string): void {
  if (!/^[1-9][0-9]*$/.test(value)) throw new GestureLearningAuthorityError('INVALID_REQUEST', `${label} must be a positive revision`);
}

function assertEvidence(value: AuthorizationEvidenceV1, label: string): void {
  exactKeys(value, ['id', 'revision', 'digest'], label);
  if (!/^[A-Za-z0-9._:-]{1,160}$/.test(value.id)) throw new GestureLearningAuthorityError('INVALID_REQUEST', `${label}.id is invalid`);
  if (!/^[A-Za-z0-9._:-]{1,80}$/.test(value.revision)) throw new GestureLearningAuthorityError('INVALID_REQUEST', `${label}.revision is invalid`);
  exactKeys(value.digest, ['algorithm', 'value'], `${label}.digest`);
  if (value.digest.algorithm !== 'SHA256' || !/^[0-9a-f]{64}$/.test(value.digest.value)) {
    throw new GestureLearningAuthorityError('INVALID_REQUEST', `${label}.digest is invalid`);
  }
}

function sameJson(left: unknown, right: unknown): boolean {
  return canonicalJsonStringify(left) === canonicalJsonStringify(right);
}

function familyPurpose(familyId: GestureLearningFamilyId): GestureLearningPurpose {
  return familyId === DERIVED_GESTURE_OBSERVATION_FAMILY_ID
    ? GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING
    : GOVERNED_PURPOSES.RAW_TRAJECTORY_RESEARCH;
}

function purposeNotice(purpose: GestureLearningPurpose): ImmutableReferenceV1 {
  return purpose === GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING
    ? DERIVED_GESTURE_NOTICE_REFERENCE
    : RAW_GESTURE_NOTICE_REFERENCE;
}

function retentionMs(purpose: GestureLearningPurpose): number {
  const days = purpose === GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING
    ? DERIVED_GESTURE_RETENTION_ARTIFACT.maximumRetentionDays
    : RAW_GESTURE_RETENTION_ARTIFACT.maximumRetentionDays;
  return days * 24 * 60 * 60 * 1000;
}

function frame(values: readonly string[]): Buffer {
  const chunks: Buffer[] = [];
  for (const value of values) {
    const bytes = Buffer.from(value, 'utf8');
    const length = Buffer.allocUnsafe(4);
    length.writeUInt32BE(bytes.byteLength, 0);
    chunks.push(length, bytes);
  }
  return Buffer.concat(chunks);
}

function deriveDeletionHandle(principal: AuthenticatedPrincipalV1, secret: VersionedSecretKeyV1): string {
  if (!secret.version || secret.key.byteLength < 32) {
    throw new GestureLearningAuthorityError('STORAGE_CONFIGURATION_INVALID', 'deletion handle key is invalid');
  }
  const digest = createHmac('sha256', secret.key)
    .update(DELETION_HANDLE_DOMAIN)
    .update(frame([principal.issuer, principal.subject]))
    .digest('hex');
  return `dhv1_${secret.version}_${digest}`;
}

function refusal(reasonCode: string): GovernanceAuthorityDecisionV1 {
  return Object.freeze({ status: 'REFUSED', reasonCode, message: 'governed gesture-learning event refused' });
}

function parseDate(value: string, label: string): Date {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) {
    throw new GestureLearningAuthorityError('INVALID_REQUEST', `${label} must be a canonical UTC timestamp`);
  }
  return date;
}

export class SqliteGestureLearningGovernanceV1 {
  private readonly db: DatabaseSync;
  private readonly purposePseudonymKey: VersionedSecretKeyV1;
  private readonly deletionHandleKey: VersionedSecretKeyV1;
  private readonly rawProtocolEvidence: AuthorizationEvidenceV1;
  private readonly now: () => Date;
  private readonly uuid: () => string;
  private readonly captureAuthorizationTtlMs: number;

  constructor(options: SqliteGestureLearningGovernanceOptionsV1) {
    if (!options.purposePseudonymKey.version || options.purposePseudonymKey.key.byteLength < 32) {
      throw new GestureLearningAuthorityError('STORAGE_CONFIGURATION_INVALID', 'purpose pseudonym key is invalid');
    }
    if (!options.deletionHandleKey.version || options.deletionHandleKey.key.byteLength < 32) {
      throw new GestureLearningAuthorityError('STORAGE_CONFIGURATION_INVALID', 'deletion handle key is invalid');
    }
    assertEvidence(options.rawProtocolEvidence, 'rawProtocolEvidence');
    const ttl = options.captureAuthorizationTtlMs ?? DEFAULT_CAPTURE_AUTHORIZATION_TTL_MS;
    if (!Number.isInteger(ttl) || ttl < 1_000 || ttl > 300_000) {
      throw new GestureLearningAuthorityError('STORAGE_CONFIGURATION_INVALID', 'capture authorization TTL must be between 1 and 300 seconds');
    }

    this.purposePseudonymKey = options.purposePseudonymKey;
    this.deletionHandleKey = options.deletionHandleKey;
    this.rawProtocolEvidence = Object.freeze({
      ...options.rawProtocolEvidence,
      digest: Object.freeze({ ...options.rawProtocolEvidence.digest }),
    });
    this.now = options.now ?? (() => new Date());
    this.uuid = options.uuid ?? randomUUID;
    this.captureAuthorizationTtlMs = ttl;

    mkdirSync(options.dataDirectory, { recursive: true, mode: 0o700 });
    chmodSync(options.dataDirectory, 0o700);
    if ((statSync(options.dataDirectory).mode & 0o777) !== 0o700) {
      throw new GestureLearningAuthorityError('STORAGE_CONFIGURATION_INVALID', 'governance data directory must be mode 0700');
    }
    const databasePath = join(options.dataDirectory, 'governance.sqlite');
    this.db = new DatabaseSync(databasePath);
    chmodSync(databasePath, 0o600);
    this.db.exec('PRAGMA foreign_keys = ON');
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA synchronous = FULL');
    this.db.exec('PRAGMA secure_delete = ON');
    this.migrate();
  }

  close(): void {
    this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    this.db.close();
  }

  getCurrent(principal: AuthenticatedPrincipalV1, purpose: GestureLearningPurpose): GestureLearningConsentStateV1 {
    const handle = deriveDeletionHandle(principal, this.deletionHandleKey);
    return this.publicState(purpose, this.currentConsent(handle, purpose));
  }

  grant(principal: AuthenticatedPrincipalV1, request: GestureLearningGrantRequestV1): GestureLearningConsentStateV1 & { readonly actionId: string } {
    this.validateGrantRequest(request);
    const handle = deriveDeletionHandle(principal, this.deletionHandleKey);
    const requestDigest = sha256Hex(canonicalJsonStringify(request));
    return this.transaction(() => {
      const prior = this.getIdempotency<GestureLearningConsentStateV1 & { readonly actionId: string }>(
        handle,
        request.purpose,
        'GRANT',
        request.actionId,
        requestDigest,
      );
      if (prior) return prior;
      const current = this.currentConsent(handle, request.purpose);
      const currentRevision = current ? String(current.revision) : null;
      if (currentRevision !== request.expectedPriorRevision) {
        throw new GestureLearningAuthorityError('CONSENT_REVISION_CONFLICT', 'expected prior revision does not match current consent state');
      }
      const revision = (current?.revision ?? 0) + 1;
      const effectiveAt = this.serverNow();
      const profilePseudonymId = derivePurposePseudonymV1(principal, request.purpose, this.purposePseudonymKey);
      if (!PURPOSE_PSEUDONYM_PATTERN.test(profilePseudonymId)) {
        throw new GestureLearningAuthorityError('STORAGE_CONFIGURATION_INVALID', 'derived purpose pseudonym is invalid');
      }
      const receipt = this.createReceipt(request.purpose, revision, request.actionId, profilePseudonymId, effectiveAt);
      this.db.prepare(
        `INSERT INTO gesture_learning_consent_revisions
         (principal_handle, purpose, revision, status, notice_digest, receipt_json, profile_pseudonym_id, effective_at, action_id)
         VALUES (?, ?, ?, 'GRANTED', ?, ?, ?, ?, ?)`,
      ).run(
        handle,
        request.purpose,
        revision,
        purposeNotice(request.purpose).digest.value,
        canonicalJsonStringify(receipt),
        profilePseudonymId,
        effectiveAt,
        request.actionId,
      );
      const result = Object.freeze({ ...this.publicState(request.purpose, this.currentConsent(handle, request.purpose)), actionId: request.actionId });
      this.putIdempotency(handle, request.purpose, 'GRANT', request.actionId, requestDigest, result);
      return result;
    });
  }

  revoke(principal: AuthenticatedPrincipalV1, request: GestureLearningRevocationRequestV1): GestureLearningConsentStateV1 & { readonly actionId: string } {
    this.validateRevocationRequest(request);
    const handle = deriveDeletionHandle(principal, this.deletionHandleKey);
    const requestDigest = sha256Hex(canonicalJsonStringify(request));
    return this.transaction(() => {
      const prior = this.getIdempotency<GestureLearningConsentStateV1 & { readonly actionId: string }>(
        handle,
        request.purpose,
        'REVOKE',
        request.actionId,
        requestDigest,
      );
      if (prior) return prior;
      const current = this.currentConsent(handle, request.purpose);
      if (!current || current.status !== 'GRANTED' || String(current.revision) !== request.expectedCurrentRevision) {
        throw new GestureLearningAuthorityError('CONSENT_REVISION_CONFLICT', 'current granted revision does not match revocation request');
      }
      const revision = current.revision + 1;
      const effectiveAt = this.serverNow();
      this.db.prepare(
        `INSERT INTO gesture_learning_consent_revisions
         (principal_handle, purpose, revision, status, notice_digest, receipt_json, profile_pseudonym_id, effective_at, action_id)
         VALUES (?, ?, ?, 'DENIED', ?, NULL, NULL, ?, ?)`,
      ).run(handle, request.purpose, revision, purposeNotice(request.purpose).digest.value, effectiveAt, request.actionId);
      this.db.prepare(
        `UPDATE gesture_learning_capture_authorizations
         SET invalidated_at = ?
         WHERE principal_handle = ? AND purpose = ? AND consumed_at IS NULL AND invalidated_at IS NULL`,
      ).run(effectiveAt, handle, request.purpose);
      const result = Object.freeze({ ...this.publicState(request.purpose, this.currentConsent(handle, request.purpose)), actionId: request.actionId });
      this.putIdempotency(handle, request.purpose, 'REVOKE', request.actionId, requestDigest, result);
      return result;
    });
  }

  authorizeCapture(
    principal: AuthenticatedPrincipalV1,
    request: GestureLearningCaptureAuthorizationRequestV1,
  ): GestureLearningCaptureAuthorizationV1 {
    this.validateCaptureRequest(request);
    const purpose = familyPurpose(request.familyId);
    const handle = deriveDeletionHandle(principal, this.deletionHandleKey);
    return this.transaction(() => {
      const current = this.currentConsent(handle, purpose);
      if (!current || current.status !== 'GRANTED' || !current.receipt_json || !current.profile_pseudonym_id) {
        throw new GestureLearningAuthorityError('CONSENT_REQUIRED', `${purpose} consent is required`);
      }
      if (purpose === GOVERNED_PURPOSES.RAW_TRAJECTORY_RESEARCH) {
        if (!request.protocolEvidence || !sameJson(request.protocolEvidence, this.rawProtocolEvidence)) {
          throw new GestureLearningAuthorityError('PROTOCOL_REQUIRED', 'raw trajectory capture requires the configured frozen study protocol evidence');
        }
      } else if (request.protocolEvidence !== null) {
        throw new GestureLearningAuthorityError('INVALID_REQUEST', 'derived gesture capture must not carry research protocol evidence');
      }

      const prior = this.db.prepare(
        `SELECT response_json FROM gesture_learning_capture_authorizations
         WHERE principal_handle = ? AND purpose = ? AND event_id = ?`,
      ).get(handle, purpose, request.eventId) as { response_json: string } | undefined;
      if (prior) {
        const parsed = JSON.parse(prior.response_json) as GestureLearningCaptureAuthorizationV1;
        if (
          parsed.familyId !== request.familyId || parsed.producerInstanceId !== request.producerInstanceId ||
          parsed.streamId !== request.streamId || parsed.streamSequence !== request.streamSequence ||
          !sameJson(parsed.protocolEvidence, request.protocolEvidence)
        ) {
          throw new GestureLearningAuthorityError('ACTION_ID_CONFLICT', 'eventId is already bound to a different capture authorization');
        }
        return Object.freeze(parsed);
      }

      const authorizedAt = this.serverNow();
      const expiresAt = new Date(new Date(authorizedAt).getTime() + this.captureAuthorizationTtlMs).toISOString();
      const result = Object.freeze<GestureLearningCaptureAuthorizationV1>({
        schemaVersion: SCHEMA_VERSION,
        authorizationId: `glav1_${this.uuid()}`,
        purpose,
        familyId: request.familyId,
        eventId: request.eventId,
        producerInstanceId: request.producerInstanceId,
        streamId: request.streamId,
        streamSequence: request.streamSequence,
        receipt: JSON.parse(current.receipt_json) as AuthorizationEvidenceV1,
        protocolEvidence: request.protocolEvidence,
        profilePseudonymId: current.profile_pseudonym_id,
        authorizedAt,
        expiresAt,
      });
      this.db.prepare(
        `INSERT INTO gesture_learning_capture_authorizations
         (authorization_id, principal_handle, purpose, event_id, producer_instance_id, stream_id, stream_sequence,
          family_id, consent_revision, receipt_json, protocol_json, profile_pseudonym_id, authorized_at, expires_at, response_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        result.authorizationId,
        handle,
        purpose,
        request.eventId,
        request.producerInstanceId,
        request.streamId,
        request.streamSequence,
        request.familyId,
        current.revision,
        current.receipt_json,
        request.protocolEvidence ? canonicalJsonStringify(request.protocolEvidence) : null,
        current.profile_pseudonym_id,
        authorizedAt,
        expiresAt,
        canonicalJsonStringify(result),
      );
      return result;
    });
  }

  async ingestLine(principal: AuthenticatedPrincipalV1, jsonText: string): Promise<GestureLearningEventDispositionV1> {
    let disposition: GestureLearningEventDispositionV1 = Object.freeze({ eventId: null, status: 'REFUSED_GOVERNANCE', reasonCode: 'REFUSED_GOVERNANCE' });
    const authority: GovernanceAdmissionAuthorityV1 = {
      evaluate: async (context) => {
        const evaluated = this.evaluateAndStore(principal, context);
        disposition = evaluated.disposition;
        return evaluated.decision;
      },
    };
    const admitted = await admitGovernedEventEnvelopeV1(jsonText, GESTURE_LEARNING_GOVERNED_EVENT_REGISTRY_V1, authority);
    if (!admitted.ok && disposition.eventId === null) {
      return Object.freeze({ eventId: null, status: 'REFUSED_GOVERNANCE', reasonCode: admitted.issues[0]?.code ?? 'REFUSED_GOVERNANCE' });
    }
    return disposition;
  }

  exportRecords(principal: AuthenticatedPrincipalV1, request: GestureLearningExportRequestV1): GestureLearningExportResultV1 {
    this.validateExportRequest(request);
    const handle = deriveDeletionHandle(principal, this.deletionHandleKey);
    const now = this.serverNow();
    const rows = this.db.prepare(
      `SELECT event_id, envelope_json, server_received_at
       FROM governed_gesture_learning_events
       WHERE principal_handle = ? AND purpose = ? AND server_received_at >= ? AND server_received_at <= ?
         AND retention_delete_after > ?
       ORDER BY server_received_at ASC, event_id ASC
       LIMIT ?`,
    ).all(handle, request.purpose, request.from, request.to, now, MAX_EXPORT_RECORDS + 1) as unknown as ExportRow[];
    if (rows.length > MAX_EXPORT_RECORDS) {
      throw new GestureLearningAuthorityError('EXPORT_LIMIT_REFUSED', `export exceeds ${MAX_EXPORT_RECORDS} records`);
    }
    const manifest = Object.freeze({
      kind: 'MANIFEST',
      schemaVersion: SCHEMA_VERSION,
      purpose: request.purpose,
      recordCount: rows.length,
      from: request.from,
      to: request.to,
    });
    const lines = [canonicalJsonStringify(manifest), ...rows.map((row) => canonicalJsonStringify({
      kind: 'RECORD',
      serverReceivedAt: row.server_received_at,
      envelope: JSON.parse(row.envelope_json),
    }))];
    return Object.freeze({
      schemaVersion: SCHEMA_VERSION,
      purpose: request.purpose,
      recordCount: rows.length,
      contentType: 'application/x-ndjson' as const,
      body: `${lines.join('\n')}\n`,
    });
  }

  erase(principal: AuthenticatedPrincipalV1, request: GestureLearningErasureRequestV1): GestureLearningErasureResultV1 {
    this.validateErasureRequest(request);
    const handle = deriveDeletionHandle(principal, this.deletionHandleKey);
    const requestDigest = sha256Hex(canonicalJsonStringify(request));
    return this.transaction(() => {
      const prior = this.db.prepare(
        `SELECT request_digest, response_json FROM gesture_learning_erasure_actions
         WHERE principal_handle = ? AND purpose = ? AND action_id = ?`,
      ).get(handle, request.purpose, request.actionId) as IdempotencyRow | undefined;
      if (prior) {
        if (prior.request_digest !== requestDigest) throw new GestureLearningAuthorityError('ACTION_ID_CONFLICT', 'erasure actionId was reused with different content');
        return Object.freeze(JSON.parse(prior.response_json) as GestureLearningErasureResultV1);
      }
      const current = this.currentConsent(handle, request.purpose);
      if (!current || current.status !== 'DENIED' || String(current.revision) !== request.expectedConsentRevision) {
        throw new GestureLearningAuthorityError('CONSENT_REVISION_CONFLICT', 'erasure requires the exact current revoked consent revision');
      }
      const events = this.db.prepare(
        `DELETE FROM governed_gesture_learning_events WHERE principal_handle = ? AND purpose = ?`,
      ).run(handle, request.purpose);
      const captures = this.db.prepare(
        `DELETE FROM gesture_learning_capture_authorizations WHERE principal_handle = ? AND purpose = ?`,
      ).run(handle, request.purpose);
      this.db.prepare(
        `DELETE FROM governed_gesture_learning_streams
         WHERE principal_handle = ? AND purpose = ?`,
      ).run(handle, request.purpose);
      const result = Object.freeze<GestureLearningErasureResultV1>({
        schemaVersion: SCHEMA_VERSION,
        actionId: request.actionId,
        purpose: request.purpose,
        erasedEvents: Number(events.changes),
        erasedCaptureAuthorizations: Number(captures.changes),
        result: 'SERVICE_SCOPE_RESOLVED',
        dispositions: Object.freeze([
          Object.freeze({ artifact: 'CONSENT_REVISIONS', disposition: 'POLICY_GOVERNED_RETENTION' }),
          Object.freeze({ artifact: 'LOCAL_OFFLINE_ARTIFACTS', disposition: 'OUTSIDE_SERVICE_CONTROL' }),
        ]),
      });
      this.db.prepare(
        `INSERT INTO gesture_learning_erasure_actions
         (principal_handle, purpose, action_id, request_digest, response_json, effective_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(handle, request.purpose, request.actionId, requestDigest, canonicalJsonStringify(result), this.serverNow());
      return result;
    });
  }

  runRetention(): GestureLearningRetentionReadinessV1 {
    const now = this.serverNow();
    const purged = this.db.prepare(
      `DELETE FROM governed_gesture_learning_events WHERE physical_delete_deadline <= ?`,
    ).run(now);
    this.db.prepare(
      `DELETE FROM governed_gesture_learning_streams
       WHERE NOT EXISTS (
         SELECT 1 FROM governed_gesture_learning_events e
         WHERE e.stream_id = governed_gesture_learning_streams.stream_id
       )`,
    ).run();
    const overdue = this.db.prepare(
      `SELECT COUNT(*) AS count FROM governed_gesture_learning_events WHERE physical_delete_deadline <= ?`,
    ).get(now) as { count: number };
    return Object.freeze({
      schemaVersion: SCHEMA_VERSION,
      readyForIngestion: Number(overdue.count) === 0,
      overduePhysicalDeletes: Number(overdue.count),
      purgedEvents: Number(purged.changes),
    });
  }

  assertReadyForIngestion(): void {
    const readiness = this.runRetention();
    if (!readiness.readyForIngestion) {
      throw new GestureLearningAuthorityError('LIFECYCLE_UNHEALTHY', 'gesture-learning retention is overdue');
    }
  }

  private evaluateAndStore(
    principal: AuthenticatedPrincipalV1,
    context: GovernanceAuthorityContextV1,
  ): { readonly decision: GovernanceAuthorityDecisionV1; readonly disposition: GestureLearningEventDispositionV1 } {
    const envelope = context.envelope;
    const eventId = envelope.eventId;
    const familyId = context.family.familyId;
    if (familyId !== DERIVED_GESTURE_OBSERVATION_FAMILY_ID && familyId !== RAW_GESTURE_TRAJECTORY_FAMILY_ID) {
      return { decision: refusal('UNKNOWN_FAMILY'), disposition: { eventId, status: 'REFUSED_GOVERNANCE', reasonCode: 'UNKNOWN_FAMILY' } };
    }
    const purpose = familyPurpose(familyId);
    const handle = deriveDeletionHandle(principal, this.deletionHandleKey);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const current = this.currentConsent(handle, purpose);
      if (!current || current.status !== 'GRANTED' || !current.receipt_json || !current.profile_pseudonym_id) {
        this.db.exec('ROLLBACK');
        return { decision: refusal('CONSENT_REQUIRED'), disposition: { eventId, status: 'REFUSED_GOVERNANCE', reasonCode: 'CONSENT_REQUIRED' } };
      }
      if (envelope.purpose !== purpose || envelope.identities.profilePseudonymId !== current.profile_pseudonym_id) {
        this.db.exec('ROLLBACK');
        return { decision: refusal('PRINCIPAL_BINDING_MISMATCH'), disposition: { eventId, status: 'REFUSED_GOVERNANCE', reasonCode: 'PRINCIPAL_BINDING_MISMATCH' } };
      }

      const consentAuthorization = envelope.authorization.find((entry) => entry.basis === 'CONSENT_RECEIPT');
      const receipt = JSON.parse(current.receipt_json) as AuthorizationEvidenceV1;
      if (!consentAuthorization || !sameJson(consentAuthorization.evidence, receipt)) {
        this.db.exec('ROLLBACK');
        return { decision: refusal('RECEIPT_MISMATCH'), disposition: { eventId, status: 'REFUSED_GOVERNANCE', reasonCode: 'RECEIPT_MISMATCH' } };
      }
      if (purpose === GOVERNED_PURPOSES.RAW_TRAJECTORY_RESEARCH) {
        const protocolAuthorization = envelope.authorization.find((entry) => entry.basis === 'FROZEN_STUDY_PROTOCOL');
        if (!protocolAuthorization || !sameJson(protocolAuthorization.evidence, this.rawProtocolEvidence)) {
          this.db.exec('ROLLBACK');
          return { decision: refusal('PROTOCOL_REQUIRED'), disposition: { eventId, status: 'REFUSED_GOVERNANCE', reasonCode: 'PROTOCOL_REQUIRED' } };
        }
      }

      const prior = this.db.prepare(
        `SELECT content_digest FROM governed_gesture_learning_events
         WHERE principal_handle = ? AND purpose = ? AND event_id = ?`,
      ).get(handle, purpose, eventId) as StoredEventRow | undefined;
      if (prior) {
        this.db.exec('COMMIT');
        return prior.content_digest === envelope.contentDigest.value
          ? { decision: this.authorizedDecision(), disposition: { eventId, status: 'EXACT_DUPLICATE', reasonCode: null } }
          : { decision: refusal('EVENT_ID_CONFLICT'), disposition: { eventId, status: 'EVENT_ID_CONFLICT', reasonCode: 'EVENT_ID_CONFLICT' } };
      }

      const capture = this.db.prepare(
        `SELECT authorization_id, purpose, producer_instance_id, stream_id, stream_sequence, family_id,
                consent_revision, receipt_json, protocol_json, profile_pseudonym_id, authorized_at, expires_at,
                consumed_at, invalidated_at
         FROM gesture_learning_capture_authorizations
         WHERE principal_handle = ? AND purpose = ? AND event_id = ?`,
      ).get(handle, purpose, eventId) as CaptureRow | undefined;
      const now = this.serverNow();
      if (
        !capture || capture.consumed_at !== null || capture.invalidated_at !== null ||
        capture.consent_revision !== current.revision || capture.family_id !== familyId ||
        capture.producer_instance_id !== envelope.producerInstanceId || capture.stream_id !== envelope.streamId ||
        capture.stream_sequence !== envelope.streamSequence || capture.profile_pseudonym_id !== current.profile_pseudonym_id ||
        !sameJson(JSON.parse(capture.receipt_json), receipt) ||
        (purpose === GOVERNED_PURPOSES.RAW_TRAJECTORY_RESEARCH && (!capture.protocol_json || !sameJson(JSON.parse(capture.protocol_json), this.rawProtocolEvidence))) ||
        envelope.capturedAt < capture.authorized_at || envelope.capturedAt > capture.expires_at || now > capture.expires_at
      ) {
        this.db.exec('ROLLBACK');
        return { decision: refusal('CAPTURE_AUTHORIZATION_REFUSED'), disposition: { eventId, status: 'REFUSED_GOVERNANCE', reasonCode: 'CAPTURE_AUTHORIZATION_REFUSED' } };
      }

      const stream = this.db.prepare(
        `SELECT principal_handle, purpose, producer_instance_id, profile_pseudonym_id, family_id, mode, next_sequence
         FROM governed_gesture_learning_streams WHERE stream_id = ?`,
      ).get(envelope.streamId) as StreamRow | undefined;
      if (stream && (
        stream.principal_handle !== handle || stream.purpose !== purpose || stream.producer_instance_id !== envelope.producerInstanceId ||
        stream.profile_pseudonym_id !== current.profile_pseudonym_id || stream.family_id !== familyId || stream.mode !== envelope.mode
      )) {
        this.db.exec('ROLLBACK');
        return { decision: refusal('STREAM_OWNERSHIP_CONFLICT'), disposition: { eventId, status: 'STREAM_OWNERSHIP_CONFLICT', reasonCode: 'STREAM_OWNERSHIP_CONFLICT' } };
      }
      const nextSequence = stream?.next_sequence ?? 0;
      if (envelope.streamSequence > nextSequence) {
        this.db.exec('ROLLBACK');
        return { decision: refusal('GAP_REFUSED'), disposition: { eventId, status: 'GAP_REFUSED', reasonCode: 'GAP_REFUSED' } };
      }
      if (envelope.streamSequence < nextSequence) {
        this.db.exec('ROLLBACK');
        return { decision: refusal('SEQUENCE_CONFLICT'), disposition: { eventId, status: 'SEQUENCE_CONFLICT', reasonCode: 'SEQUENCE_CONFLICT' } };
      }
      if (!stream) {
        this.db.prepare(
          `INSERT INTO governed_gesture_learning_streams
           (stream_id, principal_handle, purpose, producer_instance_id, profile_pseudonym_id, family_id, mode, next_sequence)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
        ).run(envelope.streamId, handle, purpose, envelope.producerInstanceId, current.profile_pseudonym_id, familyId, envelope.mode);
      }

      const receivedAt = now;
      const receivedDate = new Date(receivedAt);
      const deleteAfter = new Date(receivedDate.getTime() + retentionMs(purpose)).toISOString();
      const physicalDeadline = new Date(new Date(deleteAfter).getTime() + PHYSICAL_DELETE_GRACE_MS).toISOString();
      this.db.prepare(
        `INSERT INTO governed_gesture_learning_events
         (principal_handle, purpose, event_id, stream_id, stream_sequence, family_id, content_digest, payload_digest,
          envelope_json, server_received_at, retention_delete_after, physical_delete_deadline)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        handle,
        purpose,
        eventId,
        envelope.streamId,
        envelope.streamSequence,
        familyId,
        envelope.contentDigest.value,
        envelope.payloadDigest.value,
        canonicalGovernedJsonV1(envelope as unknown as JsonValue),
        receivedAt,
        deleteAfter,
        physicalDeadline,
      );
      this.db.prepare('UPDATE governed_gesture_learning_streams SET next_sequence = ? WHERE stream_id = ?')
        .run(envelope.streamSequence + 1, envelope.streamId);
      const consumed = this.db.prepare(
        `UPDATE gesture_learning_capture_authorizations SET consumed_at = ?
         WHERE authorization_id = ? AND consumed_at IS NULL AND invalidated_at IS NULL`,
      ).run(receivedAt, capture.authorization_id);
      if (Number(consumed.changes) !== 1) throw new Error('capture authorization consumption race');
      this.db.exec('COMMIT');
      return { decision: this.authorizedDecision(), disposition: { eventId, status: 'STORED', reasonCode: null } };
    } catch {
      try { this.db.exec('ROLLBACK'); } catch { /* preserve original failure */ }
      return { decision: refusal('STORAGE_FAILURE'), disposition: { eventId, status: 'STORAGE_FAILURE', reasonCode: 'STORAGE_FAILURE' } };
    }
  }

  private validateGrantRequest(request: GestureLearningGrantRequestV1): void {
    exactKeys(request, ['schemaVersion', 'purpose', 'notice', 'confirmed', 'actionId', 'expectedPriorRevision'], 'grant request');
    if (request.schemaVersion !== SCHEMA_VERSION || request.confirmed !== true) throw new GestureLearningAuthorityError('INVALID_REQUEST', 'grant request is invalid');
    this.assertPurpose(request.purpose);
    assertActionId(request.actionId);
    if (request.expectedPriorRevision !== null) assertRevision(request.expectedPriorRevision, 'expectedPriorRevision');
    if (!sameJson(request.notice, purposeNotice(request.purpose))) throw new GestureLearningAuthorityError('INVALID_REQUEST', 'grant notice does not match the reviewed purpose notice');
  }

  private validateRevocationRequest(request: GestureLearningRevocationRequestV1): void {
    exactKeys(request, ['schemaVersion', 'purpose', 'actionId', 'expectedCurrentRevision'], 'revocation request');
    if (request.schemaVersion !== SCHEMA_VERSION) throw new GestureLearningAuthorityError('INVALID_REQUEST', 'revocation request is invalid');
    this.assertPurpose(request.purpose);
    assertActionId(request.actionId);
    assertRevision(request.expectedCurrentRevision, 'expectedCurrentRevision');
  }

  private validateCaptureRequest(request: GestureLearningCaptureAuthorizationRequestV1): void {
    exactKeys(request, ['schemaVersion', 'familyId', 'eventId', 'producerInstanceId', 'streamId', 'streamSequence', 'protocolEvidence'], 'capture request');
    if (request.schemaVersion !== SCHEMA_VERSION) throw new GestureLearningAuthorityError('INVALID_REQUEST', 'capture request is invalid');
    if (request.familyId !== DERIVED_GESTURE_OBSERVATION_FAMILY_ID && request.familyId !== RAW_GESTURE_TRAJECTORY_FAMILY_ID) {
      throw new GestureLearningAuthorityError('INVALID_REQUEST', 'unknown gesture-learning family');
    }
    assertUuid(request.eventId, 'eventId');
    const producerId = request.producerInstanceId.startsWith('piv1_') ? request.producerInstanceId.slice(5) : '';
    const streamId = request.streamId.startsWith('strv1_') ? request.streamId.slice(6) : '';
    assertUuid(producerId, 'producerInstanceId');
    assertUuid(streamId, 'streamId');
    if (!Number.isSafeInteger(request.streamSequence) || request.streamSequence < 0) {
      throw new GestureLearningAuthorityError('INVALID_REQUEST', 'streamSequence must be a non-negative safe integer');
    }
    if (request.protocolEvidence) assertEvidence(request.protocolEvidence, 'protocolEvidence');
  }

  private validateExportRequest(request: GestureLearningExportRequestV1): void {
    exactKeys(request, ['schemaVersion', 'actionId', 'purpose', 'from', 'to'], 'export request');
    if (request.schemaVersion !== SCHEMA_VERSION) throw new GestureLearningAuthorityError('INVALID_REQUEST', 'export request is invalid');
    this.assertPurpose(request.purpose);
    assertActionId(request.actionId);
    const from = parseDate(request.from, 'from');
    const to = parseDate(request.to, 'to');
    if (from.getTime() > to.getTime()) throw new GestureLearningAuthorityError('INVALID_REQUEST', 'export from must not exceed to');
  }

  private validateErasureRequest(request: GestureLearningErasureRequestV1): void {
    exactKeys(request, ['schemaVersion', 'actionId', 'purpose', 'expectedConsentRevision'], 'erasure request');
    if (request.schemaVersion !== SCHEMA_VERSION) throw new GestureLearningAuthorityError('INVALID_REQUEST', 'erasure request is invalid');
    this.assertPurpose(request.purpose);
    assertActionId(request.actionId);
    assertRevision(request.expectedConsentRevision, 'expectedConsentRevision');
  }

  private assertPurpose(purpose: GestureLearningPurpose): void {
    if (purpose !== GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING && purpose !== GOVERNED_PURPOSES.RAW_TRAJECTORY_RESEARCH) {
      throw new GestureLearningAuthorityError('INVALID_REQUEST', 'unsupported gesture-learning purpose');
    }
  }

  private publicState(purpose: GestureLearningPurpose, row: ConsentRow | null): GestureLearningConsentStateV1 {
    if (!row) return Object.freeze({ schemaVersion: SCHEMA_VERSION, purpose, status: 'DENIED', revision: null, receipt: null, profilePseudonymId: null, effectiveAt: null });
    return Object.freeze({
      schemaVersion: SCHEMA_VERSION,
      purpose,
      status: row.status,
      revision: String(row.revision),
      receipt: row.receipt_json ? JSON.parse(row.receipt_json) as AuthorizationEvidenceV1 : null,
      profilePseudonymId: row.profile_pseudonym_id,
      effectiveAt: row.effective_at,
    });
  }

  private currentConsent(handle: string, purpose: GestureLearningPurpose): ConsentRow | null {
    return (this.db.prepare(
      `SELECT revision, status, receipt_json, profile_pseudonym_id, effective_at
       FROM gesture_learning_consent_revisions
       WHERE principal_handle = ? AND purpose = ? ORDER BY revision DESC LIMIT 1`,
    ).get(handle, purpose) as ConsentRow | undefined) ?? null;
  }

  private createReceipt(
    purpose: GestureLearningPurpose,
    revision: number,
    actionId: string,
    profilePseudonymId: string,
    effectiveAt: string,
  ): AuthorizationEvidenceV1 {
    const body = Object.freeze({ schemaVersion: SCHEMA_VERSION, purpose, revision: String(revision), actionId, profilePseudonymId, effectiveAt, notice: purposeNotice(purpose) });
    return Object.freeze({
      id: `glcrv1_${this.uuid()}`,
      revision: String(revision),
      digest: Object.freeze({ algorithm: 'SHA256' as const, value: sha256Hex(canonicalJsonStringify(body)) }),
    });
  }

  private getIdempotency<T>(
    handle: string,
    purpose: GestureLearningPurpose,
    endpoint: string,
    actionId: string,
    requestDigest: string,
  ): T | null {
    const row = this.db.prepare(
      `SELECT request_digest, response_json FROM gesture_learning_idempotency
       WHERE principal_handle = ? AND purpose = ? AND endpoint = ? AND action_id = ?`,
    ).get(handle, purpose, endpoint, actionId) as IdempotencyRow | undefined;
    if (!row) return null;
    if (row.request_digest !== requestDigest) throw new GestureLearningAuthorityError('ACTION_ID_CONFLICT', 'actionId was reused with different content');
    return JSON.parse(row.response_json) as T;
  }

  private putIdempotency(
    handle: string,
    purpose: GestureLearningPurpose,
    endpoint: string,
    actionId: string,
    requestDigest: string,
    response: unknown,
  ): void {
    this.db.prepare(
      `INSERT INTO gesture_learning_idempotency
       (principal_handle, purpose, endpoint, action_id, request_digest, response_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(handle, purpose, endpoint, actionId, requestDigest, canonicalJsonStringify(response));
  }

  private serverNow(): string {
    const now = this.now();
    if (!Number.isFinite(now.getTime())) throw new GestureLearningAuthorityError('STORAGE_CONFIGURATION_INVALID', 'server clock is invalid');
    return now.toISOString();
  }

  private authorizedDecision(): GovernanceAuthorityDecisionV1 {
    return Object.freeze({ status: 'AUTHORIZED', decisionId: `gev1_${this.uuid()}`, authorityVersion: 'gesture-learning-governance-v1', evaluatedAt: this.serverNow() });
  }

  private transaction<T>(body: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = body();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      try { this.db.exec('ROLLBACK'); } catch { /* preserve original error */ }
      throw error;
    }
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS gesture_learning_consent_revisions (
        principal_handle TEXT NOT NULL,
        purpose TEXT NOT NULL,
        revision INTEGER NOT NULL CHECK (revision > 0),
        status TEXT NOT NULL CHECK (status IN ('GRANTED', 'DENIED')),
        notice_digest TEXT NOT NULL,
        receipt_json TEXT,
        profile_pseudonym_id TEXT,
        effective_at TEXT NOT NULL,
        action_id TEXT NOT NULL,
        PRIMARY KEY (principal_handle, purpose, revision)
      );
      CREATE INDEX IF NOT EXISTS gesture_learning_consent_current_idx
        ON gesture_learning_consent_revisions (principal_handle, purpose, revision DESC);

      CREATE TABLE IF NOT EXISTS gesture_learning_idempotency (
        principal_handle TEXT NOT NULL,
        purpose TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        action_id TEXT NOT NULL,
        request_digest TEXT NOT NULL,
        response_json TEXT NOT NULL,
        PRIMARY KEY (principal_handle, purpose, endpoint, action_id)
      );

      CREATE TABLE IF NOT EXISTS gesture_learning_capture_authorizations (
        authorization_id TEXT PRIMARY KEY,
        principal_handle TEXT NOT NULL,
        purpose TEXT NOT NULL,
        event_id TEXT NOT NULL,
        producer_instance_id TEXT NOT NULL,
        stream_id TEXT NOT NULL,
        stream_sequence INTEGER NOT NULL CHECK (stream_sequence >= 0),
        family_id TEXT NOT NULL,
        consent_revision INTEGER NOT NULL CHECK (consent_revision > 0),
        receipt_json TEXT NOT NULL,
        protocol_json TEXT,
        profile_pseudonym_id TEXT NOT NULL,
        authorized_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        response_json TEXT NOT NULL,
        consumed_at TEXT,
        invalidated_at TEXT,
        UNIQUE (principal_handle, purpose, event_id)
      );

      CREATE TABLE IF NOT EXISTS governed_gesture_learning_streams (
        stream_id TEXT PRIMARY KEY,
        principal_handle TEXT NOT NULL,
        purpose TEXT NOT NULL,
        producer_instance_id TEXT NOT NULL,
        profile_pseudonym_id TEXT NOT NULL,
        family_id TEXT NOT NULL,
        mode TEXT NOT NULL,
        next_sequence INTEGER NOT NULL CHECK (next_sequence >= 0)
      );

      CREATE TABLE IF NOT EXISTS governed_gesture_learning_events (
        principal_handle TEXT NOT NULL,
        purpose TEXT NOT NULL,
        event_id TEXT NOT NULL,
        stream_id TEXT NOT NULL REFERENCES governed_gesture_learning_streams(stream_id),
        stream_sequence INTEGER NOT NULL CHECK (stream_sequence >= 0),
        family_id TEXT NOT NULL,
        content_digest TEXT NOT NULL,
        payload_digest TEXT NOT NULL,
        envelope_json TEXT NOT NULL,
        server_received_at TEXT NOT NULL,
        retention_delete_after TEXT NOT NULL,
        physical_delete_deadline TEXT NOT NULL,
        PRIMARY KEY (principal_handle, purpose, event_id),
        UNIQUE (stream_id, stream_sequence)
      );
      CREATE INDEX IF NOT EXISTS governed_gesture_learning_export_idx
        ON governed_gesture_learning_events (principal_handle, purpose, server_received_at, event_id);
      CREATE INDEX IF NOT EXISTS governed_gesture_learning_retention_idx
        ON governed_gesture_learning_events (physical_delete_deadline);

      CREATE TABLE IF NOT EXISTS gesture_learning_erasure_actions (
        principal_handle TEXT NOT NULL,
        purpose TEXT NOT NULL,
        action_id TEXT NOT NULL,
        request_digest TEXT NOT NULL,
        response_json TEXT NOT NULL,
        effective_at TEXT NOT NULL,
        PRIMARY KEY (principal_handle, purpose, action_id)
      );
    `);
  }
}

export const GESTURE_LEARNING_AUTHORIZATION_REFERENCES_V1 = Object.freeze({
  derived: Object.freeze({
    consentAuthority: DERIVED_GESTURE_AUTHORITY_REFERENCE,
    notice: DERIVED_GESTURE_NOTICE_REFERENCE,
  }),
  raw: Object.freeze({
    consentAuthority: RAW_GESTURE_CONSENT_AUTHORITY_REFERENCE,
    notice: RAW_GESTURE_NOTICE_REFERENCE,
    protocolAuthority: RAW_GESTURE_PROTOCOL_AUTHORITY_REFERENCE,
    protocolPolicy: RAW_GESTURE_PROTOCOL_POLICY_REFERENCE,
  }),
});
