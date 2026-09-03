import { createHmac, randomUUID } from 'node:crypto';

import { canonicalJsonStringify, sha256Hex } from '../security/CryptoHash.ts';
import {
  GOVERNED_PURPOSES,
  PRODUCT_ANALYTICS_OPERATION_NOTICE_REFERENCE,
  PRODUCT_GOVERNED_EVENT_REGISTRY_V1,
  PRODUCT_OPERATION_FAMILY_ID,
  admitGovernedEventEnvelopeV1,
  canonicalGovernedJsonV1,
  type GovernanceAdmissionAuthorityV1,
  type GovernanceAuthorityContextV1,
  type GovernanceAuthorityDecisionV1,
  type JsonValue,
} from '../governance/index.ts';
import type { AuthorizationEvidenceV1 } from '../governance/GovernedEventContracts.ts';
import type {
  ProductAnalyticsConsentAuthorityPortV1,
  ProductAnalyticsEventIngestionPortV1,
  ProductAnalyticsGovernancePersistenceV1,
  ProductAnalyticsLifecycleAuthorityPortV1,
} from './GovernanceAuthorityPorts.ts';
import type { PostgresClientV1, PostgresPoolV1 } from './PostgresGovernanceDatabase.ts';
import {
  ProductAnalyticsAuthorityError,
  derivePurposePseudonymV1,
  type AuthenticatedPrincipalV1,
  type ProductAnalyticsCaptureAuthorizationRequestV1,
  type ProductAnalyticsCaptureAuthorizationV1,
  type ProductAnalyticsConsentStateV1,
  type ProductAnalyticsGrantRequestV1,
  type ProductAnalyticsGrantResultV1,
  type ProductAnalyticsRevocationRequestV1,
  type ProductAnalyticsRevocationResultV1,
  type VersionedSecretKeyV1,
} from './ProductAnalyticsConsentAuthority.ts';
import type { ProductEventDispositionStatus, ProductEventDispositionV1 } from './ProductAnalyticsEventIngestion.ts';
import {
  CONSENT_LIFECYCLE_ENFORCEMENT_RETENTION_ARTIFACT,
  ProductAnalyticsLifecycleError,
  type ProductAnalyticsErasureRequestV1,
  type ProductAnalyticsErasureResultV1,
  type ProductAnalyticsExportRequestV1,
  type ProductAnalyticsExportResultV1,
  type ProductAnalyticsLifecycleReadinessV1,
} from './ProductAnalyticsLifecycleAuthority.ts';

const SCHEMA = 'nemosyne_governance';
const PURPOSE = GOVERNED_PURPOSES.PRODUCT_ANALYTICS;
const SCHEMA_VERSION = '1' as const;
const CAPTURE_TTL_MS = 30_000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const PHYSICAL_DELETE_GRACE_MS = 24 * 60 * 60 * 1000;
const MAX_EXPORT_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_EXPORT_RECORDS = 100_000;
const MAX_EXPORT_BYTES = 100 * 1024 * 1024;
const EXPORT_DOMAIN = 'nemosyne:governed-export:v1\n';
const DELETION_HANDLE_DOMAIN = Buffer.from('nemosyne:deletion-handle:v1\n', 'utf8');
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const POSITIVE_DECIMAL_PATTERN = /^[1-9][0-9]*$/;

interface ConsentRow {
  readonly revision: number;
  readonly status: 'GRANTED' | 'DENIED';
  readonly receipt_json: string | null;
  readonly profile_pseudonym_id: string | null;
  readonly effective_at: string | Date;
}

interface CaptureRow {
  readonly authorization_id: string;
  readonly consent_revision: number;
  readonly producer_instance_id: string;
  readonly stream_id: string;
  readonly stream_sequence: number;
  readonly family_id: string;
  readonly receipt_json: string;
  readonly profile_pseudonym_id: string;
  readonly authorized_at: string | Date;
  readonly expires_at: string | Date;
  readonly consumed_at: string | Date | null;
  readonly invalidated_at: string | Date | null;
  readonly response_json: string;
}

interface StreamRow {
  readonly principal_handle: string;
  readonly producer_instance_id: string;
  readonly purpose: string;
  readonly profile_pseudonym_id: string;
  readonly family_id: string;
  readonly mode: string;
  readonly next_sequence: number;
}

interface EventRow {
  readonly content_digest: string;
}

interface ExportRow {
  readonly event_id: string;
  readonly envelope_json: string;
  readonly server_received_at: string | Date;
}

interface IdempotencyRow {
  readonly request_digest: string;
  readonly response_json: string;
}

interface ErasureActionRow {
  readonly request_digest: string;
  readonly response_json: string;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  }
  return value;
}

function exactKeys(value: object, expected: readonly string[], label: string, lifecycle = false): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length === wanted.length && actual.every((key, index) => key === wanted[index])) return;
  if (lifecycle) throw new ProductAnalyticsLifecycleError('INVALID_REQUEST', `${label} must contain exactly ${wanted.join(', ')}`);
  throw new ProductAnalyticsAuthorityError('INVALID_REQUEST', `${label} must contain exactly ${wanted.join(', ')}`);
}

