import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const script = readFileSync(resolve(process.cwd(), 'scripts/profile-data-load.mjs'), 'utf8');

describe('data-load profile contract', () => {
  it('profiles both architectural scale tiers', () => {
    expect(script).toContain("'100k': 100_000");
    expect(script).toContain("'1m': 1_000_000");
  });

  it('isolates row-id bootstrap and cold-scan effects', () => {
    expect(script).toContain('rowIdsProvided');
    expect(script).toContain('generatedVsSuppliedLoadRatio');
    expect(script).toContain('ROW_ID_BOOTSTRAP_IS_MAJOR_LOAD_COST');
    expect(script).toContain('pointerAcquireMs');
    expect(script).toContain('coldScanMs');
    expect(script).toContain('warmScanMs');
  });
});
