import { createPublicKey, generateKeyPairSync, sign } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';

import {
  GOVERNED_DATA_CLASSES,
  GOVERNED_PURPOSES,
  PRODUCT_ANALYTICS_DATA_SERVICE_AUTHORITY_REFERENCE,
  PRODUCT_ANALYTICS_OPERATION_NOTICE_REFERENCE,
  PRODUCT_ANALYTICS_OPERATION_RETENTION_REFERENCE,
  PRODUCT_OPERATION_FAMILY_ID,
  PRODUCT_OPERATION_SOURCE_COMPONENT,
  computeGovernedEventContentDigestV1,
  computeGovernedPayloadDigestV1,
  type GovernedEventEnvelopeV1,
  type RuntimeComponentReferenceV1,
} from '../src/governance/index.ts';
import type {
  PostgresClientV1,
  PostgresPoolV1,
  PostgresQueryResultV1,
} from '../src/governance-service/PostgresGovernanceDatabase.ts';
import { POSTGRES_GOVERNANCE_SCHEMA_V1 } from '../src/governance-service/PostgresGovernanceDatabase.ts';
import { OidcJwksAuthority } from '../src/governance-service/OidcJwksAuthority.ts';
import type { AuthorizationEvidenceV1 } from '../src/governance/index.ts';
import { runGovernanceService } from '../src/governance-service/server-entry.ts';

const ISSUER = 'https://issuer.example';
const AUDIENCE = 'nemosyne-data-plane';
const KID = 'rfl-framing-key-1';
const ALL_SCOPES = 'consent:read consent:write events:capture events:write events:export events:erase';
const GRANT_ID = '11111111-1111-4111-8111-111111111111';
const EVENT_ID = '22222222-2222-4222-8222-222222222222';
const PRODUCER_ID = 'piv1_33333333-3333-4333-8333-333333333333';
const STREAM_ID = 'strv1_44444444-4444-4444-8444-444444444444';

type RunningService = { stop: () => Promise<void> };
const running: RunningService[] = [];

afterEach(async () => {
  while (running.length > 0) {
    const service = running.pop();
    if (service) await service.stop();
  }
});

const { publicKey, privateKey } = generateKeyPairSync('ec', {
  namedCurve: 'P-256',
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const PUBLIC_JWK = Object.freeze({
  ...createPublicKey(publicKey).export({ format: 'jwk' }),
  kid: KID,
  use: 'sig',
});
let tokenCounter = 0;

function jwksFetcher(input: string | URL | Request): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  if (url === `${ISSUER}/.well-known/openid-configuration`) {
    return Promise.resolve(
      new Response(JSON.stringify({ issuer: ISSUER, jwks_uri: `${ISSUER}/.well-known/jwks.json` }), {
        status: 200,
      }),
    );
  }
  if (url === `${ISSUER}/.well-known/jwks.json`) {
    return Promise.resolve(new Response(JSON.stringify({ keys: [PUBLIC_JWK] }), { status: 200 }));
  }
  return Promise.resolve(new Response('not found', { status: 404 }));
}

function base64url(value: string | Buffer): string {
  return (typeof value === 'string' ? Buffer.from(value, 'utf8') : value).toString('base64url');
}

function mintToken(): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = { typ: 'at+jwt', alg: 'ES256', kid: KID };
  const claims = {
    iss: ISSUER,
    sub: 'subject-123',
    jti: `rfl-framing-token-${++tokenCounter}`,
    aud: AUDIENCE,
    iat: nowSeconds,
    exp: nowSeconds + 120,
    scope: ALL_SCOPES,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signature = sign('sha256', Buffer.from(signingInput, 'ascii'), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  });
  return `${signingInput}.${base64url(signature)}`;
}

interface ConsentRecord {
  revision: number;
  status: 'GRANTED' | 'DENIED';
  receipt_json: string | null;
  profile_pseudonym_id: string | null;
  effective_at: string;
}

interface CaptureRecord {
  authorization_id: string;
  consent_revision: number;
  producer_instance_id: string;
  stream_id: string;
  stream_sequence: number;
  family_id: string;
  receipt_json: string;
  profile_pseudonym_id: string;
  authorized_at: string;
  expires_at: string;
  consumed_at: string | null;
  invalidated_at: string | null;
  response_json: string;
}

interface EventRecord {
  principal_handle: string;
  event_id: string;
  envelope_json: string;
  server_received_at: string;
  retention_delete_after: string;
}

interface StreamRecord {
  principal_handle: string;
  producer_instance_id: string;
  purpose: string;
  profile_pseudonym_id: string;
  family_id: string;
  mode: string;
  next_sequence: number;
}

