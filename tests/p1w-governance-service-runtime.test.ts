import { afterEach, describe, expect, it } from 'vitest';

import type {
  PostgresClientV1,
  PostgresPoolV1,
  PostgresQueryResultV1,
} from '../src/governance-service/PostgresGovernanceDatabase.ts';
import { POSTGRES_GOVERNANCE_SCHEMA_V1 } from '../src/governance-service/PostgresGovernanceDatabase.ts';
import { ProductAnalyticsLifecycleError } from '../src/governance-service/ProductAnalyticsLifecycleAuthority.ts';
import {
  readGovernanceServiceConfig,
  runGovernanceService,
} from '../src/governance-service/server-entry.ts';

type RunningService = { stop: () => Promise<void> };
const running: RunningService[] = [];

afterEach(async () => {
  while (running.length > 0) {
    const service = running.pop();
    if (service) await service.stop();
  }
});

/**
 * Minimal stateful PostgreSQL-double covering exactly the statements the
 * canonical production composition issues before the entry point binds:
 * migration (lock, schema/table inventory, version row, V1 DDL), retention
 * transaction, and the readiness count probe. Anything else fails loudly so
 * the composition cannot silently reach an unmodelled statement.
 */
class EntryPointPostgresFake implements PostgresPoolV1, PostgresClientV1 {
  readonly statements: string[] = [];
  readonly tables = new Set<string>();
  version: number | null = null;
  overduePhysicalRows = 0;
  ended = 0;
  released = 0;

  async connect(): Promise<PostgresClientV1> {
    return this;
  }

  release(): void {
    this.released += 1;
  }

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
      return { rows: [{ count: this.overduePhysicalRows }] as Row[], rowCount: 1 };
    }
    if (
      sql.startsWith('SELECT DISTINCT principal_handle FROM nemosyne_governance.product_analytics_erasure_actions')
    ) {
      return this.empty<Row>();
    }
    if (sql.startsWith('DELETE FROM nemosyne_governance.governed_product_events')) {
      return this.empty<Row>();
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
    throw new Error(`unexpected PostgreSQL statement in entry-point fake: ${sql}`);
  }

  private empty<Row>(): PostgresQueryResultV1<Row> {
    return { rows: [], rowCount: 0 };
  }

  private changed<Row>(): PostgresQueryResultV1<Row> {
    return { rows: [], rowCount: 1 };
  }
}

function digest(character: string): string {
  return character.repeat(64);
}

function testEnv(overrides: Record<string, string | undefined> = {}): typeof process.env {
  return {
    NEMOSYNE_GOVERNANCE_DB_URL: 'postgresql://localhost:5432/nemosyne_governance_test',
    NEMOSYNE_GOVERNANCE_HOST: '127.0.0.1',
    NEMOSYNE_GOVERNANCE_PORT: '0',
    NEMOSYNE_GOVERNANCE_ALLOWED_ORIGINS: 'https://app.example',
    NEMOSYNE_GOVERNANCE_OIDC_ALLOWED_ALGORITHMS: 'RS256',
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
        version: '1.0.0+test',
        artifactDigest: { algorithm: 'SHA256', value: digest('a') },
      },
      deploymentConfiguration: {
        schemaVersion: '1',
        componentId: 'repository-test',
        version: '1.0.0+test',
        artifactDigest: { algorithm: 'SHA256', value: digest('b') },
      },
      uiTreatment: {
        schemaVersion: '1',
        componentId: 'product-ui',
        version: '1.0.0+test',
        artifactDigest: { algorithm: 'SHA256', value: digest('c') },
      },
      allowedPlatformRuntimes: [{ componentId: 'browser-runtime', version: 'chromium-140' }],
    }),
    NEMOSYNE_GOVERNANCE_OIDC_AUDIENCE: 'nemosyne-data-plane',
    NEMOSYNE_GOVERNANCE_OIDC_ISSUER: 'https://issuer.example',
    ...overrides,
  };
}

