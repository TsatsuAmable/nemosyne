/**
 * MessagePack serializer for Nemosyne datasets.
 *
 * MessagePack is a good default when Arrow/FlatBuffers are not available:
 * small, fast, and human-inspectable with tooling. The payload shape matches
 * the existing JSON envelope (`{ name, columns, rows }`) so that a server
 * using MessagePack is transparent to the Nemosyne runtime.
 */

import { encode, decode } from '@msgpack/msgpack';
import { Dataset } from '../Dataset.js';

/**
 * Serialize a Dataset to a MessagePack Uint8Array.
 * @param {import('../Dataset.js').Dataset} dataset
 * @returns {Uint8Array}
 */
export function datasetToMessagePack(dataset) {
  return encode({
    name: dataset.name,
    columns: dataset.columns,
    rows: dataset.rows,
  });
}

/**
 * Deserialize a MessagePack payload back into a Dataset.
 * @param {Uint8Array|ArrayBuffer} buffer
 * @returns {import('../Dataset.js').Dataset}
 */
export function messagePackToDataset(buffer) {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
  const payload = decode(bytes);
  return new Dataset(
    payload.name ?? 'MessagePack Dataset',
    payload.columns ?? [],
    payload.rows ?? []
  );
}
