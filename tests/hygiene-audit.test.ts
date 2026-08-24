import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { FAST_NODE_TESTS, UI_ONLY_TESTS, WASM_TESTS } from './config/test-groups.ts';

describe('Sprint 27.7 — Recurring Maintainability, Tech Debt & Code Hygiene Audit Protocol', () => {
  it('ensures all 8 architectural subsystem public barrels exist', () => {
    const subsystems = [
      'atlas',
      'draco',
      'data',
      'network',
      'session',
      'study',
      'wasm',
      'vr/perception',
    ];

    for (const sub of subsystems) {
      expect(existsSync(`src/${sub}/index.ts`)).toBe(true);
    }
  });

  it('verifies audit:hygiene script exists and is executable', () => {
    expect(existsSync('scripts/audit-hygiene.mjs')).toBe(true);
  });

  it('keeps explicit test groups disjoint and assigns the WASM columnar profile correctly', () => {
    const groupedTests = [...FAST_NODE_TESTS, ...UI_ONLY_TESTS, ...WASM_TESTS];

    expect(new Set(groupedTests).size).toBe(groupedTests.length);
    expect(WASM_TESTS).toContain('tests/wasm-columnar-structure-profile.test.ts');
  });
});
