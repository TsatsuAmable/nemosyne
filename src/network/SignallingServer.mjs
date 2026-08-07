import { WebSocketServer } from 'ws';
import { createRoomRegistry } from './SignallingServerCore.ts';

/**
 * Minimal Node.js signalling server for Nemosyne collaboration rooms.
 *
 * Run with:
 *   node src/network/SignallingServer.mjs --port 5173
 *
 * Expects clients to connect with `?room=ROOM&peer=PEER` query params and
 * forwards JSON messages to the target peer or all peers in the room.
 */

const args = process.argv.slice(2);
const portArg = args.find((a) => a.startsWith('--port='));
const PORT = portArg ? parseInt(portArg.split('=')[1], 10) : 5173;

const registry = createRoomRegistry();

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (socket, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const roomId = url.searchParams.get('room') || 'default';
  const peerId = url.searchParams.get('peer') || `peer-${Date.now()}`;
  registry.handleConnection(socket, roomId, peerId);
});

console.log(`[SignallingServer] listening on ws://localhost:${PORT}/__signal`);
