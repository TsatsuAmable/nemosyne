import { Dataset } from '../data/Dataset.ts';
import type { ColumnSchema, DatasetJSON } from '../data/types.ts';
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

/**
 * Optional kernel-derived sources for the space. When supplied, `fingerprint`
 * and `ranges` come from the Rust kernel instead of the JS SHA-256 fallback.
 */
export interface DatasetSpaceSources {
  fingerprint?: string | null;
  ranges?: Record<string, DatasetSpaceNormalization> | null;
}

/** Canonical SHA-256 over JSON-compatible content. */
export function contentHashHex(value: unknown): string {
  return canonicalSha256Hex(value);
}

/**
 * @deprecated Compatibility alias for pre-SHA call sites. Despite the historic
 * name this now returns the canonical SHA-256 digest. New code must use
 * `contentHashHex`; remove this alias after legacy consumers are migrated.
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
    this.dataset = dataset.clone();
    const datasetJSON = this.dataset.toJSON();
    this.fingerprint = sources?.fingerprint ?? contentHashHex(datasetJSON);

    const occurrences = new Map<string, number>();
    this.datumIds = this.dataset.rows.map((row) => {
      const rowHash = contentHashHex(row);
      const occurrence = occurrences.get(rowHash) ?? 0;
      occurrences.set(rowHash, occurrence + 1);
      return `${this.fingerprint}:datum-${rowHash}-${occurrence}`;
    });

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
    if (column.type !== 'NUMERIC' || typeof value !== 'number' || !Number.isFinite(value))
      return null;
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
    const space = new DatasetSpace(Dataset.fromJSON(snapshot.dataset));
    if (
      space.fingerprint !== snapshot.fingerprint ||
      space.datumIds.join('|') !== snapshot.datumIds.join('|')
    ) {
      throw new Error('DatasetSpace fingerprint mismatch');
    }
    return space;
  }
}