/**
 * Stateful PostgreSQL-double for the framing experiment. Covers migration,
 * retention/readiness, credential sessions, consent, capture, events, and
 * streams. Anything else fails loudly.
 */
class FramingPostgresFake implements PostgresPoolV1, PostgresClientV1 {
  readonly statements: string[] = [];
  readonly tables = new Set<string>();
  version: number | null = null;
  ended = 0;
  readonly consent = new Map<string, ConsentRecord[]>();
  readonly idempotency = new Map<string, { request_digest: string; response_json: string }>();
  readonly captures = new Map<string, CaptureRecord>();
  readonly events: EventRecord[] = [];
  readonly streams = new Map<string, StreamRecord>();
  readonly sessions = new Map<string, { revoked_at: string | null }>();

  async connect(): Promise<PostgresClientV1> {
    return this;
  }

  release(): void {}

  async end(): Promise<void> {
    this.ended += 1;
  }

  async query<Row = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResultV1<Row>> {
    const sql = text.trim();
    this.statements.push(sql);
    if (sql.startsWith('SELECT table_name') && sql.includes('information_schema.tables')) {
      const rows = [...this.tables].sort().map((table_name) => ({ table_name }));
      return { rows: rows as Row[], rowCount: rows.length };
    }
    if (sql.startsWith('SELECT version FROM nemosyne_governance.schema_version')) {
      const rows = this.version === null ? [] : [{ version: this.version }];
      return { rows: rows as Row[], rowCount: rows.length };
    }
    if (sql.includes('CREATE TABLE nemosyne_governance.product_analytics_consent_revisions')) {
      for (const table of POSTGRES_GOVERNANCE_SCHEMA_V1.managedTables) this.tables.add(table);
      return this.empty<Row>();
    }
    if (sql.startsWith('CREATE TABLE nemosyne_governance.schema_version')) {
      this.tables.add('schema_version');
      return this.empty<Row>();
    }
    if (sql.startsWith('INSERT INTO nemosyne_governance.schema_version')) {
      this.version = Number(values[0]);
      return this.changed<Row>();
    }
    if (sql.startsWith('SELECT COUNT(*) AS count FROM nemosyne_governance.governed_product_events')) {
      return { rows: [{ count: 0 }] as Row[], rowCount: 1 };
    }
    if (
      sql.startsWith('SELECT DISTINCT principal_handle FROM nemosyne_governance.product_analytics_erasure_actions')
    ) {
      return this.empty<Row>();
    }
    if (sql.startsWith('DELETE FROM nemosyne_governance.governed_product_events WHERE physical_delete_deadline')) {
      return this.empty<Row>();
    }
    if (sql.startsWith('SELECT revoked_at FROM nemosyne_governance.data_plane_credential_sessions')) {
      const row = this.sessions.get(String(values[0]));
      return { rows: (row ? [row] : []) as Row[], rowCount: row ? 1 : 0 };
    }
    if (sql.startsWith('INSERT INTO nemosyne_governance.data_plane_credential_sessions')) {
      const key = String(values[0]);
      if (!this.sessions.has(key)) this.sessions.set(key, { revoked_at: null });
      return this.changed<Row>();
    }
    if (sql.includes("endpoint = 'GRANT'")) {
      const row = this.idempotency.get(`${String(values[0])}|GRANT|${String(values[1])}`);
      return { rows: (row ? [row] : []) as Row[], rowCount: row ? 1 : 0 };
    }
    if (sql.startsWith('INSERT INTO nemosyne_governance.product_analytics_idempotency')) {
      this.idempotency.set(`${String(values[0])}|GRANT|${String(values[1])}`, {
        request_digest: String(values[2]),
        response_json: String(values[3]),
      });
      return this.changed<Row>();
    }
    if (
      sql.startsWith('SELECT revision, status, receipt_json, profile_pseudonym_id, effective_at') &&
      sql.includes('product_analytics_consent_revisions')
    ) {
      const rows = this.consent.get(String(values[0])) ?? [];
      const row = rows.at(-1);
      return { rows: (row ? [row] : []) as Row[], rowCount: row ? 1 : 0 };
    }
    if (sql.startsWith('INSERT INTO nemosyne_governance.product_analytics_consent_revisions')) {
      const handle = String(values[0]);
      const existing = this.consent.get(handle) ?? [];
      existing.push({
        revision: Number(values[2]),
        status: 'GRANTED',
        receipt_json: String(values[4]),
        profile_pseudonym_id: String(values[5]),
        effective_at: String(values[6]),
      });
      this.consent.set(handle, existing);
      return this.changed<Row>();
    }
    if (
      sql.startsWith('SELECT authorization_id, consent_revision, producer_instance_id') ||
      sql.startsWith('SELECT authorization_id,consent_revision,producer_instance_id')
    ) {
      const row = this.captures.get(`${String(values[0])}|${String(values[1])}`);
      return { rows: (row ? [row] : []) as Row[], rowCount: row ? 1 : 0 };
    }
    if (sql.startsWith('INSERT INTO nemosyne_governance.product_analytics_capture_authorizations')) {
      const record: CaptureRecord = {
        authorization_id: String(values[0]),
        consent_revision: Number(values[7]),
        producer_instance_id: String(values[3]),
        stream_id: String(values[4]),
        stream_sequence: Number(values[5]),
        family_id: String(values[6]),
        receipt_json: String(values[8]),
        profile_pseudonym_id: String(values[9]),
        authorized_at: String(values[10]),
        expires_at: String(values[11]),
        consumed_at: null,
        invalidated_at: null,
        response_json: String(values[12]),
      };
      this.captures.set(`${String(values[1])}|${String(values[2])}`, record);
      return this.changed<Row>();
    }
    if (sql.startsWith('SELECT content_digest FROM nemosyne_governance.governed_product_events')) {
      const row = this.events.find(
        (event) => event.principal_handle === String(values[0]) && event.event_id === String(values[1]),
      );
      const rows = row ? [{ content_digest: JSON.parse(row.envelope_json).contentDigest.value }] : [];
      return { rows: rows as Row[], rowCount: rows.length };
    }
    if (
      sql.startsWith(
        'SELECT principal_handle,producer_instance_id,purpose,profile_pseudonym_id,family_id,mode,next_sequence FROM nemosyne_governance.governed_product_streams',
      )
    ) {
      const row = this.streams.get(String(values[0]));
      return { rows: (row ? [row] : []) as Row[], rowCount: row ? 1 : 0 };
    }
    if (sql.startsWith('INSERT INTO nemosyne_governance.governed_product_streams')) {
      this.streams.set(String(values[0]), {
        principal_handle: String(values[1]),
        producer_instance_id: String(values[2]),
        purpose: String(values[3]),
        profile_pseudonym_id: String(values[4]),
        family_id: String(values[5]),
        mode: String(values[6]),
        next_sequence: 0,
      });
      return this.changed<Row>();
    }
    if (sql.startsWith('UPDATE nemosyne_governance.governed_product_streams SET next_sequence')) {
      const row = this.streams.get(String(values[1]));
      if (row) row.next_sequence = Number(values[0]);
      return this.changed<Row>();
    }
    if (sql.startsWith('INSERT INTO nemosyne_governance.governed_product_events')) {
      this.events.push({
        principal_handle: String(values[0]),
        event_id: String(values[1]),
        envelope_json: String(values[6]),
        server_received_at: String(values[7]),
        retention_delete_after: String(values[8]),
      });
      return this.changed<Row>();
    }
    if (sql.startsWith('UPDATE nemosyne_governance.product_analytics_capture_authorizations SET consumed_at')) {
      const row = [...this.captures.values()].find((capture) => capture.authorization_id === String(values[1]));
      if (!row || row.consumed_at !== null || row.invalidated_at !== null) return this.empty<Row>();
      row.consumed_at = String(values[0]);
      return this.changed<Row>();
    }
    if (
      sql === 'BEGIN' ||
      sql === 'COMMIT' ||
      sql === 'ROLLBACK' ||
      sql.startsWith('SET TRANSACTION') ||
      sql.includes('pg_advisory_xact_lock') ||
      sql.startsWith('CREATE SCHEMA')
    ) {
      return this.empty<Row>();
    }
    throw new Error(`unexpected PostgreSQL statement in framing fake: ${sql}`);
  }

