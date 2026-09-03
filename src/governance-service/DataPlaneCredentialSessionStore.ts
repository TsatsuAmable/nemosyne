import { chmodSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import type { PostgresPoolV1 } from './PostgresGovernanceDatabase.ts';

const SCHEMA = 'nemosyne_governance';

export interface DataPlaneCredentialSessionStoreV1 {
  touch(sessionHandle: string, seenAt: string): Promise<'ACTIVE' | 'REVOKED'>;
  revoke(sessionHandle: string, revokedAt: string): Promise<boolean>;
  close(): Promise<void>;
}

/** PostgreSQL production implementation. Schema creation is owned by PT4B9 migrations. */
export class PostgresDataPlaneCredentialSessionStoreV1 implements DataPlaneCredentialSessionStoreV1 {
  constructor(private readonly pool: PostgresPoolV1) {}

  async touch(sessionHandle: string, seenAt: string): Promise<'ACTIVE' | 'REVOKED'> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const prior = await client.query<{ revoked_at: string | Date | null }>(
        `SELECT revoked_at FROM ${SCHEMA}.data_plane_credential_sessions WHERE session_handle = $1 FOR UPDATE`,
        [sessionHandle],
      );
      if (prior.rows[0]?.revoked_at) {
        await client.query('ROLLBACK');
        return 'REVOKED';
      }
      await client.query(
        `INSERT INTO ${SCHEMA}.data_plane_credential_sessions
         (session_handle, first_seen_at, last_seen_at, revoked_at)
         VALUES ($1, $2, $2, NULL)
         ON CONFLICT (session_handle) DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at`,
        [sessionHandle, seenAt],
      );
      await client.query('COMMIT');
      return 'ACTIVE';
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* preserve original failure */ }
      throw error;
    } finally {
      client.release();
    }
  }

  async revoke(sessionHandle: string, revokedAt: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE ${SCHEMA}.data_plane_credential_sessions
       SET revoked_at = $1
       WHERE session_handle = $2 AND revoked_at IS NULL`,
      [revokedAt, sessionHandle],
    );
    return result.rowCount === 1;
  }

  async close(): Promise<void> {
    // Pool ownership belongs to the aggregate PostgreSQL persistence/composition.
  }
}

/** Temporary compatibility/test implementation. */
export class SqliteDataPlaneCredentialSessionStoreV1 implements DataPlaneCredentialSessionStoreV1 {
  private readonly db: DatabaseSync;

  constructor(dataDirectory: string) {
    mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });
    chmodSync(dataDirectory, 0o700);
    if ((statSync(dataDirectory).mode & 0o777) !== 0o700) throw new Error('governance data directory must be mode 0700');
    const databasePath = join(dataDirectory, 'governance.sqlite');
    this.db = new DatabaseSync(databasePath);
    chmodSync(databasePath, 0o600);
    this.db.exec('PRAGMA foreign_keys = ON');
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA synchronous = FULL');
    this.db.exec('PRAGMA secure_delete = ON');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS data_plane_credential_sessions (
        session_handle TEXT PRIMARY KEY,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        revoked_at TEXT
      );
    `);
  }

  async touch(sessionHandle: string, seenAt: string): Promise<'ACTIVE' | 'REVOKED'> {
    const row = this.db.prepare('SELECT revoked_at FROM data_plane_credential_sessions WHERE session_handle = ?').get(sessionHandle) as { revoked_at: string | null } | undefined;
    if (row?.revoked_at) return 'REVOKED';
    this.db.prepare(
      `INSERT INTO data_plane_credential_sessions (session_handle, first_seen_at, last_seen_at, revoked_at)
       VALUES (?, ?, ?, NULL)
       ON CONFLICT(session_handle) DO UPDATE SET last_seen_at = excluded.last_seen_at`,
    ).run(sessionHandle, seenAt, seenAt);
    return 'ACTIVE';
  }

  async revoke(sessionHandle: string, revokedAt: string): Promise<boolean> {
    const result = this.db.prepare('UPDATE data_plane_credential_sessions SET revoked_at = ? WHERE session_handle = ? AND revoked_at IS NULL').run(revokedAt, sessionHandle);
    return Number(result.changes) === 1;
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
