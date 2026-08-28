import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CANONICAL_DATASET_IDENTITY_ALGORITHM,
  canonicalDatasetIdentityHex,
  canonicalDatasetIdentityInput,
} from '../src/data/DatasetIdentity.ts';
import type { DatasetJSON } from '../src/data/types.ts';
import { canonicalJsonStringify } from '../src/security/CryptoHash.ts';

interface IdentityGoldenFixture {
  algorithm: string;
  expectedSha256: string;
  canonicalJson: string;
  dataset: DatasetJSON;
}

const fixture = JSON.parse(
  readFileSync(resolve(process.cwd(), 'tests/fixtures/q2-dataset-identity-golden.json'), 'utf8'),
) as IdentityGoldenFixture;

describe('P1-Q Q2 cross-language canonical dataset identity golden', () => {
  it('pins the TypeScript canonical preimage and SHA-256 to the shared v1 contract', () => {
    expect(fixture.algorithm).toBe(CANONICAL_DATASET_IDENTITY_ALGORITHM);

    const projection = canonicalDatasetIdentityInput(fixture.dataset);
    expect(canonicalJsonStringify(projection)).toBe(fixture.canonicalJson);
    expect(canonicalDatasetIdentityHex(fixture.dataset)).toBe(fixture.expectedSha256);
  });
});
