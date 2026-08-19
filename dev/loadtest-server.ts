import fs from 'node:fs';
import path from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  handleBoundedJsonPost,
  jsonOk,
  jsonError,
  isShortString,
  MAX_BODY_BYTES,
} from './http-utils.ts';

interface LoadTestSummary {
  profileName?: unknown;
  xrActive?: unknown;
  verdict?: {
    jsPathSufficientTo?: unknown;
    commandBufferWarrantedAt?: unknown;
  };
}

export function loadtestResultsPlugin(): Plugin {
  const logDir = path.resolve(process.cwd(), 'logs');
  const logFile = path.join(logDir, 'loadtest-results.jsonl');

  try {
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  } catch {
    // Ignore error
  }

  function handleLoadTest(req: IncomingMessage, res: ServerResponse): boolean {
    if (req.url !== '/__loadtest-results' || req.method !== 'POST') return false;
    return handleBoundedJsonPost<LoadTestSummary>(req, res, MAX_BODY_BYTES, (summary, response) => {
      if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
        jsonError(response, 400, 'expected a summary object');
        return;
      }
      // One JSON object per line (JSONL). The body cap already bounds total size.
      try {
        fs.appendFileSync(logFile, JSON.stringify(summary) + '\n', 'utf-8');
      } catch (err) {
        console.error('[loadtest-results] failed to append summary:', err);
        jsonError(response, 500, 'write failed');
        return;
      }
      // Echo a compact verdict line to the dev console (bound the strings).
      const verdict = summary.verdict ?? {};
      const profileName = isShortString(summary.profileName, 128) ? summary.profileName : '?';
      const line =
        `[LOAD TEST] ${profileName} | XR=${summary.xrActive} | ` +
        `sufficientTo=${verdict.jsPathSufficientTo} warrantedAt=${verdict.commandBufferWarrantedAt}`;
      // eslint-disable-next-line no-console
      console.log(`\x1b[35m${line}\x1b[0m`);
      jsonOk(response, { status: 'ok' });
    });
  }

  return {
    name: 'nemosyne-loadtest-results',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        if (!handleLoadTest(req, res)) next();
      });
    },
  };
}
