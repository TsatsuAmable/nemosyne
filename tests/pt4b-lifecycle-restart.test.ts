import { createHmac } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';

import { SqliteProductAnalyticsConsentAuthority, type AuthenticatedPrincipalV1 } from '../src/governance-service/ProductAnalyticsConsentAuthority.ts';
import { SqliteProductAnalyticsEventIngestion } from '../src/governance-service/ProductAnalyticsEventIngestion.ts';
import { SqliteProductAnalyticsLifecycleAuthority } from '../src/governance-service/ProductAnalyticsLifecycleAuthority.ts';

const PRINCIPAL: AuthenticatedPrincipalV1 = Object.freeze({ issuer: 'https://issuer.example', subject: 'subject-123' });
const PURPOSE_KEY = Object.freeze({ version: 'p1', key: new Uint8Array(32).fill(7) });
const DELETION_KEY = Object.freeze({ version: 'd1', key: new Uint8Array(32).fill(9) });
const DELETION_DOMAIN = Buffer.from('nemosyne:deletion-handle:v1\n', 'utf8');
const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

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

function deletionHandle(): string {
  const digest = createHmac('sha256', DELETION_KEY.key)
    .update(DELETION_DOMAIN)
    .update(frame([PRINCIPAL.issuer, PRINCIPAL.subject]))
    .digest('hex');
  return `dhv1_${DELETION_KEY.version}_${digest}`;
}

describe('PT4B7 lifecycle restart durability', () => {
  it('reopens the same durable volume and preserves export/erasure reachability', () => {
    const dataDirectory = mkdtempSync(join(tmpdir(), 'nemosyne-pt4b7-restart-'));
    directories.push(dataDirectory);
    const now = new Date('2026-09-03T05:00:00.000Z');

    const consent = new SqliteProductAnalyticsConsentAuthority({
      dataDirectory,
      purposePseudonymKey: PURPOSE_KEY,
      deletionHandleKey: DELETION_KEY,
      now: () => now,
    });
    const ingestion = new SqliteProductAnalyticsEventIngestion({
      dataDirectory,
      deletionHandleKey: DELETION_KEY,
      now: () => now,
    });
    const lifecycle = new SqliteProductAnalyticsLifecycleAuthority({
      dataDirectory,
      deletionHandleKey: DELETION_KEY,
      now: () => now,
    });

    const granted = consent.grant(PRINCIPAL, {
      schemaVersion: '1',
      purpose: 'product-analytics',
      notice: (await import('../src/governance/index.ts')).PRODUCT_ANALYTICS_OPERATION_NOTICE_REFERENCE,
      confirmed: true,
      actionId: '11111111-1111-4111-8111-111111111111',
      expectedPriorRevision: null,
    });

    const db = new DatabaseSync(join(dataDirectory, 'governance.sqlite'));
    const handle = deletionHandle();
    db.prepare(
      `INSERT INTO governed_product_streams
       (stream_id, principal_handle, producer_instance_id, purpose, profile_pseudonym_id, family_id, mode, next_sequence)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'strv1_44444444-4444-4444-8444-444444444444',
      handle,
      'piv1_33333333-3333-4333-8333-333333333333',
      'product-analytics',
      granted.profilePseudonymId!,
      'product.operation-applied.v1',
      'PRODUCT',
      1
    );
    db.prepare(
      `INSERT INTO governed_product_events
       (principal_handle, event_id, stream_id, stream_sequence, content_digest, payload_digest,
        envelope_json, server_received_at, retention_delete_after, physical_delete_deadline)
       VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`
    ).run(
      handle,
      '22222222-2222-4222-8222-222222222222',
      'strv1_44444444-4444-4444-8444-444444444444',
      'a'.repeat(64),
      'b'.repeat(64),
      JSON.stringify({ eventId: '22222222-2222-4222-8222-222222222222' }),
      now.toISOString(),
      '2026-10-03T05:00:00.000Z',
      '2026-10-04T05:00:00.000Z'
    );
    db.close();
    lifecycle.close();
    ingestion.close();
    consent.close();

    const consentAfterRestart = new SqliteProductAnalyticsConsentAuthority({
      dataDirectory,
      purposePseudonymKey: PURPOSE_KEY,
      deletionHandleKey: DELETION_KEY,
      now: () => now,
    });
    const ingestionAfterRestart = new SqliteProductAnalyticsEventIngestion({
      dataDirectory,
      deletionHandleKey: DELETION_KEY,
      now: () => now,
    });
    const lifecycleAfterRestart = new SqliteProductAnalyticsLifecycleAuthority({
      dataDirectory,
      deletionHandleKey: DELETION_KEY,
      now: () => now,
    });

    expect(lifecycleAfterRestart.exportRecords(PRINCIPAL, {
      schemaVersion: '1',
      actionId: '77777777-7777-4777-8777-777777777777',
      from: '2026-09-03T04:59:00.000Z',
      to: '2026-09-03T05:01:00.000Z',
    }).recordCount).toBe(1);

    const erased = lifecycleAfterRestart.erase(PRINCIPAL, {
      schemaVersion: '1',
      actionId: '88888888-8888-4888-8888-888888888888',
      expectedConsentRevision: granted.revision!,
    });
    expect(erased.result).toBe('SERVICE_SCOPE_RESOLVED');

    lifecycleAfterRestart.close();
    ingestionAfterRestart.close();
    consentAfterRestart.close();

    const finalDb = new DatabaseSync(join(dataDirectory, 'governance.sqlite'), { readOnly: true });
    expect((finalDb.prepare('SELECT COUNT(*) AS count FROM governed_product_events WHERE principal_handle = ?').get(handle) as { count: number }).count).toBe(0);
    expect((finalDb.prepare('SELECT COUNT(*) AS count FROM product_analytics_consent_revisions WHERE principal_handle = ?').get(handle) as { count: number }).count).toBeGreaterThan(0);
    finalDb.close();
  });
});
