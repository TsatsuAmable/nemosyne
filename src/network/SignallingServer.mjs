import { WebSocketServer } from 'ws';
import { createRoomRegistry } from './SignallingServerCore.ts';

/**
 * Minimal Node.js signalling server for Nemosyne collaboration rooms.
 *
 * Run with:
 *   node src/network/SignallingServer.mjs --port=5173 [--token=PARTICIPANT_SECRET] [--observer-token=OBSERVER_SECRET] [--allowed-origins=http://localhost:5173]
 *
 * Authentication & Role Enforcement:
 *   - Dual-token mode (Recommended): Pass both --token (or NEMOSYNE_SIGNAL_TOKEN) and
 *     --observer-token (or NEMOSYNE_OBSERVER_TOKEN). The server authoritatively enforces
 *     and binds peer capabilities (observers cannot escalate to participant).
 *   - Cryptographic Signed Tickets: Clients supply HMAC-SHA256 room tickets with embedded claims.
 *   - Scoped shared secret format: Clients connect with "SECRET:observer" or "SECRET:participant".
 *   - Open mode (Dev only): Pass --allow-open or NEMOSYNE_SIGNAL_ALLOW_OPEN=1.
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

// Resolve the security profile: open mode is dev-only; a configured token
// selects ResearchPreview (or Production when origins are also configured).
// An operator who forgets both token and --allow-open gets a fail-closed
// registry that rejects unauthenticated connections after the auth timeout.
const SECURITY_PROFILE = ALLOW_OPEN
  ? 'Development'
  : (ALLOWED_ORIGINS ? 'Production' : 'ResearchPreview');

const registry = createRoomRegistry({
  authToken: AUTH_TOKEN,
  observerAuthToken: OBSERVER_TOKEN,
  allowedOrigins: ALLOWED_ORIGINS,
  securityProfile: SECURITY_PROFILE,
  allowOpenNoToken: ALLOW_OPEN,
});

const wss = new WebSocketServer({ port: PORT });

// --- Heartbeat & Zombie Socket Reaper ---------------------------------------
const HEARTBEAT_INTERVAL_MS = 30_000;
const heartbeatInterval = setInterval(() => {
  for (const socket of wss.clients) {
    if (socket.isAlive === false) {
      socket.terminate();
      continue;
    }
    socket.isAlive = false;
    socket.ping();
  }
  registry.cleanupIdleRooms();
}, HEARTBEAT_INTERVAL_MS);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

wss.on('connection', (socket, req) => {
  socket.isAlive = true;
  socket.on('pong', () => {
    socket.isAlive = true;
  });

  const url = new URL(req.url, `http://${req.headers.host}`);
  const roomId = url.searchParams.get('room') || 'default';
  const peerId = url.searchParams.get('peer') || `peer-${Date.now()}`;
  // P0.3: URL-token auth is development-only. In Production the registry
  // ignores the ?token= query param — peers must authenticate via in-band
  // `auth` messages. We still read it here for Development/ResearchPreview
  // but the registry enforces the profile-based gate.
  const token = SECURITY_PROFILE === 'Production' ? undefined : (url.searchParams.get('token') || undefined);
  const role = url.searchParams.get('role') === 'observer' ? 'observer' : 'participant';
  registry.handleConnection(socket, roomId, peerId, token, role, req);
});

let mode = 'closed (set NEMOSYNE_SIGNAL_TOKEN or --allow-open)';
if (AUTH_TOKEN && OBSERVER_TOKEN) {
  mode = 'token required (dual-token: participant + observer separated)';
} else if (AUTH_TOKEN) {
  mode = 'token required (single secret; pass --observer-token for strict role separation)';
  console.warn('[SignallingServer] WARNING: Running with single --token without --observer-token. Observers sharing this secret can request participant role unless scoped (secret:observer) or HMAC tickets are used.');
} else if (ALLOW_OPEN) {
  mode = 'OPEN (no token)';
}
console.warn(`[SignallingServer] listening on ws://localhost:${PORT}/__signal (${mode})`);
