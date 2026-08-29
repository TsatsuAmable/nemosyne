/* eslint-disable @typescript-eslint/no-explicit-any */
import * as crypto from 'node:crypto';
import { describe, it, expect, vi } from 'vitest';
import { UploadSanitizer } from '../src/data/index.ts';
import {
  createSignedTicket,
  verifySignedTicket,
  SignedTicketReplayGuard,
  SIGNED_TICKET_VERSION,
  type TicketClaims,
} from '../src/network/index.ts';
import { TelemetryConsentManager } from '../src/study/index.ts';

describe('Sprint 27.5 — Security, Input Sanitization & Network Hardening', () => {
  describe('UploadSanitizer', () => {
    it('sanitizes malicious directory traversal file names', () => {
      const malicious = '../../../../etc/passwd\0.csv';
      const clean = UploadSanitizer.sanitizeFileName(malicious);
      expect(clean).not.toContain('..');
      expect(clean).not.toContain('\0');
      expect(clean).toBe('._._._._etc_passwd.csv');
    });

    it('rejects oversized raw upload bytes before memory allocation', () => {
      const oversizedBuffer = new Uint8Array(2000);
      const result = UploadSanitizer.validateUploadBytes(oversizedBuffer, 'data.csv', {
        maxSizeBytes: 1000,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum allowed limit');
    });

    it('recursively neutralizes prototype pollution payloads in parsed objects', () => {
      const maliciousPayload = JSON.parse('{"name":"safe","__proto__":{"polluted":true},"nested":{"constructor":{"admin":true}}}');
      const clean = UploadSanitizer.neutralizeObject(maliciousPayload);

      expect(clean.name).toBe('safe');
      expect((clean as Record<string, unknown>).polluted).toBeUndefined();
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    it('rejects datasets with excess row or column counts', () => {
      const rowResult = UploadSanitizer.validateDatasetMetrics(600_000, 10, {
        maxRowCount: 500_000,
      });
      expect(rowResult.valid).toBe(false);
      expect(rowResult.error).toContain('Row count 600000 exceeds');

      const colResult = UploadSanitizer.validateDatasetMetrics(100, 2_000, {
        maxColumnCount: 1_000,
      });
      expect(colResult.valid).toBe(false);
      expect(colResult.error).toContain('Column count 2000 exceeds');
    });
  });

  describe('SignedTicket — canonical admission authority (HMAC-SHA256)', () => {
    const SECRET = 'test-room-secret-key-xyz-987';
    const ROOM = 'session-vr-collab-01';

    /** Sign a raw claims object so tests can construct canonical-schema tickets the creator refuses to issue. */
    function signRawClaims(claims: unknown, secret: string): string {
      const payloadB64 = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(payloadB64);
      return `${payloadB64}.${hmac.digest('hex')}`;
    }

    function makeTicket(overrides: Partial<TicketClaims> = {}, now = Date.now()): string {
      return createSignedTicket(
        {
          room: ROOM,
          role: 'participant',
          exp: now + 300_000, // 5 min
          ...(overrides as any),
        },
        SECRET
      );
    }

    function decodeClaims(ticket: string): TicketClaims {
      const [payloadB64] = ticket.split('.');
      return JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as TicketClaims;
    }

    it('verifies a valid signed ticket: one creator and one verifier share one schema', () => {
      const now = Date.now();
      const ticket = makeTicket({}, now);
      const result = verifySignedTicket(ticket, SECRET, ROOM, now);

      expect(result.valid).toBe(true);
      expect(result.claims?.version).toBe(SIGNED_TICKET_VERSION);
      expect(result.claims?.room).toBe(ROOM);
      expect(result.claims?.role).toBe('participant');
      expect(result.claims?.nonce).toBeTruthy();

      const observerTicket = makeTicket({ role: 'observer' }, now);
      const observerResult = verifySignedTicket(observerTicket, SECRET, ROOM, now);
      expect(observerResult.valid).toBe(true);
      expect(observerResult.claims?.role).toBe('observer');
    });

    it('rejects forged cryptographic signatures and mismatched rooms', () => {
      const now = Date.now();
      const forged = signRawClaims(
        { version: 1, room: ROOM, role: 'participant', issuedAt: now, exp: now + 300_000, nonce: 'n-forged' },
        'wrong-secret'
      );
      const res = verifySignedTicket(forged, SECRET, ROOM, now);
      expect(res.valid).toBe(false);
      expect(res.errorKind).toBe('invalid_signature');
      expect(res.error).toContain('invalid ticket cryptographic signature');

      const otherRoom = makeTicket({}, now);
      const roomRes = verifySignedTicket(otherRoom, SECRET, 'different-room', now);
      expect(roomRes.valid).toBe(false);
      expect(roomRes.errorKind).toBe('room_mismatch');
    });

    it('prevents replay attacks with the same nonce and selectively evicts expired nonces', () => {
      const guard = new SignedTicketReplayGuard();
      const now = Date.now();

      const ticket1 = makeTicket({ nonce: 'nonce-bob-unique-1', exp: now + 10_000 }, now);
      const ticket2 = makeTicket({ nonce: 'nonce-bob-unique-2', exp: now + 100_000 }, now);
      const c1 = decodeClaims(ticket1);
      const c2 = decodeClaims(ticket2);

      expect(guard.consume(c1.nonce, c1.exp)).toBe(true);
      expect(guard.consume(c2.nonce, c2.exp)).toBe(true);
      expect(guard.size).toBe(2);

      // Replay of ticket1 is rejected
      expect(guard.consume(c1.nonce, c1.exp)).toBe(false);

      // Clear expired nonces at now + 20s (ticket1 expired, ticket2 active)
      guard.clearExpired(now + 20_000);
      expect(guard.size).toBe(1);
    });

    it('rejects a malformed (non-hex) signature', () => {
      const now = Date.now();
      const ticket = makeTicket({}, now);
      const malformed = ticket.slice(0, -2) + 'zz';
      const result = verifySignedTicket(malformed, SECRET, ROOM, now);
      expect(result.valid).toBe(false);
      expect(result.errorKind).toBe('malformed_signature');
    });

    it('rejects an incorrect signature length', () => {
      const now = Date.now();
      const ticket = makeTicket({}, now);
      const result = verifySignedTicket(ticket + '00', SECRET, ROOM, now);
      expect(result.valid).toBe(false);
      expect(result.errorKind).toBe('malformed_signature');
    });

    it('rejects a modified payload (room tampered)', () => {
      const now = Date.now();
      const ticket = makeTicket({}, now);
      const claims = decodeClaims(ticket);
      claims.room = 'attacker-room';
      const tamperedPayload = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
      const tampered = `${tamperedPayload}.${ticket.split('.')[1]}`;
      const result = verifySignedTicket(tampered, SECRET, ROOM, now);
      expect(result.valid).toBe(false);
      expect(result.errorKind).toBe('invalid_signature');
    });

    it('rejects a modified signature (one hex char flipped)', () => {
      const now = Date.now();
      const ticket = makeTicket({}, now);
      const flipped = ticket.slice(0, -1) + (ticket.endsWith('0') ? '1' : '0');
      const result = verifySignedTicket(flipped, SECRET, ROOM, now);
      expect(result.valid).toBe(false);
      expect(result.errorKind).toBe('invalid_signature');
    });

    it('rejects an expired ticket', () => {
      const now = Date.now();
      const expired = makeTicket({ exp: now - 1000 }, now);
      const result = verifySignedTicket(expired, SECRET, ROOM, now);
      expect(result.valid).toBe(false);
      expect(result.errorKind).toBe('expired');
    });

    it('rejects a future-issued ticket', () => {
      const now = Date.now();
      const future = makeTicket({ issuedAt: now + 120_000 }, now);
      const result = verifySignedTicket(future, SECRET, ROOM, now);
      expect(result.valid).toBe(false);
      expect(result.errorKind).toBe('future_issued');
    });

    it('rejects a replayed nonce via the admission replay guard', () => {
      const guard = new SignedTicketReplayGuard();
      const now = Date.now();
      const ticket = makeTicket({ nonce: 'nonce-replay-p0' }, now);
      const res = verifySignedTicket(ticket, SECRET, ROOM, now);
      expect(res.valid).toBe(true);
      const claims = res.claims!;
      expect(guard.consume(claims.nonce, claims.exp)).toBe(true);
      expect(guard.consume(claims.nonce, claims.exp)).toBe(false);
    });

    it('fails closed on legacy/foreign role ontology values (analyst, collaborator)', () => {
      const now = Date.now();
      const analyst = signRawClaims(
        { version: 1, room: ROOM, role: 'analyst', issuedAt: now, exp: now + 300_000, nonce: 'n-analyst' },
        SECRET
      );
      const analystRes = verifySignedTicket(analyst, SECRET, ROOM, now);
      expect(analystRes.valid).toBe(false);
      expect(analystRes.errorKind).toBe('invalid_role');

      const collaborator = signRawClaims(
        { version: 1, room: ROOM, role: 'collaborator', issuedAt: now, exp: now + 300_000, nonce: 'n-collab' },
        SECRET
      );
      expect(verifySignedTicket(collaborator, SECRET, ROOM, now).errorKind).toBe('invalid_role');
    });

    it('rejects a ticket with a missing nonce (nonce is mandatory)', () => {
      const now = Date.now();
      const noNonce = signRawClaims(
        { version: 1, room: ROOM, role: 'participant', issuedAt: now, exp: now + 300_000 },
        SECRET
      );
      const result = verifySignedTicket(noNonce, SECRET, ROOM, now);
      expect(result.valid).toBe(false);
      expect(result.errorKind).toBe('missing_nonce');
    });

    it('rejects an unsupported ticket version', () => {
      const now = Date.now();
      const v2 = signRawClaims(
        { version: 2, room: ROOM, role: 'participant', issuedAt: now, exp: now + 300_000, nonce: 'n-v2' },
        SECRET
      );
      const result = verifySignedTicket(v2, SECRET, ROOM, now);
      expect(result.valid).toBe(false);
      expect(result.errorKind).toBe('unsupported_version');
    });

    it('createSignedTicket fails closed on unknown roles at issuance', () => {
      const now = Date.now();
      expect(() =>
        createSignedTicket({ room: ROOM, role: 'analyst' as any, exp: now + 300_000 }, SECRET)
      ).toThrow(/claims.role must be one of/);
      expect(() =>
        createSignedTicket({ room: ROOM, role: 'collaborator' as any, exp: now + 300_000 }, SECRET)
      ).toThrow(/claims.role must be one of/);
      expect(() =>
        createSignedTicket({ room: ROOM, role: 'participant' as any, exp: 'soon' as any }, SECRET)
      ).toThrow(/claims.exp must be a finite number/);
    });

    it('does not depend on ambient WebCrypto (Node crypto is the only mechanism)', () => {
      const now = Date.now();
      const ticket = makeTicket({}, now);
      const realCrypto = globalThis.crypto;
      vi.stubGlobal('crypto', { subtle: undefined });
      try {
        const result = verifySignedTicket(ticket, SECRET, ROOM, now);
        expect(result.valid).toBe(true);
        expect(result.claims?.role).toBe('participant');
      } finally {
        vi.stubGlobal('crypto', realCrypto);
      }
    });
  });

  describe('TelemetryConsentManager & GDPR Right-to-Erasure', () => {
    it('manages consent scopes and pseudonymous hashing', () => {
      const manager = new TelemetryConsentManager();
      const rawSubject = 'analyst_dr_carter@hospital.org';

      expect(manager.isPermitted(rawSubject)).toBe(false);

      const record = manager.grantConsent(rawSubject, ['telemetry', 'biometric']);
      expect(record.pseudonymToken).toMatch(/^subj_[0-9a-f]{8}$/);
      expect(manager.isPermitted(rawSubject, 'telemetry')).toBe(true);
      expect(manager.isPermitted(rawSubject, 'biometric')).toBe(true);
      expect(manager.isPermitted(rawSubject, 'interaction_replay')).toBe(false);

      manager.revokeConsent(rawSubject);
      expect(manager.isPermitted(rawSubject, 'telemetry')).toBe(false);
    });

    it('permanently purges records on Right-to-Erasure execution', () => {
      const manager = new TelemetryConsentManager();
      manager.grantConsent('user-to-erase');
      expect(manager.activeConsentCount).toBe(1);

      const erased = manager.executeRightToErasure('user-to-erase');
      expect(erased).toBe(true);
      expect(manager.activeConsentCount).toBe(0);
      expect(manager.isPermitted('user-to-erase')).toBe(false);
    });
  });
});
