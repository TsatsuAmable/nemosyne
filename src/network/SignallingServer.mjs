import { WebSocketServer } from 'ws';
import { createRoomRegistry } from './SignallingServerCore.ts';

/**
 * Minimal Node.js signalling server for Nemosyne collaboration rooms.
 *
 * Run with:
 *   node src/network/SignallingServer.mjs --port=5173 [--token=SHARED_SECRET]
 *
 * Expects clients to connect with `?room=ROOM&peer=PEER[&token=SHARED_SECRET]`
 * query params and forwards JSON messages to the target peer or all peers in
 * the room. When --token (or NEMOSYNE_SIGNAL_TOKEN) is set, every join must
 * supply a matching ?token=; otherwise the connection is rejected (close 4001).
 */

const args = process.argv.slice(2);
const portArg = args.find((a) => a.startsWith('--port='));
const PORT = portArg ? parseInt(portArg.split('=')[1], 10) : 5173;
const tokenArg = args.find((a) => a.startsWith('--token='));
const AUTH_TOKEN = tokenArg ? tokenArg.split('=')[1] : (process.env.NEMOSYNE_SIGNAL_TOKEN || '');
const observerTokenArg = args.find((a) => a.startsWith('--observer-token='));
const OBSERVER_TOKEN = observerTokenArg ? observerTokenArg.split('=')[1] : (process.env.NEMOSYNE_OBSERVER_TOKEN || '');
// Open (no-token) mode is opt-in for the standalone server so an operator who
// forgets to set NEMOSYNE_SIGNAL_TOKEN doesn't accidentally run an open relay.
// Set NEMOSYNE_SIGNAL_ALLOW_OPEN=1 (or pass --allow-open) for frictionless local dev.
const allowOpenArg = args.find((a) => a.startsWith('--allow-open'));
const ALLOW_OPEN =
  allowOpenArg !== undefined || process.env.NEMOSYNE_SIGNAL_ALLOW_OPEN === '1';

const originsArg = args.find((a) => a.startsWith('--allowed-origins='));
const ALLOWED_ORIGINS = originsArg
  ? originsArg.split('=')[1].split(',')
  : (process.env.NEMOSYNE_ALLOWED_ORIGINS ? process.env.NEMOSYNE_ALLOWED_ORIGINS.split(',') : undefined);

const registry = createRoomRegistry({
  authToken: AUTH_TOKEN,
  observerAuthToken: OBSERVER_TOKEN,
  allowedOrigins: ALLOWED_ORIGINS,
  allowOpenNoToken: ALLOW_OPEN,
});

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (socket, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const roomId = url.searchParams.get('room') || 'default';
  const peerId = url.searchParams.get('peer') || `peer-${Date.now()}`;
  const token = url.searchParams.get('token') || undefined;
  const role = url.searchParams.get('role') === 'observer' ? 'observer' : 'participant';
  registry.handleConnection(socket, roomId, peerId, token, role, req);
});

const mode = AUTH_TOKEN ? 'token required' : ALLOW_OPEN ? 'OPEN (no token)' : 'closed (set NEMOSYNE_SIGNAL_TOKEN or --allow-open)';
console.log(`[SignallingServer] listening on ws://localhost:${PORT}/__signal (${mode})`);
