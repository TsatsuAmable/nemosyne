#!/usr/bin/env node
// Reviewer-loop test-quality aggregation: vacuous tests, tautological and
// determinism-only assertions (ast-grep), plus candidate untested source
// files (basename import scan). Report-only: always exits 0. Findings are
// leads for a human reviewer, not defects — helper assertion styles and
// indirect coverage produce false positives by design.
//
// A scan that cannot run is reported as SCAN FAILED, never as a zero count:
// the ast-grep entry must be spawned as a native binary (see
// scripts/lib/test-quality-scanner.mjs), and absence is explicit.

import { readdirSync, statSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import { resolveAstGrepBin, scanRule, parseLocations } from './lib/test-quality-scanner.mjs';

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

const bin = resolveAstGrepBin(root);

function runCategory(rule, scope) {
  if (!bin) return { ok: false, hits: [], error: 'ast-grep binary not found under node_modules/@ast-grep/cli' };
  const result = scanRule(bin, join(rulesDir, rule), scope, root);
  if (!result.ok) return { ok: false, hits: [], error: result.error };
  return { ok: true, hits: parseLocations(result.output), error: '' };
}

const vacuous = runCategory('vacuous-test.yml', 'tests');
const tautological = runCategory('tautological-expect.yml', 'tests');
const determinismOnly = runCategory('determinism-only-expect.yml', 'tests');

function section(title, category) {
  if (!category.ok) return [`${title}: **SCAN FAILED**`, `- scanner error: ${category.error}`];
  return [`${title}: **${category.hits.length}**`, ...category.hits.map((h) => `- ${h}`)];
}

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
  ...section('Vacuous tests (no expect/assert call)', vacuous),
  '',
  ...section('Tautological assertions (literal self-compare)', tautological),
  '',
  ...section('Determinism-only assertions (self-compare; weak but non-empty)', determinismOnly),
  '',
  `Candidate untested source files (basename never referenced by a test): **${untested.length}**`,
  ...untested.slice(0, 50).map((h) => `- ${h}`),
];
if (untested.length > 50) lines.push(`- \u2026and ${untested.length - 50} more (see artifact)`);
lines.push(
  '',
  '_Helper assertion styles and indirect coverage cause false positives; verify before acting._'
);
const report = lines.join('\n');
writeFileSync(join(outDir, 'test-quality-report.md'), report);
const failed = [vacuous, tautological, determinismOnly].filter((c) => !c.ok).length;
console.log(
  `test-quality: vacuous=${vacuous.hits.length} tautological=${tautological.hits.length} determinism-only=${determinismOnly.hits.length} untested=${untested.length} scanFailures=${failed}`
);
if (failed > 0) console.error(`test-quality: ${failed} categor${failed === 1 ? 'y' : 'ies'} failed to scan; see report`);