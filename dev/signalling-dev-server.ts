import type { Plugin, ViteDevServer, PreviewServer } from 'vite';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import type { WebSocket } from 'ws';
import { createRoomRegistry } from '../src/network/SignallingServerCore.ts';

/**
 * Signalling endpoint mounted on the Vite dev/preview server at /__signal.
 *
 * This lets the collaboration networking layer work out of the box during
 * local development without running a separate WebSocket port. In
 * production, route the same path to a standalone `SignallingServer.mjs`.
 */
export function signallingPlugin(): Plugin {
  async function attach(server: ViteDevServer | PreviewServer) {
    if (!server.httpServer) return;
    const { WebSocketServer } = await import('ws');
    const wss = new WebSocketServer({ noServer: true });
    // Optional shared-secret gate: set NEMOSYNE_SIGNAL_TOKEN to require a
    // matching ?token= on join. Dev stays frictionless: the Development
    // security profile enables open (no-token) mode by default. This plugin
    // only runs under `vite serve` / `vite preview` so it never ships to
    // production.
    const registry = createRoomRegistry({
      authToken: process.env.NEMOSYNE_SIGNAL_TOKEN || '',
      securityProfile: 'Development',
    });

    server.httpServer.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
      const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
      if (url.pathname !== '/__signal') return;
      wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
        const roomId = url.searchParams.get('room') || 'default';
        const peerId = url.searchParams.get('peer') || `peer-${Date.now()}`;
        const token = url.searchParams.get('token') || undefined;
        // Forward the role so the observer relay-gating in the room registry
        // is exercised in dev/preview too, matching the standalone server.
        const roleParam = url.searchParams.get('role');
        const role =
          roleParam === 'observer' || roleParam === 'participant' ? roleParam : undefined;
        registry.handleConnection(ws, roomId, peerId, token, role, request);
      });
    });
  }

  return {
    name: 'nemosyne-signalling',
    apply: 'serve',
    configureServer: attach,
    configurePreviewServer: attach,
  };
}

