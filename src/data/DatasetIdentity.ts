import type { DatasetJSON } from './types.ts';
import {
  canonicalJsonStringify,
  canonicalSha256Hex,
  canonicalSha256HexStreaming,
} from '../security/CryptoHash.ts';

/**
 * Stable name for the scientific dataset identity contract shared with Rust.
 *
 * Versioning this semantic contract separately from package/session formats lets
 * provenance say exactly what a `datasetFingerprint` commits to without tying
 * identity evolution to a container format revision.
 */
export const CANONICAL_DATASET_IDENTITY_ALGORITHM = 'sha256-canonical-dataset-v1' as const;

/** Threshold for using streaming hash to avoid memory pressure on large datasets. */
const STREAMING_HASH_THRESHOLD = 50000;

export interface CanonicalDatasetIdentityInput {
  columns: DatasetJSON['columns'];
  edges?: NonNullable<DatasetJSON['edges']>;
  name: string;
  rows: Record<string, unknown>[];
}

/**
 * Build the scientific projection hashed by Rust `dataset_fingerprint`.
 *
 * Contract:
 * - declared schema order is preserved;
 * - row objects contain declared columns only;
 * - a missing/undefined declared value is scientific null;
 * - graph edges, endpoint JSON types, weights, and attributes are retained;
 * - durable rowIds and presentation/adapter metadata are excluded;
 * - dataset name remains part of v1 for parity with the established Rust
 *   fingerprint contract. Changing that rule requires a new identity version.
 *
 * Object-key canonical ordering and JSON scalar rendering are provided by
 * `canonicalSha256Hex`, which is intentionally mirrored by Rust.
 */
export function canonicalDatasetIdentityInput(
  dataset: DatasetJSON,
): CanonicalDatasetIdentityInput {
  const columns = dataset.columns.map((column) => ({
    name: column.name,
    type: column.type,
  }));
  const declaredNames = columns.map((column) => column.name);
  const rows = dataset.rows.map((row) => {
    const projected: Record<string, unknown> = {};
    for (const name of declaredNames) {
      const value = row?.[name];
      projected[name] = value === undefined ? null : value;
    }
    return projected;
  });

  return {
    columns,
    ...(dataset.edges ? { edges: dataset.edges.map((edge) => ({ ...edge })) } : {}),
    name: dataset.name,
    rows,
  };
}

/** SHA-256 scientific identity compatible with Rust `dataset_fingerprint`. */
export function canonicalDatasetIdentityHex(dataset: DatasetJSON): string {
  return canonicalSha256Hex(canonicalDatasetIdentityInput(dataset));
}

/** Async version that uses chunked canonical hashing for large datasets. */
export async function canonicalDatasetIdentityHexAsync(dataset: DatasetJSON): Promise<string> {
  const input = canonicalDatasetIdentityInput(dataset);

  if (input.rows.length < STREAMING_HASH_THRESHOLD) {
    return canonicalSha256Hex(input);
  }

  const { columns, edges, name, rows } = input;
  const rowCount = rows.length;
  const chunkSize = 10000;

  return canonicalSha256HexStreaming(
    (writer) => {
      // canonicalJsonStringify sorts object keys recursively. Preserve that exact
      // top-level order here: columns, optional edges, name, rows.
      writer.write(`{"columns":${canonicalJsonStringify(columns)}`);
      if (edges !== undefined) {
        writer.write(`,"edges":${canonicalJsonStringify(edges)}`);
      }
      writer.write(`,"name":${canonicalJsonStringify(name)},"rows":[`);
    },
    async (writer, start, end) => {
      for (let i = start; i < end; i++) {
        if (i > 0) writer.write(',');
        writer.write(canonicalJsonStringify(rows[i]));
      }
    },
    (writer) => {
      writer.write(']}');
    },
    rowCount,
    chunkSize,
  );
}