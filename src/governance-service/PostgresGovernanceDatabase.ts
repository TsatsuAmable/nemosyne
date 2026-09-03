const GOVERNANCE_SCHEMA = 'nemosyne_governance';
const CURRENT_SCHEMA_VERSION = 1;
const MIGRATION_LOCK_KEY = 0x4e454d4f53594e45n; // "NEMOSYNE" as a stable advisory-lock namespace.

export interface PostgresQueryResultV1<Row = Record<string, unknown>> {
  readonly rows: readonly Row[];
  readonly rowCount: number | null;
}

export interface PostgresQueryableV1 {
  query<Row = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<PostgresQueryResultV1<Row>>;
}

export interface PostgresClientV1 extends PostgresQueryableV1 {
  release(): void;
}

export interface PostgresPoolV1 extends PostgresQueryableV1 {
  connect(): Promise<PostgresClientV1>;
  end(): Promise<void>;
}

export type PostgresGovernanceConfigurationErrorCode =
  | 'DATABASE_URL_INVALID'
  | 'DATABASE_TLS_REQUIRED'
  | 'SCHEMA_VERSION_UNSUPPORTED'
  | 'SCHEMA_STATE_INVALID';

export class PostgresGovernanceConfigurationError extends Error {
  constructor(
    readonly code: PostgresGovernanceConfigurationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PostgresGovernanceConfigurationError';
  }
}

export interface PostgresGovernanceConnectionProfileV1 {
  readonly databaseUrl: string;
  readonly localDevelopment: boolean;
  readonly tlsRequired: boolean;
}

function isLocalDatabaseHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

/**
 * Validate configuration before a PostgreSQL driver is constructed. Production
 * profiles never infer or silently downgrade TLS from the URL.
 */
export function parsePostgresGovernanceConnectionProfileV1(
  databaseUrl: string,
  options: Readonly<{ allowInsecureLocalDevelopment?: boolean }> = {},
): PostgresGovernanceConnectionProfileV1 {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new PostgresGovernanceConfigurationError('DATABASE_URL_INVALID', 'governance database URL is invalid');
  }
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new PostgresGovernanceConfigurationError('DATABASE_URL_INVALID', 'governance database must use postgres:// or postgresql://');
  }
  if (!parsed.hostname || !parsed.pathname || parsed.pathname === '/' || parsed.hash) {
    throw new PostgresGovernanceConfigurationError('DATABASE_URL_INVALID', 'governance database URL requires a host and database name and must not contain a fragment');
  }

  const local = isLocalDatabaseHost(parsed.hostname);
  const insecureLocal = local && options.allowInsecureLocalDevelopment === true;
  const sslMode = parsed.searchParams.get('sslmode');
  const explicitlySecure = sslMode === 'require' || sslMode === 'verify-ca' || sslMode === 'verify-full';
  if (!insecureLocal && !explicitlySecure) {
    throw new PostgresGovernanceConfigurationError(
      'DATABASE_TLS_REQUIRED',
      'non-local governance PostgreSQL requires sslmode=require, verify-ca, or verify-full',
    );
  }
  if (sslMode === 'disable' && !insecureLocal) {
    throw new PostgresGovernanceConfigurationError('DATABASE_TLS_REQUIRED', 'governance PostgreSQL TLS cannot be disabled outside explicit local development');
  }

  return Object.freeze({
    databaseUrl: parsed.toString(),
    localDevelopment: insecureLocal,
    tlsRequired: !insecureLocal,
  });
}

