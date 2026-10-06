import { createPublicKey, generateKeyPairSync, sign } from 'node:crypto';
import { connect, type Socket } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';

import { OidcJwksAuthority } from '../src/governance-service/OidcJwksAuthority.ts';
import { runGovernanceService } from '../src/governance-service/server-entry.ts';
import type {
  PostgresClientV1,
  PostgresPoolV1,
  PostgresQueryResultV1,
} from '../src/governance-service/PostgresGovernanceDatabase.ts';
import { POSTGRES_GOVERNANCE_SCHEMA_V1 } from '../src/governance-service/PostgresGovernanceDatabase.ts';

const ISSUER = 'https://issuer.example';
const AUDIENCE = 'nemosyne-data-plane';
const KID = 'rfl-shutdown-key-1';

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

function mintToken(): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const signingInput = `${base64url(JSON.stringify({ typ: 'at+jwt', alg: 'ES256', kid: KID }))}.${base64url(
    JSON.stringify({
      iss: ISSUER,
      sub: 'subject-123',
      jti: `rfl-shutdown-${++tokenCounter}`,
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

class ShutdownPoolFake implements PostgresPoolV1, PostgresClientV1 {
  readonly tables = new Set<string>(POSTGRES_GOVERNANCE_SCHEMA_V1.managedTables);
  readonly sessions = new Map<string, { revoked_at: string | null }>();
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
    throw new Error(`unexpected statement in shutdown fake: ${sql}`);
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe('RFL cycle 6: service stop with stalled uploads in flight', () => {
  // RFL-0002 shutdown drain: stop() drops idle connections at once and
  // destroys anything still open after a brief grace, so server.close
  // resolves instead of hanging on uploads stalled mid-body. This test
  // guards the bounded-stop contract.
  it('stop() resolves boundedly while uploads are stalled mid-body', async () => {
    const service = await runGovernanceService(testEnv(), {
      poolForTest: new ShutdownPoolFake(),
      oidcJwksAuthorityForTest: new OidcJwksAuthority({ issuer: ISSUER, fetcher: jwksFetcher }),
    });
    running.push(service);
    const token = mintToken();
    const path = '/v1/governed-events/batches';

    await openStalledPost(service.port, token, path);
    await openStalledPost(service.port, token, path);
    await delay(300);

    const outcome = await Promise.race([
      service.stop().then((): string => 'stopped'),
      delay(4000).then((): string => 'hung'),
    ]);
    expect(outcome).toBe('stopped');
  });

  it('stop() resolves promptly with no work in flight (control)', async () => {
    const service = await runGovernanceService(testEnv(), {
      poolForTest: new ShutdownPoolFake(),
      oidcJwksAuthorityForTest: new OidcJwksAuthority({ issuer: ISSUER, fetcher: jwksFetcher }),
    });
    running.push(service);
    const outcome = await Promise.race([
      service.stop().then((): string => 'stopped'),
      delay(4000).then((): string => 'hung'),
    ]);
    expect(outcome).toBe('stopped');
  });
});
