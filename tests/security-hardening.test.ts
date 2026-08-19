import { describe, it, expect } from 'vitest';
import { UploadSanitizer } from '../src/data/index.ts';
import { SignedTicketVerifier, type SignedRoomTicket } from '../src/network/index.ts';
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

  describe('SignedTicketVerifier (HMAC-SHA256 Collaboration Security)', () => {
    const SECRET = 'test-room-secret-key-xyz-987';
    const SESSION_ID = 'session-vr-collab-01';

    it('verifies a valid signed ticket', async () => {
      const verifier = new SignedTicketVerifier();
      const now = Date.now();

      const ticketPayload = {
        version: 1 as const,
        sessionId: SESSION_ID,
        participantId: 'user-alice-01',
        role: 'analyst' as const,
        issuedAt: now,
        expiresAt: now + 300_000, // 5 min
        nonce: 'nonce-123456',
      };

      const signedTicket = await SignedTicketVerifier.signTicket(ticketPayload, SECRET);
      const result = await verifier.verifyTicket(signedTicket, SECRET, SESSION_ID, now);

      expect(result.valid).toBe(true);
      expect(result.ticket?.participantId).toBe('user-alice-01');
    });

    it('rejects forged cryptographic signatures and mismatched rooms', async () => {
      const verifier = new SignedTicketVerifier();
      const now = Date.now();

      const signedTicket: SignedRoomTicket = {
        version: 1,
        sessionId: SESSION_ID,
        participantId: 'user-mallory',
        role: 'analyst',
        issuedAt: now,
        expiresAt: now + 300_000,
        nonce: 'nonce-mallory-1',
        signatureHex: 'deadbeefcafebabe00000000',
      };

      const result = await verifier.verifyTicket(signedTicket, SECRET, SESSION_ID, now);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid HMAC cryptographic signature');
    });

    it('prevents replay attacks with the same nonce and selectively evicts expired nonces', async () => {
      const verifier = new SignedTicketVerifier();
      const now = Date.now();

      const ticket1 = await SignedTicketVerifier.signTicket(
        {
          version: 1,
          sessionId: SESSION_ID,
          participantId: 'user-bob-02',
          role: 'collaborator',
          issuedAt: now,
          expiresAt: now + 10_000, // 10s expiration
          nonce: 'nonce-bob-unique-1',
        },
        SECRET
      );

      const ticket2 = await SignedTicketVerifier.signTicket(
        {
          version: 1,
          sessionId: SESSION_ID,
          participantId: 'user-bob-02',
          role: 'collaborator',
          issuedAt: now,
          expiresAt: now + 100_000, // 100s expiration
          nonce: 'nonce-bob-unique-2',
        },
        SECRET
      );

      const res1 = await verifier.verifyTicket(ticket1, SECRET, SESSION_ID, now);
      expect(res1.valid).toBe(true);

      const res2 = await verifier.verifyTicket(ticket2, SECRET, SESSION_ID, now);
      expect(res2.valid).toBe(true);
      expect(verifier.activeNonceCount).toBe(2);

      // Replay of ticket1 is rejected
      const replay = await verifier.verifyTicket(ticket1, SECRET, SESSION_ID, now);
      expect(replay.valid).toBe(false);
      expect(replay.error).toContain('replay detected');

      // Clear expired nonces at now + 20s (ticket1 expired, ticket2 active)
      verifier.clearExpiredNonces(now + 20_000);
      expect(verifier.activeNonceCount).toBe(1);
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
