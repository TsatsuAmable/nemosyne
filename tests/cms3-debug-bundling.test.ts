// @ts-nocheck
// @vitest-environment jsdom

/**
 * CMS-3 — dev debug bundling boundary falsifiers.
 *
 * The streamer is development tooling that patches console methods and
 * polls a dev-server-only endpoint (`/__remote-logs`). The sprint's exit
 * criterion is reproducible bundle/reachability evidence that production
 * startup/bundling can neither initialize nor include it accidentally.
 *
 * Bundle-level evidence is recorded in the PR body (grep of `dist/` markers
 * before and after); these falsifiers pin the source-level boundary that
 * guarantees it.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { remoteDebugStreamer } from '../src/utils/RemoteDebugStreamer.ts';

const source = (relative: string): string => readFileSync(resolve(process.cwd(), relative), 'utf8');

enum OriginFile {
  Main = 'src/main.ts',
  Streamer = 'src/utils/RemoteDebugStreamer.ts',
}

afterEach(() => {
  remoteDebugStreamer.dispose();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('CMS-3: DEV-only loading boundary for the remote debug streamer', () => {
  it('production startup does not statically import the streamer', () => {
    const main = source(OriginFile.Main);

    // No `import ... from '...RemoteDebugStreamer'` in any form — such a
    // static import survives production tree-shaking (the module exports an
    // instance whose class methods cannot be proven dead), which is exactly
    // the defect this sprint retired.
    const importTarget = /^import\s+(?:type\s+)?[^;]*from\s+['"][^'"]*RemoteDebugStreamer/m;
    expect(importTarget.test(main)).toBe(false);

    // The ONLY streamer reference in main.ts is the dynamic import inside the
    // DEV guard, and the guard precedes it in program order.
    const guardAt = main.indexOf('if (import.meta.env.DEV)');
    const dynamicImportAt = main.indexOf("import('./utils/RemoteDebugStreamer.ts')");
    expect(dynamicImportAt).toBeGreaterThan(-1);
    expect(guardAt).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(dynamicImportAt);
  });

  it('no production source beyond the allowlisted trio can re-admit the streamer', () => {
    // A future static import from ANY other src/** module would re-admit the
    // streamer to a production chunk without tripping the main.ts-only pin
    // above. Sweep the whole production tree: only the streamer module itself
    // and two allowlisted mentioning files may carry the identifier, and none
    // of them may hold a static import form.
    const STATIC_IMPORT_OF_STREAMER =
      /^import(?:\s+type)?[^;]*from\s+['"][^'"]*RemoteDebugStreamer[^'"]*['"]/m;
    const allowlist = new Set([
      OriginFile.Main,
      OriginFile.Streamer,
      'src/observability/index.ts', // comment only — names the streamer, exports none
    ]);

    const offenders: string[] = [];
    const identifierFiles: string[] = [];
    const walk = (relDir: string): void => {
      const entries = readdirSync(relDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === 'dist') continue;
        const rel = `${relDir}/${entry.name}`;
        if (entry.isDirectory()) {
          walk(rel);
        } else if (/\.(?:ts|js|mjs|json|html|css)$/.test(entry.name)) {
          if (rel === `${OriginFile.Streamer}`) continue;
          const text = readFileSync(rel, 'utf8');
          if (text.includes('RemoteDebugStreamer')) {
            identifierFiles.push(rel);
            if (!allowlist.has(rel)) offenders.push(`${rel}: unexpected streamer reference`);
            if (STATIC_IMPORT_OF_STREAMER.test(text)) offenders.push(`${rel}: static import of streamer`);
          }
        }
      }
    };

    const root = process.cwd();
    const srcRoot = `${root.replace(/\\/g, '/')}/src`;
    for (const entry of readdirSync(srcRoot, { withFileTypes: true })) {
      const rel = `src/${entry.name}`;
      if (entry.isDirectory()) walk(rel);
      else {
        const text = readFileSync(`src/${entry.name}`, 'utf8');
        if (text.includes('RemoteDebugStreamer')) {
          identifierFiles.push(rel);
          if (!allowlist.has(rel)) offenders.push(`${rel}: unexpected streamer reference`);
          if (STATIC_IMPORT_OF_STREAMER.test(text)) offenders.push(`${rel}: static import of streamer`);
        }
      }
    }

    // The allowlist is not speculative: assert each allowlisted file (except
    // main.ts, already pinned above, and observability's Telemetry re-export
    // target) is present so a future file move keeps this list honest.
    for (const required of ['src/observability/index.ts']) {
      expect(identifierFiles, `allowlisted file ${required} should still mention the streamer`).toContain(required);
    }

    expect(offenders, offenders.join('; ')).toEqual([]);
  });

  it('the streamer refuses to initialize when the build is not DEV', () => {
    vi.stubEnv('DEV', false);

    const origLog = console.log;
    remoteDebugStreamer.init();

    expect(console.log).toBe(origLog);
    expect(document.getElementById('nemosyne-vr-debug-hud')).toBeNull();
  });

  it('the streamer still arms itself in DEV — the dev tooling survives', () => {
    vi.stubEnv('DEV', true);

    const origLog = console.log;
    remoteDebugStreamer.init();

    expect(console.log).not.toBe(origLog);

    remoteDebugStreamer.dispose();

    // dispose() restores the original console methods.
    expect(console.log).toBe(origLog);
  });

  it('the streamer module carries its own DEV guard at the head of init()', () => {
    const src = source(OriginFile.Streamer);
    const guardAt = src.indexOf('!import.meta.env.DEV');
    expect(guardAt).toBeGreaterThan(-1);

    // The guard sits at the head of init(), before the idempotence/window
    // checks — no production path can pass through to the console patch.
    const initAt = src.indexOf('init(): void {');
    expect(initAt).toBeGreaterThan(-1);
    const windowCheckAt = src.indexOf("typeof window === 'undefined'");
    expect(initAt).toBeLessThan(guardAt);
    expect(guardAt).toBeLessThan(windowCheckAt);
  });
});