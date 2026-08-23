import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const scriptPath = resolve(process.cwd(), 'scripts/benchmark-data-boundary.mjs');

describe('data boundary benchmark contract', () => {
  it('defines the four deterministic large-data tiers', () => {
    const source = readFileSync(scriptPath, 'utf8');
    expect(source).toContain("'10k': 10_000");
    expect(source).toContain("'100k': 100_000");
    expect(source).toContain("'1m': 1_000_000");
    expect(source).toContain("'10m': 10_000_000");
  });

  it('compares the primitive borrowed-column ABI with full JSON materialisation', () => {
    const source = readFileSync(scriptPath, 'utf8');
    expect(source).toContain('dataset_primitive_column_values_ptr');
    expect(source).toContain('dataset_primitive_column_validity_ptr');
    expect(source).toContain('firstPrimitiveBorrowAndScanMs');
    expect(source).toContain('cachedPrimitiveBorrowAndScanMs');
    expect(source).toContain('wasmMemoryGrowthForBorrowCacheBytes');
    expect(source).toContain('borrowedRowObjects: 0');
    expect(source).toContain('schemaVersion: 3');
  });

  it('predeclares the 100K/1M canonical-columnar decision gates', () => {
    const source = readFileSync(scriptPath, 'utf8');
    expect(source).toContain("const required = ['100k', '1m']");
    expect(source).toContain('PROMOTE_COLUMNAR_CANDIDATE');
    expect(source).toContain('HOLD_DUAL_REPRESENTATION');
    expect(source).toContain('cachedBorrowMateriallyFasterAt1m');
    expect(source).toContain('firstBorrowFasterAt1m');
    expect(source).toContain('cacheGrowthBoundedToLogicalPayload');
    expect(source).toContain('cachedBorrowScalingNoWorseThanMaterialization');
    expect(source).toContain('reconstructedRowsAvoided');
  });

  it('fails before touching WASM when an unknown tier is requested', () => {
    const run = spawnSync(process.execPath, [scriptPath, '--tier=bogus'], {
      encoding: 'utf8',
    });
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/Unknown tier 'bogus'/);
    expect(run.stderr).not.toMatch(/WASM package missing/);
  });
});
