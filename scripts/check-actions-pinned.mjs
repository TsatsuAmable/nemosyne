#!/usr/bin/env node

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const workflowDir = '.github/workflows';
const failures = [];
const shaPattern = /^[0-9a-f]{40}$/;

for (const name of readdirSync(workflowDir)) {
  if (!name.endsWith('.yml') && !name.endsWith('.yaml')) continue;
  const path = join(workflowDir, name);
  const lines = readFileSync(path, 'utf8').split('\n');

  lines.forEach((line, index) => {
    const match = line.match(/^\s*-?\s*uses:\s*([^\s#]+)(?:\s+#.*)?$/);
    if (!match) return;
    const spec = match[1];
    if (spec.startsWith('./') || spec.startsWith('docker://')) return;

    const at = spec.lastIndexOf('@');
    if (at <= 0) {
      failures.push(`${path}:${index + 1} external action has no immutable ref: ${spec}`);
      return;
    }
    const ref = spec.slice(at + 1);
    if (!shaPattern.test(ref)) {
      failures.push(`${path}:${index + 1} external action must be pinned to a 40-character commit SHA: ${spec}`);
    }
  });
}

if (failures.length > 0) {
  console.error('GITHUB ACTION PINNING FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('GITHUB ACTION PINNING PASSED');
console.log('All external workflow actions are pinned to immutable commit SHAs.');
