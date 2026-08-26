#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { extname, join, relative } from 'node:path';

const results = [];
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const node = process.execPath;

function run(command, args) {
  execFileSync(command, args, { stdio: 'pipe', maxBuffer: 32 * 1024 * 1024 });
}

function filesUnder(root) {
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...filesUnder(path));
    else files.push(path);
  }
  return files;
}

function check(dimension, name, fn) {
  process.stdout.write(`[Hygiene Audit] ${dimension}: ${name}... `);
  try {
    const detail = fn();
    results.push({ dimension, name, passed: true, detail });
    console.log(`PASSED (${detail || 'OK'})`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({ dimension, name, passed: false, error: message });
    console.log(`FAILED: ${message}`);
  }
}

console.log('\nNEMOSYNE RECURRING MAINTAINABILITY AND HYGIENE AUDIT\n');

check('Dim 1', 'Documentation authority and staleness', () => {
  run(node, ['scripts/check-docs.mjs']);
  return 'documentation manifest, links, and stale-instruction guards passed';
});

check('Dim 2', 'Public subsystem API contract', () => {
  const subsystems = [
    'atlas',
    'data',
    'draco',
    'investigation',
    'network',
    'session',
    'study',
    'vr/perception',
    'wasm',
  ];
  const missing = subsystems.filter((subsystem) => !existsSync(`src/${subsystem}/index.ts`));
  if (missing.length > 0) throw new Error(`Missing barrels: ${missing.join(', ')}`);
  return `${subsystems.length} public barrels present`;
});

check('Dim 3', 'Full source dependency-cycle lint', () => {
  run(npx, ['eslint', 'src', '--quiet']);
  return 'all source modules checked by import/no-cycle';
});

check('Dim 4', 'Analytical authority invariants', () => {
  run(npx, ['vitest', 'run', 'tests/architectural-invariants.test.ts']);
  return 'Rust authority and state invariants passed';
});

check('Dim 5', 'TypeScript hotspot inventory', () => {
  const hotspots = filesUnder('src')
    .filter((path) => extname(path) === '.ts')
    .map((path) => ({
      path: relative('.', path),
      lines: readFileSync(path, 'utf8').split('\n').length,
    }))
    .filter(({ lines }) => lines > 1000)
    .sort((a, b) => b.lines - a.lines);
  return hotspots.length === 0
    ? 'no source file exceeds 1,000 lines'
    : `advisory hotspots: ${hotspots.map(({ path, lines }) => `${path} (${lines})`).join(', ')}`;
});

check('Dim 6', 'GPU and memory lifecycle regression', () => {
  run(npx, ['vitest', 'run', 'tests/sprint-27-6-reliability-memory.test.ts']);
  return 'resource teardown regression passed';
});

check('Dim 7', 'Production bundle gzip budget', () => {
  if (!existsSync('dist/index.html')) run(npm, ['run', 'build']);
  const files = filesUnder('dist').filter((path) => statSync(path).isFile());
  const gzipBytes = files.reduce(
    (total, path) => total + gzipSync(readFileSync(path), { level: 9 }).byteLength,
    0
  );
  const budgetBytes = 2.5 * 1024 * 1024;
  if (gzipBytes > budgetBytes) {
    throw new Error(`${(gzipBytes / 1024 / 1024).toFixed(2)} MiB exceeds the 2.50 MiB gzip budget`);
  }
  return `${files.length} files, ${(gzipBytes / 1024 / 1024).toFixed(2)} MiB gzip`;
});

check('Dim 8', 'Canonical investigation vertical slice', () => {
  run(npx, ['vitest', 'run', 'tests/golden-path-vertical-slice.test.ts']);
  return 'portable investigation and replay regression passed';
});

check('Dim 9', 'Rust/WASM scientific kernel', () => {
  run('cargo', ['test', '--manifest-path', 'wasm/Cargo.toml']);
  return 'complete Rust test suite passed';
});

const failed = results.filter((result) => !result.passed);
console.log();
if (failed.length === 0) {
  console.log(`HYGIENE AUDIT PASSED: ${results.length}/${results.length} dimensions verified.`);
  process.exit(0);
}

console.error(`HYGIENE AUDIT FAILED: ${failed.length}/${results.length} dimensions failed.`);
process.exit(1);
