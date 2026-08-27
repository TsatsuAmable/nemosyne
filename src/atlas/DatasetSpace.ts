import { Dataset } from '../data/Dataset.ts';
import type { ColumnSchema, DatasetJSON } from '../data/types.ts';
import {
  canonicalDatasetIdentityHex,
} from '../data/DatasetIdentity.ts';
import { canonicalSha256Hex } from '../security/CryptoHash.ts';

export interface DatasetSpaceNormalization {
  min: number;
  max: number;
}

export interface DatasetSpaceJSON {
  version: 2;
  fingerprint: string;
  datumIds: string[];
  normalization: Record<string, DatasetSpaceNormalization>;
  missingness: 'exclude-non-finite';
  embedding: {
    method: 'none';
    dimensions: 0;
    seed: null;
  };
  dataset: DatasetJSON;
}

export interface DatasetSpaceSources {
  /** Canonical scientific fingerprint supplied by the authoritative data path. */
  fingerprint?: string | null;
  /** Rust-owned numeric ranges. When present, DatasetSpace must not rescan rows. */
  ranges?: Record<string, DatasetSpaceNormalization> | null;
  /**
   * Durable observation identities supplied by the authoritative lineage path.
   * Omitted means: prefer the Dataset's validated durable rowIds when present,
   * otherwise use the schema-v2 content-occurrence compatibility IDs. Explicit
   * null forces the historical content-occurrence mode when reading old v2 state.
   */
  datumIds?: readonly string[] | null;
}

/** Canonical SHA-256 over generic JSON-compatible content. */
export function contentHashHex(value: unknown): string {
  return canonicalSha256Hex(value);
}

/**
 * @deprecated Use `canonicalDatasetIdentityHex` from the data layer. Retained
 * while callers migrate; this alias now follows the exact Rust scientific
 * projection rather than hashing arbitrary row-object keys.
 */
export const datasetContentHashHex = canonicalDatasetIdentityHex;

/**
 * @deprecated Compatibility alias for pre-SHA call sites. Despite the historic
 * name this now returns canonical SHA-256. New code must use `contentHashHex`.
 */
export const fnv1aHex = contentHashHex;

function validateAuthoritativeDatumIds(
  datumIds: readonly string[],
  rowCount: number,
): string[] {
  if (
    datumIds.length !== rowCount ||
    datumIds.some((id) => typeof id !== 'string' || id.length === 0) ||
    new Set(datumIds).size !== datumIds.length
  ) {
    throw new Error('[DatasetSpace] authoritative datum IDs must be unique, non-empty, and aligned 1:1 with rows');
  }
  return [...datumIds];
}

function arraysEqual(left: readonly string[] | undefined, right: readonly string[]): boolean {
  if (!left || left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

export class DatasetSpace {
  readonly version = 2 as const;
  readonly dataset: Dataset;
  readonly fingerprint: string;
  readonly datumIds: readonly string[];
  readonly normalization: Readonly<Record<string, DatasetSpaceNormalization>>;
  readonly missingness = 'exclude-non-finite' as const;
  readonly embedding = { method: 'none' as const, dimensions: 0 as const, seed: null };

  constructor(dataset: Dataset, sources?: DatasetSpaceSources) {
    this.dataset = dataset.clone();
    this.fingerprint = sources?.fingerprint ?? canonicalDatasetIdentityHex(this.dataset.toJSON());

    const hasExplicitDatumIds = sources != null && Object.prototype.hasOwnProperty.call(sources, 'datumIds');
    const authoritativeDatumIds = hasExplicitDatumIds
      ? sources?.datumIds
      : this.dataset.rowIds;

    if (authoritativeDatumIds != null) {
      this.datumIds = validateAuthoritativeDatumIds(authoritativeDatumIds, this.dataset.rowCount);
    } else {
      // Historical/direct schema-v2 fallback. New Atlas datasets with durable
      // rowIds never enter this O(N) content-hash path, regardless of accessor
      // order or whether DatasetSpace was first requested for state export.
      const occurrences = new Map<string, number>();
      this.datumIds = this.dataset.rows.map((row) => {
        const rowHash = contentHashHex(row);
        const occurrence = occurrences.get(rowHash) ?? 0;
        occurrences.set(rowHash, occurrence + 1);
        return `${this.fingerprint}:datum-${rowHash}-${occurrence}`;
      });
    }

    const ranges: Record<string, DatasetSpaceNormalization> = {};
    if (sources?.ranges) {
      for (const [name, range] of Object.entries(sources.ranges)) {
        ranges[name] = { min: range.min, max: range.max };
      }
    } else {
      for (const column of this.dataset.columns) {
        if (column.type !== 'NUMERIC') continue;
        ranges[column.name] = this.dataset.rangeOf(column.name);
      }
    }
    this.normalization = ranges;
  }

  datumIdAt(rowIndex: number): string | undefined {
    return this.datumIds[rowIndex];
  }

  normalize(column: ColumnSchema, value: unknown): number | null {
    if (column.type !== 'NUMERIC' || typeof value !== 'number' || !Number.isFinite(value)) return null;
    const range = this.normalization[column.name];
    if (!range) return null;
    if (range.max === range.min) return 0;
    return (value - range.min) / (range.max - range.min);
  }

  toJSON(): DatasetSpaceJSON {
    return {
      version: this.version,
      fingerprint: this.fingerprint,
      datumIds: [...this.datumIds],
      normalization: { ...this.normalization },
      missingness: this.missingness,
      embedding: { ...this.embedding },
      dataset: this.dataset.toJSON(),
    };
  }

  static fromJSON(snapshot: DatasetSpaceJSON): DatasetSpace {
    if (snapshot.version !== 2 || snapshot.missingness !== 'exclude-non-finite') {
      throw new Error('Unsupported DatasetSpace version; legacy 32-bit fingerprints must be regenerated');
    }
    const dataset = Dataset.fromJSON(snapshot.dataset);
    // RF-051 compatibility: new live Atlas snapshots use the durable row-ID
    // vector directly. Older v2 snapshots can contain rowIds while retaining
    // content-occurrence datum IDs, so explicitly force the historical mode
    // when the two vectors do not agree instead of reinterpreting old state.
    const datumIds = arraysEqual(snapshot.dataset.rowIds, snapshot.datumIds)
      ? snapshot.datumIds
      : null;
    const space = new DatasetSpace(dataset, { datumIds });
    if (space.fingerprint !== snapshot.fingerprint || space.datumIds.join('|') !== snapshot.datumIds.join('|')) {
      throw new Error('DatasetSpace fingerprint mismatch');
    }
    return space;
  }
}
