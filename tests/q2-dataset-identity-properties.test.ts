import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  canonicalDatasetIdentityHex,
  canonicalDatasetIdentityInput,
} from '../src/data/DatasetIdentity.ts';
import type { DatasetJSON } from '../src/data/types.ts';

const NUM_RUNS = 250;
const BASE_SEED = 20_260_828;

const jsonScalar = fc.oneof(
  fc.integer({ min: -1_000_000, max: 1_000_000 }),
  fc.double({ min: -1_000_000, max: 1_000_000, noNaN: true, noDefaultInfinity: true }),
  fc.boolean(),
  fc.string({ maxLength: 24 }),
  fc.constant(null),
);

const rowArbitrary = fc.record(
  {
    x: fc.integer({ min: -10_000, max: 10_000 }),
    label: fc.option(fc.string({ maxLength: 20 }), { nil: undefined }),
    flag: fc.option(fc.boolean(), { nil: undefined }),
    ignoredPresentationValue: jsonScalar,
  },
  { requiredKeys: ['x', 'ignoredPresentationValue'] },
);

const datasetArbitrary = fc.record({
  name: fc.string({ minLength: 1, maxLength: 24 }),
  rows: fc.array(rowArbitrary, { maxLength: 25 }),
});

type GeneratedDatasetSample = {
  name: string;
  rows: Record<string, unknown>[];
};

function toDataset(sample: GeneratedDatasetSample): DatasetJSON {
  return {
    name: sample.name,
    columns: [
      { name: 'x', type: 'NUMERIC' },
      { name: 'label', type: 'CATEGORICAL' },
      { name: 'flag', type: 'CATEGORICAL' },
    ],
    rows: sample.rows,
  };
}

function withoutPresentationExtras(dataset: DatasetJSON): DatasetJSON {
  return {
    name: dataset.name,
    columns: dataset.columns,
    rows: dataset.rows.map((row) => ({
      x: row.x,
      ...(row.label === undefined ? {} : { label: row.label }),
      ...(row.flag === undefined ? {} : { flag: row.flag }),
    })),
  };
}

function propertyConfig(seedOffset: number) {
  return {
    numRuns: NUM_RUNS,
    seed: BASE_SEED + seedOffset,
  };
}

describe('P1-Q Q2 bounded canonical dataset identity properties', () => {
  it('excludes undeclared row fields from scientific identity', () => {
    fc.assert(
      fc.property(datasetArbitrary, (sample) => {
        const withPresentationExtras = toDataset(sample);
        const scientificOnly = withoutPresentationExtras(withPresentationExtras);
        expect(canonicalDatasetIdentityHex(withPresentationExtras)).toBe(
          canonicalDatasetIdentityHex(scientificOnly),
        );
      }),
      propertyConfig(1),
    );
  });

  it('excludes row lineage and root presentation metadata from scientific identity', () => {
    fc.assert(
      fc.property(
        datasetArbitrary,
        fc.array(fc.string({ maxLength: 20 }), { maxLength: 25 }),
        (sample, rowIds) => {
          const dataset = withoutPresentationExtras(toDataset(sample));
          const decorated = {
            ...dataset,
            rowIds,
            _meta: { selected: true, cameraHint: 'presentation-only' },
          };
          expect(canonicalDatasetIdentityHex(decorated)).toBe(
            canonicalDatasetIdentityHex(dataset),
          );
        },
      ),
      propertyConfig(2),
    );
  });

  it('preserves scientific identity through a JSON roundtrip', () => {
    fc.assert(
      fc.property(datasetArbitrary, (sample) => {
        const dataset = withoutPresentationExtras(toDataset(sample));
        const roundTripped = JSON.parse(JSON.stringify(dataset)) as DatasetJSON;
        expect(canonicalDatasetIdentityHex(roundTripped)).toBe(
          canonicalDatasetIdentityHex(dataset),
        );
      }),
      propertyConfig(3),
    );
  });

  it('keeps graph endpoint JSON type scientifically visible', () => {
    fc.assert(
      fc.property(jsonScalar, (attribute) => {
        const base: DatasetJSON = {
          name: 'endpoint-type-property',
          columns: [{ name: 'x', type: 'NUMERIC' }],
          rows: [{ x: 1 }, { x: 2 }],
        };
        const numericEndpoint: DatasetJSON = {
          ...base,
          edges: [{ source: 0, target: 1, relation: { attribute } }],
        };
        const stringEndpoint: DatasetJSON = {
          ...base,
          edges: [{ source: '0', target: '1', relation: { attribute } }],
        };
        expect(canonicalDatasetIdentityHex(numericEndpoint)).not.toBe(
          canonicalDatasetIdentityHex(stringEndpoint),
        );
      }),
      propertyConfig(4),
    );
  });

  it('normalizes missing declared values and explicit null to the same canonical projection', () => {
    fc.assert(
      fc.property(fc.integer(), fc.string({ maxLength: 20 }), (x, name) => {
        const missing: DatasetJSON = {
          name,
          columns: [
            { name: 'x', type: 'NUMERIC' },
            { name: 'y', type: 'NUMERIC' },
          ],
          rows: [{ x }],
        };
        const explicitNull: DatasetJSON = {
          ...missing,
          rows: [{ x, y: null }],
        };
        expect(canonicalDatasetIdentityInput(missing)).toEqual(
          canonicalDatasetIdentityInput(explicitNull),
        );
        expect(canonicalDatasetIdentityHex(missing)).toBe(
          canonicalDatasetIdentityHex(explicitNull),
        );
      }),
      propertyConfig(5),
    );
  });
});
