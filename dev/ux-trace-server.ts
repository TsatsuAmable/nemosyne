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

function isTerminalControlCode(code: number): boolean {
  return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
}

/**
 * Encode terminal control characters before writing user/device supplied trace
 * fields to an interactive terminal. JSONL persistence remains unchanged and
 * therefore keeps the original evidence; only the human terminal projection is
 * neutralised. C0, DEL and C1 bytes, including ESC, are rendered visibly.
 */
export function sanitizeUxTraceTerminalText(value: unknown): string {
  let output = '';
  for (const char of String(value ?? '')) {
    const code = char.charCodeAt(0);
    output += isTerminalControlCode(code)
      ? `\\u${code.toString(16).padStart(4, '0')}`
      : char;
  }
  return output;
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
            'mode',
            'dataset',
            'performance',
            'interaction-pattern',
            'ttfr',
          ].includes(record.type as string)
        ) {
          const parts: string[] = [];
          if (record.phase) parts.push(String(record.phase));
          if (record.hand != null) parts.push(`hand:${String(record.hand)}`);
          if (record.d != null) parts.push(`d:${String(record.d)}`);
          if (record.gating) parts.push(`gate:${String(record.gating)}`);
          if (record.hit) parts.push(`hit:${String(record.hit)}`);
          if (record.target) parts.push(`target:${String(record.target)}`);
          if (record.name) parts.push(`name:${String(record.name)}`);
          if (record.confidence != null) parts.push(`conf:${String(record.confidence)}`);
          if (record.kind) parts.push(`kind:${String(record.kind)}`);
          if (record.state) parts.push(`state:${String(record.state)}`);
          if (record.via) parts.push(`via:${String(record.via)}`);
          if (record.datasetName) parts.push(`dataset:${String(record.datasetName)}`);
          if (record.topology) parts.push(`topology:${String(record.topology)}`);
          if (record.severity) parts.push(`severity:${String(record.severity)}`);
          if (record.frameMs != null) parts.push(`frame:${String(record.frameMs)}ms`);
          if (record.budget != null) parts.push(`budget:${String(record.budget)}ms`);
          if (record.pattern) parts.push(`pattern:${String(record.pattern)}`);
          if (record.score != null) parts.push(`score:${String(record.score)}`);
          if (record.ttfrMs != null) parts.push(`ttfr:${String(record.ttfrMs)}ms`);
          if (record.step != null && record.total != null) {
            parts.push(`step:${String(record.step)}/${String(record.total)}`);
          }
          if (record.ctx?.gaze?.target) parts.push(`gaze:${String(record.ctx.gaze.target)}`);
          if (record.ctx?.ptr?.driftDeg != null) {
            parts.push(`drift:${String(record.ctx.ptr.driftDeg)}deg`);
          }
          const terminalLine = sanitizeUxTraceTerminalText(
            `[UX] ${String(record.type)} ${parts.join(' ')}`
          );
          process.stdout.write(`\u001b[36m${terminalLine}\u001b[0m\n`);
        }
      }
      try {
        if (lines.length) fs.appendFileSync(logFile, `${lines.join('\n')}\n`, 'utf8');
        if (manifestLines.length) {
          fs.appendFileSync(manifestFile, `${manifestLines.join('\n')}\n`, 'utf8');
        }
      } catch (error) {
        console.warn('[ux-trace] failed to persist records:', error);
        jsonError(response, 500, 'failed to persist UX trace records');
        return;
      }
      jsonOk(response, { ok: true, appended });
    });
  }

  function configureServer(server: ViteDevServer): void {
    server.middlewares.use((req, res, next) => {
      if (handleUxTrace(req, res)) return;
      next();
    });
  }

  return {
    name: 'ux-trace',
    configureServer,
    configurePreviewServer: configureServer,
  };
}
