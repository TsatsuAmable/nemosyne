// Anti-reintroduction ratchet for the retired Moneta alias. src/moneta is the
// only analytical authority after the Draco purge (#1031 kernel ABI, #1032 src
// alias purge); no src, kernel, script, or governance file may reintroduce the
// alias outside the explicitly allowed citation/retirement allowances below.
// New allowances require a review of what is being permitted — do not extend
// this list to make a failing scan pass without reading the new occurrence.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

/** File stems (repo-relative, forward slashes) allowed to mention the alias. */
const ALLOWED_FILES: ReadonlySet<string> = new Set([
  // Retired error code 0301 stays registered as reserved so persisted
  // archives remain decodable (docs/ERROR_REGISTER.md).
  'src/types/ErrorRegistry.ts',
  // check-docs ratchet guarding against the obsolete root doc returning.
  'scripts/check-docs.mjs',
]);

/** Extra token-level allowances applied to otherwise-scanned files. */
const ALLOWED_TOKEN_PATTERNS: ReadonlyArray<RegExp> = [
  // Academic citation of the Moritz et al. TVCG 2019 benchmark corpus id.
  /draco-perception/gi,
];

const SCAN_ROOTS = [
  'src',
  join('wasm', 'src'),
  'scripts',
  'governance',
  '.dependency-cruiser.boundaries.cjs',
];

function collectFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    if (entry === 'node_modules' || entry.startsWith('.')) return [];
    const full = join(directory, entry);
    return statSync(full).isDirectory()
      ? collectFiles(full)
      : /\.(?:ts|mjs|cjs|js|rs|json)$/.test(entry) || full.endsWith('.boundaries.cjs')
        ? [full]
        : [];
  });
}

describe('Moneta alias anti-reintroduction ratchet', () => {
  it('keeps retired Draco tokens out of src, kernel, scripts, and governance', () => {
    const violations: string[] = [];

    for (const scanRoot of SCAN_ROOTS) {
      // Top-level single files are scanned directly; directories are walked.
      const entries = statSync(join(ROOT, scanRoot)).isDirectory()
        ? collectFiles(scanRoot)
        : [scanRoot];

      for (const file of entries) {
        const repoPath = file.replaceAll('\\', '/');
        if (ALLOWED_FILES.has(repoPath)) continue;

        const content = readFileSync(join(ROOT, file), 'utf8');
        let scanned = content;
        for (const allowance of ALLOWED_TOKEN_PATTERNS) {
          scanned = scanned.replace(allowance, '');
        }

        const match = /draco/i.exec(scanned);
        if (match) violations.push(`${repoPath}: "${match[0]}"`);
      }
    }

    expect(
      violations,
      `Retired Draco alias reintroduced: ${violations.join('; ')}. ` +
        'Reintroductions to the Moneta alias surface are forbidden — if the token is' +
        ' genuinely a citation or retirement-record allowance, extend this test' +
        " deliberately with a comment, or use the Moneta name instead."
    ).toEqual([]);
  });
});