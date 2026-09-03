import { createHmac, randomUUID } from 'node:crypto';
import { chmodSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { canonicalJsonStringify, sha256Hex } from '../security/CryptoHash.ts';
import {
  PRODUCT_ANALYTICS_OPERATION_NOTICE_REFERENCE,
  PRODUCT_OPERATION_FAMILY_ID,
} from '../governance/index.ts';
import type { AuthenticatedPrincipalV1, VersionedSecretKeyV1 } from './ProductAnalyticsConsentAuthority.ts';

const PURPOSE = 'product-analytics' as const;
const SCHEMA_VERSION = '1' as const;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const PHYSICAL_DELETE_GRACE_MS = 24 * 60 * 60 * 1000;
const MAX_EXPORT_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_EXPORT_RECORDS = 100_000;
const MAX_EXPORT_BYTES = 100 * 1024 * 1024;
const EXPORT_DOMAIN = 'nemosyne:governed-export:v1\n';
const DELETION_HANDLE_DOMAIN = Buffer.from('nemosyne:deletion-handle:v1\n', 'utf8');
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const POSITIVE_DECIMAL_PATTERN = /^[1-9][0-9]*$/;

export const CONSENT_LIFECYCLE_ENFORCEMENT_RETENTION_ARTIFACT = Object.freeze({
  schemaVersion: '1',
  id: 'consent-lifecycle-enforcement-retention',
  version: '1.0.0',
  purpose: PURPOSE,
  retentionDays: 30,
  physicalDeletionDeadlineHours: 24,
  clock: 'SERVER_LIFECYCLE_ACTION_AT',
  retainedArtifacts: Object.freeze([
    'CONSENT_REVISIONS',
    'CONSENT_IDEMPOTENCY',
    'PROTECTED_DELETION_MAPPING',
    'ERASURE_IDEMPOTENCY',
  ]),
  analyticsVisibility: 'NONE',
} as const);

const PINNED_LIFECYCLE_POLICY_SHA256 = '71aa3033cdf5d085ec806c7bf19f71d4b88b5902a0a66b6ea1a13730d6257085';

export const CONSENT_LIFECYCLE_ENFORCEMENT_RETENTION_DIGEST = (() => {
  const actual = sha256Hex(canonicalJsonStringify(CONSENT_LIFECYCLE_ENFORCEMENT_RETENTION_ARTIFACT));
  if (actual !== PINNED_LIFECYCLE_POLICY_SHA256) {
    throw new Error('consent lifecycle retention artifact digest mismatch: reviewed version must change before content changes');
  }
  return actual;
})();

export interface ProductAnalyticsExportRequestV1 {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly actionId: string;
  readonly from: string;
  readonly to: string;
}

export interface ProductAnalyticsErasureRequestV1 {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly actionId: string;
  readonly expectedConsentRevision: string;
}

export type RegisteredArtifactDisposition =
  | 'LOGICAL_DELETE_COMPLETED'
  | 'CHECKPOINT_COMPLETED'
  | 'POLICY_GOVERNED_RETENTION'
  | 'NOT_PRESENT'
  | 'OUTSIDE_SERVICE_CONTROL';

export interface ProductAnalyticsErasureArtifactDispositionV1 {
  readonly artifact: string;
  readonly disposition: RegisteredArtifactDisposition;
}

export interface ProductAnalyticsErasureResultV1 {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly requestId: string;
  readonly actionId: string;
  readonly purpose: typeof PURPOSE;
  readonly result: 'SERVICE_SCOPE_RESOLVED' | 'PARTIAL' | 'FAILED';
  readonly dispositions: readonly ProductAnalyticsErasureArtifactDispositionV1[];
}

export interface ProductAnalyticsExportResultV1 {
  readonly contentType: 'application/x-ndjson';
  readonly body: string;
  readonly recordCount: number;
  readonly digest: string;
}

export interface ProductAnalyticsLifecycleReadinessV1 {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly readyForIngestion: boolean;
  readonly overduePhysicalRows: number;
  readonly checkedAt: string;
}

export type ProductAnalyticsLifecycleErrorCode =
  | 'INVALID_REQUEST'
  | 'CONSENT_REVISION_CONFLICT'
  | 'ACTION_ID_CONFLICT'
  | 'EXPORT_LIMIT_REFUSED'
  | 'LIFECYCLE_UNHEALTHY'
  | 'STORAGE_CONFIGURATION_INVALID';

export class ProductAnalyticsLifecycleError extends Error {
  readonly code: ProductAnalyticsLifecycleErrorCode;

  constructor(code: ProductAnalyticsLifecycleErrorCode, message: string) {
    super(message);
    this.name = 'ProductAnalyticsLifecycleError';
    this.code = code;
  }
}

export interface ProductAnalyticsLifecycleAuthorityOptions {
  readonly dataDirectory: string;
  readonly deletionHandleKey: VersionedSecretKeyV1;
  readonly now?: () => Date;
  readonly uuid?: () => string;
}

interface ExportRow {
  readonly event_id: string;
  readonly envelope_json: string;
  readonly server_received_at: string;
}

interface ConsentRevisionRow {
  readonly revision: number;
  readonly status: 'GRANTED' | 'DENIED';
  readonly effective_at: string;
}

interface ErasureActionRow {
  readonly request_digest: string;
  readonly response_json: string;
}

function exactKeys(value: object, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new ProductAnalyticsLifecycleError('INVALID_REQUEST', `${label} must contain exactly ${wanted.join(', ')}`);
  }
}