function assertUuid(value: string, label: string, lifecycle = false): void {
  if (UUID_PATTERN.test(value)) return;
  if (lifecycle) throw new ProductAnalyticsLifecycleError('INVALID_REQUEST', `${label} must be a UUID`);
  throw new ProductAnalyticsAuthorityError('INVALID_REQUEST', `${label} must be a UUID`);
}

function assertPrincipal(principal: AuthenticatedPrincipalV1): void {
  exactKeys(principal, ['issuer', 'subject'], 'principal');
  if (!principal.issuer || !principal.subject || Buffer.byteLength(principal.issuer, 'utf8') > 2048 || Buffer.byteLength(principal.subject, 'utf8') > 256) {
    throw new ProductAnalyticsAuthorityError('INVALID_REQUEST', 'issuer and subject are required and bounded');
  }
}

function assertSecret(secret: VersionedSecretKeyV1, label: string): void {
  if (!/^[A-Za-z0-9._-]{1,32}$/.test(secret.version) || secret.key.byteLength < 32) {
    throw new ProductAnalyticsAuthorityError('STORAGE_CONFIGURATION_INVALID', `${label} requires a bounded version and at least 256 bits`);
  }
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

function deletionHandle(principal: AuthenticatedPrincipalV1, secret: VersionedSecretKeyV1): string {
  assertPrincipal(principal);
  assertSecret(secret, 'deletion handle key');
  return `dhv1_${secret.version}_${createHmac('sha256', secret.key).update(DELETION_HANDLE_DOMAIN).update(frame([principal.issuer, principal.subject])).digest('hex')}`;
}

function iso(value: string | Date): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error('database returned invalid timestamp');
  return parsed.toISOString();
}

function nowIso(now: () => Date): string {
  const value = now();
  if (!Number.isFinite(value.getTime())) throw new ProductAnalyticsAuthorityError('STORAGE_CONFIGURATION_INVALID', 'server clock returned an invalid time');
  return value.toISOString();
}

async function transaction<T>(pool: PostgresPoolV1, work: (client: PostgresClientV1) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
    const value = await work(client);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* preserve original failure */ }
    throw error;
  } finally {
    client.release();
  }
}

async function lockPrincipal(client: PostgresClientV1, handle: string): Promise<void> {
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`principal:${handle}`]);
}

async function lockStream(client: PostgresClientV1, streamId: string): Promise<void> {
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`stream:${streamId}`]);
}

async function currentConsent(database: PostgresClientV1 | PostgresPoolV1, handle: string, forUpdate = false): Promise<ConsentRow | null> {
  const result = await database.query<ConsentRow>(
    `SELECT revision, status, receipt_json, profile_pseudonym_id, effective_at
     FROM ${SCHEMA}.product_analytics_consent_revisions
     WHERE principal_handle = $1 AND purpose = $2
     ORDER BY revision DESC LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`,
    [handle, PURPOSE],
  );
  return result.rows[0] ?? null;
}

function publicConsent(row: ConsentRow | null): ProductAnalyticsConsentStateV1 {
  if (!row) return deepFreeze({ schemaVersion: SCHEMA_VERSION, purpose: PURPOSE, status: 'DENIED', revision: null, receipt: null, profilePseudonymId: null, effectiveAt: null });
  return deepFreeze({
    schemaVersion: SCHEMA_VERSION,
    purpose: PURPOSE,
    status: row.status,
    revision: String(row.revision),
    receipt: row.receipt_json ? JSON.parse(row.receipt_json) as AuthorizationEvidenceV1 : null,
    profilePseudonymId: row.profile_pseudonym_id,
    effectiveAt: iso(row.effective_at),
  });
}

function validateGrant(request: ProductAnalyticsGrantRequestV1): void {
  exactKeys(request, ['schemaVersion', 'purpose', 'notice', 'confirmed', 'actionId', 'expectedPriorRevision'], 'grant request');
  if (request.schemaVersion !== SCHEMA_VERSION || request.purpose !== PURPOSE || request.confirmed !== true || canonicalJsonStringify(request.notice) !== canonicalJsonStringify(PRODUCT_ANALYTICS_OPERATION_NOTICE_REFERENCE)) {
    throw new ProductAnalyticsAuthorityError('INVALID_REQUEST', 'grant must match the reviewed product-analytics notice');
  }
  assertUuid(request.actionId, 'actionId');
  if (request.expectedPriorRevision !== null && !POSITIVE_DECIMAL_PATTERN.test(request.expectedPriorRevision)) throw new ProductAnalyticsAuthorityError('INVALID_REQUEST', 'expectedPriorRevision must be canonical');
}

function validateRevoke(request: ProductAnalyticsRevocationRequestV1): void {
  exactKeys(request, ['schemaVersion', 'purpose', 'actionId', 'expectedCurrentRevision'], 'revocation request');
  if (request.schemaVersion !== SCHEMA_VERSION || request.purpose !== PURPOSE || !POSITIVE_DECIMAL_PATTERN.test(request.expectedCurrentRevision)) throw new ProductAnalyticsAuthorityError('INVALID_REQUEST', 'revocation request is invalid');
  assertUuid(request.actionId, 'actionId');
}