  private empty<Row>(): PostgresQueryResultV1<Row> {
    return { rows: [], rowCount: 0 };
  }

  private changed<Row>(): PostgresQueryResultV1<Row> {
    return { rows: [], rowCount: 1 };
  }
}

function runtimeRef(componentId: string, version: string, character: string): RuntimeComponentReferenceV1 {
  return {
    schemaVersion: '1',
    componentId,
    version,
    artifactDigest: { algorithm: 'SHA256', value: character.repeat(64) },
  };
}

const APP = runtimeRef('nemosyne-app', '1.0.0+sha.0123456789abcdef', 'a');
const DEPLOYMENT = runtimeRef('private-preview', '1.0.0+sha.0123456789abcdef', 'b');
const UI = runtimeRef('product-ui', '1.0.0+sha.0123456789abcdef', 'c');

function testEnv(): typeof process.env {
  return {
    NEMOSYNE_GOVERNANCE_DB_URL: 'postgresql://localhost:5432/nemosyne_governance_rfl_test',
    NEMOSYNE_GOVERNANCE_HOST: '127.0.0.1',
    NEMOSYNE_GOVERNANCE_PORT: '0',
    NEMOSYNE_GOVERNANCE_ALLOWED_ORIGINS: 'https://app.example',
    NEMOSYNE_GOVERNANCE_OIDC_ALLOWED_ALGORITHMS: 'ES256',
    NEMOSYNE_GOVERNANCE_CREDENTIAL_SESSION_KEY_HEX: 'ab'.repeat(32),
    NEMOSYNE_GOVERNANCE_DELETION_HANDLE_KEY_HEX: 'cd'.repeat(32),
    NEMOSYNE_GOVERNANCE_DELETION_HANDLE_KEY_VERSION: 'd1',
    NEMOSYNE_GOVERNANCE_PURPOSE_PSEUDONYM_KEY_HEX: 'ef'.repeat(32),
    NEMOSYNE_GOVERNANCE_PURPOSE_PSEUDONYM_KEY_VERSION: 'p1',
    NEMOSYNE_GOVERNANCE_DEPLOYMENT_MANIFEST_JSON: JSON.stringify({
      schemaVersion: '1',
      applicationBuild: APP,
      deploymentConfiguration: DEPLOYMENT,
      uiTreatment: UI,
      allowedPlatformRuntimes: [{ componentId: 'browser-runtime', version: '1.0.0+sha.0123456789abcdef' }],
    }),
    NEMOSYNE_GOVERNANCE_OIDC_AUDIENCE: AUDIENCE,
    NEMOSYNE_GOVERNANCE_OIDC_ISSUER: ISSUER,
  };
}

