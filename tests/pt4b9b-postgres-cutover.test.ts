import { describe, expect, it } from 'vitest';

import { PRODUCT_ANALYTICS_OPERATION_NOTICE_REFERENCE, type RuntimeComponentReferenceV1 } from '../src/governance/index.ts';
import { PostgresDataPlaneCredentialSessionStoreV1 } from '../src/governance-service/DataPlaneCredentialSessionStore.ts';
import { OidcJwksAuthority } from '../src/governance-service/OidcJwksAuthority.ts';
import type { PostgresClientV1, PostgresPoolV1, PostgresQueryResultV1 } from '../src/governance-service/PostgresGovernanceDatabase.ts';
import { POSTGRES_GOVERNANCE_SCHEMA_V1 } from '../src/governance-service/PostgresGovernanceDatabase.ts';
import { PostgresProductAnalyticsPersistenceV1 } from '../src/governance-service/PostgresProductAnalyticsPersistence.ts';
import { createPostgresProductAnalyticsGovernanceCompositionV1 } from '../src/governance-service/ProductAnalyticsGovernanceComposition.ts';
import { RuntimePinnedProductAnalyticsEventIngestion } from '../src/governance-service/ProductAnalyticsRuntimeAuthority.ts';

interface ConsentRecord {
  revision: number;
  status: 'GRANTED' | 'DENIED';
  receipt_json: string | null;
  profile_pseudonym_id: string | null;
  effective_at: string;
}

class StatefulPostgresFake implements PostgresPoolV1, PostgresClientV1 {
  readonly statements: string[] = [];
  readonly tables = new Set<string>();
  readonly consent = new Map<string, ConsentRecord[]>();
  readonly idempotency = new Map<string, { request_digest: string; response_json: string }>();
  readonly sessions = new Map<string, { revoked_at: string | null }>();
  version: number | null = null;
  ended = 0;
  released = 0;

  async connect(): Promise<PostgresClientV1> { return this; }
  release(): void { this.released += 1; }
  async end(): Promise<void> { this.ended += 1; }

