import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { DatasetJSON } from '../src/data/types.ts';
import * as bridge from '../src/wasm/RuntimeBridge.ts';

interface IdentityGoldenFixture {
  expectedSha256: string;
  dataset: DatasetJSON;
}

const fixture = JSON.parse(
  readFileSync(resolve(process.cwd(), 'tests/fixtures/q2-dataset-identity-golden.json'), 'utf8'),
) as IdentityGoldenFixture;

describe('P1-Q Q2 Rust/TypeScript cross-language identity golden', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) {
      await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
    }
    expect(bridge.isReady()).toBe(true);
  });

  it('pins the production Rust fingerprint boundary to the shared v1 digest', () => {
    const handle = bridge.loadDatasetJson(fixture.dataset);
    expect(handle).toBeGreaterThan(0);
    try {
      expect(bridge.datasetFingerprint(handle)).toBe(fixture.expectedSha256);
    } finally {
      bridge.destroyDataset(handle);
    }
  });
});
