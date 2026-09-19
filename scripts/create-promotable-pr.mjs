#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { validatePromotionEvidence } from './lib/promotion-evidence.mjs';

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}
const bodyFile = arg('--body-file');
const title = arg('--title');
const base = arg('--base') ?? 'main';
const dryRun = process.argv.includes('--dry-run');
if (!bodyFile || !title) {
  console.error('Usage: node scripts/create-promotable-pr.mjs --title <title> --body-file <path> [--base main] [--dry-run]');
  process.exit(2);
}
const body = fs.readFileSync(bodyFile, 'utf8');
const headSha = git(['rev-parse', 'HEAD']);
const remoteBase = base.startsWith('origin/') ? base : `origin/${base}`;
const changedFiles = git(['diff', '--name-only', `${remoteBase}...HEAD`]).split(/\n/).filter(Boolean).length;
const result = validatePromotionEvidence({ body, expectedSha: headSha, changedFiles });
if (!result.ok) {
  console.error('[promotable PR] REFUSED: promotion evidence is invalid');
  for (const error of result.errors) console.error('- ' + error);
  process.exit(1);
}
console.log('[promotable PR] preflight PASS ' + JSON.stringify({ exactHead: headSha, changedFiles, classification: result.classification }));
if (dryRun) process.exit(0);
execFileSync('gh', ['pr', 'create', '--base', base.replace(/^origin\//, ''), '--title', title, '--body-file', bodyFile], { stdio: 'inherit' });
