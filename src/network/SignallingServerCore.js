/**
 * Shared signalling-room logic used by both the standalone Node server and the
 * Vite dev-server plugin. Keeps the two transports consistent without copying
 * code.
 */

export function createRoomRegistry() {
  const rooms = new Map(); // roomId -> Map(peerId -> socket)

  function broadcast(roomId, from, message) {
    const room = rooms.get(roomId);
    if (!room) return;
    const data = JSON.stringify({ roomId, from, data: message });
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
      target.send(JSON.stringify({ roomId, from, data: message }));
    }
  }

  function handleConnection(socket, roomId, peerId) {
    if (!rooms.has(roomId)) rooms.set(roomId, new Map());
    const room = rooms.get(roomId);
    room.set(peerId, socket);

    // Notify existing peers that a new peer joined, and tell the new peer
    // about existing peers so it can initiate WebRTC offers.
    for (const [id, other] of room) {
      if (id !== peerId && other.readyState === 1) {
        other.send(JSON.stringify({ roomId, from: peerId, data: { type: 'join' } }));
        socket.send(JSON.stringify({ roomId, from: id, data: { type: 'join' } }));
      }
    }

    socket.on('message', (raw) => {
      let message;
      try {
        message = JSON.parse(raw);
      } catch {
        return;
      }
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
          other.send(JSON.stringify({ roomId, from: peerId, data: { type: 'leave' } }));
        }
      }
    });
  }

  return { handleConnection };
}