function validateCapture(request: ProductAnalyticsCaptureAuthorizationRequestV1): void {
  exactKeys(request, ['schemaVersion', 'familyId', 'eventId', 'producerInstanceId', 'streamId', 'streamSequence'], 'capture authorization request');
  if (request.schemaVersion !== SCHEMA_VERSION || request.familyId !== PRODUCT_OPERATION_FAMILY_ID) throw new ProductAnalyticsAuthorityError('INVALID_REQUEST', 'capture request schema/family mismatch');
  assertUuid(request.eventId, 'eventId');
  if (!/^piv1_[0-9a-f-]{36}$/i.test(request.producerInstanceId) || !/^strv1_[0-9a-f-]{36}$/i.test(request.streamId) || !Number.isSafeInteger(request.streamSequence) || request.streamSequence < 0) {
    throw new ProductAnalyticsAuthorityError('INVALID_REQUEST', 'capture coordinates are invalid');
  }
  assertUuid(request.producerInstanceId.slice(5), 'producerInstanceId');
  assertUuid(request.streamId.slice(6), 'streamId');
}

export interface PostgresProductAnalyticsPersistenceOptionsV1 {
  readonly pool: PostgresPoolV1;
  readonly purposePseudonymKey: VersionedSecretKeyV1;
  readonly deletionHandleKey: VersionedSecretKeyV1;
  readonly now?: () => Date;
  readonly uuid?: () => string;
  readonly captureAuthorizationTtlMs?: number;
}

export class PostgresProductAnalyticsPersistenceV1 implements ProductAnalyticsGovernancePersistenceV1, ProductAnalyticsConsentAuthorityPortV1, ProductAnalyticsEventIngestionPortV1, ProductAnalyticsLifecycleAuthorityPortV1 {
  readonly consentAuthority: ProductAnalyticsConsentAuthorityPortV1 = this;
  readonly eventIngestion: ProductAnalyticsEventIngestionPortV1 = this;
  readonly lifecycleAuthority: ProductAnalyticsLifecycleAuthorityPortV1 = this;
  private readonly now: () => Date;
  private readonly uuid: () => string;
  private readonly captureTtlMs: number;

  constructor(private readonly options: PostgresProductAnalyticsPersistenceOptionsV1) {
    assertSecret(options.purposePseudonymKey, 'purpose pseudonym key');
    assertSecret(options.deletionHandleKey, 'deletion handle key');
    this.now = options.now ?? (() => new Date());
    this.uuid = options.uuid ?? randomUUID;
    this.captureTtlMs = options.captureAuthorizationTtlMs ?? CAPTURE_TTL_MS;
    if (!Number.isInteger(this.captureTtlMs) || this.captureTtlMs < 1_000 || this.captureTtlMs > 300_000) throw new ProductAnalyticsAuthorityError('STORAGE_CONFIGURATION_INVALID', 'capture authorization TTL must be between 1 and 300 seconds');
  }

  async close(): Promise<void> {
    await this.options.pool.end();
  }

  async getCurrent(principal: AuthenticatedPrincipalV1): Promise<ProductAnalyticsConsentStateV1> {
    const handle = deletionHandle(principal, this.options.deletionHandleKey);
    return publicConsent(await currentConsent(this.options.pool, handle));
  }

  async grant(principal: AuthenticatedPrincipalV1, request: ProductAnalyticsGrantRequestV1): Promise<ProductAnalyticsGrantResultV1> {
    assertPrincipal(principal);
    validateGrant(request);
    const handle = deletionHandle(principal, this.options.deletionHandleKey);
    const requestDigest = sha256Hex(canonicalJsonStringify(request));
    return transaction(this.options.pool, async (client) => {
      await lockPrincipal(client, handle);
      const prior = await client.query<IdempotencyRow>(`SELECT request_digest, response_json FROM ${SCHEMA}.product_analytics_idempotency WHERE principal_handle = $1 AND endpoint = 'GRANT' AND action_id = $2 FOR UPDATE`, [handle, request.actionId]);
      if (prior.rows[0]) {
        if (prior.rows[0].request_digest !== requestDigest) throw new ProductAnalyticsAuthorityError('ACTION_ID_CONFLICT', 'action ID was already used with different content');
        return deepFreeze(JSON.parse(prior.rows[0].response_json) as ProductAnalyticsGrantResultV1);
      }
      const current = await currentConsent(client, handle, true);
      if (request.expectedPriorRevision !== (current ? String(current.revision) : null)) throw new ProductAnalyticsAuthorityError('CONSENT_REVISION_CONFLICT', 'expected prior consent revision does not match current state');
      const revision = (current?.revision ?? 0) + 1;
      const effectiveAt = nowIso(this.now);
      const profilePseudonymId = derivePurposePseudonymV1(principal, PURPOSE, this.options.purposePseudonymKey);
      const evidence = { schemaVersion: SCHEMA_VERSION, purpose: PURPOSE, revision: String(revision), notice: PRODUCT_ANALYTICS_OPERATION_NOTICE_REFERENCE, profilePseudonymId, effectiveAt, actionId: request.actionId };
      const receipt: AuthorizationEvidenceV1 = deepFreeze({ id: `crv1_${this.uuid()}`, revision: String(revision), digest: { algorithm: 'SHA256', value: sha256Hex(canonicalJsonStringify(evidence)) } });
      const receiptJson = canonicalJsonStringify(receipt);
      await client.query(`INSERT INTO ${SCHEMA}.product_analytics_consent_revisions (principal_handle, purpose, revision, status, notice_digest, receipt_json, profile_pseudonym_id, effective_at, action_id) VALUES ($1,$2,$3,'GRANTED',$4,$5,$6,$7,$8)`, [handle, PURPOSE, revision, PRODUCT_ANALYTICS_OPERATION_NOTICE_REFERENCE.digest.value, receiptJson, profilePseudonymId, effectiveAt, request.actionId]);
      const result = deepFreeze<ProductAnalyticsGrantResultV1>({ ...publicConsent({ revision, status: 'GRANTED', receipt_json: receiptJson, profile_pseudonym_id: profilePseudonymId, effective_at: effectiveAt }), actionId: request.actionId });
      await client.query(`INSERT INTO ${SCHEMA}.product_analytics_idempotency (principal_handle, endpoint, action_id, request_digest, response_json) VALUES ($1,'GRANT',$2,$3,$4)`, [handle, request.actionId, requestDigest, canonicalJsonStringify(result)]);
      return result;
    });
  }