describe('RDO-001 governance service runtime entry point', () => {
  it('refuses to read incomplete fail-closed configuration', () => {
    expect(() => readGovernanceServiceConfig({})).toThrow(/NEMOSYNE_GOVERNANCE_DB_URL/);
    expect(() =>
      readGovernanceServiceConfig(testEnv({ NEMOSYNE_GOVERNANCE_ALLOWED_ORIGINS: undefined })),
    ).toThrow(/NEMOSYNE_GOVERNANCE_ALLOWED_ORIGINS/);
    expect(() =>
      readGovernanceServiceConfig(testEnv({ NEMOSYNE_GOVERNANCE_DEPLOYMENT_MANIFEST_JSON: undefined })),
    ).toThrow(/NEMOSYNE_GOVERNANCE_DEPLOYMENT_MANIFEST_JSON/);
    expect(() =>
      readGovernanceServiceConfig(testEnv({ NEMOSYNE_GOVERNANCE_OIDC_ISSUER: undefined })),
    ).toThrow(/NEMOSYNE_GOVERNANCE_OIDC_ISSUER/);
  });

  it('rejects malformed configuration values instead of defaulting them', () => {
    expect(() =>
      readGovernanceServiceConfig(testEnv({ NEMOSYNE_GOVERNANCE_PORT: 'not-a-port' })),
    ).toThrow(/invalid NEMOSYNE_GOVERNANCE_PORT/);
    expect(() =>
      readGovernanceServiceConfig(testEnv({ NEMOSYNE_GOVERNANCE_CREDENTIAL_SESSION_KEY_HEX: 'zz' })),
    ).toThrow(/invalid NEMOSYNE_GOVERNANCE_CREDENTIAL_SESSION_KEY_HEX/);
    expect(() =>
      readGovernanceServiceConfig(testEnv({ NEMOSYNE_GOVERNANCE_OIDC_ALLOWED_ALGORITHMS: 'HS256' })),
    ).toThrow(/unsupported algorithm/);
    expect(() =>
      readGovernanceServiceConfig(testEnv({ NEMOSYNE_GOVERNANCE_DEPLOYMENT_MANIFEST_JSON: '{oops' })),
    ).toThrow(SyntaxError);
  });

  it('parses a complete configuration without silent downgrades', () => {
    const config = readGovernanceServiceConfig(testEnv());
    expect(config.host).toBe('127.0.0.1');
    expect(config.port).toBe(0);
    expect(config.allowedOrigins).toEqual(['https://app.example']);
    expect(config.allowedAlgorithms).toEqual(['RS256']);
    expect(config.credentialSessionKey.byteLength).toBe(32);
    expect(config.oidcIssuer).toBe('https://issuer.example');
  });

  it('refuses to bind when configuration is absent', async () => {
    await expect(runGovernanceService({})).rejects.toThrow(/NEMOSYNE_GOVERNANCE_DB_URL/);
  });

  it('binds a real loopback listener only after the real composition proves readiness', async () => {
    const pool = new EntryPointPostgresFake();
    const service = await runGovernanceService(testEnv(), { poolForTest: pool });
    running.push(service);

    const health = await fetch(`http://127.0.0.1:${service.port}/healthz`);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: 'ok' });

    const ready = await fetch(`http://127.0.0.1:${service.port}/readyz`);
    expect(ready.status).toBe(200);
    expect(await ready.json()).toEqual({
      persistence: 'postgres',
      service: 'governance',
      status: 'ready',
    });

    const missing = await fetch(`http://127.0.0.1:${service.port}/not-a-service-route`);
    expect(missing.status).toBe(404);
    // Unknown paths belong to the production dispatch surface, which answers
    // with its governed NOT_FOUND contract rather than the ops envelope.
    expect(await missing.json()).toEqual({ schemaVersion: '1', code: 'NOT_FOUND' });

    // The bind happened only after real migrations plus the readiness proof.
    expect(pool.version).toBe(1);
    const sawMigration = pool.statements.some((sql) =>
      sql.startsWith('INSERT INTO nemosyne_governance.schema_version'),
    );
    expect(sawMigration).toBe(true);
    const sawReadinessProbe = pool.statements.some((sql) =>
      sql.startsWith('SELECT COUNT(*) AS count FROM nemosyne_governance.governed_product_events'),
    );
    expect(sawReadinessProbe).toBe(true);

    await service.stop();
    expect(pool.ended).toBe(1);
  });

  it('refuses to bind when persistence cannot prove readiness', async () => {
    const pool = new EntryPointPostgresFake();
    pool.overduePhysicalRows = 3;
    // The established contract is the typed error plus its machine-readable
    // code, which is what the HTTP and gesture-learning layers switch on; the
    // message is human text, so the assertion pins type and `code`, not a
    // message substring.
    const startup = runGovernanceService(testEnv(), { poolForTest: pool });
    await expect(startup).rejects.toBeInstanceOf(ProductAnalyticsLifecycleError);
    await expect(startup).rejects.toMatchObject({ code: 'LIFECYCLE_UNHEALTHY' });
    // Readiness was attempted (the count probe ran) and the refusal happened
    // before any listener could bind.
    const sawReadinessProbe = pool.statements.some((sql) =>
      sql.startsWith('SELECT COUNT(*) AS count FROM nemosyne_governance.governed_product_events'),
    );
    expect(sawReadinessProbe).toBe(true);
    expect(pool.ended).toBe(0);
  });
});
