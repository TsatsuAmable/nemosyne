import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { createRoomRegistry } from './src/network/SignallingServerCore.ts';

const certDir = path.resolve(process.cwd(), 'certs');

// --- Bounded dev-only POST handling -------------------------------------------------
// The `/__remote-logs`, `/__loadtest-results`, and `/__ux-trace` endpoints are
// dev tools. They must reject oversized payloads, time out stuck clients, rate
// limit by peer, and validate structure before touching the filesystem — so a
// LAN peer (host:true binds to all interfaces) can't exhaust disk or memory.
const MAX_BODY_BYTES = 256 * 1024; // 256 KiB
const POST_TIMEOUT_MS = 5000;
const RATE_LIMIT_MAX_REQUESTS = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;

function createRateLimiter({ maxRequests, windowMs }) {
  const hits = new Map();
  function allow(ip) {
    const now = Date.now();
    const key = ip || 'unknown';
    const times = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (times.length >= maxRequests) {
      hits.set(key, times);
      return false;
    }
    times.push(now);
    hits.set(key, times);
    return true;
  }
  return { allow };
}

const devPostRateLimiter = createRateLimiter({
  maxRequests: RATE_LIMIT_MAX_REQUESTS,
  windowMs: RATE_LIMIT_WINDOW_MS,
});

/**
 * Read a POST body as JSON with a hard byte cap and a timeout. Calls
 * `onParsed(body, res)` on success. Responds 413 / 408 / 400 and tears down the
 * socket on overflow / timeout / bad JSON. Returns true if it handled the
 * request (so the middleware can stop the chain).
 */
function handleBoundedJsonPost(req, res, maxBytes, onParsed) {
  const ip = req.socket?.remoteAddress;
  if (!devPostRateLimiter.allow(ip)) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'rate limited' }));
    return true;
  }
  let body = '';
  let tooLarge = false;
  const timer = setTimeout(() => {
    try {
      res.writeHead(408, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'request timeout' }));
    } catch { /* response already gone */ }
    req.destroy();
  }, POST_TIMEOUT_MS);
  req.on('data', (chunk) => {
    if (tooLarge) return;
    body += chunk;
    if (Buffer.byteLength(body) > maxBytes) {
      tooLarge = true;
      clearTimeout(timer);
      try {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'payload too large' }));
      } catch { /* response already gone */ }
      req.destroy();
    }
  });
  req.on('end', () => {
    clearTimeout(timer);
    if (tooLarge) return;
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      try {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid json' }));
      } catch { /* response already gone */ }
      return;
    }
    onParsed(parsed, res);
  });
  req.on('error', () => clearTimeout(timer));
  return true;
}

function jsonOk(res, payload) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function jsonError(res, code, message) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: message }));
}

function isShortString(value, maxLen) {
  return typeof value === 'string' && value.length <= maxLen;
}

function loadCert(file) {
  const p = path.join(certDir, file);
  try {
    return fs.readFileSync(p);
  } catch {
    return undefined;
  }
}

/**
 * Demo WebSocket endpoint mounted on the Vite dev/preview server.
 *
 * Connect to `wss://<host>/__demo-stream` to receive a mock time-series
 * sensor feed. The ws module is lazily imported so it is only loaded when a
 * dev server actually starts.
 */
function demoStreamPlugin() {
  async function attach(server) {
    if (!server.httpServer) return;
    const { WebSocketServer } = await import('ws');
    const wss = new WebSocketServer({ noServer: true });

    server.httpServer.on('upgrade', (request, socket, head) => {
      const pathname = new URL(request.url || '', 'http://localhost').pathname;
      if (pathname !== '/__demo-stream') return;
      wss.handleUpgrade(request, socket, head, (ws) => {
        ws.send(JSON.stringify({ topology: 'TIME_SERIES', name: 'Demo Sensor Stream', rows: generateRows(12) }));

        const interval = setInterval(() => {
          if (ws.readyState !== 1) {
            clearInterval(interval);
            return;
          }
          ws.send(JSON.stringify({ topology: 'TIME_SERIES', rows: [generateRow()] }));
        }, 1000);

        ws.on('close', () => clearInterval(interval));
        ws.on('error', () => clearInterval(interval));
      });
    });
  }

  return {
    name: 'nemosyne-demo-stream',
    apply: 'serve',
    configureServer: attach,
    configurePreview: attach,
  };
}

/**
 * Signalling endpoint mounted on the Vite dev/preview server at /__signal.
 *
 * This lets the collaboration networking layer work out of the box during
 * local development without running a separate WebSocket port. In
 * production, route the same path to a standalone `SignallingServer.mjs`.
 */
