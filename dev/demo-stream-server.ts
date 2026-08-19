import type { Plugin, ViteDevServer, PreviewServer } from 'vite';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import type { WebSocket } from 'ws';

const SENSORS = ['alpha', 'beta', 'gamma', 'delta'];

interface DemoSensorRow {
  time: string;
  sensorId: string;
  temperature: number;
  vibration: number;
}

function generateRow(time = Date.now()): DemoSensorRow {
  const sensorId = SENSORS[Math.floor(Math.random() * SENSORS.length)];
  return {
    time: new Date(time).toISOString(),
    sensorId,
    temperature: Number((20 + Math.random() * 15).toFixed(2)),
    vibration: Number((Math.random() * 2).toFixed(3)),
  };
}

function generateRows(count: number): DemoSensorRow[] {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => generateRow(now - (count - 1 - i) * 1000));
}

/**
 * Demo WebSocket endpoint mounted on the Vite dev/preview server.
 *
 * Connect to `wss://<host>/__demo-stream` to receive a mock time-series
 * sensor feed. The ws module is lazily imported so it is only loaded when a
 * dev server actually starts.
 */
export function demoStreamPlugin(): Plugin {
  async function attach(server: ViteDevServer | PreviewServer) {
    if (!server.httpServer) return;
    const { WebSocketServer } = await import('ws');
    const wss = new WebSocketServer({ noServer: true });

    server.httpServer.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
      const pathname = new URL(request.url || '', 'http://localhost').pathname;
      if (pathname !== '/__demo-stream') return;
      wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
        ws.send(
          JSON.stringify({
            topology: 'TIME_SERIES',
            name: 'Demo Sensor Stream',
            rows: generateRows(12),
          })
        );

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
    configurePreviewServer: attach,
  };
}

