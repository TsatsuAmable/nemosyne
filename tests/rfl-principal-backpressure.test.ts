import { createPublicKey, generateKeyPairSync, sign } from 'node:crypto';
import { connect, type Socket } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';

import { OidcJwksAuthority } from '../src/governance-service/OidcJwksAuthority.ts';
import { PRODUCT_ANALYTICS_OPERATION_NOTICE_REFERENCE } from '../src/governance/index.ts';
import { runGovernanceService } from '../src/governance-service/server-entry.ts';
import type {
  PostgresClientV1,
  PostgresPoolV1,
  PostgresQueryResultV1,
} from '../src/governance-service/PostgresGovernanceDatabase.ts';
import { POSTGRES_GOVERNANCE_SCHEMA_V1 } from '../src/governance-service/PostgresGovernanceDatabase.ts';

const ISSUER = 'https://issuer.example';
const AUDIENCE = 'nemosyne-data-plane';
const KID = 'rfl-backpressure-key-1';

type RunningService = { stop: () => Promise<void> };
const running: RunningService[] = [];
const openSockets: Socket[] = [];

afterEach(async () => {
  for (const socket of openSockets.splice(0)) {
    socket.destroy();
  }
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

function mintToken(subject: string): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const signingInput = `${base64url(JSON.stringify({ typ: 'at+jwt', alg: 'ES256', kid: KID }))}.${base64url(
    JSON.stringify({
      iss: ISSUER,
      sub: subject,
      jti: `rfl-backpressure-${++tokenCounter}`,
      aud: AUDIENCE,
      iat: nowSeconds,
      exp: nowSeconds + 120,
      scope: 'consent:read consent:write events:capture events:write events:export events:erase',
    }),
  )}`;
  const signature = sign('sha256', Buffer.from(signingInput, 'ascii'), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  });
  return `${signingInput}.${base64url(signature)}`;
}

class BackpressurePoolFake implements PostgresPoolV1, PostgresClientV1 {
  readonly tables = new Set<string>(POSTGRES_GOVERNANCE_SCHEMA_V1.managedTables);
  readonly sessions = new Map<string, { revoked_at: string | null }>();
  readonly consent = new Map<
    string,
    Array<{
      revision: number;
      status: 'GRANTED' | 'DENIED';
      receipt_json: string | null;
      profile_pseudonym_id: string | null;
      effective_at: string;
    }>
  >();
  readonly idempotency = new Map<string, { request_digest: string; response_json: string }>();
  async connect(): Promise<PostgresClientV1> {
    return this;
  }
  release(): void {}
  async end(): Promise<void> {}
  async query<Row = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResultV1<Row>> {
    const sql = text.trim();
    if (sql.startsWith('SELECT table_name')) {
      const rows = [...this.tables].sort().map((table_name) => ({ table_name }));
      return { rows: rows as Row[], rowCount: rows.length };
    }
    if (sql.startsWith('SELECT version FROM nemosyne_governance.schema_version')) {
      return { rows: [{ version: 1 }] as Row[], rowCount: 1 };
    }
    if (sql.startsWith('SELECT COUNT(*) AS count FROM nemosyne_governance.governed_product_events')) {
      return { rows: [{ count: 0 }] as Row[], rowCount: 1 };
    }
    if (
      sql.startsWith('SELECT DISTINCT principal_handle FROM nemosyne_governance.product_analytics_erasure_actions')
    ) {
      return { rows: [], rowCount: 0 };
    }
    if (sql.startsWith('SELECT revoked_at FROM nemosyne_governance.data_plane_credential_sessions')) {
      const row = this.sessions.get(String(values[0]));
      return { rows: (row ? [row] : []) as Row[], rowCount: row ? 1 : 0 };
    }
    if (sql.startsWith('INSERT INTO nemosyne_governance.data_plane_credential_sessions')) {
      const key = String(values[0]);
      if (!this.sessions.has(key)) this.sessions.set(key, { revoked_at: null });
      return { rows: [], rowCount: 1 };
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
      return { rows: [], rowCount: 1 };
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
      return { rows: [], rowCount: 1 };
    }
    if (
      sql === 'BEGIN' ||
      sql === 'COMMIT' ||
      sql === 'ROLLBACK' ||
      sql.startsWith('SET TRANSACTION') ||
      sql.includes('pg_advisory_xact_lock') ||
      sql.startsWith('CREATE SCHEMA') ||
      sql.startsWith('DELETE FROM nemosyne_governance.governed_product_events WHERE physical_delete_deadline')
    ) {
      return { rows: [], rowCount: 0 };
    }
    throw new Error(`unexpected statement in backpressure fake: ${sql}`);
  }
}

