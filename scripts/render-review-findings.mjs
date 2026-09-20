#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REVIEW_FINDINGS_BEGIN = '<!-- REVIEW_FINDINGS_STATUS:BEGIN -->';
export const REVIEW_FINDINGS_END = '<!-- REVIEW_FINDINGS_STATUS:END -->';

const LEDGER_PATH = 'governance/review-findings.json';
const ROADMAP_PATH = 'docs/ROADMAP.md';

function read(root, path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function validateLedger(ledger) {
  if (ledger.schemaVersion !== 1) throw new Error('review-findings schemaVersion must be 1');
  if (ledger.authority !== 'review-finding-disposition') {
    throw new Error("review-findings authority must be 'review-finding-disposition'");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ledger.lastReviewed ?? '')) {
    throw new Error('review-findings lastReviewed must be YYYY-MM-DD');
  }

  const allowedStatuses = new Set(ledger.statuses ?? []);
  if (allowedStatuses.size === 0) throw new Error('review-findings statuses must not be empty');

  const requiredIds = new Set(['RF-037', 'RF-038', 'RF-039', 'RF-040', 'RF-041', 'RF-042', 'RF-043']);
  const ids = new Set();
  for (const finding of ledger.findings ?? []) {
    if (!/^RF-\d{3}$/.test(finding.id ?? '')) throw new Error(`invalid review finding id: ${finding.id}`);
    if (ids.has(finding.id)) throw new Error(`duplicate review finding id: ${finding.id}`);
    ids.add(finding.id);
    if (!finding.title || !finding.severity || !finding.status || !finding.statusNote) {
      throw new Error(`incomplete review finding: ${finding.id}`);
    }
    if (!allowedStatuses.has(finding.status)) {
      throw new Error(`unsupported review finding status '${finding.status}' for ${finding.id}`);
    }
    if (!Array.isArray(finding.evidence) || finding.evidence.length === 0) {
      throw new Error(`review finding ${finding.id} must name evidence`);
    }
  }

  for (const id of requiredIds) {
    if (!ids.has(id)) throw new Error(`required migrated review finding is missing: ${id}`);
  }

  return ledger;
}

export function loadReviewFindings(root = process.cwd()) {
  return validateLedger(JSON.parse(read(root, LEDGER_PATH)));
}

export function renderReviewFindingsProjection(root = process.cwd()) {
  const ledger = loadReviewFindings(root);
  const rows = ledger.findings.map(
    (finding) =>
      `| ${finding.id} | ${finding.severity} | \`${finding.status}\` | ${finding.statusNote} |`,
  );

  return [
    REVIEW_FINDINGS_BEGIN,
    '> **Generated review-finding disposition.** Mutable RF status is owned by `governance/review-findings.json`; edit the ledger, not this table.',
    '',
    '| Finding | Severity | Status | Current disposition |',
    '| --- | --- | --- | --- |',
    ...rows,
    REVIEW_FINDINGS_END,
  ].join('\n');
}

export function replaceReviewFindingsProjection(markdown, projection) {
  const start = markdown.indexOf(REVIEW_FINDINGS_BEGIN);
  const end = markdown.indexOf(REVIEW_FINDINGS_END);

  if (start < 0 || end < 0 || end < start) {
    throw new Error('ROADMAP review-finding projection markers are missing or malformed');
  }

  return `${markdown.slice(0, start)}${projection}${markdown.slice(end + REVIEW_FINDINGS_END.length)}`;
}

function writeProjection(root = process.cwd()) {
  const roadmap = read(root, ROADMAP_PATH);
  const next = replaceReviewFindingsProjection(roadmap, renderReviewFindingsProjection(root));
  writeFileSync(resolve(root, ROADMAP_PATH), next, 'utf8');
  console.log(`Updated ${ROADMAP_PATH} from ${LEDGER_PATH}`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  if (!process.argv.includes('--write')) {
    console.error('Usage: node scripts/render-review-findings.mjs --write');
    process.exit(2);
  }
  writeProjection();
}