  async revoke(principal: AuthenticatedPrincipalV1, request: ProductAnalyticsRevocationRequestV1): Promise<ProductAnalyticsRevocationResultV1> {
    assertPrincipal(principal);
    validateRevoke(request);
    const handle = deletionHandle(principal, this.options.deletionHandleKey);
    const requestDigest = sha256Hex(canonicalJsonStringify(request));
    return transaction(this.options.pool, async (client) => {
      await lockPrincipal(client, handle);
      const prior = await client.query<IdempotencyRow>(`SELECT request_digest, response_json FROM ${SCHEMA}.product_analytics_idempotency WHERE principal_handle = $1 AND endpoint = 'REVOKE' AND action_id = $2 FOR UPDATE`, [handle, request.actionId]);
      if (prior.rows[0]) {
        if (prior.rows[0].request_digest !== requestDigest) throw new ProductAnalyticsAuthorityError('ACTION_ID_CONFLICT', 'action ID was already used with different content');
        return deepFreeze(JSON.parse(prior.rows[0].response_json) as ProductAnalyticsRevocationResultV1);
      }
      const current = await currentConsent(client, handle, true);
      if (!current || current.status !== 'GRANTED' || String(current.revision) !== request.expectedCurrentRevision) throw new ProductAnalyticsAuthorityError('CONSENT_REVISION_CONFLICT', 'current granted consent revision does not match revocation request');
      const revision = current.revision + 1;
      const effectiveAt = nowIso(this.now);
      await client.query(`INSERT INTO ${SCHEMA}.product_analytics_consent_revisions (principal_handle,purpose,revision,status,notice_digest,receipt_json,profile_pseudonym_id,effective_at,action_id) VALUES ($1,$2,$3,'DENIED',$4,NULL,NULL,$5,$6)`, [handle, PURPOSE, revision, PRODUCT_ANALYTICS_OPERATION_NOTICE_REFERENCE.digest.value, effectiveAt, request.actionId]);
      await client.query(`UPDATE ${SCHEMA}.product_analytics_capture_authorizations SET invalidated_at = $1 WHERE principal_handle = $2 AND consumed_at IS NULL AND invalidated_at IS NULL`, [effectiveAt, handle]);
      const result = deepFreeze<ProductAnalyticsRevocationResultV1>({ ...publicConsent({ revision, status: 'DENIED', receipt_json: null, profile_pseudonym_id: null, effective_at: effectiveAt }), actionId: request.actionId });
      await client.query(`INSERT INTO ${SCHEMA}.product_analytics_idempotency (principal_handle, endpoint, action_id, request_digest, response_json) VALUES ($1,'REVOKE',$2,$3,$4)`, [handle, request.actionId, requestDigest, canonicalJsonStringify(result)]);
      return result;
    });
  }

