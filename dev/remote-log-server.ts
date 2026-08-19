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

interface LogEntry {
  level?: unknown;
  message?: unknown;
  stack?: unknown;
  timestamp?: unknown;
}

export function remoteLogsPlugin(): Plugin {
  const logDir = path.resolve(process.cwd(), 'logs');
  const logFile = path.join(logDir, 'vr-remote-console.log');
  const MAX_ENTRIES = 500;
  const MAX_MESSAGE_LEN = 8000;
  const MAX_LEVEL_LEN = 10;

  try {
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  } catch {
    // Ignore error
  }

  function handleLogs(req: IncomingMessage, res: ServerResponse): boolean {
    if (req.url !== '/__remote-logs' || req.method !== 'POST') return false;
    return handleBoundedJsonPost<unknown>(req, res, MAX_BODY_BYTES, (entries, response) => {
      if (!Array.isArray(entries) || entries.length > MAX_ENTRIES) {
        jsonError(response, 400, `expected an array of at most ${MAX_ENTRIES} entries`);
        return;
      }
      for (const entry of entries as LogEntry[]) {
        if (!entry || typeof entry !== 'object') continue;
        if (!isShortString(entry.level, MAX_LEVEL_LEN)) continue;
        if (!isShortString(entry.message, MAX_MESSAGE_LEN)) continue;
        const stack = isShortString(entry.stack, MAX_MESSAGE_LEN) ? entry.stack : '';
        const ts = isShortString(entry.timestamp, 64) ? entry.timestamp : '';
        const line = `[VR REMOTE LOG ${ts}] [${entry.level.toUpperCase()}] ${entry.message}${stack ? '\n' + stack : ''}\n`;
        // eslint-disable-next-line no-console
        console.log(`\x1b[36m${line.trim()}\x1b[0m`);
        try {
          fs.appendFileSync(logFile, line, 'utf-8');
        } catch {
          // Ignore disk error
        }
      }
      jsonOk(response, { status: 'ok' });
    });
  }

  return {
    name: 'nemosyne-remote-logs',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        if (!handleLogs(req, res)) next();
      });
    },
  };
}
