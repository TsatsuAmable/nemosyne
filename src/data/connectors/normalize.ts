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
 * Normalize transport shape only. This module deliberately performs no schema
 * inference: Rust/WASM is the sole analytical authority, including live-ingest
 * column typing.
 */
export function normalizeLiveMessage(
  message: LiveMessage | unknown,
  defaultTopology: string = 'TIME_SERIES'
): NormalizedLiveUpdate | null {
  if (!message || typeof message !== 'object') return null;
  const msg = message as LiveMessage;
  if (!Array.isArray(msg.rows) || msg.rows.length === 0) return null;
  return {
    rows: msg.rows,
    name: msg.name,
    topology: msg.topology || defaultTopology,
  };
}