function assertPrincipal(principal: AuthenticatedPrincipalV1): void {
  exactKeys(principal, ['issuer', 'subject'], 'principal');
  if (!principal.issuer || !principal.subject || Buffer.byteLength(principal.issuer, 'utf8') > 2048 || Buffer.byteLength(principal.subject, 'utf8') > 256) {
    throw new ProductAnalyticsLifecycleError('INVALID_REQUEST', 'principal issuer/subject are invalid');
  }
}

function assertSecret(secret: VersionedSecretKeyV1): void {
  if (!/^[A-Za-z0-9._-]{1,32}$/.test(secret.version) || secret.key.byteLength < 32) {
    throw new ProductAnalyticsLifecycleError('STORAGE_CONFIGURATION_INVALID', 'deletion handle key is invalid');
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
  assertSecret(secret);
  const digest = createHmac('sha256', secret.key)
    .update(DELETION_HANDLE_DOMAIN)
    .update(frame([principal.issuer, principal.subject]))
    .digest('hex');
  return `dhv1_${secret.version}_${digest}`;
}

function parseServerTime(value: string, label: string): number {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    throw new ProductAnalyticsLifecycleError('INVALID_REQUEST', `${label} must be a canonical UTC timestamp`);
  }
  const time = Date.parse(value);
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value) {
    throw new ProductAnalyticsLifecycleError('INVALID_REQUEST', `${label} must be a canonical UTC timestamp`);
  }
  return time;
}

function assertUuid(value: string, label: string): void {
  if (!UUID_PATTERN.test(value)) throw new ProductAnalyticsLifecycleError('INVALID_REQUEST', `${label} must be a UUID`);
}

function currentConsent(db: DatabaseSync, handle: string): ConsentRevisionRow | null {
  return (db.prepare(
    `SELECT revision, status, effective_at FROM product_analytics_consent_revisions
     WHERE principal_handle = ? AND purpose = ? ORDER BY revision DESC LIMIT 1`
  ).get(handle, PURPOSE) as ConsentRevisionRow | undefined) ?? null;
}

export class SqliteProductAnalyticsLifecycleAuthority {
  private readonly db: DatabaseSync;
  private readonly deletionHandleKey: VersionedSecretKeyV1;
  private readonly now: () => Date;
  private readonly uuid: () => string;

  constructor(options: ProductAnalyticsLifecycleAuthorityOptions) {
    assertSecret(options.deletionHandleKey);
    this.deletionHandleKey = options.deletionHandleKey;
    this.now = options.now ?? (() => new Date());
    this.uuid = options.uuid ?? randomUUID;
    mkdirSync(options.dataDirectory, { recursive: true, mode: 0o700 });
    chmodSync(options.dataDirectory, 0o700);
    if ((statSync(options.dataDirectory).mode & 0o777) !== 0o700) {
      throw new ProductAnalyticsLifecycleError('STORAGE_CONFIGURATION_INVALID', 'governance data directory must be mode 0700');
    }
    const databasePath = join(options.dataDirectory, 'governance.sqlite');
    this.db = new DatabaseSync(databasePath);
    chmodSync(databasePath, 0o600);
    this.db.exec('PRAGMA foreign_keys = ON');
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA synchronous = FULL');
    this.db.exec('PRAGMA secure_delete = ON');
    this.db.exec('PRAGMA wal_autocheckpoint = 1000');
    this.migrate();
    const integrity = this.db.prepare('PRAGMA integrity_check').get() as Record<string, unknown> | undefined;
    if (!integrity || Object.values(integrity)[0] !== 'ok') {
      throw new ProductAnalyticsLifecycleError('STORAGE_CONFIGURATION_INVALID', 'governance database integrity check failed');
    }
    this.runRetention();
  }