  async authorizeCapture(principal: AuthenticatedPrincipalV1, request: ProductAnalyticsCaptureAuthorizationRequestV1): Promise<ProductAnalyticsCaptureAuthorizationV1> {
    assertPrincipal(principal);
    validateCapture(request);
    const handle = deletionHandle(principal, this.options.deletionHandleKey);
    return transaction(this.options.pool, async (client) => {
      await lockPrincipal(client, handle);
      const current = await currentConsent(client, handle, true);
      const receipt = current?.receipt_json ? JSON.parse(current.receipt_json) as AuthorizationEvidenceV1 : null;
      if (!current || current.status !== 'GRANTED' || !receipt || !current.profile_pseudonym_id) throw new ProductAnalyticsAuthorityError('CONSENT_REQUIRED', 'current product-analytics consent is required for capture authorization');
      const prior = await client.query<CaptureRow>(`SELECT authorization_id, consent_revision, producer_instance_id, stream_id, stream_sequence, family_id, receipt_json, profile_pseudonym_id, authorized_at, expires_at, consumed_at, invalidated_at, response_json FROM ${SCHEMA}.product_analytics_capture_authorizations WHERE principal_handle = $1 AND event_id = $2 FOR UPDATE`, [handle, request.eventId]);
      const existing = prior.rows[0];
      if (existing) {
        if (existing.invalidated_at !== null || existing.consent_revision !== current.revision) throw new ProductAnalyticsAuthorityError('ACTION_ID_CONFLICT', 'event ID belongs to invalidated or superseded capture authorization');
        const response = deepFreeze(JSON.parse(existing.response_json) as ProductAnalyticsCaptureAuthorizationV1);
        if (response.producerInstanceId === request.producerInstanceId && response.streamId === request.streamId && response.streamSequence === request.streamSequence && response.familyId === request.familyId) return response;
        throw new ProductAnalyticsAuthorityError('ACTION_ID_CONFLICT', 'event ID is already bound to different capture coordinates');
      }
      const authorizedAtDate = this.now();
      if (!Number.isFinite(authorizedAtDate.getTime())) throw new ProductAnalyticsAuthorityError('STORAGE_CONFIGURATION_INVALID', 'server clock returned an invalid time');
      const authorizedAt = authorizedAtDate.toISOString();
      const expiresAt = new Date(authorizedAtDate.getTime() + this.captureTtlMs).toISOString();
      const result = deepFreeze<ProductAnalyticsCaptureAuthorizationV1>({ schemaVersion: SCHEMA_VERSION, authorizationId: `cav1_${this.uuid()}`, eventId: request.eventId, producerInstanceId: request.producerInstanceId, streamId: request.streamId, streamSequence: request.streamSequence, familyId: PRODUCT_OPERATION_FAMILY_ID, receipt, profilePseudonymId: current.profile_pseudonym_id, authorizedAt, expiresAt });
      await client.query(`INSERT INTO ${SCHEMA}.product_analytics_capture_authorizations (authorization_id,principal_handle,event_id,producer_instance_id,stream_id,stream_sequence,family_id,consent_revision,receipt_json,profile_pseudonym_id,authorized_at,expires_at,response_json) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [result.authorizationId, handle, request.eventId, request.producerInstanceId, request.streamId, request.streamSequence, request.familyId, current.revision, canonicalJsonStringify(receipt), current.profile_pseudonym_id, authorizedAt, expiresAt, canonicalJsonStringify(result)]);
      return result;
    });
  }

  async ingestLine(principal: AuthenticatedPrincipalV1, jsonText: string): Promise<ProductEventDispositionV1> {
    let disposition: ProductEventDispositionV1 = Object.freeze({ eventId: null, status: 'REFUSED_GOVERNANCE', reasonCode: 'REFUSED_GOVERNANCE' });
    const authority: GovernanceAdmissionAuthorityV1 = { evaluate: async (context) => {
      const evaluated = await this.evaluateAndStore(principal, context);
      disposition = evaluated.disposition;
      return evaluated.decision;
    } };
    const admitted = await admitGovernedEventEnvelopeV1(jsonText, PRODUCT_GOVERNED_EVENT_REGISTRY_V1, authority);
    if (!admitted.ok && disposition.eventId === null) return Object.freeze({ eventId: null, status: 'REFUSED_GOVERNANCE', reasonCode: admitted.issues[0]?.code ?? 'REFUSED_GOVERNANCE' });
    return disposition;
  }

  private async evaluateAndStore(principal: AuthenticatedPrincipalV1, context: GovernanceAuthorityContextV1): Promise<{ decision: GovernanceAuthorityDecisionV1; disposition: ProductEventDispositionV1 }> {
    const envelope = context.envelope;
    const eventId = envelope.eventId;
    const refuse = (status: ProductEventDispositionStatus, reasonCode: string = status) => ({ decision: Object.freeze({ status: 'REFUSED' as const, reasonCode: status, message: 'governed product event refused' }), disposition: Object.freeze({ eventId, status, reasonCode }) });
    if (context.family.familyId !== PRODUCT_OPERATION_FAMILY_ID) return refuse('REFUSED_GOVERNANCE', 'UNKNOWN_FAMILY');
    const handle = deletionHandle(principal, this.options.deletionHandleKey);
    try {
      return await transaction(this.options.pool, async (client) => {
        await lockPrincipal(client, handle);
        await lockStream(client, envelope.streamId);
        const receivedAt = nowIso(this.now);
        const current = await currentConsent(client, handle, true);
        if (!current || current.status !== 'GRANTED' || !current.receipt_json || !current.profile_pseudonym_id) return refuse('REFUSED_GOVERNANCE', 'CONSENT_REQUIRED');
        if (envelope.identities.profilePseudonymId !== current.profile_pseudonym_id) return refuse('REFUSED_GOVERNANCE', 'PRINCIPAL_BINDING_MISMATCH');
        const receipt = JSON.parse(current.receipt_json) as AuthorizationEvidenceV1;
        const authorization = envelope.authorization[0];
        if (envelope.authorization.length !== 1 || !authorization || authorization.evidence.id !== receipt.id || authorization.evidence.revision !== receipt.revision || authorization.evidence.digest.algorithm !== receipt.digest.algorithm || authorization.evidence.digest.value !== receipt.digest.value) return refuse('REFUSED_GOVERNANCE', 'RECEIPT_MISMATCH');
        const priorResult = await client.query<EventRow>(`SELECT content_digest FROM ${SCHEMA}.governed_product_events WHERE principal_handle = $1 AND event_id = $2 FOR UPDATE`, [handle, eventId]);
        const prior = priorResult.rows[0];
        if (prior) {
          if (prior.content_digest !== envelope.contentDigest.value) return refuse('EVENT_ID_CONFLICT');
          return { decision: this.authorized(receivedAt), disposition: Object.freeze({ eventId, status: 'EXACT_DUPLICATE' as const, reasonCode: null }) };
        }
        const captureResult = await client.query<CaptureRow>(`SELECT authorization_id,consent_revision,producer_instance_id,stream_id,stream_sequence,family_id,receipt_json,profile_pseudonym_id,authorized_at,expires_at,consumed_at,invalidated_at,response_json FROM ${SCHEMA}.product_analytics_capture_authorizations WHERE principal_handle = $1 AND event_id = $2 FOR UPDATE`, [handle, eventId]);
        const capture = captureResult.rows[0];
        if (!capture || capture.consumed_at !== null || capture.invalidated_at !== null || capture.consent_revision !== current.revision || capture.producer_instance_id !== envelope.producerInstanceId || capture.stream_id !== envelope.streamId || capture.stream_sequence !== envelope.streamSequence || capture.family_id !== envelope.eventFamilyId || capture.profile_pseudonym_id !== current.profile_pseudonym_id || canonicalGovernedJsonV1(JSON.parse(capture.receipt_json)) !== canonicalGovernedJsonV1(receipt as unknown as JsonValue) || envelope.capturedAt < iso(capture.authorized_at) || envelope.capturedAt > iso(capture.expires_at) || receivedAt > iso(capture.expires_at)) return refuse('REFUSED_GOVERNANCE', 'CAPTURE_AUTHORIZATION_REFUSED');
        const streamResult = await client.query<StreamRow>(`SELECT principal_handle,producer_instance_id,purpose,profile_pseudonym_id,family_id,mode,next_sequence FROM ${SCHEMA}.governed_product_streams WHERE stream_id = $1 FOR UPDATE`, [envelope.streamId]);
        const stream = streamResult.rows[0];
        if (stream && (stream.principal_handle !== handle || stream.producer_instance_id !== envelope.producerInstanceId || stream.purpose !== envelope.purpose || stream.profile_pseudonym_id !== current.profile_pseudonym_id || stream.family_id !== envelope.eventFamilyId || stream.mode !== envelope.mode)) return refuse('STREAM_OWNERSHIP_CONFLICT');
        const nextSequence = stream?.next_sequence ?? 0;
        if (envelope.streamSequence > nextSequence) return refuse('GAP_REFUSED');
        if (envelope.streamSequence < nextSequence) return refuse('SEQUENCE_CONFLICT');
        if (!stream) await client.query(`INSERT INTO ${SCHEMA}.governed_product_streams (stream_id,principal_handle,producer_instance_id,purpose,profile_pseudonym_id,family_id,mode,next_sequence) VALUES ($1,$2,$3,$4,$5,$6,$7,0)`, [envelope.streamId, handle, envelope.producerInstanceId, envelope.purpose, current.profile_pseudonym_id, envelope.eventFamilyId, envelope.mode]);
        const received = new Date(receivedAt).getTime();
        const retentionDeleteAfter = new Date(received + THIRTY_DAYS_MS).toISOString();
        const physicalDeleteDeadline = new Date(received + THIRTY_DAYS_MS + PHYSICAL_DELETE_GRACE_MS).toISOString();
        await client.query(`INSERT INTO ${SCHEMA}.governed_product_events (principal_handle,event_id,stream_id,stream_sequence,content_digest,payload_digest,envelope_json,server_received_at,retention_delete_after,physical_delete_deadline) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [handle, eventId, envelope.streamId, envelope.streamSequence, envelope.contentDigest.value, envelope.payloadDigest.value, canonicalGovernedJsonV1(envelope as unknown as JsonValue), receivedAt, retentionDeleteAfter, physicalDeleteDeadline]);
        await client.query(`UPDATE ${SCHEMA}.governed_product_streams SET next_sequence = $1 WHERE stream_id = $2`, [envelope.streamSequence + 1, envelope.streamId]);
        const consumed = await client.query(`UPDATE ${SCHEMA}.product_analytics_capture_authorizations SET consumed_at = $1 WHERE authorization_id = $2 AND consumed_at IS NULL AND invalidated_at IS NULL`, [receivedAt, capture.authorization_id]);
        if (consumed.rowCount !== 1) throw new Error('capture authorization consumption race');
        return { decision: this.authorized(receivedAt), disposition: Object.freeze({ eventId, status: 'STORED' as const, reasonCode: null }) };
      });
    } catch {
      return { decision: Object.freeze({ status: 'REFUSED', reasonCode: 'STORAGE_FAILURE', message: 'governed product event refused' }), disposition: Object.freeze({ eventId, status: 'STORAGE_FAILURE', reasonCode: 'STORAGE_FAILURE' }) };
    }
  }

  private authorized(evaluatedAt: string): GovernanceAuthorityDecisionV1 {
    return Object.freeze({ status: 'AUTHORIZED', decisionId: `gev1_${this.uuid()}`, authorityVersion: 'product-analytics-postgres-store-v1', evaluatedAt });
  }

  async readiness(): Promise<ProductAnalyticsLifecycleReadinessV1> {
    const checkedAt = nowIso(this.now);
    const result = await this.options.pool.query<{ count: string | number }>(`SELECT COUNT(*) AS count FROM ${SCHEMA}.governed_product_events WHERE physical_delete_deadline <= $1`, [checkedAt]);
    const overduePhysicalRows = Number(result.rows[0]?.count ?? 0);
    return Object.freeze({ schemaVersion: SCHEMA_VERSION, readyForIngestion: overduePhysicalRows === 0, overduePhysicalRows, checkedAt });
  }

  async assertReadyForIngestion(): Promise<void> {
    if (!(await this.readiness()).readyForIngestion) throw new ProductAnalyticsLifecycleError('LIFECYCLE_UNHEALTHY', 'overdue retained rows must be purged before ingestion');
  }

  async runRetention(): Promise<ProductAnalyticsLifecycleReadinessV1> {
    const currentTime = nowIso(this.now);
    await transaction(this.options.pool, async (client) => {
      await client.query(`DELETE FROM ${SCHEMA}.governed_product_events WHERE physical_delete_deadline <= $1`, [currentTime]);
      const candidates = await client.query<{ principal_handle: string }>(`SELECT DISTINCT principal_handle FROM ${SCHEMA}.product_analytics_erasure_actions WHERE purge_after <= $1`, [currentTime]);
      for (const candidate of candidates.rows) {
        await lockPrincipal(client, candidate.principal_handle);
        const current = await currentConsent(client, candidate.principal_handle, true);
        if (current?.status === 'GRANTED') continue;
        const latest = await client.query<{ latest: string | Date | null }>(`SELECT MAX(value) AS latest FROM (SELECT MAX(effective_at) AS value FROM ${SCHEMA}.product_analytics_consent_revisions WHERE principal_handle = $1 UNION ALL SELECT MAX(effective_at) AS value FROM ${SCHEMA}.product_analytics_erasure_actions WHERE principal_handle = $1) AS lifecycle_times`, [candidate.principal_handle]);
        const latestValue = latest.rows[0]?.latest;
        if (!latestValue || new Date(iso(latestValue)).getTime() + THIRTY_DAYS_MS + PHYSICAL_DELETE_GRACE_MS > new Date(currentTime).getTime()) continue;
        await client.query(`DELETE FROM ${SCHEMA}.product_analytics_idempotency WHERE principal_handle = $1`, [candidate.principal_handle]);
        await client.query(`DELETE FROM ${SCHEMA}.product_analytics_consent_revisions WHERE principal_handle = $1`, [candidate.principal_handle]);
        await client.query(`DELETE FROM ${SCHEMA}.product_analytics_erasure_actions WHERE principal_handle = $1`, [candidate.principal_handle]);
      }
    });
    return this.readiness();
  }

  async exportRecords(principal: AuthenticatedPrincipalV1, request: ProductAnalyticsExportRequestV1): Promise<ProductAnalyticsExportResultV1> {
    exactKeys(request, ['schemaVersion', 'actionId', 'from', 'to'], 'export request', true);
    if (request.schemaVersion !== SCHEMA_VERSION) throw new ProductAnalyticsLifecycleError('INVALID_REQUEST', 'unsupported export schema version');
    assertUuid(request.actionId, 'actionId', true);
    const from = Date.parse(request.from); const to = Date.parse(request.to);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || to - from > MAX_EXPORT_INTERVAL_MS) throw new ProductAnalyticsLifecycleError('INVALID_REQUEST', 'export interval must be positive and at most seven days');
    const handle = deletionHandle(principal, this.options.deletionHandleKey);
    const generatedAt = nowIso(this.now);
    const rows = await transaction(this.options.pool, async (client) => (await client.query<ExportRow>(`SELECT event_id,envelope_json,server_received_at FROM ${SCHEMA}.governed_product_events WHERE principal_handle = $1 AND server_received_at >= $2 AND server_received_at < $3 AND retention_delete_after > $4 ORDER BY server_received_at ASC,event_id ASC LIMIT $5`, [handle, request.from, request.to, generatedAt, MAX_EXPORT_RECORDS + 1])).rows);
    if (rows.length > MAX_EXPORT_RECORDS) throw new ProductAnalyticsLifecycleError('EXPORT_LIMIT_REFUSED', 'export exceeds record limit');
    const wrappers = rows.map((row) => Object.freeze({ schemaVersion: SCHEMA_VERSION, kind: 'RECORD' as const, receivedAt: iso(row.server_received_at), envelope: JSON.parse(row.envelope_json) as unknown }));
    const digest = sha256Hex(`${EXPORT_DOMAIN}${canonicalJsonStringify(wrappers)}`);
    const manifest = Object.freeze({ schemaVersion: SCHEMA_VERSION, kind: 'MANIFEST' as const, exportId: `gexv1_${this.uuid()}`, actionId: request.actionId, from: request.from, to: request.to, generatedAt, purpose: PURPOSE, familyId: PRODUCT_OPERATION_FAMILY_ID, recordCount: wrappers.length, digest: Object.freeze({ algorithm: 'SHA256' as const, value: digest }) });
    const body = `${[canonicalJsonStringify(manifest), ...wrappers.map((wrapper) => canonicalJsonStringify(wrapper))].join('\n')}\n`;
    if (Buffer.byteLength(body, 'utf8') > MAX_EXPORT_BYTES) throw new ProductAnalyticsLifecycleError('EXPORT_LIMIT_REFUSED', 'export exceeds byte limit');
    return Object.freeze({ contentType: 'application/x-ndjson', body, recordCount: wrappers.length, digest });
  }

  async erase(principal: AuthenticatedPrincipalV1, request: ProductAnalyticsErasureRequestV1): Promise<ProductAnalyticsErasureResultV1> {
    exactKeys(request, ['schemaVersion', 'actionId', 'expectedConsentRevision'], 'erasure request', true);
    if (request.schemaVersion !== SCHEMA_VERSION || !POSITIVE_DECIMAL_PATTERN.test(request.expectedConsentRevision)) throw new ProductAnalyticsLifecycleError('INVALID_REQUEST', 'erasure request is invalid');
    assertUuid(request.actionId, 'actionId', true);
    const handle = deletionHandle(principal, this.options.deletionHandleKey);
    const digest = sha256Hex(canonicalJsonStringify(request));
    return transaction(this.options.pool, async (client) => {
      await lockPrincipal(client, handle);
      const prior = await client.query<ErasureActionRow>(`SELECT request_digest,response_json FROM ${SCHEMA}.product_analytics_erasure_actions WHERE principal_handle = $1 AND action_id = $2 FOR UPDATE`, [handle, request.actionId]);
      if (prior.rows[0]) {
        if (prior.rows[0].request_digest !== digest) throw new ProductAnalyticsLifecycleError('ACTION_ID_CONFLICT', 'erasure action ID was already used with different content');
        return deepFreeze(JSON.parse(prior.rows[0].response_json) as ProductAnalyticsErasureResultV1);
      }
      const current = await currentConsent(client, handle, true);
      if (!current || String(current.revision) !== request.expectedConsentRevision) throw new ProductAnalyticsLifecycleError('CONSENT_REVISION_CONFLICT', 'current consent revision does not match erasure request');
      const effectiveAt = nowIso(this.now);
      const revision = current.revision + 1;
      await client.query(`INSERT INTO ${SCHEMA}.product_analytics_consent_revisions (principal_handle,purpose,revision,status,notice_digest,receipt_json,profile_pseudonym_id,effective_at,action_id) VALUES ($1,$2,$3,'DENIED',$4,NULL,NULL,$5,$6)`, [handle, PURPOSE, revision, PRODUCT_ANALYTICS_OPERATION_NOTICE_REFERENCE.digest.value, effectiveAt, request.actionId]);
      await client.query(`UPDATE ${SCHEMA}.product_analytics_capture_authorizations SET invalidated_at = $1 WHERE principal_handle = $2 AND consumed_at IS NULL AND invalidated_at IS NULL`, [effectiveAt, handle]);
      await client.query(`DELETE FROM ${SCHEMA}.governed_product_events WHERE principal_handle = $1`, [handle]);
      await client.query(`DELETE FROM ${SCHEMA}.governed_product_streams WHERE principal_handle = $1`, [handle]);
      await client.query(`DELETE FROM ${SCHEMA}.product_analytics_capture_authorizations WHERE principal_handle = $1`, [handle]);
      const dispositions = Object.freeze([
        Object.freeze({ artifact: 'GOVERNED_PRODUCT_EVENTS', disposition: 'LOGICAL_DELETE_COMPLETED' as const }),
        Object.freeze({ artifact: 'GOVERNED_PRODUCT_STREAMS', disposition: 'LOGICAL_DELETE_COMPLETED' as const }),
        Object.freeze({ artifact: 'CAPTURE_AUTHORIZATIONS', disposition: 'LOGICAL_DELETE_COMPLETED' as const }),
        Object.freeze({ artifact: 'CONSENT_REVISIONS', disposition: 'POLICY_GOVERNED_RETENTION' as const }),
        Object.freeze({ artifact: 'CONSENT_IDEMPOTENCY', disposition: 'POLICY_GOVERNED_RETENTION' as const }),
        Object.freeze({ artifact: 'PROTECTED_DELETION_MAPPING', disposition: 'POLICY_GOVERNED_RETENTION' as const }),
        Object.freeze({ artifact: 'POSTGRES_PRIMARY_STORAGE', disposition: 'LOGICAL_DELETE_COMPLETED' as const }),
        Object.freeze({ artifact: 'LOCAL_OFFLINE_ARTIFACTS', disposition: 'OUTSIDE_SERVICE_CONTROL' as const }),
        Object.freeze({ artifact: 'DOWNLOADED_EXPORTS', disposition: 'OUTSIDE_SERVICE_CONTROL' as const }),
      ]);
      const result = deepFreeze<ProductAnalyticsErasureResultV1>({ schemaVersion: SCHEMA_VERSION, requestId: `gerv1_${this.uuid()}`, actionId: request.actionId, purpose: PURPOSE, result: 'SERVICE_SCOPE_RESOLVED', dispositions });
      const purgeAfter = new Date(new Date(effectiveAt).getTime() + THIRTY_DAYS_MS + PHYSICAL_DELETE_GRACE_MS).toISOString();
      await client.query(`INSERT INTO ${SCHEMA}.product_analytics_erasure_actions (principal_handle,action_id,request_digest,response_json,effective_at,purge_after) VALUES ($1,$2,$3,$4,$5,$6)`, [handle, request.actionId, digest, canonicalJsonStringify(result), effectiveAt, purgeAfter]);
      return result;
    });
  }
}

export const POSTGRES_PRODUCT_ANALYTICS_RETENTION_POLICY_V1 = CONSENT_LIFECYCLE_ENFORCEMENT_RETENTION_ARTIFACT;
