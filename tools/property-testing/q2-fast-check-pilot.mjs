import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  canonicalDatasetIdentityHex,
  canonicalDatasetIdentityInput,
} from '../../src/data/DatasetIdentity.ts';

const BASE_SEED = 20_260_828;
const NUM_RUNS = 250;

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

function toDataset(sample) {
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

function withoutPresentationExtras(dataset) {
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

function runProperty(name, seedOffset, property) {
  const seed = BASE_SEED + seedOffset;
  fc.assert(property, { numRuns: NUM_RUNS, seed, endOnFailure: true });
  console.log(`property=${name} runs=${NUM_RUNS} seed=${seed} status=pass`);
}

runProperty(
  'undeclared-row-fields-do-not-change-scientific-identity',
  1,
  fc.property(datasetArbitrary, (sample) => {
    const withPresentationExtras = toDataset(sample);
    const scientificOnly = withoutPresentationExtras(withPresentationExtras);
    assert.equal(
      canonicalDatasetIdentityHex(withPresentationExtras),
      canonicalDatasetIdentityHex(scientificOnly),
    );
  }),
);

runProperty(
  'row-ids-and-root-presentation-metadata-are-excluded',
  2,
  fc.property(datasetArbitrary, fc.array(fc.string({ maxLength: 20 }), { maxLength: 25 }), (sample, rowIds) => {
    const dataset = withoutPresentationExtras(toDataset(sample));
    const decorated = {
      ...dataset,
      rowIds,
      _meta: { selected: true, cameraHint: 'presentation-only' },
    };
    assert.equal(canonicalDatasetIdentityHex(decorated), canonicalDatasetIdentityHex(dataset));
  }),
);

runProperty(
  'json-roundtrip-preserves-canonical-scientific-identity',
  3,
  fc.property(datasetArbitrary, (sample) => {
    const dataset = withoutPresentationExtras(toDataset(sample));
    const roundTripped = JSON.parse(JSON.stringify(dataset));
    assert.equal(canonicalDatasetIdentityHex(roundTripped), canonicalDatasetIdentityHex(dataset));
  }),
);

runProperty(
  'graph-endpoint-json-type-remains-scientifically-visible',
  4,
  fc.property(jsonScalar, (attribute) => {
    const base = {
      name: 'endpoint-type-property',
      columns: [{ name: 'x', type: 'NUMERIC' }],
      rows: [{ x: 1 }, { x: 2 }],
    };
    const numericEndpoint = {
      ...base,
      edges: [{ source: 0, target: 1, relation: { attribute } }],
    };
    const stringEndpoint = {
      ...base,
      edges: [{ source: '0', target: '1', relation: { attribute } }],
    };
    assert.notEqual(
      canonicalDatasetIdentityHex(numericEndpoint),
      canonicalDatasetIdentityHex(stringEndpoint),
    );
  }),
);

runProperty(
  'canonical-projection-normalizes-missing-declared-values-to-null',
  5,
  fc.property(fc.integer(), fc.string({ maxLength: 20 }), (x, name) => {
    const missing = {
      name,
      columns: [
        { name: 'x', type: 'NUMERIC' },
        { name: 'y', type: 'NUMERIC' },
      ],
      rows: [{ x }],
    };
    const explicitNull = {
      ...missing,
      rows: [{ x, y: null }],
    };
    assert.deepEqual(canonicalDatasetIdentityInput(missing), canonicalDatasetIdentityInput(explicitNull));
    assert.equal(canonicalDatasetIdentityHex(missing), canonicalDatasetIdentityHex(explicitNull));
  }),
);

const shrinkProbe = fc.check(
  fc.property(fc.integer({ min: 0, max: 10_000 }), (value) => value < 10),
  {
    seed: BASE_SEED + 99,
    numRuns: 20,
    examples: [[10_000]],
    verbose: 2,
  },
);

assert.equal(shrinkProbe.failed, true, 'deliberate diagnostic probe must fail');
assert.ok(shrinkProbe.numShrinks > 0, 'deliberate diagnostic probe must demonstrate shrinking');
assert.ok(shrinkProbe.counterexample, 'deliberate diagnostic probe must retain a counterexample');
console.log(
  `shrink-evidence seed=${shrinkProbe.seed} path=${shrinkProbe.counterexamplePath} shrinks=${shrinkProbe.numShrinks} counterexample=${JSON.stringify(shrinkProbe.counterexample)}`,
);

console.log(`P1-Q Q2 fast-check pilot complete: 5 properties x ${NUM_RUNS} generated cases + shrink probe`);
