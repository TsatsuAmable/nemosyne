import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import {
  parseLocations,
  resolveAstGrepBin,
  scanRule,
} from '../scripts/lib/test-quality-scanner.mjs';

const root = process.cwd();
const rulesDir = join(root, 'tools', 'reviewer-loop', 'test-quality-rules');

describe('reviewer test-quality scanner', () => {
  it('resolves to a directly runnable native binary', () => {
    const bin = resolveAstGrepBin(root);
    expect(bin).not.toBeNull();
    // Direct spawn must succeed: routing the cli entry through node breaks on
    // runners where postinstall staged a native binary, and that failure used
    // to read as zero findings.
    const out = execFileSync(bin as string, ['--version'], { encoding: 'utf8' });
    expect(out.trim().length).toBeGreaterThan(0);
  });

  it('reports a root without a scanner as absent', () => {
    expect(resolveAstGrepBin(join(root, 'tests', 'fixtures'))).toBeNull();
  });

  it('surfaces an unrunnable scanner as a scan failure, not an empty result', () => {
    const result = scanRule('definitely-not-a-scanner-binary', 'vacuous-test.yml', 'tests', root);
    expect(result.ok).toBe(false);
    expect(result.output).toBe('');
    expect(result.error.length).toBeGreaterThan(0);
  });

  it('finds the known vacuous assertion end to end', () => {
    const bin = resolveAstGrepBin(root) as string;
    const result = scanRule(
      bin,
      join(rulesDir, 'vacuous-test.yml'),
      join('tests', 'fixtures', 'scan-samples'),
      root
    );
    expect(result.ok).toBe(true);
    const hits = parseLocations(result.output);
    expect(hits.some((h) => h.includes('vacuous-sample.ts'))).toBe(true);
  });

  it('no longer finds the fixed webxr-simulator vacuous test', () => {
    const bin = resolveAstGrepBin(root) as string;
    const result = scanRule(bin, join(rulesDir, 'vacuous-test.yml'), join('tests', 'ui-system'), root);
    expect(result.ok).toBe(true);
    const hits = parseLocations(result.output);
    expect(hits.some((h) => h.includes('webxr-simulator.test.ts'))).toBe(false);
  });

  it('parses pretty-print locations without the binary', () => {
    const corner = String.fromCharCode(0x250c);
    const dash = String.fromCharCode(0x2500);
    const output = `help[vacuous-test]:\n    ${corner}${dash} tests/a.test.ts:3:1\n`;
    expect(parseLocations(output)).toEqual(['tests/a.test.ts:3']);
  });
});