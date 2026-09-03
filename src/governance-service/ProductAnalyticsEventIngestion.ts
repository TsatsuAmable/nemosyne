import { createHmac, randomUUID } from 'node:crypto';
import { chmodSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import {
  PRODUCT_GOVERNED_EVENT_REGISTRY_V1,
  PRODUCT_OPERATION_FAMILY_ID,
  admitGovernedEventEnvelopeV1,
  canonicalGovernedJsonV1,
  type GovernanceAdmissionAuthorityV1,
  type GovernanceAuthorityContextV1,
  type GovernanceAuthorityDecisionV1,
} from '../governance/index.ts';
import type { AuthenticatedPrincipalV1, VersionedSecretKeyV1 } from './ProductAnalyticsConsentAuthority.ts';

const PURPOSE = 'product-analytics';
const DELETION_HANDLE_DOMAIN = Buffer.from('nemosyne:deletion-handle:v1\n', 'utf8');
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const PHYSICAL_DELETE_GRACE_MS = 24 * 60 * 60 * 1000;

export type ProductEventDispositionStatus =
  | 'STORED'
  | 'EXACT_DUPLICATE'
  | 'REFUSED_GOVERNANCE'
  | 'EVENT_ID_CONFLICT'
  | 'STREAM_OWNERSHIP_CONFLICT'
  | 'SEQUENCE_CONFLICT'
  | 'GAP_REFUSED'
  | 'STORAGE_FAILURE';

export interface ProductEventDispositionV1 {
  readonly eventId: string | null;
  readonly status: ProductEventDispositionStatus;
  readonly reasonCode: string | null;
}

export interface ProductAnalyticsEventIngestionOptions {
  readonly dataDirectory: string;
  readonly deletionHandleKey: VersionedSecretKeyV1;
  readonly now?: () => Date;
  readonly uuid?: () => string;
}

interface ConsentRow {
  readonly revision: number;
  readonly status: 'GRANTED' | 'DENIED';
  readonly receipt_json: string | null;
  readonly profile_pseudonym_id: string | null;
}

interface CaptureRow {
  readonly authorization_id: string;
  readonly producer_instance_id: string;
  readonly stream_id: string;
  readonly stream_sequence: number;
  readonly family_id: string;
  readonly consent_revision: number;
  readonly receipt_json: string;
  readonly profile_pseudonym_id: string;
  readonly authorized_at: string;
  readonly expires_at: string;
  readonly consumed_at: string | null;
  readonly invalidated_at: string | null;
}

interface StoredEventRow {
  readonly content_digest: string;
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
  if (!secret.version || secret.key.byteLength < 32) throw new Error('invalid deletion-handle key');
  const digest = createHmac('sha256', secret.key)
    .update(DELETION_HANDLE_DOMAIN)
    .update(frame([principal.issuer, principal.subject]))
    .digest('hex');
  return `dhv1_${secret.version}_${digest}`;
}

function refuse(reasonCode: ProductEventDispositionStatus): GovernanceAuthorityDecisionV1 {
  return Object.freeze({ status: 'REFUSED', reasonCode, message: 'governed product event refused' });
}

export class SqliteProductAnalyticsEventIngestion {
  private readonly db: DatabaseSync;
  private readonly deletionHandleKey: VersionedSecretKeyV1;
  private readonly now: () => Date;
  private readonly uuid: () => string;

  constructor(options: ProductAnalyticsEventIngestionOptions) {
    this.deletionHandleKey = options.deletionHandleKey;
    this.now = options.now ?? (() => new Date());
    this.uuid = options.uuid ?? randomUUID;
    mkdirSync(options.dataDirectory, { recursive: true, mode: 0o700 });
    chmodSync(options.dataDirectory, 0o700);
    if ((statSync(options.dataDirectory).mode & 0o777) !== 0o700) throw new Error('governance data directory must be mode 0700');
    const databasePath = join(options.dataDirectory, 'governance.sqlite');
    this.db = new DatabaseSync(databasePath);
    chmodSync(databasePath, 0o600);
    this.db.exec('PRAGMA foreign_keys = ON');
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA synchronous = FULL');
    this.db.exec('PRAGMA secure_delete = ON');
    this.db.exec('PRAGMA wal_autocheckpoint = 1000');
    this.migrate();
  }

  close(): void {
    this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    this.db.close();
  }

  async ingestLine(principal: AuthenticatedPrincipalV1, jsonText: string): Promise<ProductEventDispositionV1> {
    let disposition: ProductEventDispositionV1 = Object.freeze({ eventId: null, status: 'REFUSED_GOVERNANCE', reasonCode: 'REFUSED_GOVERNANCE' });
    const authority: GovernanceAdmissionAuthorityV1 = {
      evaluate: async (context) => {
        const evaluated = this.evaluateAndStore(principal, context);
        disposition = evaluated.disposition;
        return evaluated.decision;
      },
    };
    const admitted = await admitGovernedEventEnvelopeV1(jsonText, PRODUCT_GOVERNED_EVENT_REGISTRY_V1, authority);
    if (!admitted.ok && disposition.eventId === null) {
      return Object.freeze({ eventId: null, status: 'REFUSED_GOVERNANCE', reasonCode: admitted.issues[0]?.code ?? 'REFUSED_GOVERNANCE' });
    }
    return disposition;
  }

  private evaluateAndStore(
    principal: AuthenticatedPrincipalV1,
    context: GovernanceAuthorityContextV1
  ): { readonly decision: GovernanceAuthorityDecisionV1; readonly disposition: ProductEventDispositionV1 } {
    const envelope = context.envelope;
    const eventId = envelope.eventId;
    if (context.family.familyId !== PRODUCT_OPERATION_FAMILY_ID) {
      return { decision: refuse('REFUSED_GOVERNANCE'), disposition: { eventId, status: 'REFUSED_GOVERNANCE', reasonCode: 'UNKNOWN_FAMILY' } };
    }
    const handle = deletionHandle(principal, this.deletionHandleKey);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const now = this.now();
      if (!Number.isFinite(now.getTime())) throw new Error('invalid server clock');
      const receivedAt = now.toISOString();
      const current = this.currentConsent(handle);
      if (!current || current.status !== 'GRANTED' || !current.receipt_json || !current.profile_pseudonym_id) {
        this.db.exec('ROLLBACK');
        return { decision: refuse('REFUSED_GOVERNANCE'), disposition: { eventId, status: 'REFUSED_GOVERNANCE', reasonCode: 'CONSENT_REQUIRED' } };
      }
      if (envelope.identities.profilePseudonymId !== current.profile_pseudonym_id) {
        this.db.exec('ROLLBACK');
        return { decision: refuse('REFUSED_GOVERNANCE'), disposition: { eventId, status: 'REFUSED_GOVERNANCE', reasonCode: 'PRINCIPAL_BINDING_MISMATCH' } };
      }
      const receipt = JSON.parse(current.receipt_json) as { id: string; revision: string; digest: { algorithm: string; value: string } };
      const authorization = envelope.authorization[0];
      if (
        envelope.authorization.length !== 1 ||
        !authorization ||
        authorization.evidence.id !== receipt.id ||
        authorization.evidence.revision !== receipt.revision ||
        authorization.evidence.digest.algorithm !== receipt.digest.algorithm ||
        authorization.evidence.digest.value !== receipt.digest.value
      ) {
        this.db.exec('ROLLBACK');
        return { decision: refuse('REFUSED_GOVERNANCE'), disposition: { eventId, status: 'REFUSED_GOVERNANCE', reasonCode: 'RECEIPT_MISMATCH' } };
      }

      const prior = this.db.prepare(
        'SELECT content_digest FROM governed_product_events WHERE principal_handle = ? AND event_id = ?'
      ).get(handle, eventId) as StoredEventRow | undefined;
      if (prior) {
        this.db.exec('COMMIT');
        const exact = prior.content_digest === envelope.contentDigest.value;
        return exact
          ? { decision: this.authorized(receivedAt), disposition: { eventId, status: 'EXACT_DUPLICATE', reasonCode: null } }
          : { decision: refuse('EVENT_ID_CONFLICT'), disposition: { eventId, status: 'EVENT_ID_CONFLICT', reasonCode: 'EVENT_ID_CONFLICT' } };
      }

      const capture = this.db.prepare(
        `SELECT authorization_id, producer_instance_id, stream_id, stream_sequence, family_id,
                consent_revision, receipt_json, profile_pseudonym_id, authorized_at, expires_at,
                consumed_at, invalidated_at
         FROM product_analytics_capture_authorizations
         WHERE principal_handle = ? AND event_id = ?`
      ).get(handle, eventId) as CaptureRow | undefined;
      if (
        !capture || capture.consumed_at !== null || capture.invalidated_at !== null ||
        capture.consent_revision !== current.revision || capture.producer_instance_id !== envelope.producerInstanceId ||
        capture.stream_id !== envelope.streamId || capture.stream_sequence !== envelope.streamSequence ||
        capture.family_id !== envelope.eventFamilyId || capture.profile_pseudonym_id !== current.profile_pseudonym_id ||
        canonicalGovernedJsonV1(JSON.parse(capture.receipt_json)) !== canonicalGovernedJsonV1(receipt) ||
        envelope.capturedAt < capture.authorized_at || envelope.capturedAt > capture.expires_at || receivedAt > capture.expires_at
      ) {
        this.db.exec('ROLLBACK');
        return { decision: refuse('REFUSED_GOVERNANCE'), disposition: { eventId, status: 'REFUSED_GOVERNANCE', reasonCode: 'CAPTURE_AUTHORIZATION_REFUSED' } };
      }

      const stream = this.db.prepare(
        `SELECT principal_handle, producer_instance_id, purpose, profile_pseudonym_id, family_id, mode, next_sequence
         FROM governed_product_streams WHERE stream_id = ?`
      ).get(envelope.streamId) as StreamRow | undefined;
      if (stream && (
        stream.principal_handle !== handle || stream.producer_instance_id !== envelope.producerInstanceId ||
        stream.purpose !== envelope.purpose || stream.profile_pseudonym_id !== current.profile_pseudonym_id ||
        stream.family_id !== envelope.eventFamilyId || stream.mode !== envelope.mode
      )) {
        this.db.exec('ROLLBACK');
        return { decision: refuse('STREAM_OWNERSHIP_CONFLICT'), disposition: { eventId, status: 'STREAM_OWNERSHIP_CONFLICT', reasonCode: 'STREAM_OWNERSHIP_CONFLICT' } };
      }
      const nextSequence = stream?.next_sequence ?? 0;
      if (envelope.streamSequence > nextSequence) {
        this.db.exec('ROLLBACK');
        return { decision: refuse('GAP_REFUSED'), disposition: { eventId, status: 'GAP_REFUSED', reasonCode: 'GAP_REFUSED' } };
      }
      if (envelope.streamSequence < nextSequence) {
        this.db.exec('ROLLBACK');
        return { decision: refuse('SEQUENCE_CONFLICT'), disposition: { eventId, status: 'SEQUENCE_CONFLICT', reasonCode: 'SEQUENCE_CONFLICT' } };
      }

      if (!stream) {
        this.db.prepare(
          `INSERT INTO governed_product_streams
           (stream_id, principal_handle, producer_instance_id, purpose, profile_pseudonym_id, family_id, mode, next_sequence)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
        ).run(envelope.streamId, handle, envelope.producerInstanceId, envelope.purpose, current.profile_pseudonym_id, envelope.eventFamilyId, envelope.mode);
      }
      const retentionDeleteAfter = new Date(now.getTime() + THIRTY_DAYS_MS).toISOString();
      const physicalDeleteDeadline = new Date(now.getTime() + THIRTY_DAYS_MS + PHYSICAL_DELETE_GRACE_MS).toISOString();
      this.db.prepare(
        `INSERT INTO governed_product_events
         (principal_handle, event_id, stream_id, stream_sequence, content_digest, payload_digest,
          envelope_json, server_received_at, retention_delete_after, physical_delete_deadline)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(handle, eventId, envelope.streamId, envelope.streamSequence, envelope.contentDigest.value,
        envelope.payloadDigest.value, canonicalGovernedJsonV1(envelope), receivedAt, retentionDeleteAfter, physicalDeleteDeadline);
      this.db.prepare('UPDATE governed_product_streams SET next_sequence = ? WHERE stream_id = ?')
        .run(envelope.streamSequence + 1, envelope.streamId);
      const consumed = this.db.prepare(
        `UPDATE product_analytics_capture_authorizations SET consumed_at = ?
         WHERE authorization_id = ? AND consumed_at IS NULL AND invalidated_at IS NULL`
      ).run(receivedAt, capture.authorization_id);
      if (Number(consumed.changes) !== 1) throw new Error('capture authorization consumption race');
      this.db.exec('COMMIT');
      return { decision: this.authorized(receivedAt), disposition: { eventId, status: 'STORED', reasonCode: null } };
    } catch {
      try { this.db.exec('ROLLBACK'); } catch { /* already rolled back */ }
      return { decision: refuse('STORAGE_FAILURE'), disposition: { eventId, status: 'STORAGE_FAILURE', reasonCode: 'STORAGE_FAILURE' } };
    }
  }

  private authorized(evaluatedAt: string): GovernanceAuthorityDecisionV1 {
    return Object.freeze({ status: 'AUTHORIZED', decisionId: `gev1_${this.uuid()}`, authorityVersion: 'product-analytics-event-store-v1', evaluatedAt });
  }

  private currentConsent(handle: string): ConsentRow | null {
    return (this.db.prepare(
      `SELECT revision, status, receipt_json, profile_pseudonym_id
       FROM product_analytics_consent_revisions
       WHERE principal_handle = ? AND purpose = ? ORDER BY revision DESC LIMIT 1`
    ).get(handle, PURPOSE) as ConsentRow | undefined) ?? null;
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS governed_product_streams (
        stream_id TEXT PRIMARY KEY,
        principal_handle TEXT NOT NULL,
        producer_instance_id TEXT NOT NULL,
        purpose TEXT NOT NULL,
        profile_pseudonym_id TEXT NOT NULL,
        family_id TEXT NOT NULL,
        mode TEXT NOT NULL,
        next_sequence INTEGER NOT NULL CHECK (next_sequence >= 0)
      );
      CREATE TABLE IF NOT EXISTS governed_product_events (
        principal_handle TEXT NOT NULL,
        event_id TEXT NOT NULL,
        stream_id TEXT NOT NULL,
        stream_sequence INTEGER NOT NULL CHECK (stream_sequence >= 0),
        content_digest TEXT NOT NULL,
        payload_digest TEXT NOT NULL,
        envelope_json TEXT NOT NULL,
        server_received_at TEXT NOT NULL,
        retention_delete_after TEXT NOT NULL,
        physical_delete_deadline TEXT NOT NULL,
        PRIMARY KEY (principal_handle, event_id),
        UNIQUE (stream_id, stream_sequence),
        FOREIGN KEY (stream_id) REFERENCES governed_product_streams(stream_id)
      );
    `);
  }
}