function testEnv(): typeof process.env {
  return {
    NEMOSYNE_GOVERNANCE_DB_URL: 'postgresql://localhost:5432/x',
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
      applicationBuild: {
        schemaVersion: '1',
        componentId: 'nemosyne-app',
        version: '1.0.0+sha.0123456789abcdef',
        artifactDigest: { algorithm: 'SHA256', value: 'a'.repeat(64) },
      },
      deploymentConfiguration: {
        schemaVersion: '1',
        componentId: 'private-preview',
        version: '1.0.0+sha.0123456789abcdef',
        artifactDigest: { algorithm: 'SHA256', value: 'b'.repeat(64) },
      },
      uiTreatment: {
        schemaVersion: '1',
        componentId: 'product-ui',
        version: '1.0.0+sha.0123456789abcdef',
        artifactDigest: { algorithm: 'SHA256', value: 'c'.repeat(64) },
      },
      allowedPlatformRuntimes: [{ componentId: 'browser-runtime', version: '1.0.0+sha.0123456789abcdef' }],
    }),
    NEMOSYNE_GOVERNANCE_OIDC_AUDIENCE: AUDIENCE,
    NEMOSYNE_GOVERNANCE_OIDC_ISSUER: ISSUER,
  };
}

/**
 * Raw-socket stalled request. undici fetch cannot hold a request open on an
 * unsent body stream (it never transmits headers), so stalled in-flight
 * dispatch slots are built with hand-written chunked HTTP instead: headers
 * flush immediately, the server authenticates and parks inside the body read,
 * and no body bytes move until release sends the terminating chunk.
 */
function openStalledPost(port: number, token: string, path: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = connect(port, '127.0.0.1', () => {
      socket.write(
        `POST ${path} HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\n` +
          `authorization: Bearer ${token}\r\ncontent-type: application/json\r\n` +
          'transfer-encoding: chunked\r\nconnection: keep-alive\r\n\r\n',
        (error) => {
          if (error) reject(error);
          else resolve(socket);
        },
      );
    });
    socket.on('error', reject);
    openSockets.push(socket);
  });
}

function readHttpResponse(socket: Socket): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      const headEnd = buffer.indexOf('\r\n\r\n');
      if (headEnd === -1) return;
      const head = buffer.slice(0, headEnd);
      const status = Number(head.split(' ')[1]);
      const lengthMatch = /content-length:\s*(\d+)/i.exec(head);
      const length = lengthMatch ? Number(lengthMatch[1]) : 0;
      const body = buffer.slice(headEnd + 4);
      if (Buffer.byteLength(body, 'utf8') >= length) {
        socket.off('data', onData);
        resolve({ status, body: body.slice(0, length) });
      }
    };
    socket.on('data', onData);
    socket.on('error', reject);
  });
}

function releaseStall(socket: Socket): void {
  socket.write('0\r\n\r\n');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function startService(): Promise<{ port: number }> {
  const service = await runGovernanceService(testEnv(), {
    poolForTest: new BackpressurePoolFake(),
    oidcJwksAuthorityForTest: new OidcJwksAuthority({ issuer: ISSUER, fetcher: jwksFetcher }),
  });
  running.push(service);
  return { port: service.port };
}

describe('RFL cycle 3: per-principal backpressure through the real boundary', () => {
  it('refuses a third same-principal request while two are stalled, then recovers', async () => {
    const { port } = await startService();
    const token = mintToken('subject-123');
    const path = '/v1/governance/consents/product-analytics/grants';
    const url = `http://127.0.0.1:${port}${path}`;
    const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

    const socketA = await openStalledPost(port, token, path);
    const socketB = await openStalledPost(port, token, path);
    const responseA = readHttpResponse(socketA);
    const responseB = readHttpResponse(socketB);
    // Let both requests authenticate and park inside the body read.
    await delay(300);

    const refused = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ bogus: 3 }),
    });
    expect(refused.status).toBe(429);
    expect(await refused.json()).toMatchObject({ code: 'BUSY' });

    releaseStall(socketA);
    releaseStall(socketB);
    expect(await responseA).toMatchObject({ status: 400 });
    expect(await responseB).toMatchObject({ status: 400 });

    const after = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        schemaVersion: '1',
        purpose: 'product-analytics',
        notice: PRODUCT_ANALYTICS_OPERATION_NOTICE_REFERENCE,
        confirmed: true,
        actionId: '11111111-1111-4111-8111-111111111111',
        expectedPriorRevision: null,
      }),
    });
    expect(after.status).toBe(200);
    expect(await after.json()).toMatchObject({ status: 'GRANTED', revision: '1' });
  });

  it('leaves a different principal unaffected while one principal is saturated', async () => {
    const { port } = await startService();
    const saturated = mintToken('subject-123');
    const other = mintToken('subject-456');
    const path = '/v1/governance/consents/product-analytics/grants';
    const url = `http://127.0.0.1:${port}${path}`;

    const socketA = await openStalledPost(port, saturated, path);
    const socketB = await openStalledPost(port, saturated, path);
    const responseA = readHttpResponse(socketA);
    const responseB = readHttpResponse(socketB);
    await delay(300);

    const probeSaturated = await fetch(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${saturated}`, 'content-type': 'application/json' },
      body: JSON.stringify({ bogus: 3 }),
    });
    expect(probeSaturated.status).toBe(429);

    const probeOther = await fetch(`http://127.0.0.1:${port}/v1/governance/consents/product-analytics/current`, {
      headers: { authorization: `Bearer ${other}` },
    });
    expect(probeOther.status).toBe(200);
    expect(await probeOther.json()).toMatchObject({ status: 'DENIED', revision: null });

    releaseStall(socketA);
    releaseStall(socketB);
    expect(await responseA).toMatchObject({ status: 400 });
    expect(await responseB).toMatchObject({ status: 400 });
  });
});
