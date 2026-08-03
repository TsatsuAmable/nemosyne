/**
 * Shared signalling-room logic used by both the standalone Node server and the
 * Vite dev-server plugin. Keeps the two transports consistent without copying
 * code.
 */

const DEFAULT_MAX_MESSAGE_BYTES = 64 * 1024; // 64 KiB
const DEFAULT_MAX_PEERS_PER_ROOM = 50;

export function createRoomRegistry({
  maxMessageBytes = DEFAULT_MAX_MESSAGE_BYTES,
  maxPeersPerRoom = DEFAULT_MAX_PEERS_PER_ROOM,
} = {}) {
  const rooms = new Map(); // roomId -> Map(peerId -> socket)

  function isValidMessage(data) {
    if (data == null) return false;
    if (typeof data !== 'object') return false;
    if (data.to !== undefined && data.to !== '*' && typeof data.to !== 'string') return false;
    if (data.from !== undefined && typeof data.from !== 'string') return false;
    return true;
  }

  function broadcast(roomId, from, message) {
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

  function sendTo(roomId, to, from, message) {
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

  function handleConnection(socket, roomId, peerId) {
    if (!rooms.has(roomId)) rooms.set(roomId, new Map());
    const room = rooms.get(roomId);
    if (room.size >= maxPeersPerRoom) {
      try {
        socket.close(1008, 'room full');
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

    socket.on('message', (raw) => {
      if (Buffer.byteLength(raw, 'utf8') > maxMessageBytes) return;
      let message;
      try {
        message = JSON.parse(raw);
      } catch {
        return;
      }
      if (!isValidMessage(message)) return;
      if (message.to === '*') {
        broadcast(roomId, message.from ?? peerId, message.data);
      } else if (message.to) {
        sendTo(roomId, message.to, message.from ?? peerId, message.data);
      }
    });

    socket.on('close', () => {
      room.delete(peerId);
      if (room.size === 0) rooms.delete(roomId);
      for (const other of room.values()) {
        if (other.readyState === 1) {
          const data = JSON.stringify({ roomId, from: peerId, data: { type: 'leave' } });
          if (data.length <= maxMessageBytes) other.send(data);
        }
      }
    });
  }

  return { handleConnection };
}
