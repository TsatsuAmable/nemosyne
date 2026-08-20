// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { createRoomRegistry, type SignallingSocket } from '../src/network/SignallingServerCore.ts';
import { createSignedTicket } from '../src/network/SignedTicket.ts';

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
  describe('Cryptographic Signed Tickets & Role Authorization', () => {
    it('enforces server-assigned role from valid HMAC signed ticket', () => {
      const secret = 'room-hmac-master-key';
      const registry = createRoomRegistry({ authToken: secret });
      const observerSocket = makeSocket();

      // Create cryptographically signed ticket with observer role
      const ticket = createSignedTicket({
        room: 'lab-1',
        role: 'observer',
        exp: Date.now() + 60000,
      }, secret);

      // Client connects with signed ticket claiming observer, but requests participant in header
      registry.handleConnection(observerSocket, 'lab-1', 'analyst-1', ticket, 'participant');

      expect(observerSocket.closeCode).toBeUndefined();
      expect(observerSocket.readyState).toBe(1);

      // Attempt to broadcast an unauthorized datasetOperation
      const participantSocket = makeSocket();
      const participantTicket = createSignedTicket({
        room: 'lab-1',
        role: 'participant',
        exp: Date.now() + 60000,
      }, secret);
      registry.handleConnection(participantSocket, 'lab-1', 'analyst-2', participantTicket);
      participantSocket.sent.length = 0;

      observerSocket.listeners.message[0](
        JSON.stringify({ to: '*', data: { type: 'datasetOperation', op: 'mutate' } })
      );

      // Participant should NOT receive unauthorized dataset operations from observer
      expect(participantSocket.sent.length).toBe(0);
    });

    it('rejects forged / unsigned raw JSON token claims', () => {
      const secret = 'secure-hmac-secret';
      const registry = createRoomRegistry({ authToken: secret });
      const socket = makeSocket();

      // Attacker attempts to forge claims by sending unsigned raw JSON
      const forgedUnsignedJson = JSON.stringify({ room: 'lab-1', role: 'participant' });
      registry.handleConnection(socket, 'lab-1', 'attacker', forgedUnsignedJson);

      expect(socket.closeCode).toBe(4001);
      expect(socket.closeReason).toBe('invalid token');
    });

    it('rejects tampered cryptographic tickets (invalid signature)', () => {
      const secret = 'correct-server-secret';
      const wrongSecret = 'attacker-tampered-secret';
      const registry = createRoomRegistry({ authToken: secret });
      const socket = makeSocket();

      // Attacker signs ticket with incorrect secret
      const tamperedTicket = createSignedTicket({
        room: 'lab-1',
        role: 'participant',
        exp: Date.now() + 60000,
      }, wrongSecret);

      registry.handleConnection(socket, 'lab-1', 'attacker', tamperedTicket);
      expect(socket.closeCode).toBe(4001);
      expect(socket.closeReason).toBe('invalid ticket cryptographic signature');
    });

    it('rejects expired room-scoped tokens (close 4001)', () => {
      const secret = 'server-key';
      const registry = createRoomRegistry({ authToken: secret });
      const socket = makeSocket();

      const expiredTicket = createSignedTicket({
        room: 'lab-1',
        role: 'participant',
        exp: Date.now() - 10000, // 10 seconds in the past
      }, secret);

      registry.handleConnection(socket, 'lab-1', 'peer-expired', expiredTicket);
      expect(socket.closeCode).toBe(4001);
      expect(socket.closeReason).toBe('ticket expired');
    });

    it('rejects token scoped for a different room (close 4001)', () => {
      const secret = 'server-key';
      const registry = createRoomRegistry({ authToken: secret });
      const socket = makeSocket();

      const ticketOtherRoom = createSignedTicket({
        room: 'room-alpha',
        role: 'participant',
        exp: Date.now() + 60000,
      }, secret);

      registry.handleConnection(socket, 'room-beta', 'peer-mismatch', ticketOtherRoom);
      expect(socket.closeCode).toBe(4001);
      expect(socket.closeReason).toBe('ticket room scope mismatch');
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
  });

  describe('Origin Enforcement (Anti-CSWSH)', () => {
    it('permits connections from allowed origins', () => {
      const registry = createRoomRegistry({
        securityProfile: 'Development',
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
        securityProfile: 'Development',
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

  describe('Auth Failure Throttling & Abuse Defense', () => {
    it('throttles IP after 5 consecutive auth failures', () => {
      const registry = createRoomRegistry({ authToken: 'correct-secret', maxAuthFailures: 3 });
      const req = { socket: { remoteAddress: '198.51.100.10' } };

      // 3 failed auth attempts
      for (let i = 0; i < 3; i++) {
        const s = makeSocket();
        registry.handleConnection(s, 'room1', `brute-${i}`, 'bad-password', 'participant', req);
        expect(s.closeCode).toBe(4001);
      }

      expect(registry.getAuthFailureCount('198.51.100.10')).toBe(3);

      // 4th connection is immediately throttled with 1008
      const blockedSocket = makeSocket();
      registry.handleConnection(blockedSocket, 'room1', 'brute-blocked', 'correct-secret', 'participant', req);
      expect(blockedSocket.closeCode).toBe(1008);
      expect(blockedSocket.closeReason).toBe('too many authentication failures');
    });

    it('enforces message rate limits and terminates abusive sockets with 1008', () => {
      const registry = createRoomRegistry({ securityProfile: 'Development', maxMessagesPerSecond: 5 });
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
      const registry = createRoomRegistry({ securityProfile: 'Development', maxConnectionsPerIp: 2 });
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
      const registry = createRoomRegistry({ securityProfile: 'Development', roomIdleTimeoutMs: 50 }); // 50ms timeout for test
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

  describe('P0.2 — Fail-Closed Security Profiles & Startup Diagnostic', () => {
    it('an unconfigured production registry cannot admit unauthenticated peers', () => {
      vi.useFakeTimers();
      try {
        const registry = createRoomRegistry({ securityProfile: 'Production' });
        const a = makeSocket();
        // No token supplied — the peer is admitted pending auth but must NOT
        // be authenticated. After the auth timeout it is closed with 4001.
        registry.handleConnection(a, 'room1', 'peerA');
        expect(a.closeCode).toBeUndefined(); // admitted pending auth, not immediately closed
        expect(a.readyState).toBe(1);

        // No in-band auth message sent — after timeout the socket is closed.
        vi.advanceTimersByTime(5000);
        expect(a.closeCode).toBe(4001);
        expect(a.closeReason).toBe('auth timeout');

        // The diagnostic must flag the missing auth + origins as unsafe for Production.
        const diag = registry.getSecurityDiagnostic();
        expect(diag.profile).toBe('Production');
        expect(diag.openMode).toBe(false);
        expect(diag.authTokenConfigured).toBe(false);
        expect(diag.originEnforcement).toBe(false);
        expect(diag.ok).toBe(false);
        expect(diag.warnings.some((w) => w.includes('Production profile requires authentication'))).toBe(true);
        expect(diag.warnings.some((w) => w.includes('Production profile requires allowedOrigins'))).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it('a production registry with authToken + origins is ok and rejects bad tokens', () => {
      const registry = createRoomRegistry({
        securityProfile: 'Production',
        authToken: 'prod-secret',
        allowedOrigins: ['https://nemosyne.world'],
      });
      const diag = registry.getSecurityDiagnostic();
      expect(diag.ok).toBe(true);
      expect(diag.warnings).toHaveLength(0);

      // Wrong URL token is ignored in Production (not rejected) — the peer is
      // admitted pending in-band auth. URL tokens are development-only.
      const a = makeSocket();
      registry.handleConnection(a, 'room1', 'peerA', 'wrong-secret', 'participant', {
        headers: { origin: 'https://nemosyne.world' },
      });
      expect(a.closeCode).toBeUndefined(); // admitted pending auth, URL token ignored
      expect(registry.getTotalPeers()).toBe(0); // not authenticated

      // A wrong in-band auth message IS rejected with 4001.
      a.listeners.message[0](
        JSON.stringify({ to: 'peerA', data: { type: 'auth', token: 'wrong-secret' } })
      );
      expect(a.closeCode).toBe(4001);

      // Correct in-band auth is admitted.
      const b = makeSocket();
      registry.handleConnection(b, 'room1', 'peerB', 'prod-secret', 'participant', {
        headers: { origin: 'https://nemosyne.world' },
      });
      expect(b.closeCode).toBeUndefined(); // admitted pending auth
      b.listeners.message[0](
        JSON.stringify({ to: 'peerB', data: { type: 'auth', token: 'prod-secret' } })
      );
      expect(b.closeCode).toBeUndefined();
      expect(registry.getTotalPeers()).toBe(1); // b is now authenticated
    });

    it('Development profile defaults to open mode and emits a diagnostic warning', () => {
      const registry = createRoomRegistry({ securityProfile: 'Development' });
      const diag = registry.getSecurityDiagnostic();
      expect(diag.profile).toBe('Development');
      expect(diag.openMode).toBe(true);
      expect(diag.warnings.some((w) => w.includes('do not deploy this configuration to production'))).toBe(true);

      // Open mode admits a no-token peer as authenticated immediately.
      const a = makeSocket();
      registry.handleConnection(a, 'room1', 'peerA');
      expect(a.closeCode).toBeUndefined();
      expect(registry.getTotalPeers()).toBe(1); // authenticated
    });

    it('default (no profile) is fail-closed: open mode is off', () => {
      const registry = createRoomRegistry({ authToken: 'secret' });
      const diag = registry.getSecurityDiagnostic();
      expect(diag.profile).toBe('ResearchPreview');
      expect(diag.openMode).toBe(false);
      // With authToken configured, the registry is functional but not open.
      expect(diag.ok).toBe(true);
    });

    it('ResearchPreview without auth warns that all connections will be rejected', () => {
      const registry = createRoomRegistry({ securityProfile: 'ResearchPreview' });
      const diag = registry.getSecurityDiagnostic();
      expect(diag.ok).toBe(false);
      expect(diag.warnings.some((w) => w.includes('all connections will be rejected'))).toBe(true);
    });

    it('explicitly forcing allowOpenNoToken=true in Production is flagged as a warning', () => {
      const registry = createRoomRegistry({
        securityProfile: 'Production',
        authToken: 'secret',
        allowedOrigins: ['https://nemosyne.world'],
        allowOpenNoToken: true,
      });
      const diag = registry.getSecurityDiagnostic();
      expect(diag.ok).toBe(false);
      expect(diag.warnings.some((w) => w.includes('must not run in open'))).toBe(true);
    });
  });

  describe('P0.3 — Eliminate URL-Token Authentication (Production in-band only)', () => {
    it('Production ignores URL-supplied tokens and requires in-band auth', () => {
      vi.useFakeTimers();
      try {
        const registry = createRoomRegistry({
          securityProfile: 'Production',
          authToken: 'prod-secret',
          allowedOrigins: ['https://nemosyne.world'],
        });
        const diag = registry.getSecurityDiagnostic();
        expect(diag.acceptUrlToken).toBe(false);

        // A peer connects WITH the correct token via the URL parameter, but
        // Production ignores it — the peer is admitted pending in-band auth.
        const a = makeSocket();
        registry.handleConnection(a, 'room1', 'peerA', 'prod-secret', 'participant', {
          headers: { origin: 'https://nemosyne.world' },
        });
        expect(a.closeCode).toBeUndefined(); // admitted pending auth, not rejected
        expect(registry.getTotalPeers()).toBe(0); // NOT authenticated yet

        // The peer sends an in-band auth message with the correct token.
        a.listeners.message[0](
          JSON.stringify({ to: 'peerA', data: { type: 'auth', token: 'prod-secret' } })
        );
        expect(registry.getTotalPeers()).toBe(1); // now authenticated
        expect(a.closeCode).toBeUndefined();

        // The auth timeout must not fire after successful in-band auth.
        vi.advanceTimersByTime(5000);
        expect(a.closeCode).toBeUndefined();
      } finally {
        vi.useRealTimers();
      }
    });

    it('ResearchPreview still accepts URL-supplied tokens (deprecated but functional)', () => {
      const registry = createRoomRegistry({
        authToken: 'preview-secret',
      });
      const diag = registry.getSecurityDiagnostic();
      expect(diag.profile).toBe('ResearchPreview');
      expect(diag.acceptUrlToken).toBe(true);

      const a = makeSocket();
      registry.handleConnection(a, 'room1', 'peerA', 'preview-secret');
      expect(a.closeCode).toBeUndefined();
      expect(registry.getTotalPeers()).toBe(1); // authenticated via URL token
    });

    it('Development accepts URL-supplied tokens', () => {
      const registry = createRoomRegistry({
        securityProfile: 'Development',
        authToken: 'dev-secret',
      });
      expect(registry.getSecurityDiagnostic().acceptUrlToken).toBe(true);

      const a = makeSocket();
      registry.handleConnection(a, 'room1', 'peerA', 'dev-secret');
      expect(a.closeCode).toBeUndefined();
      expect(registry.getTotalPeers()).toBe(1);
    });
  });
});
