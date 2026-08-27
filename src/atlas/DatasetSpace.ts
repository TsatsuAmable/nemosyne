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
  fingerprint?: string | null;
  ranges?: Record<string, DatasetSpaceNormalization> | null;
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

export class DatasetSpace {
  readonly version = 2 as const;
  readonly dataset: Dataset;
  readonly fingerprint: string;
  readonly datumIds: readonly string[];
  readonly normalization: Readonly<Record<string, DatasetSpaceNormalization>>;
  readonly missingness = 'exclude-non-finite' as const;
  readonly embedding = { method: 'none' as const, dimensions: 0 as const, seed: null };

  constructor(dataset: Dataset, sources?: DatasetSpaceSources) {
    // Avoid cloning if caller provides pre-computed values
    this.dataset = dataset;
    const datasetJSON = sources?.fingerprint ? null : this.dataset.toJSON();
    this.fingerprint = sources?.fingerprint ?? canonicalDatasetIdentityHex(datasetJSON!);

    // Use pre-computed datumIds if provided, otherwise compute them
    if (sources?.datumIds) {
      this.datumIds = sources.datumIds;
    } else {
      const occurrences = new Map<string, number>();
      this.datumIds = this.dataset.rows.map((row) => {
        const rowHash = contentHashHex(row);
        const occurrence = occurrences.get(rowHash) ?? 0;
        occurrences.set(rowHash, occurrence + 1);
        return `${this.fingerprint}:datum-${rowHash}-${occurrence}`;
      });
    }

    // Use pre-computed ranges if provided, otherwise compute them
    if (sources?.ranges) {
      this.normalization = sources.ranges;
    } else {
      const ranges: Record<string, DatasetSpaceNormalization> = {};
      for (const column of this.dataset.columns) {
        if (column.type !== 'NUMERIC') continue;
        ranges[column.name] = this.dataset.rangeOf(column.name);
      }
      this.normalization = ranges;
    }
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
    // Compute the expected fingerprint from the dataset to validate against the snapshot
    const expectedFingerprint = canonicalDatasetIdentityHex(dataset.toJSON());
    if (expectedFingerprint !== snapshot.fingerprint) {
      throw new Error('DatasetSpace fingerprint mismatch');
    }
    const space = new DatasetSpace(dataset, {
      fingerprint: snapshot.fingerprint,
      ranges: snapshot.normalization,
      datumIds: snapshot.datumIds,
    });
    if (space.datumIds.join('|') !== snapshot.datumIds.join('|')) {
      throw new Error('DatasetSpace datumIds mismatch');
    }
    return space;
  }
}
