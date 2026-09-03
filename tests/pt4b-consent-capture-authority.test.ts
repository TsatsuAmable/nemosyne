import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';

import { PRODUCT_ANALYTICS_OPERATION_NOTICE_REFERENCE, PRODUCT_OPERATION_FAMILY_ID } from '../src/governance/index.ts';
import {
  ProductAnalyticsAuthorityError,
  SqliteProductAnalyticsConsentAuthority,
  derivePurposePseudonymV1,
  type AuthenticatedPrincipalV1,
  type ProductAnalyticsConsentAuthorityOptions,
} from '../src/governance-service/ProductAnalyticsConsentAuthority.ts';

const PRINCIPAL: AuthenticatedPrincipalV1 = Object.freeze({
  issuer: 'https://issuer.example',
  subject: 'subject-123',
});

const PURPOSE_KEY = Object.freeze({ version: 'k1', key: Uint8Array.from({ length: 32 }, (_, i) => i) });
const DELETION_KEY = Object.freeze({ version: 'd1', key: Uint8Array.from({ length: 32 }, (_, i) => 255 - i) });

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function createDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'nemosyne-pt4b2-'));
  temporaryDirectories.push(directory);
  return directory;
}

function deterministicUuidFactory(): () => string {
  let counter = 0;
  return () => {
    counter += 1;
    return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
  };
}

function createOptions(dataDirectory: string, now = new Date('2026-09-03T04:00:00.000Z')): ProductAnalyticsConsentAuthorityOptions {
  return {
    dataDirectory,
    purposePseudonymKey: PURPOSE_KEY,
    deletionHandleKey: DELETION_KEY,
    now: () => now,
    uuid: deterministicUuidFactory(),
    captureAuthorizationTtlMs: 30_000,
  };
}

function grantRequest(actionId = '11111111-1111-4111-8111-111111111111', expectedPriorRevision: string | null = null) {
  return {
    schemaVersion: '1' as const,
    purpose: 'product-analytics' as const,
    notice: PRODUCT_ANALYTICS_OPERATION_NOTICE_REFERENCE,
    confirmed: true as const,
    actionId,
    expectedPriorRevision,
  };
}

function captureRequest(eventId = '22222222-2222-4222-8222-222222222222', streamSequence = 0) {
  return {
    schemaVersion: '1' as const,
    familyId: PRODUCT_OPERATION_FAMILY_ID,
    eventId,
    producerInstanceId: 'piv1_33333333-3333-4333-8333-333333333333',
    streamId: 'strv1_44444444-4444-4444-8444-444444444444',
    streamSequence,
  };
}

