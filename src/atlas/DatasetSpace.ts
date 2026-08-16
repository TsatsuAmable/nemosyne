import { Dataset } from '../data/Dataset.ts';
import type { ColumnSchema, DatasetJSON } from '../data/types.ts';

export interface DatasetSpaceNormalization {
  min: number;
  max: number;
}

export interface DatasetSpaceJSON {
  version: 1;
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

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, canonicalize(entry)])
    );
  }
  return value;
}

function hash(value: unknown): string {
  const text = JSON.stringify(canonicalize(value));
  let state = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    state ^= text.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }
  return (state >>> 0).toString(16).padStart(8, '0');
}

export class DatasetSpace {
  readonly version = 1 as const;
  readonly dataset: Dataset;
  readonly fingerprint: string;
  readonly datumIds: readonly string[];
  readonly normalization: Readonly<Record<string, DatasetSpaceNormalization>>;
  readonly missingness = 'exclude-non-finite' as const;
  readonly embedding = { method: 'none' as const, dimensions: 0 as const, seed: null };

  constructor(dataset: Dataset) {
    this.dataset = dataset.clone();
    const datasetJSON = this.dataset.toJSON();
    this.fingerprint = hash(datasetJSON);

    const occurrences = new Map<string, number>();
    this.datumIds = this.dataset.rows.map((row) => {
      const rowHash = hash(row);
      const occurrence = occurrences.get(rowHash) ?? 0;
      occurrences.set(rowHash, occurrence + 1);
      return `${this.fingerprint}:datum-${rowHash}-${occurrence}`;
    });

    const ranges: Record<string, DatasetSpaceNormalization> = {};
    for (const column of this.dataset.columns) {
      if (column.type !== 'NUMERIC') continue;
      ranges[column.name] = this.dataset.rangeOf(column.name);
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
    if (snapshot.version !== 1 || snapshot.missingness !== 'exclude-non-finite') {
      throw new Error('Unsupported DatasetSpace version');
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
