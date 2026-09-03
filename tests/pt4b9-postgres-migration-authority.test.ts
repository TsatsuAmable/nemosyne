import { describe, expect, it } from 'vitest';

import {
  POSTGRES_GOVERNANCE_SCHEMA_V1,
  PostgresGovernanceConfigurationError,
  PostgresGovernanceMigrationAuthorityV1,
  parsePostgresGovernanceConnectionProfileV1,
  type PostgresClientV1,
  type PostgresPoolV1,
  type PostgresQueryResultV1,
} from '../src/governance-service/PostgresGovernanceDatabase.ts';

class FakePostgres implements PostgresPoolV1, PostgresClientV1 {
  readonly statements: string[] = [];
  version: number | null = null;
  released = 0;
  failOnGovernedStreams = false;

  async connect(): Promise<PostgresClientV1> {
    return this;
  }

  release(): void {
    this.released += 1;
  }

  async end(): Promise<void> {}

  async query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResultV1<Row>> {
    this.statements.push(text.trim());
    if (this.failOnGovernedStreams && text.includes('CREATE TABLE IF NOT EXISTS nemosyne_governance.governed_product_streams')) {
      throw new Error('injected migration failure');
    }
    if (text.includes('SELECT version FROM nemosyne_governance.schema_version')) {
      const rows = this.version === null ? [] : [{ version: this.version }];
      return { rows: rows as Row[], rowCount: rows.length };
    }
    if (text.includes('INSERT INTO nemosyne_governance.schema_version')) {
      this.version = Number(values[0]);
    }
    return { rows: [], rowCount: 0 };
  }
}

describe('PT4B9 PostgreSQL connection policy', () => {
  it('requires PostgreSQL and TLS for non-local service databases', () => {
    expect(() => parsePostgresGovernanceConnectionProfileV1('https://db.example/nemosyne')).toThrowError(PostgresGovernanceConfigurationError);
    expect(() => parsePostgresGovernanceConnectionProfileV1('postgresql://db.example/nemosyne')).toThrowErrorMatchingObject({
      code: 'DATABASE_TLS_REQUIRED',
    });
    expect(() => parsePostgresGovernanceConnectionProfileV1('postgresql://db.example/nemosyne?sslmode=disable')).toThrowErrorMatchingObject({
      code: 'DATABASE_TLS_REQUIRED',
    });

    const profile = parsePostgresGovernanceConnectionProfileV1(
      'postgresql://db.example/nemosyne?sslmode=verify-full',
    );
    expect(profile.tlsRequired).toBe(true);
    expect(profile.localDevelopment).toBe(false);
  });

  it('permits insecure PostgreSQL only for an explicitly authorized local-development profile', () => {
    expect(() => parsePostgresGovernanceConnectionProfileV1('postgresql://localhost/nemosyne')).toThrowErrorMatchingObject({
      code: 'DATABASE_TLS_REQUIRED',
    });
    const profile = parsePostgresGovernanceConnectionProfileV1(
      'postgresql://localhost/nemosyne?sslmode=disable',
      { allowInsecureLocalDevelopment: true },
    );
    expect(profile).toMatchObject({ localDevelopment: true, tlsRequired: false });
  });
});

describe('PT4B9 PostgreSQL schema authority', () => {
  it('owns the complete PT4 schema under one serialized transactional migration', async () => {
    const database = new FakePostgres();
    const authority = new PostgresGovernanceMigrationAuthorityV1(database);

    await expect(authority.migrate()).resolves.toBe(POSTGRES_GOVERNANCE_SCHEMA_V1.version);
    expect(database.version).toBe(POSTGRES_GOVERNANCE_SCHEMA_V1.version);
    expect(database.statements[0]).toBe('BEGIN');
    expect(database.statements.some((sql) => sql.includes('pg_advisory_xact_lock'))).toBe(true);
    expect(database.statements.some((sql) => sql.includes('product_analytics_consent_revisions'))).toBe(true);
    expect(database.statements.some((sql) => sql.includes('product_analytics_capture_authorizations'))).toBe(true);
    expect(database.statements.some((sql) => sql.includes('governed_product_streams'))).toBe(true);
    expect(database.statements.some((sql) => sql.includes('governed_product_events'))).toBe(true);
    expect(database.statements.some((sql) => sql.includes('product_analytics_erasure_actions'))).toBe(true);
    expect(database.statements.some((sql) => sql.includes('data_plane_credential_sessions'))).toBe(true);
    expect(database.statements.at(-1)).toBe('COMMIT');
    expect(database.released).toBe(1);

    const priorStatementCount = database.statements.length;
    await expect(authority.migrate()).resolves.toBe(POSTGRES_GOVERNANCE_SCHEMA_V1.version);
    const secondRun = database.statements.slice(priorStatementCount);
    expect(secondRun.some((sql) => sql.includes('governed_product_events ('))).toBe(false);
    expect(database.released).toBe(2);
  });

  it('rolls back atomically and releases the connection when schema creation fails', async () => {
    const database = new FakePostgres();
    database.failOnGovernedStreams = true;
    const authority = new PostgresGovernanceMigrationAuthorityV1(database);

    await expect(authority.migrate()).rejects.toThrow('injected migration failure');
    expect(database.statements).toContain('ROLLBACK');
    expect(database.statements).not.toContain('COMMIT');
    expect(database.version).toBeNull();
    expect(database.released).toBe(1);
  });

  it('refuses newer or missing schema versions instead of silently downgrading', async () => {
    const database = new FakePostgres();
    database.version = POSTGRES_GOVERNANCE_SCHEMA_V1.version + 1;
    const authority = new PostgresGovernanceMigrationAuthorityV1(database);

    await expect(authority.migrate()).rejects.toMatchObject({ code: 'SCHEMA_VERSION_UNSUPPORTED' });
    expect(database.statements).toContain('ROLLBACK');

    database.version = null;
    await expect(authority.assertCurrent()).rejects.toMatchObject({ code: 'SCHEMA_VERSION_UNSUPPORTED' });
    database.version = POSTGRES_GOVERNANCE_SCHEMA_V1.version;
    await expect(authority.assertCurrent()).resolves.toBeUndefined();
  });
});
