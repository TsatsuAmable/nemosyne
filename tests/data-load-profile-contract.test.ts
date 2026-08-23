import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const script = readFileSync(resolve(process.cwd(), 'scripts/profile-data-load.mjs'), 'utf8');

describe('data-load profile contract', () => {
  it('profiles both architectural scale tiers', () => {
    expect(script).toContain("'100k': 100_000");
    expect(script).toContain("'1m': 1_000_000");
  });

  it('isolates compatibility-build, columnar-build, pointer and cold-scan effects', () => {
    expect(script).toContain('data_load_dataset_json_profiled');
    expect(script).toContain('data_last_load_profile');
    expect(script).toContain('compatibilityDatasetBuildMs');
    expect(script).toContain('columnarSidecarBuildMs');
    expect(script).toContain('dominantRustPhase');
    expect(script).toContain('JSON_ROW_COMPATIBILITY_BUILD_DOMINATES');
    expect(script).toContain('ROW_TO_COLUMNAR_RECONSTRUCTION_DOMINATES');
    expect(script).toContain('pointerAcquireMs');
    expect(script).toContain('coldScanMs');
    expect(script).toContain('warmScanMs');
  });
});