const MIGRATION_V1 = `
CREATE SCHEMA IF NOT EXISTS ${GOVERNANCE_SCHEMA};

CREATE TABLE IF NOT EXISTS ${GOVERNANCE_SCHEMA}.product_analytics_consent_revisions (
  principal_handle TEXT NOT NULL,
  purpose TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  status TEXT NOT NULL CHECK (status IN ('GRANTED', 'DENIED')),
  notice_digest TEXT NOT NULL,
  receipt_json TEXT,
  profile_pseudonym_id TEXT,
  effective_at TIMESTAMPTZ NOT NULL,
  action_id TEXT NOT NULL,
  PRIMARY KEY (principal_handle, purpose, revision)
);
CREATE INDEX IF NOT EXISTS product_analytics_consent_current_idx
  ON ${GOVERNANCE_SCHEMA}.product_analytics_consent_revisions
  (principal_handle, purpose, revision DESC);

CREATE TABLE IF NOT EXISTS ${GOVERNANCE_SCHEMA}.product_analytics_idempotency (
  principal_handle TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  action_id TEXT NOT NULL,
  request_digest TEXT NOT NULL,
  response_json TEXT NOT NULL,
  PRIMARY KEY (principal_handle, endpoint, action_id)
);

CREATE TABLE IF NOT EXISTS ${GOVERNANCE_SCHEMA}.product_analytics_capture_authorizations (
  authorization_id TEXT PRIMARY KEY,
  principal_handle TEXT NOT NULL,
  event_id TEXT NOT NULL,
  producer_instance_id TEXT NOT NULL,
  stream_id TEXT NOT NULL,
  stream_sequence INTEGER NOT NULL CHECK (stream_sequence >= 0),
  family_id TEXT NOT NULL,
  consent_revision INTEGER NOT NULL CHECK (consent_revision > 0),
  receipt_json TEXT NOT NULL,
  profile_pseudonym_id TEXT NOT NULL,
  authorized_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  response_json TEXT NOT NULL,
  consumed_at TIMESTAMPTZ,
  invalidated_at TIMESTAMPTZ,
  UNIQUE (principal_handle, event_id)
);
CREATE INDEX IF NOT EXISTS product_analytics_capture_principal_idx
  ON ${GOVERNANCE_SCHEMA}.product_analytics_capture_authorizations (principal_handle, event_id);

CREATE TABLE IF NOT EXISTS ${GOVERNANCE_SCHEMA}.governed_product_streams (
  stream_id TEXT PRIMARY KEY,
  principal_handle TEXT NOT NULL,
  producer_instance_id TEXT NOT NULL,
  purpose TEXT NOT NULL,
  profile_pseudonym_id TEXT NOT NULL,
  family_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  next_sequence INTEGER NOT NULL CHECK (next_sequence >= 0)
);
CREATE INDEX IF NOT EXISTS governed_product_streams_principal_idx
  ON ${GOVERNANCE_SCHEMA}.governed_product_streams (principal_handle);

CREATE TABLE IF NOT EXISTS ${GOVERNANCE_SCHEMA}.governed_product_events (
  principal_handle TEXT NOT NULL,
  event_id TEXT NOT NULL,
  stream_id TEXT NOT NULL REFERENCES ${GOVERNANCE_SCHEMA}.governed_product_streams(stream_id),
  stream_sequence INTEGER NOT NULL CHECK (stream_sequence >= 0),
  content_digest TEXT NOT NULL,
  payload_digest TEXT NOT NULL,
  envelope_json TEXT NOT NULL,
  server_received_at TIMESTAMPTZ NOT NULL,
  retention_delete_after TIMESTAMPTZ NOT NULL,
  physical_delete_deadline TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (principal_handle, event_id),
  UNIQUE (stream_id, stream_sequence)
);
CREATE INDEX IF NOT EXISTS governed_product_events_export_idx
  ON ${GOVERNANCE_SCHEMA}.governed_product_events
  (principal_handle, server_received_at, event_id);
CREATE INDEX IF NOT EXISTS governed_product_events_retention_idx
  ON ${GOVERNANCE_SCHEMA}.governed_product_events (physical_delete_deadline);

CREATE TABLE IF NOT EXISTS ${GOVERNANCE_SCHEMA}.product_analytics_erasure_actions (
  principal_handle TEXT NOT NULL,
  action_id TEXT NOT NULL,
  request_digest TEXT NOT NULL,
  response_json TEXT NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL,
  purge_after TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (principal_handle, action_id)
);
CREATE INDEX IF NOT EXISTS product_analytics_erasure_purge_idx
  ON ${GOVERNANCE_SCHEMA}.product_analytics_erasure_actions (purge_after);

CREATE TABLE IF NOT EXISTS ${GOVERNANCE_SCHEMA}.data_plane_credential_sessions (
  session_handle TEXT PRIMARY KEY,
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);
`;

interface MigrationVersionRow {
  readonly version: number;
}

/**
 * Single PostgreSQL schema/migration authority for every PT4 durable table.
 * Migrations are serialized by a PostgreSQL transaction-scoped advisory lock.
 */
export class PostgresGovernanceMigrationAuthorityV1 {
  constructor(private readonly pool: PostgresPoolV1) {}

  async migrate(): Promise<number> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_LOCK_KEY.toString()]);
      await client.query(`CREATE SCHEMA IF NOT EXISTS ${GOVERNANCE_SCHEMA}`);
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${GOVERNANCE_SCHEMA}.schema_version (
          singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
          version INTEGER NOT NULL CHECK (version >= 0),
          updated_at TIMESTAMPTZ NOT NULL
        )
      `);
      const versionResult = await client.query<MigrationVersionRow>(
        `SELECT version FROM ${GOVERNANCE_SCHEMA}.schema_version WHERE singleton = TRUE FOR UPDATE`,
      );
      if (versionResult.rows.length > 1) {
        throw new PostgresGovernanceConfigurationError('SCHEMA_STATE_INVALID', 'governance schema contains multiple version rows');
      }
      let version = versionResult.rows[0]?.version ?? 0;
      if (!Number.isInteger(version) || version < 0 || version > CURRENT_SCHEMA_VERSION) {
        throw new PostgresGovernanceConfigurationError(
          'SCHEMA_VERSION_UNSUPPORTED',
          `unsupported governance PostgreSQL schema version ${String(version)}`,
        );
      }
      if (version === 0) {
        await client.query(MIGRATION_V1);
        await client.query(
          `INSERT INTO ${GOVERNANCE_SCHEMA}.schema_version (singleton, version, updated_at)
           VALUES (TRUE, $1, CURRENT_TIMESTAMP)
           ON CONFLICT (singleton) DO UPDATE SET version = EXCLUDED.version, updated_at = EXCLUDED.updated_at`,
          [CURRENT_SCHEMA_VERSION],
        );
        version = CURRENT_SCHEMA_VERSION;
      }
      await client.query('COMMIT');
      return version;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Preserve the original migration failure.
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async assertCurrent(): Promise<void> {
    const result = await this.pool.query<MigrationVersionRow>(
      `SELECT version FROM ${GOVERNANCE_SCHEMA}.schema_version WHERE singleton = TRUE`,
    );
    if (result.rows.length !== 1 || result.rows[0]?.version !== CURRENT_SCHEMA_VERSION) {
      throw new PostgresGovernanceConfigurationError(
        'SCHEMA_VERSION_UNSUPPORTED',
        'governance PostgreSQL schema is absent, incomplete, or unsupported',
      );
    }
  }
}

export const POSTGRES_GOVERNANCE_SCHEMA_V1 = Object.freeze({
  schema: GOVERNANCE_SCHEMA,
  version: CURRENT_SCHEMA_VERSION,
});
