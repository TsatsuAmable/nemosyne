import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  collectWasmBuildDiagnostics,
  resolveNpmInvocation,
  resolveViteInvocation,
  writeDispositionFile,
  writeWasmBuildLog,
  type WasmDiagnosticProbeFn,
} from '../scripts/quest-validation.mjs';
import type { ValidationManifest } from '../src/validation/validation-manifest.ts';

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

  it('bounds WASM toolchain probes and records null instead of throwing on probe failure', () => {
    const probeMock = vi.fn(
      (
        command: string,
        _args: string[],
        _options: Parameters<WasmDiagnosticProbeFn>[2]
      ) => {
        if (command === 'cargo') {
          return { status: null, stdout: '', error: new Error('probe timed out') };
        }
        return { status: 0, stdout: `${command} 1.0.0\n`, error: undefined };
      }
    );

    const diagnostics = collectWasmBuildDiagnostics({
      root: tempRoot(),
      wasm: { status: 1 },
      probeSyncFn: probeMock as unknown as WasmDiagnosticProbeFn,
      probeTimeoutMs: 123,
    });

    expect(probeMock).toHaveBeenCalledTimes(3);
    for (const call of probeMock.mock.calls) {
      expect(call[2]).toMatchObject({ timeout: 123, encoding: 'utf8' });
    }
    expect(diagnostics.status).toBe(1);
    expect(diagnostics.wasmPackVersion).toBe('wasm-pack 1.0.0');
    expect(diagnostics.cargoVersion).toBeNull();
    expect(diagnostics.rustcVersion).toBe('rustc 1.0.0');
  });

  it('caps an excessive diagnostic-probe timeout so failure evidence stays bounded', () => {
    const probeMock = vi.fn(
      (_command: string, _args: string[], _options: Parameters<WasmDiagnosticProbeFn>[2]) => ({
        status: 0,
        stdout: 'ok\n',
        error: undefined,
      })
    );

    collectWasmBuildDiagnostics({
      root: tempRoot(),
      wasm: { status: 1 },
      probeSyncFn: probeMock as unknown as WasmDiagnosticProbeFn,
      probeTimeoutMs: Number.MAX_SAFE_INTEGER,
    });

    for (const call of probeMock.mock.calls) {
      expect(call[2].timeout).toBe(5000);
    }
  });

  it('persists readable build.log beside the authoritative FAIL disposition', () => {
    const root = tempRoot();
    const wasmPkg = join(root, 'wasm', 'pkg');
    mkdirSync(wasmPkg, { recursive: true });
    writeFileSync(join(wasmPkg, 'nemosyne_wasm.js'), 'export default {};\n');
    writeFileSync(join(wasmPkg, 'nemosyne_wasm_bg.wasm'), 'wasm-bytes');

    const probeMock = vi.fn(
      (command: string, _args: string[], _options: Parameters<WasmDiagnosticProbeFn>[2]) => ({
        status: 0,
        stdout: `${command} 1.0.0\n`,
        error: undefined,
      })
    );
    const diagnostics = collectWasmBuildDiagnostics({
      root,
      wasm: { status: 1 },
      probeSyncFn: probeMock as unknown as WasmDiagnosticProbeFn,
    });

    const manifest = {
      evidenceDir: 'logs/validation/test-session',
      sessionId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
      sessionLabel: 'test-session',
      buildId: 'a8be01af10e36e595e52571c91613cc070035b51',
      validationMode: 'quest-perf',
      gates: ['PERF-04'],
      evidenceClass: 'governed-physical-validation',
      deviceIdentity: null,
      invalidations: [],
      promotionEligible: false,
    } as unknown as ValidationManifest;

    const buildLog = writeWasmBuildLog(manifest, diagnostics, root);
    const disposition = writeDispositionFile(
      manifest,
      { status: 'FAIL', reasons: ['WASM dev build exited with status 1; session aborted before Vite start'] },
      root
    );

    expect(buildLog).toBe(join(root, 'logs', 'validation', 'test-session', 'build.log'));
    expect(buildLog).not.toBeNull();
    expect(existsSync(buildLog!)).toBe(true);
    expect(dirname(buildLog!)).toBe(dirname(disposition));

    const persistedDiagnostics = JSON.parse(readFileSync(buildLog!, 'utf8'));
    expect(persistedDiagnostics).toEqual(diagnostics);
    expect(persistedDiagnostics.wasmJsPresent).toBe(true);
    expect(persistedDiagnostics.wasmBgPresent).toBe(true);

    const persistedDisposition = JSON.parse(readFileSync(disposition, 'utf8'));
    expect(persistedDisposition.gateDisposition.status).toBe('FAIL');
    expect(persistedDisposition.gateDisposition.reasons).toEqual([
      'WASM dev build exited with status 1; session aborted before Vite start',
    ]);
  });
});
