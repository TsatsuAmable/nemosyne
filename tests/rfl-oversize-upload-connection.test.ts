import { createPublicKey, generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';

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
const KID = 'rfl-repro-key-1';
const SCOPES = 'consent:read consent:write events:capture events:write events:export events:erase';

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
      jti: `rfl-repro-${++tokenCounter}`,
      aud: AUDIENCE,
      iat: nowSeconds,
      exp: nowSeconds + 120,
      scope: SCOPES,
    }),
  )}`;
  const signature = sign('sha256', Buffer.from(signingInput, 'ascii'), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  });
  return `${signingInput}.${base64url(signature)}`;
}

class ReproPoolFake implements PostgresPoolV1, PostgresClientV1 {
  readonly tables = new Set<string>(POSTGRES_GOVERNANCE_SCHEMA_V1.managedTables);
  version: number | null = 1;
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
    throw new Error(`unexpected statement in reproducer fake: ${sql}`);
  }
}

function env(): typeof process.env {
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

describe('RFL-0001 reproducer: refused oversized uploads lose their governed response', () => {
  // RFL-0001 transport framing: body reads use explicit handlers instead of
  // async iteration so a size refusal pauses (never destroys) the request
  // stream; the refusal-path resume() drain then delivers the governed 413
  // and leaves the pooled connection reusable. This test guards that contract.
  it('every refused oversized upload receives the governed 413', async () => {
    const service = await runGovernanceService(env(), {
      poolForTest: new ReproPoolFake(),
      oidcJwksAuthorityForTest: new OidcJwksAuthority({ issuer: ISSUER, fetcher: jwksFetcher }),
    });
    try {
      const url = `http://127.0.0.1:${service.port}/v1/governed-events/batches`;
      const token = mintToken();
      // ~5.1MB: forces the server to refuse mid-stream while the client is
      // still transmitting. Five pairs stay under the 12-batch rate window.
      const bigLine = `{"a":"${'y'.repeat(320_000)}"}`;
      const bigBody = `${Array(16).fill(bigLine).join('\n')}\n`;
      let transportFailures = 0;
      for (let i = 0; i < 5; i += 1) {
        try {
          const big = await fetch(url, {
            method: 'POST',
            headers: { authorization: `Bearer ${token}`, 'content-type': 'application/x-ndjson' },
            body: bigBody,
          });
          const code = ((await big.json()) as { code?: string }).code;
          if (big.status !== 413 || code !== 'BATCH_FRAMING_REFUSED') {
            throw new Error(`unexpected refusal: status=${big.status} code=${code}`);
          }
          const empty = await fetch(url, {
            method: 'POST',
            headers: { authorization: `Bearer ${token}`, 'content-type': 'application/x-ndjson' },
            body: '',
          });
          if (empty.status !== 413) {
            throw new Error(`unexpected empty status=${empty.status}`);
          }
          await empty.text();
        } catch (error) {
          if (error instanceof TypeError) transportFailures += 1;
          else throw error;
        }
      }
      expect(transportFailures).toBe(0);
    } finally {
      await service.stop();
    }
  }, 120000);
});