function signallingPlugin() {
  async function attach(server) {
    if (!server.httpServer) return;
    const { WebSocketServer } = await import('ws');
    const wss = new WebSocketServer({ noServer: true });
    // Optional shared-secret gate: set NEMOSYNE_SIGNAL_TOKEN to require a
    // matching ?token= on join. Dev stays frictionless: open (no-token) mode
    // is explicitly allowed here because this plugin only runs under `vite serve`.
    const registry = createRoomRegistry({
      authToken: process.env.NEMOSYNE_SIGNAL_TOKEN || '',
      allowOpenNoToken: true,
    });

    server.httpServer.on('upgrade', (request, socket, head) => {
      const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
      if (url.pathname !== '/__signal') return;
      wss.handleUpgrade(request, socket, head, (ws) => {
        const roomId = url.searchParams.get('room') || 'default';
        const peerId = url.searchParams.get('peer') || `peer-${Date.now()}`;
        const token = url.searchParams.get('token') || undefined;
        // Forward the role so the observer relay-gating in the room registry
        // is exercised in dev/preview too, matching the standalone server.
        const roleParam = url.searchParams.get('role');
        const role = roleParam === 'observer' || roleParam === 'participant' ? roleParam : undefined;
        registry.handleConnection(ws, roomId, peerId, token, role, request);
      });
    });
  }

  return {
    name: 'nemosyne-signalling',
    apply: 'serve',
    configureServer: attach,
    configurePreview: attach,
  };
}

const SENSORS = ['alpha', 'beta', 'gamma', 'delta'];

function generateRow(time = Date.now()) {
  const sensorId = SENSORS[Math.floor(Math.random() * SENSORS.length)];
  return {
    time: new Date(time).toISOString(),
    sensorId,
    temperature: Number((20 + Math.random() * 15).toFixed(2)),
    vibration: Number((Math.random() * 2).toFixed(3)),
  };
}

function generateRows(count) {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => generateRow(now - (count - 1 - i) * 1000));
}

function httpsOptions(command) {
  // The Playwright load-smoke (test/playwright-load-smoke) runs `vite preview`
  // over plain HTTP — headless Chromium needs no TLS, and CI has no certs.
  // Setting NEMOSYNE_FORCE_HTTP=1 (via Playwright's webServer.env) forces HTTP
  // even when local dev certs are present, keeping the smoke deterministic
  // across environments. Normal dev/preview is unaffected.
  if (process.env.NEMOSYNE_FORCE_HTTP === '1') return undefined;
  const key = loadCert('key.pem');
  const cert = loadCert('cert.pem');
  if (key && cert) return { key, cert };
  if (process.env.VITEST) return undefined;
  if (command === 'serve' || command === 'preview') {
    console.warn(`[vite.config.js] HTTPS certs not found in ${certDir}. Generate them with:\n  mkdir certs && openssl req -x509 -newkey rsa:2048 -keyout certs/key.pem -out certs/cert.pem -subj "/CN=localhost" -nodes`);
  }
  return undefined;
}

function remoteLogsPlugin() {
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

  function handleLogs(req, res) {
    if (req.url !== '/__remote-logs' || req.method !== 'POST') return false;
    return handleBoundedJsonPost(req, res, MAX_BODY_BYTES, (entries, res) => {
      if (!Array.isArray(entries) || entries.length > MAX_ENTRIES) {
        jsonError(res, 400, 'expected an array of at most ' + MAX_ENTRIES + ' entries');
        return;
      }
      for (const entry of entries) {
        if (!entry || typeof entry !== 'object') continue;
        if (!isShortString(entry.level, MAX_LEVEL_LEN)) continue;
        if (!isShortString(entry.message, MAX_MESSAGE_LEN)) continue;
        const stack = isShortString(entry.stack, MAX_MESSAGE_LEN) ? entry.stack : '';
        const ts = isShortString(entry.timestamp, 64) ? entry.timestamp : '';
        const line = `[VR REMOTE LOG ${ts}] [${entry.level.toUpperCase()}] ${entry.message}${stack ? '\n' + stack : ''}\n`;
        console.log(`\x1b[36m${line.trim()}\x1b[0m`);
        try {
          fs.appendFileSync(logFile, line, 'utf-8');
        } catch {
          // Ignore disk error
        }
      }
      jsonOk(res, { status: 'ok' });
    });
  }

  return {
    name: 'nemosyne-remote-logs',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!handleLogs(req, res)) next();
      });
    },
  };
}

/**
 * Load-test results endpoint, mounted on the Vite dev server only.
 *
 * The VR load-test harness POSTs a completed run summary (perf/UX aggregates
 * only — no user dataset rows or session snapshots) to `/__loadtest-results`
 * when a run finishes. This serve-only handler appends one JSON object per line
 * to `logs/loadtest-results.jsonl`, so the dev can read the verdict (whether the
 * WASM command buffer is warranted and the perf level it must meet) off the
 * local machine after a real-headset run. Mirrors `remoteLogsPlugin`.
 */
