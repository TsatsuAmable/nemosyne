/**
 * Shared signalling-room logic used by both the standalone Node server and the
 * Vite dev-server plugin. Keeps the two transports consistent without copying
 * code.
 */

const DEFAULT_MAX_MESSAGE_BYTES = 64 * 1024; // 64 KiB
const DEFAULT_MAX_PEERS_PER_ROOM = 50;

export interface SignallingSocket {
  readyState: number;
  send(data: string): void;
  close?(code?: number, reason?: string): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on?(event: string, listener: (...args: any[]) => void): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addEventListener?(type: string, listener: (...args: any[]) => void): void;
}

export interface RoomRegistryOptions {
  maxMessageBytes?: number;
  maxPeersPerRoom?: number;
  /**
   * Optional shared secret required to join a room. When set (non-empty), a
   * peer must supply a matching `token` to `handleConnection`; a mismatch is
   * rejected with close code 4001. When unset, token checks are skipped so
   * local dev remains frictionless. This is a shared secret, not strong auth.
   */
  authToken?: string;
}

export interface RoomRegistry {
  handleConnection(socket: SignallingSocket, roomId: string, peerId: string, token?: string): void;
}

interface SignallingMessagePayload {
  to?: string;
  from?: string;
  data?: unknown;
  [key: string]: unknown;
}

export function createRoomRegistry({
  maxMessageBytes = DEFAULT_MAX_MESSAGE_BYTES,
  maxPeersPerRoom = DEFAULT_MAX_PEERS_PER_ROOM,
  authToken = '',
}: RoomRegistryOptions = {}): RoomRegistry {
  const rooms = new Map<string, Map<string, SignallingSocket>>(); // roomId -> Map(peerId -> socket)

  function isValidMessage(data: unknown): data is SignallingMessagePayload {
    if (data == null) return false;
    if (typeof data !== 'object') return false;
    const msg = data as SignallingMessagePayload;
    if (msg.to !== undefined && msg.to !== '*' && typeof msg.to !== 'string') return false;
    if (msg.from !== undefined && typeof msg.from !== 'string') return false;
    return true;
  }

  function broadcast(roomId: string, from: string, message: unknown): void {
    const room = rooms.get(roomId);
    if (!room) return;
    const data = JSON.stringify({ roomId, from, data: message });
    if (data.length > maxMessageBytes) return;
    for (const socket of room.values()) {
      if (socket.readyState === 1) {
        socket.send(data);
      }
    }
  }

  function sendTo(roomId: string, to: string, from: string, message: unknown): void {
    const room = rooms.get(roomId);
    if (!room) return;
    const target = room.get(to);
    if (target?.readyState === 1) {
      const data = JSON.stringify({ roomId, from, data: message });
      if (data.length <= maxMessageBytes) {
        target.send(data);
      }
    }
  }

  function handleConnection(socket: SignallingSocket, roomId: string, peerId: string, token?: string): void {
    // Shared-secret gate: when a token is configured, every join must supply a
    // matching token. A missing/mismatched token is rejected before the peer is
    // admitted to any room state. (room+token is a shared secret, not strong auth.)
    if (authToken) {
      if (typeof token !== 'string' || token !== authToken) {
        try {
          socket.close?.(4001, 'invalid token');
        } catch (_) {
          // Ignore close failures on an already-closed socket.
        }
        return;
      }
    }

    if (!rooms.has(roomId)) rooms.set(roomId, new Map());
    const room = rooms.get(roomId)!;
    if (room.size >= maxPeersPerRoom) {
      try {
        socket.close?.(1008, 'room full');
      } catch (_) {
        // Ignore close failures on an already-closed socket.
      }
      return;
    }
    // Reject a peerId that is already live in the room rather than silently
    // overwriting it. Closing the *new* (duplicate) join keeps the existing
    // peer's session intact and prevents impersonation-by-collision.
    if (room.has(peerId)) {
      try {
        socket.close?.(4002, 'peerId in use');
      } catch (_) {
        // Ignore close failures on an already-closed socket.
      }
      return;
    }
    room.set(peerId, socket);

    // Notify existing peers that a new peer joined, and tell the new peer
    // about existing peers so it can initiate WebRTC offers.
    for (const [id, other] of room) {
      if (id !== peerId && other.readyState === 1) {
        const data = JSON.stringify({ roomId, from: peerId, data: { type: 'join' } });
        if (data.length <= maxMessageBytes) other.send(data);
        socket.send(JSON.stringify({ roomId, from: id, data: { type: 'join' } }));
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onMessage = (raw: any) => {
      const rawStr = typeof raw === 'string' ? raw : (raw?.toString?.() ?? String(raw));
      if (Buffer.byteLength(rawStr, 'utf8') > maxMessageBytes) return;
      let message: unknown;
      try {
        message = JSON.parse(rawStr);
      } catch {
        return;
      }
      if (!isValidMessage(message)) return;
      if (message.to === '*') {
        broadcast(roomId, peerId, message.data);
      } else if (message.to) {
        sendTo(roomId, message.to, peerId, message.data);
      }
    };

    const onClose = () => {
      room.delete(peerId);
      if (room.size === 0) rooms.delete(roomId);
      for (const other of room.values()) {
        if (other.readyState === 1) {
          const data = JSON.stringify({ roomId, from: peerId, data: { type: 'leave' } });
          if (data.length <= maxMessageBytes) other.send(data);
        }
      }
    };

    if (typeof socket.on === 'function') {
      socket.on('message', onMessage);
      socket.on('close', onClose);
    } else if (typeof socket.addEventListener === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      socket.addEventListener('message', (evt: any) => onMessage(evt.data));
      socket.addEventListener('close', onClose);
    }
  }

  return { handleConnection };
}
