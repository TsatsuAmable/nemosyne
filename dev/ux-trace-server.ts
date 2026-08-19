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

interface UXRecord {
  type?: unknown;
  t?: unknown;
  phase?: unknown;
  hand?: unknown;
  d?: unknown;
  gating?: unknown;
  hit?: unknown;
  target?: unknown;
  name?: unknown;
  confidence?: unknown;
  kind?: unknown;
  state?: unknown;
  via?: unknown;
  datasetName?: unknown;
  topology?: unknown;
  severity?: unknown;
  frameMs?: unknown;
  budget?: unknown;
  pattern?: unknown;
  score?: unknown;
  ttfrMs?: unknown;
  step?: unknown;
  total?: unknown;
  ctx?: {
    gaze?: { target?: unknown };
    ptr?: { driftDeg?: unknown };
  };
}

interface UXBatch {
  records?: unknown;
  sid?: unknown;
}

export function uxTracePlugin(): Plugin {
  const logDir = path.resolve(process.cwd(), 'logs');
  const logFile = path.join(logDir, 'ux-trace.jsonl');
  const manifestFile = path.join(logDir, 'session-manifest.jsonl');

  try {
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  } catch {
    // Ignore error
  }

  function handleUxTrace(req: IncomingMessage, res: ServerResponse): boolean {
    if (req.url !== '/__ux-trace' || req.method !== 'POST') return false;
    return handleBoundedJsonPost<UXBatch>(req, res, MAX_BODY_BYTES, (batch, response) => {
      if (!batch || !Array.isArray(batch.records) || batch.records.length > 1000) {
        jsonError(response, 400, 'expected { records: array (<= 1000) }');
        return;
      }
      const lines: string[] = [];
      const manifestLines: string[] = [];
      let appended = 0;
      for (const record of batch.records as UXRecord[]) {
        if (!record || typeof record !== 'object') continue;
        if (!isShortString(record.type, 32)) continue;
        const line = JSON.stringify(record);
        if (line.length > 16 * 1024) continue; // per-record cap
        lines.push(line);
        if (record.type === 'session-manifest') {
          manifestLines.push(line);
        }
        appended++;
        // Echo interesting events (not 5 Hz context samples) to the terminal.
        if (
          [
            'pinch',
            'selection',
            'gesture',
            'system',
            'wheel',
            'tour',
            'session-manifest',
            'perf',
            'friction',
            'hands',
          ].includes(record.type)
        ) {
          const detail =
            record.type === 'pinch'
              ? `${record.phase} ${record.hand} d=${record.d} -> ${record.gating}`
              : record.type === 'selection'
                ? `${record.hit}${record.target ? ` ${record.target}` : ''}`
                : record.type === 'gesture'
                  ? `${record.name} conf=${record.confidence}`
                  : record.type === 'system'
                    ? record.kind
                    : record.type === 'wheel'
                      ? `${record.state} via ${record.via}`
                      : record.type === 'session-manifest'
                        ? `manifest ${record.datasetName || 'no-dataset'} [${record.topology || '-'}]`
                        : record.type === 'perf'
                          ? `perf ${record.severity} frameMs=${record.frameMs} budget=${record.budget}`
                          : record.type === 'friction'
                            ? `friction ${record.pattern} score=${record.score}`
                            : record.type === 'hands'
                              ? `hands ${record.phase} ${record.hand} ttfr=${record.ttfrMs}ms`
                              : `step ${record.step}/${record.total}`;
          const ctx = record.ctx || {};
          const gaze = ctx.gaze?.target ? ` gaze=${ctx.gaze.target}` : '';
          const drift = ctx.ptr?.driftDeg != null ? ` drift=${ctx.ptr.driftDeg}°` : '';
          const sid = isShortString(batch.sid, 64) ? batch.sid : '?';
          // eslint-disable-next-line no-console
          console.log(
            `\x1b[33m[UX TRACE ${sid} +${record.t}s] ${record.type}: ${detail}${gaze}${drift}\x1b[0m`
          );
        }
      }
      if (lines.length > 0) {
        try {
          fs.appendFileSync(logFile, lines.join('\n') + '\n', 'utf-8');
          if (manifestLines.length > 0) {
            fs.appendFileSync(manifestFile, manifestLines.join('\n') + '\n', 'utf-8');
          }
        } catch (err) {
          console.error('[ux-trace] failed to append batch:', err);
        }
      }
      jsonOk(response, { status: 'ok', appended });
    });
  }

  return {
    name: 'nemosyne-ux-trace',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        if (!handleUxTrace(req, res)) next();
      });
    },
  };
}
