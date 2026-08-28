import { describe, expect, it } from 'vitest';
import {
  canonicalDatasetIdentityHex,
  canonicalDatasetIdentityHexAsync,
} from '../src/data/DatasetIdentity.ts';
import type { DatasetJSON } from '../src/data/types.ts';

const STREAMING_ROW_COUNT = 50_001;

function makeLargeDataset(edges: DatasetJSON['edges']): DatasetJSON {
  return {
    name: 'q2-streaming-identity',
    columns: [
      { name: 'x', type: 'NUMERIC' },
      { name: 'label', type: 'CATEGORICAL' },
    ],
    rows: Array.from({ length: STREAMING_ROW_COUNT }, (_, index) => ({
      x: index,
      ...(index % 11 === 0 ? {} : { label: `group-${index % 7}` }),
      ignoredPresentationValue: index % 3,
    })),
    edges,
  };
}

describe('P1-Q Q2 canonical dataset identity parity', () => {
  it('keeps the large-dataset async path byte-equivalent to canonical identity across chunk boundaries and nested edge key order', async () => {
    const dataset = makeLargeDataset([
      {
        target: 1,
        source: 0,
        relation: { z: 3, a: 'canonical-first' },
        weight: 0.5,
      },
    ]);

    expect(await canonicalDatasetIdentityHexAsync(dataset)).toBe(
      canonicalDatasetIdentityHex(dataset),
    );
  });

  it('preserves the semantic distinction between an explicit empty edge set and an absent edge field on the async path', async () => {
    const withEmptyEdges = makeLargeDataset([]);
    const withoutEdges = makeLargeDataset(undefined);

    expect(await canonicalDatasetIdentityHexAsync(withEmptyEdges)).toBe(
      canonicalDatasetIdentityHex(withEmptyEdges),
    );
    expect(await canonicalDatasetIdentityHexAsync(withoutEdges)).toBe(
      canonicalDatasetIdentityHex(withoutEdges),
    );
    expect(canonicalDatasetIdentityHex(withEmptyEdges)).not.toBe(
      canonicalDatasetIdentityHex(withoutEdges),
    );
  });
});
