import { createHmac, randomUUID } from 'node:crypto';
import { chmodSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { canonicalJsonStringify, sha256Hex } from '../security/CryptoHash.ts';
import {
  GOVERNED_PURPOSES,
  PRODUCT_ANALYTICS_OPERATION_NOTICE_REFERENCE,
  PRODUCT_OPERATION_FAMILY_ID,
  type ImmutableReferenceV1,
  type ProductOperationValue,
} from '../governance/index.ts';
import type { AuthorizationEvidenceV1 } from '../governance/GovernedEventContracts.ts';

const PURPOSE = GOVERNED_PURPOSES.PRODUCT_ANALYTICS;
const SCHEMA_VERSION = '1' as const;
const DEFAULT_CAPTURE_AUTHORIZATION_TTL_MS = 30_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const POSITIVE_DECIMAL_PATTERN = /^[1-9][0-9]*$/;
const PURPOSE_PSEUDONYM_DOMAIN = new TextEncoder().encode('nemosyne:purpose-pseudonym:v1\n');
const DELETION_HANDLE_DOMAIN = new TextEncoder().encode('nemosyne:deletion-handle:v1\n');

export type ProductAnalyticsConsentStatus = 'GRANTED' | 'DENIED';

export interface AuthenticatedPrincipalV1 {
  readonly issuer: string;
  readonly subject: string;
}

export interface VersionedSecretKeyV1 {
  readonly version: string;
  readonly key: Uint8Array;
}

export interface ProductAnalyticsConsentStateV1 {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly purpose: typeof PURPOSE;
  readonly status: ProductAnalyticsConsentStatus;
  readonly revision: string | null;
  readonly receipt: AuthorizationEvidenceV1 | null;
  readonly profilePseudonymId: string | null;
  readonly effectiveAt: string | null;
}

export interface ProductAnalyticsGrantRequestV1 {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly purpose: typeof PURPOSE;
  readonly notice: ImmutableReferenceV1;
  readonly confirmed: true;
  readonly actionId: string;
  readonly expectedPriorRevision: string | null;
}

export interface ProductAnalyticsGrantResultV1 extends ProductAnalyticsConsentStateV1 {
  readonly actionId: string;
}

export interface ProductAnalyticsRevocationRequestV1 {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly purpose: typeof PURPOSE;
  readonly actionId: string;
  readonly expectedCurrentRevision: string;
}

export interface ProductAnalyticsRevocationResultV1 extends ProductAnalyticsConsentStateV1 {
  readonly actionId: string;
}

export interface ProductAnalyticsCaptureAuthorizationRequestV1 {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly familyId: typeof PRODUCT_OPERATION_FAMILY_ID;
  readonly eventId: string;
  readonly producerInstanceId: string;
  readonly streamId: string;
  readonly streamSequence: number;
}

export interface ProductAnalyticsCaptureAuthorizationV1 {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly authorizationId: string;
  readonly eventId: string;
  readonly producerInstanceId: string;
  readonly streamId: string;
  readonly streamSequence: number;
  readonly familyId: typeof PRODUCT_OPERATION_FAMILY_ID;
  readonly receipt: AuthorizationEvidenceV1;
  readonly profilePseudonymId: string;
  readonly authorizedAt: string;
  readonly expiresAt: string;
}

export type ProductAnalyticsAuthorityErrorCode =
  | 'INVALID_REQUEST'
  | 'CONSENT_REVISION_CONFLICT'
  | 'ACTION_ID_CONFLICT'
  | 'CONSENT_REQUIRED'
  | 'STORAGE_CONFIGURATION_INVALID';

export class ProductAnalyticsAuthorityError extends Error {
  readonly code: ProductAnalyticsAuthorityErrorCode;

  constructor(code: ProductAnalyticsAuthorityErrorCode, message: string) {
    super(message);
    this.name = 'ProductAnalyticsAuthorityError';
    this.code = code;
  }
}

export interface ProductAnalyticsConsentAuthorityOptions {
  readonly dataDirectory: string;
  readonly purposePseudonymKey: VersionedSecretKeyV1;
  readonly deletionHandleKey: VersionedSecretKeyV1;
  readonly now?: () => Date;
  readonly uuid?: () => string;
  readonly captureAuthorizationTtlMs?: number;
}

interface ConsentRevisionRow {
  readonly revision: number;
  readonly status: ProductAnalyticsConsentStatus;
  readonly receipt_json: string | null;
  readonly profile_pseudonym_id: string | null;
  readonly effective_at: string;
}

interface IdempotencyRow {
  readonly request_digest: string;
  readonly response_json: string;
}

function assertExactKeys(value: object, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new ProductAnalyticsAuthorityError('INVALID_REQUEST', `${label} must contain exactly ${wanted.join(', ')}`);
  }
}