  async query<Row = Record<string, unknown>>(text: string, values: readonly unknown[] = []): Promise<PostgresQueryResultV1<Row>> {
    const sql = text.trim();
    this.statements.push(sql);
    if (sql.startsWith('SELECT table_name') && sql.includes('information_schema.tables')) {
      const rows = [...this.tables].sort().map((table_name) => ({ table_name }));
      return { rows: rows as Row[], rowCount: rows.length };
    }
    if (sql.includes('CREATE TABLE nemosyne_governance.schema_version')) {
      this.tables.add('schema_version');
      return this.empty<Row>();
    }
    if (sql.includes('CREATE TABLE nemosyne_governance.product_analytics_consent_revisions')) {
      for (const table of POSTGRES_GOVERNANCE_SCHEMA_V1.managedTables) this.tables.add(table);
      return this.empty<Row>();
    }
    if (sql.startsWith('SELECT version FROM nemosyne_governance.schema_version')) {
      const rows = this.version === null ? [] : [{ version: this.version }];
      return { rows: rows as Row[], rowCount: rows.length };
    }
    if (sql.startsWith('INSERT INTO nemosyne_governance.schema_version')) {
      this.version = Number(values[0]);
      return this.changed<Row>();
    }
    if (sql.includes("endpoint = 'GRANT'") || sql.includes("endpoint = 'REVOKE'")) {
      const endpoint = sql.includes("'GRANT'") ? 'GRANT' : 'REVOKE';
      const key = `${String(values[0])}|${endpoint}|${String(values[1])}`;
      const row = this.idempotency.get(key);
      return { rows: (row ? [row] : []) as Row[], rowCount: row ? 1 : 0 };
    }
    if (sql.startsWith('SELECT revision, status, receipt_json, profile_pseudonym_id, effective_at') && sql.includes('product_analytics_consent_revisions')) {
      const rows = this.consent.get(String(values[0])) ?? [];
      const row = rows.at(-1);
      return { rows: (row ? [row] : []) as Row[], rowCount: row ? 1 : 0 };
    }
    if (sql.startsWith('INSERT INTO nemosyne_governance.product_analytics_consent_revisions')) {
      const handle = String(values[0]);
      const status = sql.includes("'GRANTED'") ? 'GRANTED' : 'DENIED';
      const existing = this.consent.get(handle) ?? [];
      const record: ConsentRecord = status === 'GRANTED'
        ? { revision: Number(values[2]), status, receipt_json: String(values[4]), profile_pseudonym_id: String(values[5]), effective_at: String(values[6]) }
        : { revision: Number(values[2]), status, receipt_json: null, profile_pseudonym_id: null, effective_at: String(values[4]) };
      this.consent.set(handle, [...existing, record]);
      return this.changed<Row>();
    }
    if (sql.startsWith('INSERT INTO nemosyne_governance.product_analytics_idempotency')) {
      const endpoint = sql.includes("'GRANT'") ? 'GRANT' : 'REVOKE';
      this.idempotency.set(`${String(values[0])}|${endpoint}|${String(values[1])}`, { request_digest: String(values[2]), response_json: String(values[3]) });
      return this.changed<Row>();
    }
    if (sql.startsWith('SELECT COUNT(*) AS count FROM nemosyne_governance.governed_product_events')) {
      return { rows: [{ count: 0 }] as Row[], rowCount: 1 };
    }
    if (sql.startsWith('SELECT DISTINCT principal_handle FROM nemosyne_governance.product_analytics_erasure_actions')) return this.empty<Row>();
    if (sql.startsWith('SELECT revoked_at FROM nemosyne_governance.data_plane_credential_sessions')) {
      const row = this.sessions.get(String(values[0]));
      return { rows: (row ? [row] : []) as Row[], rowCount: row ? 1 : 0 };
    }
    if (sql.startsWith('INSERT INTO nemosyne_governance.data_plane_credential_sessions')) {
      const key = String(values[0]);
      if (!this.sessions.has(key)) this.sessions.set(key, { revoked_at: null });
      return this.changed<Row>();
    }
    if (sql.startsWith('UPDATE nemosyne_governance.data_plane_credential_sessions')) {
      const key = String(values[1]);
      const row = this.sessions.get(key);
      if (!row || row.revoked_at !== null) return this.empty<Row>();
      row.revoked_at = String(values[0]);
      return this.changed<Row>();
    }
    if (sql.startsWith('UPDATE nemosyne_governance.product_analytics_capture_authorizations')) return this.empty<Row>();
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK' || sql.startsWith('SET TRANSACTION') || sql.includes('pg_advisory_xact_lock') || sql.startsWith('CREATE SCHEMA')) return this.empty<Row>();
    if (sql.startsWith('DELETE FROM nemosyne_governance.governed_product_events')) return this.empty<Row>();
    throw new Error(`unexpected PostgreSQL statement in fake: ${sql}`);
  }

  private empty<Row>(): PostgresQueryResultV1<Row> { return { rows: [], rowCount: 0 }; }
  private changed<Row>(): PostgresQueryResultV1<Row> { return { rows: [], rowCount: 1 }; }
}

function ref(componentId: string, version: string, character: string): RuntimeComponentReferenceV1 {
  return { schemaVersion: '1', componentId, version, artifactDigest: { algorithm: 'SHA256', value: character.repeat(64) } };
}

const APP = ref('nemosyne-app', '1.0.0+sha.0123456789abcdef', 'a');
const DEPLOYMENT = ref('private-preview', '1.0.0+sha.0123456789abcdef', 'b');
const UI = ref('product-ui', '1.0.0+sha.0123456789abcdef', 'c');
const PLATFORM = ref('browser-runtime', 'chromium-140', 'd');
const principal = { issuer: 'https://issuer.example', subject: 'subject-123' };
const keys = { purposePseudonymKey: { version: 'p1', key: new Uint8Array(32).fill(7) }, deletionHandleKey: { version: 'd1', key: new Uint8Array(32).fill(9) } } as const;

