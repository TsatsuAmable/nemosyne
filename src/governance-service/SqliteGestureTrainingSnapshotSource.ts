import { statSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import {
  DERIVED_GESTURE_OBSERVATION_FAMILY_ID,
  GOVERNED_PURPOSES,
} from '../governance/index.ts';
import type {
  GestureTrainingSnapshotSourceV1,
  GestureTrainingSourceReadRequestV1,
  GestureTrainingSourceRecordV1,
} from '../learning/GestureTrainingSnapshotMaterializer.ts';

const MAX_RECORDS = 1_000_000;
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

interface SourceRow {
  readonly event_id: string;
  readonly server_received_at: string;
  readonly envelope_json: string;
}

export class GestureTrainingSnapshotSourceError extends Error {
  constructor(readonly code: 'INVALID_CONFIGURATION' | 'INVALID_REQUEST' | 'SOURCE_LIMIT_EXCEEDED', message: string) {
    super(message);
    this.name = 'GestureTrainingSnapshotSourceError';
  }
}

export interface SqliteGestureTrainingSnapshotSourceOptionsV1 {
  readonly dataDirectory: string;
}

function canonicalUtc(value: string): boolean {
  return UTC_TIMESTAMP.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

/**
 * Read-only PT6D adapter over the existing governed SQLite evidence store.
 *
 * This adapter deliberately does not select `principal_handle`. The learning
 * plane receives only admitted envelope identity, purpose-scoped pseudonym and
 * immutable event evidence. SQLite remains repository-runnable infrastructure,
 * not a declaration of the eventual production datastore.
 */
export class SqliteGestureTrainingSnapshotSourceV1 implements GestureTrainingSnapshotSourceV1 {
  private readonly db: DatabaseSync;

  constructor(options: SqliteGestureTrainingSnapshotSourceOptionsV1) {
    if (!options.dataDirectory) {
      throw new GestureTrainingSnapshotSourceError('INVALID_CONFIGURATION', 'dataDirectory is required');
    }
    const databasePath = join(options.dataDirectory, 'governance.sqlite');
    let status;
    try {
      status = statSync(databasePath);
    } catch {
      throw new GestureTrainingSnapshotSourceError('INVALID_CONFIGURATION', 'governance.sqlite does not exist');
    }
    if (!status.isFile()) {
      throw new GestureTrainingSnapshotSourceError('INVALID_CONFIGURATION', 'governance.sqlite must be a regular file');
    }
    this.db = new DatabaseSync(databasePath, { readOnly: true });
  }

  close(): void {
    this.db.close();
  }

  async readDerivedLearningRecords(
    request: GestureTrainingSourceReadRequestV1,
  ): Promise<readonly GestureTrainingSourceRecordV1[]> {
    if (
      request.schemaVersion !== '1' ||
      !canonicalUtc(request.asOf) ||
      !Number.isSafeInteger(request.maxRecords) ||
      request.maxRecords < 1 ||
      request.maxRecords > MAX_RECORDS
    ) {
      throw new GestureTrainingSnapshotSourceError('INVALID_REQUEST', 'snapshot source request is invalid or exceeds the bounded read policy');
    }

    const rows = this.db.prepare(
      `SELECT event_id, server_received_at, envelope_json
       FROM governed_gesture_learning_events
       WHERE purpose = ? AND family_id = ?
         AND server_received_at <= ?
         AND retention_delete_after > ?
       ORDER BY server_received_at ASC, event_id ASC
       LIMIT ?`,
    ).all(
      GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING,
      DERIVED_GESTURE_OBSERVATION_FAMILY_ID,
      request.asOf,
      request.asOf,
      request.maxRecords + 1,
    ) as unknown as SourceRow[];

    if (rows.length > request.maxRecords) {
      throw new GestureTrainingSnapshotSourceError(
        'SOURCE_LIMIT_EXCEEDED',
        `retained L2 population exceeds the ${request.maxRecords}-record snapshot bound`,
      );
    }

    return Object.freeze(rows.map((row) => Object.freeze({
      eventId: row.event_id,
      serverReceivedAt: row.server_received_at,
      envelopeJson: row.envelope_json,
    })));
  }
}
