// Test-quality scanner resolution: spawn the ast-grep NATIVE binary directly.
// The extensionless `node_modules/@ast-grep/cli/ast-grep` entry is a JS shim
// only on Windows; on Linux/macOS postinstall overwrites it with the native
// binary, so routing it through `node` throws and must never read as zero
// findings. Resolution failures are explicit (null), never silent.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

// Locate the platform ast-grep binary under the given repo root. Returns the
// path or null when no binary is present (caller must report, not zero-fill).
export function resolveAstGrepBin(root) {
  const name = process.platform === 'win32' ? 'ast-grep.exe' : 'ast-grep';
  const direct = join(root, 'node_modules', '@ast-grep', 'cli', name);
  if (existsSync(direct)) return direct;
  // Postinstall skipped or layout drift: ask the package where it staged it.
  try {
    const require = createRequire(
      join(root, 'node_modules', '@ast-grep', 'cli', 'package.json')
    );
    const { resolveBinaryPath } = require('./postinstall.js');
    const staged = resolveBinaryPath();
    if (staged && existsSync(staged)) return staged;
  } catch {
    // Fall through to null: an absent scanner is a reportable state.
  }
  return null;
}

// Run one rule scan. ok is true only when the scanner exited 0; any launch
// failure or nonzero exit is a scan failure, never an empty result.
export function scanRule(bin, rulePath, scope, cwd) {
  try {
    const output = execFileSync(bin, ['scan', '--rule', rulePath, scope], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      cwd,
    });
    return { ok: true, output, error: '' };
  } catch (error) {
    const stderr = String(error.stderr ?? '').split('\n')[0];
    return { ok: false, output: '', error: stderr || String(error.message ?? error) };
  }
}

// Extract `path:line` hits from ast-grep pretty-print scan output.
export function parseLocations(output) {
  const hits = [];
  for (const line of String(output).split('\n')) {
    const match = line.match(/\u250C\u2500\s+(\S+?):(\d+):(\d+)/);
    if (match) hits.push(`${match[1]}:${match[2]}`);
  }
  return [...new Set(hits)];
}