function loadtestResultsPlugin() {
  const logDir = path.resolve(process.cwd(), 'logs');
  const logFile = path.join(logDir, 'loadtest-results.jsonl');

  try {
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  } catch {
    // Ignore error
  }

  function handleLoadTest(req, res) {
    if (req.url !== '/__loadtest-results' || req.method !== 'POST') return false;
    return handleBoundedJsonPost(req, res, MAX_BODY_BYTES, (summary, res) => {
      if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
        jsonError(res, 400, 'expected a summary object');
        return;
      }
      // One JSON object per line (JSONL). The body cap already bounds total size.
      try {
        fs.appendFileSync(logFile, JSON.stringify(summary) + '\n', 'utf-8');
      } catch (err) {
        console.error('[loadtest-results] failed to append summary:', err);
        jsonError(res, 500, 'write failed');
        return;
      }
      // Echo a compact verdict line to the dev console (bound the strings).
      const verdict = summary.verdict ?? {};
      const profileName = isShortString(summary.profileName, 128) ? summary.profileName : '?';
      const line =
        `[LOAD TEST] ${profileName} | XR=${summary.xrActive} | ` +
        `sufficientTo=${verdict.jsPathSufficientTo} warrantedAt=${verdict.commandBufferWarrantedAt}`;
      console.log(`\x1b[35m${line}\x1b[0m`);
      jsonOk(res, { status: 'ok' });
    });
  }

  return {
    name: 'nemosyne-loadtest-results',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!handleLoadTest(req, res)) next();
      });
    },
  };
}

/**
 * UX trace endpoint, mounted on the Vite dev server only.
 *
 * The dev-only UXTraceRecorder POSTs batches of correlated input/world-view
 * records (pinch edges with routing decisions, selection hit/miss, gestures,
 * system toggles, head-gaze context samples) to `/__ux-trace`. Each record is
 * appended as one JSON line to `logs/ux-trace.jsonl` for offline analysis via
 * `scripts/analyze-ux-trace.mjs`. Mirrors `loadtestResultsPlugin`.
 */
function uxTracePlugin() {
  const logDir = path.resolve(process.cwd(), 'logs');
  const logFile = path.join(logDir, 'ux-trace.jsonl');
  const manifestFile = path.join(logDir, 'session-manifest.jsonl');

  try {
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  } catch {
    // Ignore error
  }

  function handleUxTrace(req, res) {
    if (req.url !== '/__ux-trace' || req.method !== 'POST') return false;
    return handleBoundedJsonPost(req, res, MAX_BODY_BYTES, (batch, res) => {
      if (!batch || !Array.isArray(batch.records) || batch.records.length > 1000) {
        jsonError(res, 400, 'expected { records: array (<= 1000) }');
        return;
      }
      const lines = [];
      const manifestLines = [];
      let appended = 0;
      for (const record of batch.records) {
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
        if (['pinch', 'selection', 'gesture', 'system', 'wheel', 'tour', 'session-manifest', 'perf', 'friction', 'hands'].includes(record.type)) {
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
          console.log(`\x1b[33m[UX TRACE ${sid} +${record.t}s] ${record.type}: ${detail}${gaze}${drift}\x1b[0m`);
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
      jsonOk(res, { status: 'ok', appended });
    });
  }

  return {
    name: 'nemosyne-ux-trace',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!handleUxTrace(req, res)) next();
      });
    },
  };
}

function wasmServePlugin() {
  const wasmPkgDir = path.resolve(process.cwd(), 'wasm', 'pkg');
  return {
    name: 'nemosyne-wasm-serve',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/wasm', (req, res, next) => {
        let relative = req.url.replace(/^\//, '').split('?')[0];
        if (relative.startsWith('pkg/')) {
          relative = relative.replace(/^pkg\//, '');
        }
        // Path-traversal guard: reject any `..` segment and require the
        // resolved path to stay inside the wasm pkg directory.
        if (relative.includes('..')) {
          next();
          return;
        }
        const filePath = path.resolve(wasmPkgDir, relative);
        if (!filePath.startsWith(wasmPkgDir + path.sep)) {
          next();
          return;
        }
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          next();
          return;
        }

        const ext = path.extname(filePath).toLowerCase();
        let mime = 'application/octet-stream';
        if (ext === '.wasm') mime = 'application/wasm';
        else if (ext === '.js') mime = 'application/javascript';
        else if (ext === '.json') mime = 'application/json';

        res.setHeader('Content-Type', mime);
        fs.createReadStream(filePath).pipe(res);
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  plugins: [
    demoStreamPlugin(),
    signallingPlugin(),
    remoteLogsPlugin(),
    loadtestResultsPlugin(),
    uxTracePlugin(),
    wasmServePlugin(),
  ],
  server: {
    host: true,
    https: httpsOptions(command),
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  preview: {
    // Localhost only: the dev-only signalling/demo-stream plugins mount in
    // preview too, and `host: true` would expose them to the LAN. Dev (serve)
    // stays `host: true` because the Quest workflow needs LAN reachability.
    host: false,
    https: httpsOptions(command),
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      // The wasm-pack output is optional in production; externalise it so
      // `npm run build` (which does not run wasm-pack) still succeeds. When the
      // wasm module is present the dynamic import fetches it at runtime.
      external: ['/wasm/pkg/nemosyne_wasm.js'],
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('/src/data/serializers/')) return 'serializers';
          if (id.includes('/src/vr/ui/')) return 'vr-ui';
        },
      },
    },
  },
}));