function assertUuid(value: string, label: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new ProductAnalyticsAuthorityError('INVALID_REQUEST', `${label} must be a UUID`);
  }
}

function assertPositiveRevision(value: string, label: string): void {
  if (!POSITIVE_DECIMAL_PATTERN.test(value)) {
    throw new ProductAnalyticsAuthorityError('INVALID_REQUEST', `${label} must be a positive canonical decimal string`);
  }
}

function assertPrincipal(principal: AuthenticatedPrincipalV1): void {
  assertExactKeys(principal, ['issuer', 'subject'], 'principal');
  if (!principal.issuer || !principal.subject) {
    throw new ProductAnalyticsAuthorityError('INVALID_REQUEST', 'issuer and subject are required');
  }
  if (new TextEncoder().encode(principal.issuer).byteLength > 2048) {
    throw new ProductAnalyticsAuthorityError('INVALID_REQUEST', 'issuer exceeds 2048 UTF-8 bytes');
  }
  if (new TextEncoder().encode(principal.subject).byteLength > 256) {
    throw new ProductAnalyticsAuthorityError('INVALID_REQUEST', 'subject exceeds 256 UTF-8 bytes');
  }
}

function assertSecret(secret: VersionedSecretKeyV1, label: string): void {
  if (!/^[A-Za-z0-9._-]{1,32}$/.test(secret.version) || secret.key.byteLength < 32) {
    throw new ProductAnalyticsAuthorityError(
      'STORAGE_CONFIGURATION_INVALID',
      `${label} requires a bounded version and at least 256 bits of key material`
    );
  }
}

function u32be(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, false);
  return bytes;
}

