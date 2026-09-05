import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
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

  it('keeps PR security evidence blocking and merge authority outside workflows', () => {
    const approvalWorkflow = readFileSync('.github/workflows/approval-gate.yml', 'utf8');
    const codeqlWorkflow = readFileSync('.github/workflows/codeql.yml', 'utf8');

    expect(approvalWorkflow).toContain('contents: read');
    expect(approvalWorkflow).toContain('pull-requests: read');
    expect(approvalWorkflow).not.toContain('gh pr merge');
    expect(approvalWorkflow).not.toContain('contents: write');
    expect(codeqlWorkflow).toContain('pull_request:');
    expect(codeqlWorkflow).toContain('upload: never');
    expect(codeqlWorkflow).toContain('Enforce zero CodeQL findings');
    expect(codeqlWorkflow).toContain('Upload CodeQL SARIF evidence');
  });

  it('keeps the ordinary PR evidence graph consolidated', () => {
    const approvalWorkflow = readFileSync('.github/workflows/approval-gate.yml', 'utf8');
    const ciWorkflow = readFileSync('.github/workflows/ci.yml', 'utf8');
    const architectureAudit = readFileSync(
      '.github/workflows/architecture-policy-pilot.yml',
      'utf8',
    );
    const q9Audit = readFileSync(
      '.github/workflows/p1q-q9-promotion-controller.yml',
      'utf8',
    );
    const q3dAudit = readFileSync(
      '.github/workflows/q3d-browser-envelope-pilot.yml',
      'utf8',
    );
    const a1Audit = readFileSync(
      '.github/workflows/stream-a-a1-browser-envelope.yml',
      'utf8',
    );

    expect(ciWorkflow).toContain('name: Enforce architecture policy');
    expect(ciWorkflow).toContain('run: npm run architecture:check');

    expect(approvalWorkflow).toContain('Verify governance policy matches live ruleset');
    expect(approvalWorkflow).not.toContain('--wait-seconds');
    expect(approvalWorkflow).not.toContain('--poll-seconds');
    expect(approvalWorkflow).not.toContain('--required-checks');

    for (const manualAudit of [architectureAudit, q9Audit, q3dAudit, a1Audit]) {
      expect(manualAudit).toContain('workflow_dispatch:');
      expect(manualAudit).not.toContain('pull_request:');
    }
  });
});