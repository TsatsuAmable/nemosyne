/* eslint-disable @typescript-eslint/no-explicit-any */
import * as crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import * as dataBarrel from '../src/data/index.ts';
import {
  createSignedTicket,
  verifySignedTicket,
  SignedTicketReplayGuard,
  SIGNED_TICKET_VERSION,
  type TicketClaims,
} from '../src/network/server.ts';
import * as networkBarrel from '../src/network/index.ts';
import { TelemetryConsentManager } from '../src/study/index.ts';

describe('Sprint 27.5 — Security, Input Sanitization & Network Hardening', () => {
  describe('S1-F2 — dead security classes removed from the barrels', () => {
    it('no longer exposes UploadSanitizer or ConnectorAuthManager from production exports', () => {
      expect((dataBarrel as any).UploadSanitizer).toBeUndefined();
      expect((networkBarrel as any).ConnectorAuthManager).toBeUndefined();
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
    const SALT = 'deployment-secret-abc-123';

    it('derives a real SHA-256 pseudonym and never stores the raw subjectId', async () => {
      const manager = new TelemetryConsentManager(SALT);
      const rawSubject = 'analyst_dr_carter@hospital.org';

      expect(await manager.isPermitted(rawSubject)).toBe(false);

      const record = await manager.grantConsent(rawSubject, ['telemetry', 'biometric']);

      // The token is the full-length SHA-256 of `salt:subjectId` (Web Crypto),
      // independently recomputed here to prove it is a real cryptographic hash.
      const expectedHex = crypto.createHash('sha256').update(`${SALT}:${rawSubject}`).digest('hex');
      expect(record.pseudonymToken).toBe(`subj_${expectedHex}`);
      expect(record.pseudonymToken).toMatch(/^subj_[0-9a-f]{64}$/);

      // The record is genuinely pseudonymous: no raw subject identifier.
      expect(record).not.toHaveProperty('subjectId');
      expect(JSON.stringify(record)).not.toContain(rawSubject);

      expect(await manager.isPermitted(rawSubject, 'telemetry')).toBe(true);
      expect(await manager.isPermitted(rawSubject, 'biometric')).toBe(true);
      expect(await manager.isPermitted(rawSubject, 'interaction_replay')).toBe(false);

      await manager.revokeConsent(rawSubject);
      expect(await manager.isPermitted(rawSubject, 'telemetry')).toBe(false);
    });

    it('fails closed when constructed without a per-deployment salt', () => {
      // The constructor signature requires a salt; the zero-arg / empty-salt
      // runtime paths still must fail closed rather than adopt a default.
      const Ctor = TelemetryConsentManager as unknown as new () => TelemetryConsentManager;
      expect(() => new Ctor()).toThrow(/non-empty per-deployment salt/);
      expect(() => new TelemetryConsentManager('')).toThrow(/non-empty per-deployment salt/);
      expect(() => new TelemetryConsentManager(undefined as unknown as string)).toThrow(/non-empty per-deployment salt/);
    });

    it('derives a deterministic cryptographic token per salt and subject', async () => {
      const a = await new TelemetryConsentManager(SALT).generatePseudonymToken('subject-1');
      const b = await new TelemetryConsentManager(SALT).generatePseudonymToken('subject-1');
      const c = await new TelemetryConsentManager(SALT).generatePseudonymToken('subject-2');
      expect(a).toBe(b);
      expect(a).not.toBe(c);
    });

    it('permanently purges records on Right-to-Erasure execution', async () => {
      const manager = new TelemetryConsentManager(SALT);
      await manager.grantConsent('user-to-erase');
      expect(manager.activeConsentCount).toBe(1);

      const erased = await manager.executeRightToErasure('user-to-erase');
      expect(erased).toBe(true);
      expect(manager.activeConsentCount).toBe(0);
      expect(await manager.isPermitted('user-to-erase')).toBe(false);
    });
  });

  describe('S1-F4 — CSPRNG-derived live identifiers', () => {
    it('generates annotation, bookmark, and archive ids from crypto.randomUUID, never Math.random', () => {
      const sharedAnnotations = readFileSync(
        resolve(process.cwd(), 'src/vr/interactions/SharedAnnotationManager.ts'),
        'utf8'
      );
      const vaultArchive = readFileSync(resolve(process.cwd(), 'src/session/VaultArchiveStore.ts'), 'utf8');
      const networkManager = readFileSync(resolve(process.cwd(), 'src/network/NetworkManager.ts'), 'utf8');

      expect(sharedAnnotations).toContain('annot-${crypto.randomUUID()}');
      expect(sharedAnnotations).toContain('bm-${crypto.randomUUID()}');
      expect(vaultArchive).toContain('${ARCHIVE_PREFIX}${crypto.randomUUID()}');
      expect(sharedAnnotations).not.toContain('Math.random');
      expect(vaultArchive).not.toContain('Math.random');

      // NetworkManager keeps a CSPRNG-first peer id and only falls back to
      // Math.random when crypto is entirely absent.
      expect(networkManager).toContain("typeof crypto !== 'undefined' && crypto.randomUUID");
      expect(networkManager).toMatch(/Math\.random/);
    });
  });

  describe('S1-F5 — no untrusted PR data interpolated into CI run blocks', () => {
    it('passes PR values to the approval gate via env, not inline shell interpolation', () => {
      const workflow = readFileSync(resolve(process.cwd(), '.github/workflows/approval-gate.yml'), 'utf8');
      expect(workflow).not.toContain('--pr ${{');
      expect(workflow).not.toContain('--sha ${{');
      expect(workflow).not.toContain("OWNER='${{");
      expect(workflow).toContain('PR_NUMBER: ${{ github.event.pull_request.number }}');
      expect(workflow).toContain('HEAD_SHA: ${{ github.event.pull_request.head.sha }}');
    });
  });
});
