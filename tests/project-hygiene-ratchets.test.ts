import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const repoRoot = process.cwd();
const tsNoCheckMarker = ['@ts', 'nocheck'].join('-');
// Verified against the synced repository baseline on 2026-09-02, then lowered
// by removing the stale opt-out from features-wiki.test.ts. This is an inherited
// ceiling, not a target: lower it whenever more legacy opt-outs are removed.
const LEGACY_TEST_TS_NOCHECK_BASELINE = 189;

function filesUnder(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...filesUnder(path));
    else files.push(path);
  }
  return files;
}

function filesContaining(root: string, marker: string): string[] {
  return filesUnder(root)
    .filter((path) => path.endsWith('.ts'))
    .filter((path) => readFileSync(path, 'utf8').includes(marker));
}

describe('project hygiene ratchets', () => {
  it('keeps production TypeScript free of ts-nocheck opt-outs', () => {
    expect(filesContaining(join(repoRoot, 'src'), tsNoCheckMarker)).toEqual([]);
  });

  it('never increases the legacy ts-nocheck test baseline', () => {
    const testsRoot = join(repoRoot, 'tests');
    const optOutFiles = filesContaining(testsRoot, tsNoCheckMarker);
    const relativeOptOutFiles = optOutFiles.map((path) => relative(testsRoot, path)).sort();
    expect(
      optOutFiles.length,
      `legacy test ts-nocheck baseline exceeded: ${optOutFiles.length} > ${LEGACY_TEST_TS_NOCHECK_BASELINE}\n` +
        `Current opt-out files:\n${relativeOptOutFiles.join('\n')}`
    ).toBeLessThanOrEqual(LEGACY_TEST_TS_NOCHECK_BASELINE);
  });

  it('keeps production Three.js loading self-hosted', () => {
    const html = readFileSync(join(repoRoot, 'index.html'), 'utf8');
    const netlify = readFileSync(join(repoRoot, 'netlify.toml'), 'utf8');

    expect(html).not.toContain('type="importmap"');
    expect(html).not.toContain('unpkg.com');
    expect(netlify).not.toContain('unpkg.com');
    expect(netlify).toContain("script-src 'self';");
  });

  it('keeps retired Draco branding out of onboarding copy', () => {
    const tour = readFileSync(join(repoRoot, 'src/data/DefaultTour.ts'), 'utf8');
    const visibleCopy = [...tour.matchAll(/text:\s*'([^']*)'/g)].map((match) => match[1]).join('\n');
    expect(visibleCopy).not.toMatch(/\bDraco\b/i);
  });
});
