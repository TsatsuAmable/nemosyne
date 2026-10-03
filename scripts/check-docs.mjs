#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { renderProductionReadiness } from './render-production-readiness.mjs';
import {
  REVIEW_FINDINGS_BEGIN,
  REVIEW_FINDINGS_END,
  loadReviewFindings,
  renderReviewFindingsProjection,
} from './render-review-findings.mjs';

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
    if (!allowedStatuses.has(document.status)) fail(`unsupported status '${document.status}' for ${document.path}`);
    if (!existsSync(resolve(root, document.path))) fail(`manifest path does not exist: ${document.path}`);
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

for (const obsoleteRootDoc of ['TEST_READY.md', 'TEST_INFRA.md', 'draco_viso.md']) {
  if (existsSync(resolve(root, obsoleteRootDoc))) {
    fail(`${obsoleteRootDoc} is historical material and must remain archived`);
  }
}

const requiredGovernance = [
  'CONTRIBUTING.md',
  'SECURITY.md',
  '.github/CODEOWNERS',
  'docs/OWNERSHIP.md',
  'docs/RFC_PROCESS.md',
  'docs/architecture/decisions/README.md',
  'governance/production-capabilities.json',
  'governance/production-readiness.json',
  'governance/review-findings.json',
  'docs/PRODUCTION_READINESS.md',
];
for (const file of requiredGovernance) {
  if (!existsSync(resolve(root, file))) fail(`missing governance file: ${file}`);
}

if (existsSync(resolve(root, 'docs/PRODUCTION_READINESS.md'))) {
  try {
    const expected = renderProductionReadiness(root);
    if (read('docs/PRODUCTION_READINESS.md') !== expected) {
      fail('docs/PRODUCTION_READINESS.md is stale; run node scripts/render-production-readiness.mjs --write');
    }
  } catch (error) {
    fail(`production readiness projection failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

try {
  const ledger = loadReviewFindings(root);
  const roadmap = read('docs/ROADMAP.md');
  const expected = renderReviewFindingsProjection(root);
  const start = roadmap.indexOf(REVIEW_FINDINGS_BEGIN);
  const end = roadmap.indexOf(REVIEW_FINDINGS_END);

  if (start < 0 || end < 0 || end < start) {
    fail('docs/ROADMAP.md is missing the generated review-finding projection markers');
  } else {
    const actual = roadmap.slice(start, end + REVIEW_FINDINGS_END.length);
    if (actual !== expected) {
      fail('docs/ROADMAP.md review-finding projection is stale; run npm run governance:findings:write');
    }
  }

  for (const finding of ledger.findings) {
    for (const evidence of finding.evidence) {
      if (/^[a-z]+:/i.test(evidence)) continue;
      const path = evidence.split('#')[0];
      if (path && !existsSync(resolve(root, path))) {
        fail(`${finding.id} evidence path does not exist: ${path}`);
      }
    }
  }

  const assurance = read('docs/archive/STREAM_C_SECURITY_ASSURANCE.md');
  for (const finding of ledger.findings) {
    const heading = `### ${finding.id} -`;
    const sectionStart = assurance.indexOf(heading);
    if (sectionStart < 0) {
      fail(`docs/archive/STREAM_C_SECURITY_ASSURANCE.md is missing ${finding.id}`);
      continue;
    }
    const nextHeading = assurance.indexOf('\n### RF-', sectionStart + heading.length);
    const section = assurance.slice(sectionStart, nextHeading < 0 ? assurance.length : nextHeading);
    if (/^\*\*Status:\*\*/m.test(section)) {
      fail(`docs/archive/STREAM_C_SECURITY_ASSURANCE.md must not restate mutable status for ${finding.id}`);
    }
  }
} catch (error) {
  fail(`review-finding authority validation failed: ${error instanceof Error ? error.message : String(error)}`);
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

const codeowners = read('.github/CODEOWNERS');
if (!codeowners.includes('@TsatsuAmable')) fail('CODEOWNERS must name the actual repository owner');

const adrIndex = read('docs/architecture/decisions/README.md');
for (const adr of [
  '0001-rust-wasm-analytical-authority.md',
  '0002-runtime-local-handles-and-durable-identity.md',
  '0003-production-path-evidence.md',
  '0004-executable-configuration-authority.md',
]) {
  const path = `docs/architecture/decisions/${adr}`;
  if (!existsSync(resolve(root, path))) fail(`missing foundational ADR: ${path}`);
  if (!adrIndex.includes(adr)) fail(`ADR index does not reference ${adr}`);
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

for (const path of [
  'docs/PROJECT_DOCS_INDEX.md',
  'docs/PRODUCTION_READINESS.md',
  'docs/ROADMAP.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'docs/OWNERSHIP.md',
  'docs/RFC_PROCESS.md',
  'docs/architecture/decisions/README.md',
]) {
  checkMarkdownLinks(path);
}

// Bounded roadmap base-identity check. Every `main@<sha>` claim in the
// canonical roadmap must resolve to a real commit that is an ancestor of (or
// equal to) HEAD. This detects stale/diverged base identity and dangling
// canonical references without inferring semantic milestone completion from
// merges: a merged SHA stays valid history, while an unknown or
// newer-than-HEAD SHA fails closed until the snapshot is reconciled.
//
// Shallow or partial clones (such as default CI checkouts) cannot resolve
// short SHAs or prove ancestry, so the check completes the history once via
// `git fetch --unshallow` before judging. A clone that cannot be completed
// (offline, or no `origin`) fails closed with guidance instead of guessing.
try {
  const roadmap = read('docs/ROADMAP.md');
  const bases = new Set(
    [...roadmap.matchAll(/main@([0-9a-f]{7,40})/g)].map((match) => match[1]),
  );
  let shallow = false;
  try {
    shallow =
      execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
        cwd: root,
        encoding: 'utf8',
      }).trim() === 'true';
  } catch {
    shallow = false;
  }
  if (shallow) {
    try {
      execFileSync('git', ['fetch', '--quiet', '--unshallow', 'origin'], {
        cwd: root,
        stdio: 'ignore',
      });
    } catch {
      fail(
        'docs/ROADMAP.md base-identity check needs full history: this is a shallow clone and `git fetch --unshallow origin` failed.',
      );
    }
  }
  for (const sha of bases) {
    let resolved = '';
    try {
      resolved = execFileSync('git', ['rev-parse', '--verify', `${sha}^{commit}`], {
        cwd: root,
        encoding: 'utf8',
      }).trim();
    } catch {
      fail(
        `docs/ROADMAP.md references unknown commit main@${sha}; use a SHA present in this repository`,
      );
      continue;
    }
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', resolved, 'HEAD'], {
        cwd: root,
        stdio: 'ignore',
      });
    } catch {
      fail(
        `docs/ROADMAP.md base main@${sha} is not an ancestor of HEAD; reconcile the snapshot with current main`,
      );
    }
  }
} catch (error) {
  fail(
    `roadmap base-identity check failed: ${error instanceof Error ? error.message : String(error)}`,
  );
}

if (failures.length > 0) {
  console.error('DOCUMENTATION INTEGRITY FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('DOCUMENTATION INTEGRITY PASSED');
console.log('Manifest, governance files, readiness/review-finding projections, ADR index, stale-instruction guards, and checked links are valid.');
