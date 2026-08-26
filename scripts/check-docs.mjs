#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = process.cwd();
const failures = [];

function fail(message) {
  failures.push(message);
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

const manifestPath = 'docs/DOCS_MANIFEST.json';
if (!existsSync(resolve(root, manifestPath))) {
  fail(`missing ${manifestPath}`);
} else {
  const manifest = JSON.parse(read(manifestPath));
  const allowedStatuses = new Set(['canonical', 'active', 'historical']);
  const authorities = new Map();

  if (manifest.schemaVersion !== 1) fail('DOCS_MANIFEST schemaVersion must be 1');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(manifest.lastReviewed ?? '')) {
    fail('DOCS_MANIFEST lastReviewed must be YYYY-MM-DD');
  }

  for (const document of manifest.documents ?? []) {
    if (!document.path || !document.status || !document.authority || !document.owner) {
      fail(`invalid manifest entry: ${JSON.stringify(document)}`);
      continue;
    }
    if (!allowedStatuses.has(document.status)) {
      fail(`unsupported status '${document.status}' for ${document.path}`);
    }
    if (!existsSync(resolve(root, document.path))) {
      fail(`manifest path does not exist: ${document.path}`);
    }
    if (document.status === 'historical' && !document.path.startsWith('docs/archive/')) {
      fail(`historical document must live under docs/archive/: ${document.path}`);
    }
    if (document.status === 'canonical') {
      const existing = authorities.get(document.authority);
      if (existing) fail(`duplicate canonical authority '${document.authority}': ${existing}, ${document.path}`);
      authorities.set(document.authority, document.path);
    }
  }
}

for (const obsoleteRootDoc of ['TEST_READY.md', 'TEST_INFRA.md']) {
  if (existsSync(resolve(root, obsoleteRootDoc))) {
    fail(`${obsoleteRootDoc} is a stale point-in-time report and must remain archived`);
  }
}

const instructionFiles = [
  'AGENTS.md',
  'CLAUDE.md',
  '.github/copilot-instructions.md',
  '.github/AUTO_REMEDIATION.md',
];
const stalePatterns = [
  [/MONETA_MIGRATION_COMPLETION_SPRINT\.md/, 'archived Moneta migration sprint'],
  [/three@0\.168\.0/, 'stale three.js version'],
  [/thresholds?:\s*\d+\/\d+\/\d+\/\d+/i, 'hard-coded coverage thresholds'],
  [/CI gate order/i, 'hard-coded serial CI topology'],
];
for (const file of instructionFiles) {
  if (!existsSync(resolve(root, file))) {
    fail(`missing instruction file: ${file}`);
    continue;
  }
  const content = read(file);
  for (const [pattern, label] of stalePatterns) {
    if (pattern.test(content)) fail(`${file} contains ${label}; link to executable/current authority instead`);
  }
}

if (!read('CLAUDE.md').includes('AGENTS.md')) fail('CLAUDE.md must defer to AGENTS.md');
if (!read('.github/copilot-instructions.md').includes('AGENTS.md')) {
  fail('.github/copilot-instructions.md must defer to AGENTS.md');
}

const packageJson = JSON.parse(read('package.json'));
if (packageJson.scripts?.['docs:check'] !== 'node scripts/check-docs.mjs') {
  fail('package.json must expose docs:check as node scripts/check-docs.mjs');
}
const ci = read('.github/workflows/ci.yml');
if (!ci.includes('npm run docs:check')) fail('required CI static analysis must run npm run docs:check');

function checkMarkdownLinks(path) {
  const content = read(path);
  const linkPattern = /\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of content.matchAll(linkPattern)) {
    const target = match[1].trim();
    if (!target || target.startsWith('#') || /^[a-z]+:/i.test(target)) continue;
    const clean = target.split('#')[0].split('?')[0];
    if (!clean) continue;
    const resolved = resolve(root, dirname(path), clean);
    if (!existsSync(resolved)) {
      fail(`${path} has broken local link: ${target}`);
      continue;
    }
    if (target.endsWith('/') && !statSync(resolved).isDirectory()) {
      fail(`${path} expects directory link but target is not a directory: ${target}`);
    }
  }
}

checkMarkdownLinks('docs/PROJECT_DOCS_INDEX.md');

if (failures.length > 0) {
  console.error('DOCUMENTATION INTEGRITY FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('DOCUMENTATION INTEGRITY PASSED');
console.log('Manifest paths, authority rules, stale-instruction guards, and index links are valid.');