describe('PT4B9B PostgreSQL production persistence', () => {
  it('preserves consent CAS/idempotency semantics through the async PostgreSQL port', async () => {
    const pool = new StatefulPostgresFake();
    for (const table of POSTGRES_GOVERNANCE_SCHEMA_V1.managedTables) pool.tables.add(table);
    pool.version = 1;
    const persistence = new PostgresProductAnalyticsPersistenceV1({ pool, ...keys, now: () => new Date('2026-09-03T08:00:00.000Z'), uuid: () => '11111111-1111-4111-8111-111111111111' });
    const grantRequest = { schemaVersion: '1', purpose: 'product-analytics', notice: PRODUCT_ANALYTICS_OPERATION_NOTICE_REFERENCE, confirmed: true, actionId: '22222222-2222-4222-8222-222222222222', expectedPriorRevision: null } as const;
    const granted = await persistence.grant(principal, grantRequest);
    expect(granted).toMatchObject({ status: 'GRANTED', revision: '1' });
    expect(await persistence.grant(principal, grantRequest)).toEqual(granted);
    expect(await persistence.getCurrent(principal)).toMatchObject({ status: 'GRANTED', revision: '1' });

    const revoked = await persistence.revoke(principal, { schemaVersion: '1', purpose: 'product-analytics', actionId: '33333333-3333-4333-8333-333333333333', expectedCurrentRevision: '1' });
    expect(revoked).toMatchObject({ status: 'DENIED', revision: '2' });
    expect(pool.statements.some((sql) => sql.includes('pg_advisory_xact_lock'))).toBe(true);
    expect(pool.statements.some((sql) => sql.includes('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE'))).toBe(true);
  });

  it('keeps credential-session revocation in PostgreSQL and makes it durable to later touches', async () => {
    const pool = new StatefulPostgresFake();
    const store = new PostgresDataPlaneCredentialSessionStoreV1(pool);
    expect(await store.touch('csv1_deadbeef', '2026-09-03T08:00:00.000Z')).toBe('ACTIVE');
    expect(await store.revoke('csv1_deadbeef', '2026-09-03T08:01:00.000Z')).toBe(true);
    expect(await store.touch('csv1_deadbeef', '2026-09-03T08:02:00.000Z')).toBe('REVOKED');
  });

  it('forces canonical OIDC credential sessions onto the same PostgreSQL pool', async () => {
    const pool = new StatefulPostgresFake();
    const jwks = new OidcJwksAuthority({ issuer: 'https://issuer.example' });
    const composition = await createPostgresProductAnalyticsGovernanceCompositionV1({
      pool,
      ...keys,
      allowedOrigins: ['https://app.example'],
      oidcIssuer: 'https://issuer.example',
      oidcAudience: 'nemosyne-data-plane',
      oidcJwksAuthority: jwks,
      allowedAlgorithms: ['RS256'],
      credentialSessionKey: new Uint8Array(32).fill(5),
      deploymentManifest: { schemaVersion: '1', applicationBuild: APP, deploymentConfiguration: DEPLOYMENT, uiTreatment: UI, allowedPlatformRuntimes: [{ componentId: PLATFORM.componentId, version: PLATFORM.version }] },
      now: () => new Date('2026-09-03T08:00:00.000Z'),
    });
    expect(composition.eventIngestion).toBeInstanceOf(RuntimePinnedProductAnalyticsEventIngestion);
    expect(pool.version).toBe(1);
    expect([...pool.tables].sort()).toEqual([...POSTGRES_GOVERNANCE_SCHEMA_V1.managedTables].sort());
    await composition.closeStorage();
    expect(pool.ended).toBe(1);
  });
});
