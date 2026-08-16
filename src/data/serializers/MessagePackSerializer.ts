/**
 * MessagePack serializer for Nemosyne datasets.
 *
 * MessagePack is a good default when Arrow/FlatBuffers are not available:
 * small, fast, and human-inspectable with tooling. The payload shape matches
 * the existing JSON envelope (`{ name, columns, rows }`) so that a server
 * using MessagePack is transparent to the Nemosyne runtime.
 */

import { encode, decode } from '@msgpack/msgpack';
import { Dataset } from '../Dataset.ts';
import type { ColumnSchema } from '../types.ts';

interface MessagePackPayload {
  name?: string;
  columns?: ColumnSchema[];
  rows?: Record<string, unknown>[];
}

/**
 * Serialize a Dataset to a MessagePack Uint8Array.
 */
export function datasetToMessagePack(dataset: Dataset): Uint8Array {
  return encode({
    name: dataset.name,
    columns: dataset.columns,
    rows: dataset.rows,
  });
}

/**
 * Deserialize a MessagePack payload back into a Dataset.
 *
 * Defense-in-depth against prototype pollution is centralized in
 * `Dataset.sanitizeRow` (applied by the Dataset constructor below),
 * so untrusted `__proto__`/`constructor`/`prototype` row keys are
 * stripped before reaching downstream consumers.
 */
export function messagePackToDataset(buffer: Uint8Array | ArrayBuffer): Dataset {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
  const payload = decode(bytes) as MessagePackPayload;
  return new Dataset(
    payload.name ?? 'MessagePack Dataset',
    payload.columns ?? [],
    payload.rows ?? []
  );
}
