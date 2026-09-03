// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { createRoomRegistry, WS_MAX_PAYLOAD_BYTES, type SignallingSocket } from '../src/network/SignallingServerCore.ts';
import { createSignedTicket } from '../src/network/SignedTicket.ts';
import * as networkBarrel from '../src/network/index.ts';
import * as serverNetworkBarrel from '../src/network/server.ts';

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

  describe('RF-037 — Canonical ticket authority on the live admission path', () => {
    /** Sign a raw claims object so tests can construct canonical-schema tickets the creator refuses to issue. */
    function signRawClaims(claims: unknown, secret: string): string {
      const payloadB64 = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(payloadB64);
      return `${payloadB64}.${hmac.digest('hex')}`;
    }

    it('accepts a valid ticket on first use and rejects its replay (same nonce) through handleConnection', () => {
      const secret = 'rf037-master-secret';
      const registry = createRoomRegistry({ authToken: secret });
      const ticket = createSignedTicket({
        room: 'lab-replay',
        role: 'participant',
        exp: Date.now() + 60000,
      }, secret);

      // First use: verified and admitted through the real admission path.
      const first = makeSocket();
      registry.handleConnection(first, 'lab-replay', 'peer-first', ticket);
      expect(first.closeCode).toBeUndefined();
      expect(first.readyState).toBe(1);
      expect(registry.getTotalPeers()).toBe(1);

      // Second use of the identical ticket: rejected at handleConnection.
      const second = makeSocket();
      registry.handleConnection(second, 'lab-replay', 'peer-second', ticket);
      expect(second.closeCode).toBe(4001);
      expect(second.closeReason).toBe('ticket replay detected (nonce already consumed)');
      expect(registry.getTotalPeers()).toBe(1);
    });

    it('rejects a replayed ticket even after the first peer disconnects', () => {
      const secret = 'rf037-reconnect-secret';
      const registry = createRoomRegistry({ authToken: secret });
      const ticket = createSignedTicket({
        room: 'lab-reconnect',
        role: 'observer',
        exp: Date.now() + 60000,
      }, secret);

      const first = makeSocket();
      registry.handleConnection(first, 'lab-reconnect', 'peer-a', ticket);
      expect(first.closeCode).toBeUndefined();

      first.close?.();
      expect(registry.getTotalPeers()).toBe(0);

      // The nonce was consumed at admission; a new connection cannot reuse it.
      const replay = makeSocket();
      registry.handleConnection(replay, 'lab-reconnect', 'peer-b', ticket);
      expect(replay.closeCode).toBe(4001);
      expect(replay.closeReason).toBe('ticket replay detected (nonce already consumed)');
    });

    it('accepts distinct tickets for distinct peers', () => {
      const secret = 'rf037-distinct-secret';
      const registry = createRoomRegistry({ authToken: secret });
      const room = 'lab-distinct';
      const now = Date.now() + 60000;

      const observerTicket = createSignedTicket({ room, role: 'observer', exp: now }, secret);
      const participantTicket = createSignedTicket({ room, role: 'participant', exp: now }, secret);

      const observer = makeSocket();
      registry.handleConnection(observer, room, 'peer-obs', observerTicket);
      const participant = makeSocket();
      registry.handleConnection(participant, room, 'peer-part', participantTicket);

      expect(observer.closeCode).toBeUndefined();
      expect(participant.closeCode).toBeUndefined();
      expect(registry.getTotalPeers()).toBe(2);

      // Roles from the canonical tickets are enforced: observer cannot relay
      // application state, participant can.
      participant.sent.length = 0;
      observer.listeners.message[0](
        JSON.stringify({ to: 'peer-part', data: { type: 'datasetOperation', op: { type: 'delete' } } })
      );
      expect(participant.sent.length).toBe(0);

      const stateSocket = makeSocket();
      registry.handleConnection(stateSocket, room, 'peer-state', participantTicket);
      expect(stateSocket.closeCode).toBe(4001); // participant ticket already consumed
    });

    it('fails closed on malformed tickets through the real admission path', () => {
      const secret = 'rf037-malformed-secret';
      // IP auth-failure throttling is orthogonal to the fail-closed property
      // under test; a generous limit keeps the specific rejection reason
      // observable for every malformed variant (throttling is covered by its
      // own dedicated test below).
      const registry = createRoomRegistry({ authToken: secret, maxAuthFailures: 100 });
      const room = 'lab-malformed';
      const now = Date.now();

      // 1. Bad structure (not two dot-separated parts).
      const badStructure = makeSocket();
      registry.handleConnection(badStructure, room, 'peer-structure', 'just-a-string');
      expect(badStructure.closeCode).toBe(4001);

      // 2. Tampered payload (re-encoded claims with a valid-shaped signature).
      const good = createSignedTicket({ room, role: 'participant', exp: now + 60000 }, secret);
      const [payloadB64, sig] = good.split('.');
      const forgedClaims = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
      forgedClaims.role = 'participant';
      forgedClaims.room = 'attacker-room';
      const tamperedPayload = Buffer.from(JSON.stringify(forgedClaims), 'utf8').toString('base64url');
      const tampered = makeSocket();
      registry.handleConnection(tampered, room, 'peer-tampered', `${tamperedPayload}.${sig}`);
      expect(tampered.closeCode).toBe(4001);
      expect(tampered.closeReason).toBe('invalid ticket cryptographic signature');

      // 3. Wrong room scope.
      const wrongRoomTicket = createSignedTicket({ room: 'room-alpha', role: 'participant', exp: now + 60000 }, secret);
      const wrongRoom = makeSocket();
      registry.handleConnection(wrongRoom, room, 'peer-room', wrongRoomTicket);
      expect(wrongRoom.closeCode).toBe(4001);
      expect(wrongRoom.closeReason).toBe('ticket room scope mismatch');

      // 4. Expired.
      const expiredTicket = createSignedTicket({ room, role: 'participant', exp: now - 1000 }, secret);
      const expired = makeSocket();
      registry.handleConnection(expired, room, 'peer-expired', expiredTicket);
      expect(expired.closeCode).toBe(4001);
      expect(expired.closeReason).toBe('ticket expired');

      // 5. Unknown role (legacy ontology), validly signed.
      const unknownRole = signRawClaims(
        { version: 1, room, role: 'analyst', issuedAt: now, exp: now + 60000, nonce: 'n-analyst' },
        secret
      );
      const rolePeer = makeSocket();
      registry.handleConnection(rolePeer, room, 'peer-analyst', unknownRole);
      expect(rolePeer.closeCode).toBe(4001);
      expect(rolePeer.closeReason).toBe('invalid role in ticket');

      // 6. Missing nonce.
      const missingNonce = signRawClaims(
        { version: 1, room, role: 'participant', issuedAt: now, exp: now + 60000 },
        secret
      );
      const noNoncePeer = makeSocket();
      registry.handleConnection(noNoncePeer, room, 'peer-nonce', missingNonce);
      expect(noNoncePeer.closeCode).toBe(4001);
      expect(noNoncePeer.closeReason).toBe('ticket missing required nonce');

      // 7. Unsupported version.
      const v2 = signRawClaims(
        { version: 2, room, role: 'participant', issuedAt: now, exp: now + 60000, nonce: 'n-v2' },
        secret
      );
      const v2Peer = makeSocket();
      registry.handleConnection(v2Peer, room, 'peer-v2', v2);
      expect(v2Peer.closeCode).toBe(4001);
      expect(v2Peer.closeReason).toBe('unsupported ticket version');

      // No peer was admitted.
      expect(registry.getTotalPeers()).toBe(0);
    });

    it('keeps the canonical ticket authority server-only with no competing browser verifier', () => {
      expect((networkBarrel as any).createSignedTicket).toBeUndefined();
      expect((networkBarrel as any).verifySignedTicket).toBeUndefined();
      expect((networkBarrel as any).SignedTicketReplayGuard).toBeUndefined();

      expect(typeof serverNetworkBarrel.createSignedTicket).toBe('function');
      expect(typeof serverNetworkBarrel.verifySignedTicket).toBe('function');
      expect(typeof serverNetworkBarrel.SignedTicketReplayGuard).toBe('function');

      // The obsolete duplicate authority must not be reachable from either public surface.
      expect((networkBarrel as any).SignedTicketVerifier).toBeUndefined();
      expect((networkBarrel as any).SignedRoomTicket).toBeUndefined();
      expect((networkBarrel as any).CryptoCapabilityError).toBeUndefined();
      expect((networkBarrel as any).timingSafeEqualBytes).toBeUndefined();
      expect((serverNetworkBarrel as any).SignedTicketVerifier).toBeUndefined();
      expect((serverNetworkBarrel as any).SignedRoomTicket).toBeUndefined();
      expect((serverNetworkBarrel as any).CryptoCapabilityError).toBeUndefined();
      expect((serverNetworkBarrel as any).timingSafeEqualBytes).toBeUndefined();
    });
  });

  describe('RF-038 — Fail-closed scoped-token role parsing on the live admission path', () => {
    it('accepts only exact observer/participant suffixes and rejects every other suffix', () => {
      const registry = createRoomRegistry({ authToken: 'room-master-key', maxAuthFailures: 100 });
      const room = 'room-scoped';

      const observer = makeSocket();
      registry.handleConnection(observer, room, 'peer-obs', 'room-master-key:observer', 'participant');
      expect(observer.closeCode).toBeUndefined();
      expect(observer.readyState).toBe(1);

      const participant = makeSocket();
      registry.handleConnection(participant, room, 'peer-part', 'room-master-key:participant');
      expect(participant.closeCode).toBeUndefined();
      expect(participant.readyState).toBe(1);

      const rejectedTokens = [
        'room-master-key:admin',
        'room-master-key:PARTICIPANT',
        'room-master-key:',
        'room-master-key:participant-extra',
        'room-master-key:observer:participant',
        'room-master-key:administrator',
      ];
      rejectedTokens.forEach((token, i) => {
        const s = makeSocket();
        registry.handleConnection(s, room, `peer-bad-${i}`, token);
        expect(s.closeCode).toBe(4001);
        expect(s.closeReason).toBe('invalid scoped token role');
      });

      // Only the two exact-scoped peers were admitted.
      expect(registry.getTotalPeers()).toBe(2);
    });

    it('enforces the exact scoped role capabilities (observer cannot relay state)', () => {
      const registry = createRoomRegistry({ authToken: 'room-master-key' });
      const room = 'room-scoped-cap';

      const observer = makeSocket();
      registry.handleConnection(observer, room, 'peer-obs', 'room-master-key:observer');
      const participant = makeSocket();
      registry.handleConnection(participant, room, 'peer-part', 'room-master-key:participant');
      participant.sent.length = 0;

      observer.listeners.message[0](
        JSON.stringify({ to: 'peer-part', data: { type: 'state', delta: { count: 1 } } })
      );
      expect(participant.sent.length).toBe(0);

      // The exact participant suffix has the privileged capabilities.
      observer.listeners.message[0](
        JSON.stringify({ to: 'peer-part', data: { type: 'offer', sdp: 'obs-offer' } })
      );
      expect(participant.sent.length).toBe(1);
    });

    it('a foreign requested role never promotes beyond the exact ontology (least privilege)', () => {
      const registry = createRoomRegistry({ authToken: 'participant-secret' });
      const room = 'room-role-ontology';

      // Plain participant secret + a foreign requested role: the request must not
      // silently become `participant`. The exact allow-list resolves it to the
      // least-privilege observer role, so it cannot relay application state.
      const weird = makeSocket();
      registry.handleConnection(weird, room, 'peer-weird', 'participant-secret', 'analyst');
      expect(weird.closeCode).toBeUndefined();
      expect(weird.readyState).toBe(1);

      const participant = makeSocket();
      registry.handleConnection(participant, room, 'peer-part', 'participant-secret');
      participant.sent.length = 0;

      weird.listeners.message[0](
        JSON.stringify({ to: 'peer-part', data: { type: 'datasetOperation', op: { type: 'delete' } } })
      );
      expect(participant.sent.length).toBe(0);

      // An administrator request in open (Development) mode is likewise capped:
      // it must not become a participant with state-broadcast capabilities.
      const openRegistry = createRoomRegistry({ securityProfile: 'Development' });
      const admin = makeSocket();
      openRegistry.handleConnection(admin, 'room-open', 'peer-admin', undefined, 'administrator');
      expect(admin.closeCode).toBeUndefined();
      const openPart = makeSocket();
      openRegistry.handleConnection(openPart, 'room-open', 'peer-open-part');
      openPart.sent.length = 0;
      admin.listeners.message[0](
        JSON.stringify({ to: 'peer-open-part', data: { type: 'datasetOperation', op: { type: 'delete' } } })
      );
      expect(openPart.sent.length).toBe(0);
      expect(openRegistry.getTotalPeers()).toBe(2);
    });
  });

  describe('S1-F1 — Signalling room/connection flood hardening', () => {
    it('bounds unauthenticated peers per room and still admits a legitimate authenticated peer', () => {
      const registry = createRoomRegistry({
        authToken: 'secret',
        maxPendingPeersPerRoom: 3,
        maxConnectionsPerIp: 100,
      });
      const floodSockets: MockSocketWithState[] = [];

      // 3 unauthenticated flood peers are admitted pending in-band auth.
      for (let i = 0; i < 3; i++) {
        const s = makeSocket();
        registry.handleConnection(s, 'room-flood', `flood-${i}`);
        expect(s.closeCode).toBeUndefined();
        floodSockets.push(s);
      }

      // A flood peer beyond the pending cap is rejected at the admission gate.
      const overflow = makeSocket();
      registry.handleConnection(overflow, 'room-flood', 'flood-overflow');
      expect(overflow.closeCode).toBe(1008);
      expect(overflow.closeReason).toBe('too many unauthenticated peers in room');

      // A legitimate authenticated peer is still admitted: the pending cap is
      // distinct from maxPeersPerRoom and does not consume authenticated slots.
      const legit = makeSocket();
      registry.handleConnection(legit, 'room-flood', 'legit-analyst', 'secret');
      expect(legit.closeCode).toBeUndefined();
      expect(registry.getTotalPeers()).toBe(1);

      // Close pending sockets so their auth timers are cleared.
      for (const s of floodSockets) s.close?.();
      legit.close?.();
    });

    it('counts unauthenticated peers toward the server-wide admission ceiling', () => {
      const registry = createRoomRegistry({
        authToken: 'secret',
        maxTotalConnections: 2,
        maxConnectionsPerIp: 100,
        authTimeoutMs: 60_000,
      });
      const a = makeSocket();
      registry.handleConnection(a, 'room-a', 'peer-a');
      expect(a.closeCode).toBeUndefined();
      expect(registry.getTotalPeers()).toBe(0); // pending peer is not authenticated

      const b = makeSocket();
      registry.handleConnection(b, 'room-b', 'peer-b');
      expect(b.closeCode).toBeUndefined();

      // Once pending + authenticated reach maxTotalConnections, admission closes.
      const c = makeSocket();
      registry.handleConnection(c, 'room-c', 'peer-c');
      expect(c.closeCode).toBe(1008);
      expect(c.closeReason).toBe('server connection limit exceeded');

      a.close?.();
      b.close?.();
    });

    it('rejects once authenticated + pending peers together reach the server cap', () => {
      const registry = createRoomRegistry({
        authToken: 'secret',
        maxTotalConnections: 2,
        maxConnectionsPerIp: 100,
        authTimeoutMs: 60_000,
      });
      const authed = makeSocket();
      registry.handleConnection(authed, 'room-mix', 'authed', 'secret');
      expect(authed.closeCode).toBeUndefined();
      expect(registry.getTotalPeers()).toBe(1);

      const pending = makeSocket();
      registry.handleConnection(pending, 'room-mix', 'pending');
      expect(pending.closeCode).toBeUndefined();

      const overflow = makeSocket();
      registry.handleConnection(overflow, 'room-mix', 'overflow');
      expect(overflow.closeCode).toBe(1008);
      expect(overflow.closeReason).toBe('server connection limit exceeded');

      authed.close?.();
      pending.close?.();
    });

    it('records a per-IP auth failure when an unauthenticated peer disconnects before the auth timeout', () => {
      const registry = createRoomRegistry({
        authToken: 'secret',
        maxAuthFailures: 3,
        authTimeoutMs: 60_000,
      });
      const req = { socket: { remoteAddress: '203.0.113.7' } };

      for (let i = 0; i < 3; i++) {
        const s = makeSocket();
        registry.handleConnection(s, 'room-recon', `recon-${i}`, undefined, 'participant', req);
        expect(s.closeCode).toBeUndefined(); // admitted pending auth
        s.close?.(); // disconnect before the auth timeout elapses
      }

      // Each early disconnect is charged as an auth failure, so rapid
      // reconnect-before-timeout cannot bypass the per-IP lockout.
      expect(registry.getAuthFailureCount('203.0.113.7')).toBe(3);

      const blocked = makeSocket();
      registry.handleConnection(blocked, 'room-recon', 'blocked', 'secret', 'participant', req);
      expect(blocked.closeCode).toBe(1008);
      expect(blocked.closeReason).toBe('too many authentication failures');
    });

    it('rejects creation of new rooms beyond the room cap while existing rooms keep admitting', () => {
      const registry = createRoomRegistry({ securityProfile: 'Development', maxRooms: 2 });

      const a = makeSocket();
      registry.handleConnection(a, 'room-1', 'peer-1');
      expect(a.closeCode).toBeUndefined();

      const b = makeSocket();
      registry.handleConnection(b, 'room-2', 'peer-2');
      expect(b.closeCode).toBeUndefined();
      expect(registry.getRoomCount()).toBe(2);

      // A brand-new room id is refused once the cap is reached.
      const c = makeSocket();
      registry.handleConnection(c, 'room-3', 'peer-3');
      expect(c.closeCode).toBe(1008);
      expect(c.closeReason).toBe('too many rooms');

      // Existing rooms still admit peers (the cap only bounds room creation).
      const d = makeSocket();
      registry.handleConnection(d, 'room-1', 'peer-4');
      expect(d.closeCode).toBeUndefined();
    });

    it('sets a transport-level maxPayload on both WebSocketServer transports', () => {
      // The shared constant is sized above the registry's 64 KiB relay cap.
      expect(WS_MAX_PAYLOAD_BYTES).toBeGreaterThanOrEqual(64 * 1024);

      const standalone = readFileSync(resolve(process.cwd(), 'src/network/SignallingServer.mjs'), 'utf8');
      const devServer = readFileSync(resolve(process.cwd(), 'dev/signalling-dev-server.ts'), 'utf8');

      expect(standalone).toContain('maxPayload: WS_MAX_PAYLOAD_BYTES');
      expect(devServer).toContain('maxPayload: WS_MAX_PAYLOAD_BYTES');
    });
  });
});
