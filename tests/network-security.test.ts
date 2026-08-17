/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach } from 'vitest';
import { createRoomRegistry, type SignallingSocket } from '../src/network/SignallingServerCore.ts';

interface MockSocketWithState extends SignallingSocket {
  listeners: Record<string, ((...args: any[]) => void)[]>;
  sent: string[];
  closeCode?: number;
  closeReason?: string;
  readyState: number;
}

function makeSocket(): MockSocketWithState {
  const listeners: Record<string, ((...args: any[]) => void)[]> = {};
  const sent: string[] = [];
  const s: MockSocketWithState = {
    readyState: 1,
    sent,
    listeners,
    send(data: string) {
      sent.push(data);
    },
    close(code?: number, reason?: string) {
      s.readyState = 3;
      s.closeCode = code;
      s.closeReason = reason;
      for (const listener of listeners.close ?? []) listener();
    },
    on(event: string, listener: (...args: any[]) => void) {
      listeners[event] = listeners[event] || [];
      listeners[event].push(listener);
    },
  };
  return s;
}

describe('Collaboration Gateway Security & Abuse Protection', () => {
  describe('Server-Authorized Roles & Escalation Prevention', () => {
    it('enforces server-assigned role from token claims even if client requests participant', () => {
      const registry = createRoomRegistry({ authToken: 'secret' });
      const observerSocket = makeSocket();

      // Scoped token claiming observer role
      const token = JSON.stringify({ room: 'lab-1', role: 'observer' });
      registry.handleConnection(observerSocket, 'lab-1', 'analyst-1', token, 'participant');

      expect(observerSocket.closeCode).toBeUndefined();
      expect(observerSocket.readyState).toBe(1);

      // Attempt to broadcast an unauthorized datasetOperation
      const participantSocket = makeSocket();
      registry.handleConnection(participantSocket, 'lab-1', 'analyst-2', JSON.stringify({ room: 'lab-1', role: 'participant' }));
      participantSocket.sent.length = 0;

      observerSocket.listeners.message[0](
        JSON.stringify({ to: '*', data: { type: 'datasetOperation', op: 'mutate' } })
      );

      // Participant should NOT receive unauthorized dataset operations from observer
      expect(participantSocket.sent.length).toBe(0);
    });

    it('enforces observer role when client connects with dedicated observerAuthToken', () => {
      const registry = createRoomRegistry({
        authToken: 'admin-participant-secret',
        observerAuthToken: 'viewer-observer-secret',
      });
      const observerSocket = makeSocket();

      // Observer supplies observer token but attempts to claim role=participant
      registry.handleConnection(observerSocket, 'room-obs', 'observer-peer', 'viewer-observer-secret', 'participant');
      expect(observerSocket.closeCode).toBeUndefined();
      expect(observerSocket.readyState).toBe(1);

      const participantSocket = makeSocket();
      registry.handleConnection(participantSocket, 'room-obs', 'participant-peer', 'admin-participant-secret');
      participantSocket.sent.length = 0;

      // Attempt to broadcast an unauthorized datasetOperation
      observerSocket.listeners.message[0](
        JSON.stringify({ to: '*', data: { type: 'datasetOperation', op: 'delete' } })
      );

      // Server should drop the broadcast because the peer was strictly bound to observer
      expect(participantSocket.sent.length).toBe(0);
    });

    it('enforces observer role when using scoped shared-secret format (secret:observer)', () => {
      const registry = createRoomRegistry({ authToken: 'room-master-key' });
      const observerSocket = makeSocket();

      // Scoped key with observer restriction but claiming participant
      registry.handleConnection(observerSocket, 'room-scoped', 'peer-scoped', 'room-master-key:observer', 'participant');
      expect(observerSocket.closeCode).toBeUndefined();
      expect(observerSocket.readyState).toBe(1);

      const participantSocket = makeSocket();
      registry.handleConnection(participantSocket, 'room-scoped', 'peer-normal', 'room-master-key');
      participantSocket.sent.length = 0;

      observerSocket.listeners.message[0](
        JSON.stringify({ to: '*', data: { type: 'state', delta: { count: 1 } } })
      );

      expect(participantSocket.sent.length).toBe(0);
    });

    it('rejects expired room-scoped tokens (close 4001)', () => {
      const registry = createRoomRegistry({ authToken: 'secret' });
      const socket = makeSocket();

      const expiredToken = JSON.stringify({
        room: 'lab-1',
        role: 'participant',
        exp: Date.now() - 10000, // 10 seconds in the past
      });

      registry.handleConnection(socket, 'lab-1', 'peer-expired', expiredToken);
      expect(socket.closeCode).toBe(4001);
      expect(socket.closeReason).toBe('token expired');
    });

    it('rejects token scoped for a different room (close 4001)', () => {
      const registry = createRoomRegistry({ authToken: 'secret' });
      const socket = makeSocket();

      const tokenOtherRoom = JSON.stringify({
        room: 'room-alpha',
        role: 'participant',
        exp: Date.now() + 60000,
      });

      registry.handleConnection(socket, 'room-beta', 'peer-mismatch', tokenOtherRoom);
      expect(socket.closeCode).toBe(4001);
      expect(socket.closeReason).toBe('token room mismatch');
    });
  });

  describe('Origin Enforcement (Anti-CSWSH)', () => {
    it('permits connections from allowed origins', () => {
      const registry = createRoomRegistry({
        allowedOrigins: ['https://nemosyne.world', 'http://localhost:5173'],
      });
      const socket = makeSocket();
      const req = { headers: { origin: 'https://nemosyne.world' } };

      registry.handleConnection(socket, 'room1', 'peer1', undefined, 'participant', req);
      expect(socket.closeCode).toBeUndefined();
      expect(socket.readyState).toBe(1);
    });

    it('rejects connections from untrusted origins with 4003 (forbidden origin)', () => {
      const registry = createRoomRegistry({
        allowedOrigins: ['https://nemosyne.world'],
      });
      const socket = makeSocket();
      const req = { headers: { origin: 'https://attacker.evil.com' } };

      registry.handleConnection(socket, 'room1', 'peer-evil', undefined, 'participant', req);
      expect(socket.closeCode).toBe(4003);
      expect(socket.closeReason).toBe('forbidden origin');
      expect(socket.readyState).toBe(3);
    });
  });

  describe('Rate Limiting & Connection Capping', () => {
    it('enforces message rate limits and terminates abusive sockets with 1008', () => {
      const registry = createRoomRegistry({ maxMessagesPerSecond: 5 });
      const socket = makeSocket();

      registry.handleConnection(socket, 'room1', 'spammer');

      // Send 5 messages (allowed)
      for (let i = 0; i < 5; i++) {
        socket.listeners.message[0](JSON.stringify({ to: '*', data: { type: 'ice', candidate: `cand-${i}` } }));
      }
      expect(socket.closeCode).toBeUndefined();

      // 6th message exceeds rate limit of 5 msg/sec
      socket.listeners.message[0](JSON.stringify({ to: '*', data: { type: 'ice', candidate: 'cand-overflow' } }));
      expect(socket.closeCode).toBe(1008);
      expect(socket.closeReason).toBe('rate limit exceeded');
    });

    it('enforces maximum simultaneous connections per IP', () => {
      const registry = createRoomRegistry({ maxConnectionsPerIp: 2 });
      const req = { socket: { remoteAddress: '192.168.1.50' } };

      const s1 = makeSocket();
      const s2 = makeSocket();
      const s3 = makeSocket();

      registry.handleConnection(s1, 'room1', 'peer1', undefined, 'participant', req);
      registry.handleConnection(s2, 'room1', 'peer2', undefined, 'participant', req);
      expect(s1.closeCode).toBeUndefined();
      expect(s2.closeCode).toBeUndefined();

      // 3rd connection from the same IP exceeds limit
      registry.handleConnection(s3, 'room1', 'peer3', undefined, 'participant', req);
      expect(s3.closeCode).toBe(1008);
      expect(s3.closeReason).toBe('ip connection limit exceeded');

      // Closing s1 frees an IP slot
      s1.close?.();
      const s4 = makeSocket();
      registry.handleConnection(s4, 'room1', 'peer4', undefined, 'participant', req);
      expect(s4.closeCode).toBeUndefined();
    });
  });

  describe('Room Lifecycle & Idle Expiration', () => {
    it('tracks room count and cleans up empty rooms after idle timeout', () => {
      const registry = createRoomRegistry({ roomIdleTimeoutMs: 50 }); // 50ms timeout for test
      const a = makeSocket();

      registry.handleConnection(a, 'room-expiring', 'peerA');
      expect(registry.getRoomCount()).toBe(1);
      expect(registry.getTotalPeers()).toBe(1);

      a.close?.();
      expect(registry.getTotalPeers()).toBe(0);

      // Immediately after close, room is empty but may still be tracked until cleanup
      registry.cleanupIdleRooms();

      // Wait 60ms for timeout to elapse
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          registry.cleanupIdleRooms();
          expect(registry.getRoomCount()).toBe(0);
          resolve();
        }, 60);
      });
    });
  });
});
