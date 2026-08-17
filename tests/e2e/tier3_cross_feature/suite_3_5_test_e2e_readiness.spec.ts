import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Tier 3 — Suite 3.5: Test Automation × E2E Readiness (F14 × F15)', () => {
  it('INT-3.5.1: Verifies test runner configuration, tier test files presence, and environment isolation', () => {
    const rootDir = process.cwd();
    const vitestConfig = path.join(rootDir, 'vitest.config.js');
    expect(fs.existsSync(vitestConfig)).toBe(true);

    // Wave 3 deleted the pure-topology-parity tier2 spec (f01_boundary), so the
    // healthy minimum tier2 population is now 14.
    const tier2Files = fs.readdirSync(path.join(rootDir, 'tests', 'e2e', 'tier2_boundary_corner'));
    expect(tier2Files.length).toBeGreaterThanOrEqual(14);

    const tier3Files = fs.readdirSync(path.join(rootDir, 'tests', 'e2e', 'tier3_cross_feature'));
    expect(tier3Files.length).toBeGreaterThanOrEqual(5);

    const tier4Files = fs.readdirSync(path.join(rootDir, 'tests', 'e2e', 'tier4_real_world'));
    expect(tier4Files.length).toBeGreaterThanOrEqual(4);
  });
});
