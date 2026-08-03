import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { createRoomRegistry } from './src/network/SignallingServerCore.js';

const certDir = path.resolve(process.cwd(), 'certs');

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
      if (request.url !== '/__demo-stream') return;
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
    const registry = createRoomRegistry();

    server.httpServer.on('upgrade', (request, socket, head) => {
      if (request.url !== '/__signal') return;
      wss.handleUpgrade(request, socket, head, (ws) => {
        const url = new URL(request.url, `http://${request.headers.host}`);
        const roomId = url.searchParams.get('room') || 'default';
        const peerId = url.searchParams.get('peer') || `peer-${Date.now()}`;
        registry.handleConnection(ws, roomId, peerId);
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
  const key = loadCert('key.pem');
  const cert = loadCert('cert.pem');
  if (key && cert) return { key, cert };
  if (process.env.VITEST) return undefined;
  if (command === 'serve' || command === 'preview') {
    console.warn(`[vite.config.js] HTTPS certs not found in ${certDir}. Generate them with:\n  mkdir certs && openssl req -x509 -newkey rsa:2048 -keyout certs/key.pem -out certs/cert.pem -subj "/CN=localhost" -nodes`);
  }
  return undefined;
}

export default defineConfig(({ command }) => ({
  plugins: [demoStreamPlugin(), signallingPlugin()],
  server: {
    host: true,
    https: httpsOptions(command),
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  preview: {
    host: true,
    https: httpsOptions(command),
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
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