  close(): void {
    this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    this.db.close();
  }

  readiness(): ProductAnalyticsLifecycleReadinessV1 {
    const now = this.serverNow();
    const row = this.db.prepare(
      'SELECT COUNT(*) AS count FROM governed_product_events WHERE physical_delete_deadline <= ?'
    ).get(now) as { count: number };
    return Object.freeze({
      schemaVersion: SCHEMA_VERSION,
      readyForIngestion: Number(row.count) === 0,
      overduePhysicalRows: Number(row.count),
      checkedAt: now,
    });
  }

  assertReadyForIngestion(): void {
    const readiness = this.readiness();
    if (!readiness.readyForIngestion) {
      throw new ProductAnalyticsLifecycleError('LIFECYCLE_UNHEALTHY', 'overdue retained rows must be purged before ingestion');
    }
  }

  runRetention(): ProductAnalyticsLifecycleReadinessV1 {
    const now = this.serverNow();
    this.transaction(() => {
      this.db.prepare('DELETE FROM governed_product_events WHERE physical_delete_deadline <= ?').run(now);

      const candidates = this.db.prepare(
        `SELECT DISTINCT principal_handle FROM product_analytics_erasure_actions
         WHERE purge_after <= ?`
      ).all(now) as unknown as { principal_handle: string }[];
      for (const candidate of candidates) {
        const current = currentConsent(this.db, candidate.principal_handle);
        if (current?.status === 'GRANTED') continue;
        const latest = this.db.prepare(
          `SELECT MAX(value) AS latest FROM (
             SELECT MAX(effective_at) AS value FROM product_analytics_consent_revisions WHERE principal_handle = ?
             UNION ALL
             SELECT MAX(effective_at) AS value FROM product_analytics_erasure_actions WHERE principal_handle = ?
           )`
        ).get(candidate.principal_handle, candidate.principal_handle) as { latest: string | null };
        if (!latest.latest) continue;
        const policyDeleteAt = new Date(Date.parse(latest.latest) + THIRTY_DAYS_MS + PHYSICAL_DELETE_GRACE_MS).toISOString();
        if (policyDeleteAt > now) continue;
        this.db.prepare('DELETE FROM product_analytics_idempotency WHERE principal_handle = ?').run(candidate.principal_handle);
        this.db.prepare('DELETE FROM product_analytics_consent_revisions WHERE principal_handle = ?').run(candidate.principal_handle);
        this.db.prepare('DELETE FROM product_analytics_erasure_actions WHERE principal_handle = ?').run(candidate.principal_handle);
      }
    });
    this.db.exec('PRAGMA wal_checkpoint(PASSIVE)');
    return this.readiness();
  }

  exportRecords(principal: AuthenticatedPrincipalV1, request: ProductAnalyticsExportRequestV1): ProductAnalyticsExportResultV1 {
    this.validateExportRequest(request);
    const handle = deletionHandle(principal, this.deletionHandleKey);
    const now = this.serverNow();
    this.db.exec('BEGIN');
    try {
      const rows = this.db.prepare(
        `SELECT event_id, envelope_json, server_received_at
         FROM governed_product_events
         WHERE principal_handle = ? AND server_received_at >= ? AND server_received_at < ? AND retention_delete_after > ?
         ORDER BY server_received_at ASC, event_id ASC
         LIMIT ?`
      ).all(handle, request.from, request.to, now, MAX_EXPORT_RECORDS + 1) as unknown as ExportRow[];
      if (rows.length > MAX_EXPORT_RECORDS) {
        this.db.exec('ROLLBACK');
        throw new ProductAnalyticsLifecycleError('EXPORT_LIMIT_REFUSED', 'export exceeds record limit');
      }
      const wrappers = rows.map((row) => Object.freeze({
        schemaVersion: SCHEMA_VERSION,
        kind: 'RECORD' as const,
        receivedAt: row.server_received_at,
        envelope: JSON.parse(row.envelope_json) as unknown,
      }));
      const canonicalWrappers = canonicalJsonStringify(wrappers);
      const digest = sha256Hex(`${EXPORT_DOMAIN}${canonicalWrappers}`);
      const manifest = Object.freeze({
        schemaVersion: SCHEMA_VERSION,
        kind: 'MANIFEST' as const,
        exportId: `gexv1_${this.uuid()}`,
        actionId: request.actionId,
        from: request.from,
        to: request.to,
        generatedAt: now,
        purpose: PURPOSE,
        familyId: PRODUCT_OPERATION_FAMILY_ID,
        recordCount: wrappers.length,
        digest: Object.freeze({ algorithm: 'SHA256' as const, value: digest }),
      });
      const lines = [canonicalJsonStringify(manifest), ...wrappers.map((wrapper) => canonicalJsonStringify(wrapper))];
      const body = `${lines.join('\n')}\n`;
      if (Buffer.byteLength(body, 'utf8') > MAX_EXPORT_BYTES) {
        this.db.exec('ROLLBACK');
        throw new ProductAnalyticsLifecycleError('EXPORT_LIMIT_REFUSED', 'export exceeds byte limit');
      }
      this.db.exec('COMMIT');
      return Object.freeze({ contentType: 'application/x-ndjson', body, recordCount: wrappers.length, digest });
    } catch (error) {
      try { this.db.exec('ROLLBACK'); } catch { /* transaction already closed */ }
      throw error;
    }
  }