interface CaptureAuthorizationBody {
  readonly authorizationId: string;
  readonly eventId: string;
  readonly streamId: string;
  readonly producerInstanceId: string;
  readonly streamSequence: number;
  readonly familyId: string;
  readonly receipt: AuthorizationEvidenceV1;
  readonly profilePseudonymId: string;
  readonly authorizedAt: string;
  readonly expiresAt: string;
}

function envelopeJson(authorization: CaptureAuthorizationBody): string {
  const payload = { operation: 'filter' };
  const content: Omit<GovernedEventEnvelopeV1, 'contentDigest'> = {
    schemaVersion: '1',
    eventFamilyId: PRODUCT_OPERATION_FAMILY_ID,
    payloadSchemaVersion: '1',
    eventId: authorization.eventId,
    streamId: authorization.streamId,
    producerInstanceId: authorization.producerInstanceId,
    streamSequence: authorization.streamSequence,
    capturedAt: authorization.authorizedAt,
    sourceComponent: PRODUCT_OPERATION_SOURCE_COMPONENT,
    mode: 'PRODUCT',
    purpose: GOVERNED_PURPOSES.PRODUCT_ANALYTICS,
    dataClasses: [GOVERNED_DATA_CLASSES.PRODUCT_INTERACTION_METADATA],
    effectiveSensitivity: 'PSEUDONYMOUS',
    identities: {
      profilePseudonymId: authorization.profilePseudonymId,
      productSessionId: 'psv1_55555555-5555-4555-8555-555555555555',
      investigationId: null,
      discoveryEpisodeId: null,
    },
    dataset: null,
    runtime: {
      schemaVersion: '1',
      components: {
        applicationBuild: runtimeRef('nemosyne-app', '1.0.0+sha.0123456789abcdef', 'a'),
        deploymentConfiguration: runtimeRef('private-preview', '1.0.0+sha.0123456789abcdef', 'b'),
        wasmKernel: null,
        representationTreatment: null,
        monetaEngine: null,
        fitnessModel: null,
        nil: null,
        perceptionGestureTreatment: null,
        uiTreatment: runtimeRef('product-ui', '1.0.0+sha.0123456789abcdef', 'c'),
        platformRuntime: runtimeRef('browser-runtime', '1.0.0+sha.0123456789abcdef', 'd'),
      },
      randomSeeds: {},
    },
    authorization: [
      {
        schemaVersion: '1',
        basis: 'CONSENT_RECEIPT',
        purpose: GOVERNED_PURPOSES.PRODUCT_ANALYTICS,
        authority: PRODUCT_ANALYTICS_DATA_SERVICE_AUTHORITY_REFERENCE,
        evidence: authorization.receipt,
        policy: PRODUCT_ANALYTICS_OPERATION_NOTICE_REFERENCE,
      },
    ],
    retention: { schemaVersion: '1', policy: PRODUCT_ANALYTICS_OPERATION_RETENTION_REFERENCE },
    payload,
    payloadDigest: computeGovernedPayloadDigestV1(payload),
  };
  return JSON.stringify({ ...content, contentDigest: computeGovernedEventContentDigestV1(content) });
}

