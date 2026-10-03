export interface LiveMessage {
  rows?: Record<string, unknown>[];
  name?: string;
  topology?: string;
}

export interface NormalizedLiveUpdate {
  rows: Record<string, unknown>[];
  name?: string;
  topology: string;
}

/**
 * A row is a record: a non-null, non-array object. Arrays are valid *values*
 * inside a row but never valid rows themselves.
 */
function isRecordRow(row: unknown): row is Record<string, unknown> {
  return typeof row === 'object' && row !== null && !Array.isArray(row);
}

/**
 * Normalize transport shape only. This module deliberately performs no schema
 * inference: Rust/WASM is the sole analytical authority, including live-ingest
 * column typing.
 *
 * Shape validation is fail-closed: a message is accepted only when every
 * entry of `rows` is a record. A single non-record entry refuses the whole
 * message so malformed rows from untrusted transport payloads can never flow
 * by reference into the coordinator buffers.
 */
export function normalizeLiveMessage(
  message: LiveMessage | unknown,
  defaultTopology: string = 'TIME_SERIES'
): NormalizedLiveUpdate | null {
  if (!message || typeof message !== 'object') return null;
  const msg = message as LiveMessage;
  if (!Array.isArray(msg.rows) || msg.rows.length === 0) return null;
  if (!msg.rows.every(isRecordRow)) return null;
  return {
    rows: msg.rows,
    name: msg.name,
    topology: msg.topology || defaultTopology,
  };
}