function expectAuthorityError(fn: () => unknown, code: string): void {
  try {
    fn();
    throw new Error(`expected ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(ProductAnalyticsAuthorityError);
    expect((error as ProductAnalyticsAuthorityError).code).toBe(code);
  }
}

describe('PT4B2 durable product analytics consent/capture authority', () => {
  it('derives the RFC 0004 purpose pseudonym with unambiguous length framing', () => {
    expect(derivePurposePseudonymV1(PRINCIPAL, 'product-analytics', PURPOSE_KEY)).toBe(
      'ppv1_k1_21c135cf2ec5ade8d7d9483d69ca18a5a59b7475fe8ba4576055f890fa1b65dc'
    );
    expect(derivePurposePseudonymV1({ issuer: 'ab', subject: 'c' }, 'product-analytics', PURPOSE_KEY)).not.toBe(
      derivePurposePseudonymV1({ issuer: 'a', subject: 'bc' }, 'product-analytics', PURPOSE_KEY)
    );
  });

  it('defaults denied and persists an exact grant across database reopen', () => {
    const directory = createDirectory();
    const authority = new SqliteProductAnalyticsConsentAuthority(createOptions(directory));
    expect(authority.getCurrent(PRINCIPAL)).toEqual({
      schemaVersion: '1',
      purpose: 'product-analytics',
      status: 'DENIED',
      revision: null,
      receipt: null,
      profilePseudonymId: null,
      effectiveAt: null,
    });

    const granted = authority.grant(PRINCIPAL, grantRequest());
    expect(granted.status).toBe('GRANTED');
    expect(granted.revision).toBe('1');
    expect(granted.profilePseudonymId).toMatch(/^ppv1_k1_[0-9a-f]{64}$/);
    expect(granted.receipt?.revision).toBe('1');
    authority.close();

    const reopened = new SqliteProductAnalyticsConsentAuthority(createOptions(directory));
    expect(reopened.getCurrent(PRINCIPAL)).toEqual({
      schemaVersion: '1',
      purpose: 'product-analytics',
      status: 'GRANTED',
      revision: '1',
      receipt: granted.receipt,
      profilePseudonymId: granted.profilePseudonymId,
      effectiveAt: granted.effectiveAt,
    });
    reopened.close();

    expect(statSync(directory).mode & 0o777).toBe(0o700);
    expect(statSync(join(directory, 'governance.sqlite')).mode & 0o777).toBe(0o600);
  });

  it('uses action IDs as exact-content idempotency keys and refuses stale CAS writes', () => {
    const authority = new SqliteProductAnalyticsConsentAuthority(createOptions(createDirectory()));
    const request = grantRequest();
    const first = authority.grant(PRINCIPAL, request);
    expect(authority.grant(PRINCIPAL, request)).toEqual(first);

    expectAuthorityError(() => authority.grant(PRINCIPAL, grantRequest(request.actionId, '1')), 'ACTION_ID_CONFLICT');
    expectAuthorityError(
      () => authority.grant(PRINCIPAL, grantRequest('55555555-5555-4555-8555-555555555555', null)),
      'CONSENT_REVISION_CONFLICT'
    );
    authority.close();
  });

  it('creates a new durable revision on revoke and invalidates outstanding authorizations', () => {
    const directory = createDirectory();
    const authority = new SqliteProductAnalyticsConsentAuthority(createOptions(directory));
    const grant = authority.grant(PRINCIPAL, grantRequest());
    const capture = authority.authorizeCapture(PRINCIPAL, captureRequest());

    const revoked = authority.revoke(PRINCIPAL, {
      schemaVersion: '1',
      purpose: 'product-analytics',
      actionId: '66666666-6666-4666-8666-666666666666',
      expectedCurrentRevision: '1',
    });
    expect(revoked).toMatchObject({ status: 'DENIED', revision: '2', receipt: null, profilePseudonymId: null });
    expectAuthorityError(
      () => authority.authorizeCapture(PRINCIPAL, captureRequest('77777777-7777-4777-8777-777777777777')),
      'CONSENT_REQUIRED'
    );
    authority.close();

    const db = new DatabaseSync(join(directory, 'governance.sqlite'), { readOnly: true });
    const revisions = db.prepare('SELECT revision, status, receipt_json FROM product_analytics_consent_revisions ORDER BY revision').all() as Array<{
      revision: number;
      status: string;
      receipt_json: string | null;
    }>;
    expect(revisions.map(({ revision, status }) => ({ revision, status }))).toEqual([
      { revision: 1, status: 'GRANTED' },
      { revision: 2, status: 'DENIED' },
    ]);
    expect(revisions[0]?.receipt_json).toContain(grant.receipt?.id);
    expect(revisions[1]?.receipt_json).toBeNull();
    const storedCapture = db
      .prepare('SELECT authorization_id, invalidated_at FROM product_analytics_capture_authorizations WHERE event_id = ?')
      .get(capture.eventId) as { authorization_id: string; invalidated_at: string | null };
    expect(storedCapture.authorization_id).toBe(capture.authorizationId);
    expect(storedCapture.invalidated_at).not.toBeNull();
    db.close();
  });

  it('binds capture authorization exactly to principal, family, event, producer, stream and sequence', () => {
    const authority = new SqliteProductAnalyticsConsentAuthority(createOptions(createDirectory()));
    authority.grant(PRINCIPAL, grantRequest());

    const request = captureRequest();
    const authorization = authority.authorizeCapture(PRINCIPAL, request);
    expect(authorization).toMatchObject({
      eventId: request.eventId,
      producerInstanceId: request.producerInstanceId,
      streamId: request.streamId,
      streamSequence: 0,
      familyId: PRODUCT_OPERATION_FAMILY_ID,
      authorizedAt: '2026-09-03T04:00:00.000Z',
      expiresAt: '2026-09-03T04:00:30.000Z',
    });
    expect(authority.authorizeCapture(PRINCIPAL, request)).toEqual(authorization);
    expectAuthorityError(() => authority.authorizeCapture(PRINCIPAL, { ...request, streamSequence: 1 }), 'ACTION_ID_CONFLICT');

    const otherPrincipal = { issuer: PRINCIPAL.issuer, subject: 'different-subject' };
    expectAuthorityError(() => authority.authorizeCapture(otherPrincipal, request), 'CONSENT_REQUIRED');
    authority.close();
  });

  it('does not persist raw issuer, subject or key material in the durable database', () => {
    const directory = createDirectory();
    const authority = new SqliteProductAnalyticsConsentAuthority(createOptions(directory));
    authority.grant(PRINCIPAL, grantRequest());
    authority.authorizeCapture(PRINCIPAL, captureRequest());
    authority.close();

    const bytes = readFileSync(join(directory, 'governance.sqlite'));
    const text = bytes.toString('latin1');
    expect(text).not.toContain(PRINCIPAL.issuer);
    expect(text).not.toContain(PRINCIPAL.subject);
    expect(text).not.toContain(Buffer.from(PURPOSE_KEY.key).toString('hex'));
    expect(text).not.toContain(Buffer.from(DELETION_KEY.key).toString('hex'));
  });

  it('fails closed on weak keys, wrong notice, malformed IDs and extra request fields', () => {
    const directory = createDirectory();
    expectAuthorityError(
      () =>
        new SqliteProductAnalyticsConsentAuthority({
          ...createOptions(directory),
          purposePseudonymKey: { version: 'weak', key: new Uint8Array(31) },
        }),
      'STORAGE_CONFIGURATION_INVALID'
    );

    const authority = new SqliteProductAnalyticsConsentAuthority(createOptions(directory));
    expectAuthorityError(
      () =>
        authority.grant(PRINCIPAL, {
          ...grantRequest(),
          notice: { ...PRODUCT_ANALYTICS_OPERATION_NOTICE_REFERENCE, id: 'other-notice' },
        }),
      'INVALID_REQUEST'
    );
    expectAuthorityError(
      () => authority.grant(PRINCIPAL, { ...grantRequest(), extra: true } as never),
      'INVALID_REQUEST'
    );
    expectAuthorityError(
      () => authority.authorizeCapture(PRINCIPAL, { ...captureRequest(), eventId: 'not-a-uuid' }),
      'INVALID_REQUEST'
    );
    authority.close();
  });
});