function lengthFrame(values: readonly string[]): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (const value of values) {
    const bytes = encoder.encode(value);
    chunks.push(u32be(bytes.byteLength), bytes);
    size += 4 + bytes.byteLength;
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

function hmacHex(secret: Uint8Array, domain: Uint8Array, values: readonly string[]): string {
  const hmac = createHmac('sha256', secret);
  hmac.update(domain);
  hmac.update(lengthFrame(values));
  return hmac.digest('hex');
}

export function derivePurposePseudonymV1(
  principal: AuthenticatedPrincipalV1,
  purpose: string,
  secret: VersionedSecretKeyV1
): string {
  assertPrincipal(principal);
  assertSecret(secret, 'purpose pseudonym key');
  return `ppv1_${secret.version}_${hmacHex(secret.key, PURPOSE_PSEUDONYM_DOMAIN, [principal.issuer, principal.subject, purpose])}`;
}

function deriveDeletionHandleV1(principal: AuthenticatedPrincipalV1, secret: VersionedSecretKeyV1): string {
  assertPrincipal(principal);
  assertSecret(secret, 'deletion handle key');
  return `dhv1_${secret.version}_${hmacHex(secret.key, DELETION_HANDLE_DOMAIN, [principal.issuer, principal.subject])}`;
}

function parseReceipt(json: string | null): AuthorizationEvidenceV1 | null {
  return json ? (JSON.parse(json) as AuthorizationEvidenceV1) : null;
}

export class SqliteProductAnalyticsConsentAuthority {
  private readonly db: DatabaseSync;
  private readonly purposePseudonymKey: VersionedSecretKeyV1;
  private readonly deletionHandleKey: VersionedSecretKeyV1;
  private readonly now: () => Date;
  private readonly uuid: () => string;
  private readonly captureAuthorizationTtlMs: number;

  constructor(options: ProductAnalyticsConsentAuthorityOptions) {
    assertSecret(options.purposePseudonymKey, 'purpose pseudonym key');
    assertSecret(options.deletionHandleKey, 'deletion handle key');
    if (
      !Number.isInteger(options.captureAuthorizationTtlMs ?? DEFAULT_CAPTURE_AUTHORIZATION_TTL_MS) ||
      (options.captureAuthorizationTtlMs ?? DEFAULT_CAPTURE_AUTHORIZATION_TTL_MS) < 1_000 ||
      (options.captureAuthorizationTtlMs ?? DEFAULT_CAPTURE_AUTHORIZATION_TTL_MS) > 300_000
    ) {
      throw new ProductAnalyticsAuthorityError(
        'STORAGE_CONFIGURATION_INVALID',
        'capture authorization TTL must be between 1 and 300 seconds'
      );
    }

    this.purposePseudonymKey = options.purposePseudonymKey;
    this.deletionHandleKey = options.deletionHandleKey;
    this.now = options.now ?? (() => new Date());
    this.uuid = options.uuid ?? randomUUID;
    this.captureAuthorizationTtlMs = options.captureAuthorizationTtlMs ?? DEFAULT_CAPTURE_AUTHORIZATION_TTL_MS;

    mkdirSync(options.dataDirectory, { recursive: true, mode: 0o700 });
    chmodSync(options.dataDirectory, 0o700);
    const directoryMode = statSync(options.dataDirectory).mode & 0o777;
    if (directoryMode !== 0o700) {
      throw new ProductAnalyticsAuthorityError('STORAGE_CONFIGURATION_INVALID', 'governance data directory must be mode 0700');
    }

    const databasePath = join(options.dataDirectory, 'governance.sqlite');
    this.db = new DatabaseSync(databasePath);
    chmodSync(databasePath, 0o600);
    if ((statSync(databasePath).mode & 0o777) !== 0o600) {
      this.db.close();
      throw new ProductAnalyticsAuthorityError('STORAGE_CONFIGURATION_INVALID', 'governance database must be mode 0600');
    }

    this.db.exec('PRAGMA foreign_keys = ON');
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA synchronous = FULL');
    this.db.exec('PRAGMA secure_delete = ON');
    this.db.exec('PRAGMA wal_autocheckpoint = 1000');

    const version = Number((this.db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version);
    if (version !== 0 && version !== 1) {
      this.db.close();
      throw new ProductAnalyticsAuthorityError('STORAGE_CONFIGURATION_INVALID', `unsupported governance schema version ${version}`);
    }
    this.migrateV1();
  }

  close(): void {
    this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    this.db.close();
  }

  getCurrent(principal: AuthenticatedPrincipalV1): ProductAnalyticsConsentStateV1 {
    assertPrincipal(principal);
    const handle = deriveDeletionHandleV1(principal, this.deletionHandleKey);
    const row = this.currentRow(handle);
    return this.toPublicState(row);
  }

  grant(
    principal: AuthenticatedPrincipalV1,
    request: ProductAnalyticsGrantRequestV1
  ): ProductAnalyticsGrantResultV1 {
    assertPrincipal(principal);
    this.validateGrantRequest(request);
    const handle = deriveDeletionHandleV1(principal, this.deletionHandleKey);
    const requestDigest = sha256Hex(canonicalJsonStringify(request));

    return this.transaction(() => {
      const prior = this.getIdempotency<ProductAnalyticsGrantResultV1>(handle, 'GRANT', request.actionId, requestDigest);
      if (prior) return prior;

      const current = this.currentRow(handle);
      const currentRevision = current ? String(current.revision) : null;
      if (request.expectedPriorRevision !== currentRevision) {
        throw new ProductAnalyticsAuthorityError('CONSENT_REVISION_CONFLICT', 'expected prior consent revision does not match current state');
      }

      const revision = (current?.revision ?? 0) + 1;
      const effectiveAt = this.now().toISOString();
      const profilePseudonymId = derivePurposePseudonymV1(principal, PURPOSE, this.purposePseudonymKey);
      const receipt = this.createReceipt(revision, request.actionId, profilePseudonymId, effectiveAt);
      this.db
        .prepare(
          `INSERT INTO product_analytics_consent_revisions
           (principal_handle, purpose, revision, status, notice_digest, receipt_json, profile_pseudonym_id, effective_at, action_id)
           VALUES (?, ?, ?, 'GRANTED', ?, ?, ?, ?, ?)`
        )
        .run(
          handle,
          PURPOSE,
          revision,
          PRODUCT_ANALYTICS_OPERATION_NOTICE_REFERENCE.digest.value,
          canonicalJsonStringify(receipt),
          profilePseudonymId,
          effectiveAt,
          request.actionId
        );

      const result: ProductAnalyticsGrantResultV1 = Object.freeze({
        ...this.toPublicState({ revision, status: 'GRANTED', receipt_json: canonicalJsonStringify(receipt), profile_pseudonym_id: profilePseudonymId, effective_at: effectiveAt }),
        actionId: request.actionId,
      });
      this.putIdempotency(handle, 'GRANT', request.actionId, requestDigest, result);
      return result;
    });
  }

  revoke(
    principal: AuthenticatedPrincipalV1,
    request: ProductAnalyticsRevocationRequestV1
  ): ProductAnalyticsRevocationResultV1 {
    assertPrincipal(principal);
    this.validateRevocationRequest(request);
    const handle = deriveDeletionHandleV1(principal, this.deletionHandleKey);
    const requestDigest = sha256Hex(canonicalJsonStringify(request));

    return this.transaction(() => {
      const prior = this.getIdempotency<ProductAnalyticsRevocationResultV1>(handle, 'REVOKE', request.actionId, requestDigest);
      if (prior) return prior;

      const current = this.currentRow(handle);
      if (!current || current.status !== 'GRANTED' || String(current.revision) !== request.expectedCurrentRevision) {
        throw new ProductAnalyticsAuthorityError('CONSENT_REVISION_CONFLICT', 'current granted consent revision does not match revocation request');
      }

      const revision = current.revision + 1;
      const effectiveAt = this.now().toISOString();
      this.db
        .prepare(
          `INSERT INTO product_analytics_consent_revisions
           (principal_handle, purpose, revision, status, notice_digest, receipt_json, profile_pseudonym_id, effective_at, action_id)
           VALUES (?, ?, ?, 'DENIED', ?, NULL, NULL, ?, ?)`
        )
        .run(handle, PURPOSE, revision, PRODUCT_ANALYTICS_OPERATION_NOTICE_REFERENCE.digest.value, effectiveAt, request.actionId);
      this.db
        .prepare(
          `UPDATE product_analytics_capture_authorizations
           SET invalidated_at = ?
           WHERE principal_handle = ? AND consumed_at IS NULL AND invalidated_at IS NULL`
        )
        .run(effectiveAt, handle);

      const result: ProductAnalyticsRevocationResultV1 = Object.freeze({
        ...this.toPublicState({ revision, status: 'DENIED', receipt_json: null, profile_pseudonym_id: null, effective_at: effectiveAt }),
        actionId: request.actionId,
      });
      this.putIdempotency(handle, 'REVOKE', request.actionId, requestDigest, result);
      return result;
    });
  }

  authorizeCapture(
    principal: AuthenticatedPrincipalV1,
    request: ProductAnalyticsCaptureAuthorizationRequestV1
  ): ProductAnalyticsCaptureAuthorizationV1 {
    assertPrincipal(principal);
    this.validateCaptureRequest(request);
    const handle = deriveDeletionHandleV1(principal, this.deletionHandleKey);

    return this.transaction(() => {
      const current = this.currentRow(handle);
      const receipt = parseReceipt(current?.receipt_json ?? null);
      if (!current || current.status !== 'GRANTED' || !receipt || !current.profile_pseudonym_id) {
        throw new ProductAnalyticsAuthorityError('CONSENT_REQUIRED', 'current product-analytics consent is required for capture authorization');
      }

      const existing = this.db
        .prepare(
          `SELECT response_json FROM product_analytics_capture_authorizations
           WHERE principal_handle = ? AND event_id = ?`
        )
        .get(handle, request.eventId) as { response_json: string } | undefined;
      if (existing) {
        const prior = JSON.parse(existing.response_json) as ProductAnalyticsCaptureAuthorizationV1;
        if (
          prior.producerInstanceId === request.producerInstanceId &&
          prior.streamId === request.streamId &&
          prior.streamSequence === request.streamSequence &&
          prior.familyId === request.familyId
        ) {
          return prior;
        }
        throw new ProductAnalyticsAuthorityError('ACTION_ID_CONFLICT', 'event ID is already bound to different capture coordinates');
      }

      const authorizedAtDate = this.now();
      const authorizedAt = authorizedAtDate.toISOString();
      const expiresAt = new Date(authorizedAtDate.getTime() + this.captureAuthorizationTtlMs).toISOString();
      const authorizationId = `cav1_${this.uuid()}`;
      const result: ProductAnalyticsCaptureAuthorizationV1 = Object.freeze({
        schemaVersion: SCHEMA_VERSION,
        authorizationId,
        eventId: request.eventId,
        producerInstanceId: request.producerInstanceId,
        streamId: request.streamId,
        streamSequence: request.streamSequence,
        familyId: PRODUCT_OPERATION_FAMILY_ID,
        receipt,
        profilePseudonymId: current.profile_pseudonym_id,
        authorizedAt,
        expiresAt,
      });

      this.db
        .prepare(
          `INSERT INTO product_analytics_capture_authorizations
           (authorization_id, principal_handle, event_id, producer_instance_id, stream_id, stream_sequence,
            family_id, consent_revision, receipt_json, profile_pseudonym_id, authorized_at, expires_at, response_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          authorizationId,
          handle,
          request.eventId,
          request.producerInstanceId,
          request.streamId,
          request.streamSequence,
          request.familyId,
          current.revision,
          canonicalJsonStringify(receipt),
          current.profile_pseudonym_id,
          authorizedAt,
          expiresAt,
          canonicalJsonStringify(result)
        );
      return result;
    });
  }

  private migrateV1(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS product_analytics_consent_revisions (
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
      CREATE TABLE IF NOT EXISTS product_analytics_idempotency (
        principal_handle TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        action_id TEXT NOT NULL,
        request_digest TEXT NOT NULL,
        response_json TEXT NOT NULL,
        PRIMARY KEY (principal_handle, endpoint, action_id)
      );
      CREATE TABLE IF NOT EXISTS product_analytics_capture_authorizations (
        authorization_id TEXT PRIMARY KEY,
        principal_handle TEXT NOT NULL,
        event_id TEXT NOT NULL,
        producer_instance_id TEXT NOT NULL,
        stream_id TEXT NOT NULL,
        stream_sequence INTEGER NOT NULL CHECK (stream_sequence >= 0),
        family_id TEXT NOT NULL,
        consent_revision INTEGER NOT NULL,
        receipt_json TEXT NOT NULL,
        profile_pseudonym_id TEXT NOT NULL,
        authorized_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        response_json TEXT NOT NULL,
        consumed_at TEXT,
        invalidated_at TEXT,
        UNIQUE (principal_handle, event_id)
      );
      PRAGMA user_version = 1;
    `);
  }

  private currentRow(handle: string): ConsentRevisionRow | null {
    return (
      (this.db
        .prepare(
          `SELECT revision, status, receipt_json, profile_pseudonym_id, effective_at
           FROM product_analytics_consent_revisions
           WHERE principal_handle = ? AND purpose = ?
           ORDER BY revision DESC LIMIT 1`
        )
        .get(handle, PURPOSE) as ConsentRevisionRow | undefined) ?? null
    );
  }

  private toPublicState(row: ConsentRevisionRow | null): ProductAnalyticsConsentStateV1 {
    if (!row) {
      return Object.freeze({
        schemaVersion: SCHEMA_VERSION,
        purpose: PURPOSE,
        status: 'DENIED',
        revision: null,
        receipt: null,
        profilePseudonymId: null,
        effectiveAt: null,
      });
    }
    return Object.freeze({
      schemaVersion: SCHEMA_VERSION,
      purpose: PURPOSE,
      status: row.status,
      revision: String(row.revision),
      receipt: parseReceipt(row.receipt_json),
      profilePseudonymId: row.profile_pseudonym_id,
      effectiveAt: row.effective_at,
    });
  }

  private createReceipt(
    revision: number,
    actionId: string,
    profilePseudonymId: string,
    effectiveAt: string
  ): AuthorizationEvidenceV1 {
    const evidence = {
      schemaVersion: SCHEMA_VERSION,
      purpose: PURPOSE,
      revision: String(revision),
      notice: PRODUCT_ANALYTICS_OPERATION_NOTICE_REFERENCE,
      profilePseudonymId,
      effectiveAt,
      actionId,
    };
    return Object.freeze({
      id: `crv1_${this.uuid()}`,
      revision: String(revision),
      digest: Object.freeze({ algorithm: 'SHA256' as const, value: sha256Hex(canonicalJsonStringify(evidence)) }),
    });
  }

  private validateGrantRequest(request: ProductAnalyticsGrantRequestV1): void {
    assertExactKeys(request, ['schemaVersion', 'purpose', 'notice', 'confirmed', 'actionId', 'expectedPriorRevision'], 'grant request');
    if (request.schemaVersion !== SCHEMA_VERSION || request.purpose !== PURPOSE || request.confirmed !== true) {
      throw new ProductAnalyticsAuthorityError('INVALID_REQUEST', 'grant request schema, purpose and explicit confirmation must match');
    }
    if (canonicalJsonStringify(request.notice) !== canonicalJsonStringify(PRODUCT_ANALYTICS_OPERATION_NOTICE_REFERENCE)) {
      throw new ProductAnalyticsAuthorityError('INVALID_REQUEST', 'grant must confirm the exact reviewed notice reference');
    }
    assertUuid(request.actionId, 'actionId');
    if (request.expectedPriorRevision !== null) assertPositiveRevision(request.expectedPriorRevision, 'expectedPriorRevision');
  }

  private validateRevocationRequest(request: ProductAnalyticsRevocationRequestV1): void {
    assertExactKeys(request, ['schemaVersion', 'purpose', 'actionId', 'expectedCurrentRevision'], 'revocation request');
    if (request.schemaVersion !== SCHEMA_VERSION || request.purpose !== PURPOSE) {
      throw new ProductAnalyticsAuthorityError('INVALID_REQUEST', 'revocation request schema and purpose must match');
    }
    assertUuid(request.actionId, 'actionId');
    assertPositiveRevision(request.expectedCurrentRevision, 'expectedCurrentRevision');
  }

  private validateCaptureRequest(request: ProductAnalyticsCaptureAuthorizationRequestV1): void {
    assertExactKeys(
      request,
      ['schemaVersion', 'familyId', 'eventId', 'producerInstanceId', 'streamId', 'streamSequence'],
      'capture authorization request'
    );
    if (request.schemaVersion !== SCHEMA_VERSION || request.familyId !== PRODUCT_OPERATION_FAMILY_ID) {
      throw new ProductAnalyticsAuthorityError('INVALID_REQUEST', 'capture request schema/family must match the first governed family');
    }
    assertUuid(request.eventId, 'eventId');
    if (!/^piv1_[0-9a-f-]{36}$/i.test(request.producerInstanceId) || !/^strv1_[0-9a-f-]{36}$/i.test(request.streamId)) {
      throw new ProductAnalyticsAuthorityError('INVALID_REQUEST', 'producer and stream IDs must use the RFC 0004 prefixed UUID forms');
    }
    assertUuid(request.producerInstanceId.slice(5), 'producerInstanceId');
    assertUuid(request.streamId.slice(6), 'streamId');
    if (!Number.isSafeInteger(request.streamSequence) || request.streamSequence < 0) {
      throw new ProductAnalyticsAuthorityError('INVALID_REQUEST', 'streamSequence must be a non-negative safe integer');
    }
  }

  private transaction<T>(work: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  private getIdempotency<T>(handle: string, endpoint: string, actionId: string, requestDigest: string): T | null {
    const row = this.db
      .prepare(
        `SELECT request_digest, response_json FROM product_analytics_idempotency
         WHERE principal_handle = ? AND endpoint = ? AND action_id = ?`
      )
      .get(handle, endpoint, actionId) as IdempotencyRow | undefined;
    if (!row) return null;
    if (row.request_digest !== requestDigest) {
      throw new ProductAnalyticsAuthorityError('ACTION_ID_CONFLICT', 'action ID was already used with different canonical content');
    }
    return JSON.parse(row.response_json) as T;
  }

  private putIdempotency(
    handle: string,
    endpoint: string,
    actionId: string,
    requestDigest: string,
    response: ProductAnalyticsGrantResultV1 | ProductAnalyticsRevocationResultV1
  ): void {
    this.db
      .prepare(
        `INSERT INTO product_analytics_idempotency
         (principal_handle, endpoint, action_id, request_digest, response_json)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(handle, endpoint, actionId, requestDigest, canonicalJsonStringify(response));
  }
}

// Type-only export keeps the service family vocabulary explicit without adding payload authority here.
export type { ProductOperationValue };
