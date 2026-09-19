#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { validatePromotionEvidence } from './lib/promotion-evidence.mjs';

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const bodyFile = arg('--body-file');
const body = bodyFile ? fs.readFileSync(bodyFile, 'utf8') : fs.readFileSync(0, 'utf8');
const expectedSha = arg('--sha') ?? execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const base = arg('--base') ?? 'origin/main';
const changedFiles = Number(arg('--changed-files') ?? execFileSync('git', ['diff', '--name-only', base + '...HEAD'], { encoding: 'utf8' }).trim().split(/\n/).filter(Boolean).length);
const result = validatePromotionEvidence({ body, expectedSha, changedFiles });
if (!result.ok) {
  console.error('[promotion preflight] FAIL');
  for (const error of result.errors) console.error('- ' + error);
  process.exit(1);
}
console.log('[promotion preflight] PASS ' + JSON.stringify({ exactHead: expectedSha, changedFiles, classification: result.classification }));