  erase(principal: AuthenticatedPrincipalV1, request: ProductAnalyticsErasureRequestV1): ProductAnalyticsErasureResultV1 {
    this.validateErasureRequest(request);
    const handle = deletionHandle(principal, this.deletionHandleKey);
    const requestDigest = sha256Hex(canonicalJsonStringify(request));
    const existing = this.db.prepare(
      `SELECT request_digest, response_json FROM product_analytics_erasure_actions
       WHERE principal_handle = ? AND action_id = ?`
    ).get(handle, request.actionId) as ErasureActionRow | undefined;
    if (existing) {
      if (existing.request_digest !== requestDigest) {
        throw new ProductAnalyticsLifecycleError('ACTION_ID_CONFLICT', 'erasure action ID was already used with different content');
      }
      const prior = JSON.parse(existing.response_json) as ProductAnalyticsErasureResultV1;
      if (prior.result === 'SERVICE_SCOPE_RESOLVED') return Object.freeze(prior);
      return this.finishCheckpoint(handle, request.actionId, prior);
    }

    const now = this.serverNow();
    let preliminary: ProductAnalyticsErasureResultV1;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const current = currentConsent(this.db, handle);
      if (!current || String(current.revision) !== request.expectedConsentRevision) {
        throw new ProductAnalyticsLifecycleError('CONSENT_REVISION_CONFLICT', 'current consent revision does not match erasure request');
      }
      const revision = current.revision + 1;
      this.db.prepare(
        `INSERT INTO product_analytics_consent_revisions
         (principal_handle, purpose, revision, status, notice_digest, receipt_json, profile_pseudonym_id, effective_at, action_id)
         VALUES (?, ?, ?, 'DENIED', ?, NULL, NULL, ?, ?)`
      ).run(
        handle,
        PURPOSE,
        revision,
        PRODUCT_ANALYTICS_OPERATION_NOTICE_REFERENCE.digest.value,
        now,
        request.actionId
      );
      this.db.prepare(
        `UPDATE product_analytics_capture_authorizations SET invalidated_at = ?
         WHERE principal_handle = ? AND consumed_at IS NULL AND invalidated_at IS NULL`
      ).run(now, handle);
      this.db.prepare('DELETE FROM governed_product_events WHERE principal_handle = ?').run(handle);
      this.db.prepare('DELETE FROM governed_product_streams WHERE principal_handle = ?').run(handle);
      this.db.prepare('DELETE FROM product_analytics_capture_authorizations WHERE principal_handle = ?').run(handle);

      preliminary = Object.freeze({
        schemaVersion: SCHEMA_VERSION,
        requestId: `gerv1_${this.uuid()}`,
        actionId: request.actionId,
        purpose: PURPOSE,
        result: 'PARTIAL' as const,
        dispositions: Object.freeze([
          Object.freeze({ artifact: 'GOVERNED_PRODUCT_EVENTS', disposition: 'LOGICAL_DELETE_COMPLETED' as const }),
          Object.freeze({ artifact: 'GOVERNED_PRODUCT_STREAMS', disposition: 'LOGICAL_DELETE_COMPLETED' as const }),
          Object.freeze({ artifact: 'CAPTURE_AUTHORIZATIONS', disposition: 'LOGICAL_DELETE_COMPLETED' as const }),
          Object.freeze({ artifact: 'CONSENT_REVISIONS', disposition: 'POLICY_GOVERNED_RETENTION' as const }),
          Object.freeze({ artifact: 'CONSENT_IDEMPOTENCY', disposition: 'POLICY_GOVERNED_RETENTION' as const }),
          Object.freeze({ artifact: 'PROTECTED_DELETION_MAPPING', disposition: 'POLICY_GOVERNED_RETENTION' as const }),
          Object.freeze({ artifact: 'SQLITE_MAIN', disposition: 'LOGICAL_DELETE_COMPLETED' as const }),
          Object.freeze({ artifact: 'SQLITE_WAL', disposition: 'NOT_PRESENT' as const }),
          Object.freeze({ artifact: 'SQLITE_TEMP', disposition: 'NOT_PRESENT' as const }),
          Object.freeze({ artifact: 'LOCAL_OFFLINE_ARTIFACTS', disposition: 'OUTSIDE_SERVICE_CONTROL' as const }),
          Object.freeze({ artifact: 'DOWNLOADED_EXPORTS', disposition: 'OUTSIDE_SERVICE_CONTROL' as const }),
        ]),
      });
      const purgeAfter = new Date(Date.parse(now) + THIRTY_DAYS_MS + PHYSICAL_DELETE_GRACE_MS).toISOString();
      this.db.prepare(
        `INSERT INTO product_analytics_erasure_actions
         (principal_handle, action_id, request_digest, response_json, effective_at, purge_after)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(handle, request.actionId, requestDigest, canonicalJsonStringify(preliminary), now, purgeAfter);
      this.db.exec('COMMIT');
    } catch (error) {
      try { this.db.exec('ROLLBACK'); } catch { /* transaction already closed */ }
      throw error;
    }
    return this.finishCheckpoint(handle, request.actionId, preliminary);
  }

  private finishCheckpoint(handle: string, actionId: string, prior: ProductAnalyticsErasureResultV1): ProductAnalyticsErasureResultV1 {
    try {
      this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
      const dispositions = prior.dispositions.map((item) =>
        item.artifact === 'SQLITE_WAL'
          ? Object.freeze({ artifact: item.artifact, disposition: 'CHECKPOINT_COMPLETED' as const })
          : item
      );
      const resolved = Object.freeze({ ...prior, result: 'SERVICE_SCOPE_RESOLVED' as const, dispositions: Object.freeze(dispositions) });
      this.transaction(() => {
        this.db.prepare(
          `UPDATE product_analytics_erasure_actions SET response_json = ?
           WHERE principal_handle = ? AND action_id = ?`
        ).run(canonicalJsonStringify(resolved), handle, actionId);
      });
      return resolved;
    } catch {
      return prior;
    }
  }

  private validateExportRequest(request: ProductAnalyticsExportRequestV1): void {
    exactKeys(request, ['schemaVersion', 'actionId', 'from', 'to'], 'export request');
    if (request.schemaVersion !== SCHEMA_VERSION) throw new ProductAnalyticsLifecycleError('INVALID_REQUEST', 'unsupported export schema version');
    assertUuid(request.actionId, 'actionId');
    const from = parseServerTime(request.from, 'from');
    const to = parseServerTime(request.to, 'to');
    if (to <= from || to - from > MAX_EXPORT_INTERVAL_MS) {
      throw new ProductAnalyticsLifecycleError('INVALID_REQUEST', 'export interval must be positive and at most seven days');
    }
  }

  private validateErasureRequest(request: ProductAnalyticsErasureRequestV1): void {
    exactKeys(request, ['schemaVersion', 'actionId', 'expectedConsentRevision'], 'erasure request');
    if (request.schemaVersion !== SCHEMA_VERSION) throw new ProductAnalyticsLifecycleError('INVALID_REQUEST', 'unsupported erasure schema version');
    assertUuid(request.actionId, 'actionId');
    if (!POSITIVE_DECIMAL_PATTERN.test(request.expectedConsentRevision)) {
      throw new ProductAnalyticsLifecycleError('INVALID_REQUEST', 'expectedConsentRevision must be a positive canonical decimal string');
    }
  }

  private serverNow(): string {
    const now = this.now();
    if (!Number.isFinite(now.getTime())) throw new ProductAnalyticsLifecycleError('STORAGE_CONFIGURATION_INVALID', 'server clock returned an invalid time');
    return now.toISOString();
  }

  private transaction<T>(work: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const value = work();
      this.db.exec('COMMIT');
      return value;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS product_analytics_erasure_actions (
        principal_handle TEXT NOT NULL,
        action_id TEXT NOT NULL,
        request_digest TEXT NOT NULL,
        response_json TEXT NOT NULL,
        effective_at TEXT NOT NULL,
        purge_after TEXT NOT NULL,
        PRIMARY KEY (principal_handle, action_id)
      );
    `);
  }
}
