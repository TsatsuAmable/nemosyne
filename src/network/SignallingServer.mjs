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

const registry = createRoomRegistry({ authToken: AUTH_TOKEN });

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (socket, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const roomId = url.searchParams.get('room') || 'default';
  const peerId = url.searchParams.get('peer') || `peer-${Date.now()}`;
  const token = url.searchParams.get('token') || undefined;
  registry.handleConnection(socket, roomId, peerId, token);
});

console.log(`[SignallingServer] listening on ws://localhost:${PORT}/__signal${AUTH_TOKEN ? ' (token required)' : ''}`);