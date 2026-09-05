import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  resolveNpmInvocation,
  resolveViteInvocation,
} from '../scripts/quest-validation.mjs';

const tempDirectories: string[] = [];

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function tempRoot(): string {
  const directory = mkdtempSync(join(tmpdir(), 'nemosyne-qv-launch-'));
  tempDirectories.push(directory);
  return directory;
}

describe('Quest validation process launch portability', () => {
  it('prefers the npm JS entry point supplied by npm itself', () => {
    const invocation = resolveNpmInvocation(
      { npm_execpath: 'C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js' },
      'win32'
    );

    expect(invocation.command).toBe(process.execPath);
    expect(invocation.args).toEqual([
      'C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js',
    ]);
  });

  it('uses the Windows command processor for direct launcher execution', () => {
    expect(
      resolveNpmInvocation({ ComSpec: 'C:\\Windows\\System32\\cmd.exe' }, 'win32')
    ).toEqual({
      command: 'C:\\Windows\\System32\\cmd.exe',
      args: ['/d', '/s', '/c', 'npm'],
    });
  });

  it('keeps the normal npm executable fallback on non-Windows platforms', () => {
    expect(resolveNpmInvocation({}, 'linux')).toEqual({ command: 'npm', args: [] });
  });

  it('executes the installed Vite JS CLI with Node instead of a Windows .cmd shim', () => {
    const root = tempRoot();
    const viteDir = join(root, 'node_modules', 'vite', 'bin');
    mkdirSync(viteDir, { recursive: true });
    const viteCli = join(viteDir, 'vite.js');
    writeFileSync(viteCli, '#!/usr/bin/env node\n');

    expect(resolveViteInvocation(root, 'win32')).toEqual({
      command: process.execPath,
      args: [viteCli],
    });
  });
});
