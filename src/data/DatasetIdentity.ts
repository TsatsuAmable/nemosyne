import type { DatasetJSON } from './types.ts';
import { canonicalSha256Hex } from '../security/CryptoHash.ts';

/**
 * Stable name for the scientific dataset identity contract shared with Rust.
 *
 * Versioning this semantic contract separately from package/session formats lets
 * provenance say exactly what a `datasetFingerprint` commits to without tying
 * identity evolution to a container format revision.
 */
export const CANONICAL_DATASET_IDENTITY_ALGORITHM = 'sha256-canonical-dataset-v1' as const;

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
