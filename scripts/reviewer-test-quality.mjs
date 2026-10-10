#!/usr/bin/env node
// Reviewer-loop test-quality aggregation: vacuous tests, tautological and
// determinism-only assertions (ast-grep), plus candidate untested source
// files (basename import scan). Report-only: always exits 0. Findings are
// leads for a human reviewer, not defects — helper assertion styles and
// indirect coverage produce false positives by design.

import { execFileSync } from 'node:child_process';
import { readdirSync, statSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative, basename } from 'node:path';

const root = process.cwd();
const rulesDir = join(root, 'tools', 'reviewer-loop', 'test-quality-rules');
const outDir = join(root, 'reports', 'test-quality');
mkdirSync(outDir, { recursive: true });

function walk(dir, ext) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) found.push(...walk(full, ext));
    else if (entry.endsWith(ext)) found.push(full);
  }
  return found;
}

function scan(rule, scope) {
  try {
    // Spawn the ast-grep JS entry through node directly: no shell, no PATH
    // dependence, identical on Windows and Linux CI runners.
    const out = execFileSync(
      process.execPath,
      [
        join(root, 'node_modules', '@ast-grep', 'cli', 'ast-grep'),
        'scan',
        '--rule',
        join(rulesDir, rule),
        scope,
      ],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
    );
    return out;
  } catch (error) {
    return error.stdout ?? '';
  }
}

function locations(output) {
  const hits = [];
  for (const line of String(output).split('\n')) {
    const match = line.match(/┌─\s+(\S+?):(\d+):(\d+)/);
    if (match) hits.push(`${match[1]}:${match[2]}`);
  }
  return [...new Set(hits)];
}

const vacuous = locations(scan('vacuous-test.yml', 'tests'));
const tautological = locations(scan('tautological-expect.yml', 'tests'));
const determinismOnly = locations(scan('determinism-only-expect.yml', 'tests'));

// Candidate untested files: no test file references the source basename.
const testFiles = walk(join(root, 'tests'), '.test.ts');
const haystack = testFiles.map((f) => readFileSync(f, 'utf8')).join('\n');
const srcFiles = walk(join(root, 'src'), '.ts');
const untested = srcFiles
  .map((f) => relative(root, f).replace(/\\/g, '/'))
  .filter((rel) => {
    const base = basename(rel, '.ts');
    if (base === 'index' || base.endsWith('.test')) return false;
    return !haystack.includes(base);
  });

const lines = [
  '# Test-quality review',
  '',
  `Vacuous tests (no expect/assert call): **${vacuous.length}**`,
  ...vacuous.map((h) => `- ${h}`),
  '',
  `Tautological assertions (literal self-compare): **${tautological.length}**`,
  ...tautological.map((h) => `- ${h}`),
  '',
  `Determinism-only assertions (self-compare; weak but non-empty): **${determinismOnly.length}**`,
  ...determinismOnly.map((h) => `- ${h}`),
  '',
  `Candidate untested source files (basename never referenced by a test): **${untested.length}**`,
  ...untested.slice(0, 50).map((h) => `- ${h}`),
];
if (untested.length > 50) lines.push(`- …and ${untested.length - 50} more (see artifact)`);
lines.push(
  '',
  '_Helper assertion styles and indirect coverage cause false positives; verify before acting._'
);
const report = lines.join('\n');
writeFileSync(join(outDir, 'test-quality-report.md'), report);
console.log(
  `test-quality: vacuous=${vacuous.length} tautological=${tautological.length} determinism-only=${determinismOnly.length} untested=${untested.length}`
);