async function startService(): Promise<{ port: number }> {
  const pool = new FramingPostgresFake();
  const jwks = new OidcJwksAuthority({ issuer: ISSUER, fetcher: jwksFetcher });
  const service = await runGovernanceService(testEnv(), {
    poolForTest: pool,
    oidcJwksAuthorityForTest: jwks,
  });
  running.push(service);
  return { port: service.port };
}

async function postBatch(port: number, token: string, body: string | Buffer): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}/v1/governed-events/batches`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/x-ndjson' },
    body: body as BodyInit,
  });
}

async function postJson(port: number, path: string, token: string, body: unknown): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('RFL cycle 1: governed batch framing fails closed on the real boundary', () => {
  it('refuses over-count, over-line, over-batch, invalid-encoding, and empty batches without ingesting', async () => {
    const { port } = await startService();
    const token = mintToken();

    const emptyFirst = await postBatch(port, token, '');
    expect(emptyFirst.status).toBe(413);
    expect(await emptyFirst.json()).toMatchObject({ code: 'BATCH_FRAMING_REFUSED' });

    const overCount = await postBatch(port, token, `${Array(17).fill('{"a":1}').join('\n')}\n`);
    expect(overCount.status).toBe(413);
    expect(await overCount.json()).toMatchObject({ code: 'BATCH_FRAMING_REFUSED' });

    const overLine = await postBatch(port, token, `{"a":"${'x'.repeat(1_300_000)}"}\n`);
    expect(overLine.status).toBe(413);
    expect(await overLine.json()).toMatchObject({ code: 'BATCH_FRAMING_REFUSED' });

    // Sized just over the 2MB batch cap: exercises the SIZE_REFUSED refusal
    // while staying clear of the mid-stream-abort connection race pinned by
    // the skipped RFL-0001 reproducer (larger refused bodies intermittently
    // lose their response to a transport error instead).
    const bigLine = `{"a":"${'y'.repeat(128_000)}"}`;
    const overBatch = await postBatch(port, token, `${Array(16).fill(bigLine).join('\n')}\n`);
    expect(overBatch.status).toBe(413);
    expect(await overBatch.json()).toMatchObject({ code: 'BATCH_FRAMING_REFUSED' });

    const invalidUtf8 = await postBatch(port, token, Buffer.from([0x7b, 0x22, 0x61, 0x22, 0x3a, 0xff, 0xfe, 0x7d]));
    expect(invalidUtf8.status).toBe(400);
    expect(await invalidUtf8.json()).toMatchObject({ code: 'BATCH_FRAMING_REFUSED' });
  });

  it('still ingests a valid batch and answers readiness after the refusals', async () => {
    const { port } = await startService();
    const token = mintToken();

    const granted = await postJson(port, '/v1/governance/consents/product-analytics/grants', token, {
      schemaVersion: '1',
      purpose: 'product-analytics',
      notice: PRODUCT_ANALYTICS_OPERATION_NOTICE_REFERENCE,
      confirmed: true,
      actionId: GRANT_ID,
      expectedPriorRevision: null,
    });
    expect(granted.status).toBe(200);

    const captured = await postJson(
      port,
      '/v1/governance/consents/product-analytics/capture-authorizations',
      token,
      {
        schemaVersion: '1',
        familyId: PRODUCT_OPERATION_FAMILY_ID,
        eventId: EVENT_ID,
        producerInstanceId: PRODUCER_ID,
        streamId: STREAM_ID,
        streamSequence: 0,
      },
    );
    expect(captured.status).toBe(200);
    const capture = (await captured.json()) as unknown as CaptureAuthorizationBody;

    const ingested = await postBatch(port, token, `${envelopeJson(capture)}\n`);
    expect(ingested.status).toBe(200);
    expect(await ingested.json()).toMatchObject({
      dispositions: [{ index: 0, eventId: EVENT_ID, status: 'STORED', reasonCode: null }],
    });

    const ready = await fetch(`http://127.0.0.1:${port}/readyz`);
    expect(ready.status).toBe(200);
  });
});
