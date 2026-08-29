/**
 * Telemetry Consent & GDPR Right-to-Erasure Manager.
 *
 * Enforces explicit participant consent, pseudonymous subject hashing, and
 * full scrubbing/deletion hooks for study and performance logs.
 *
 * Privacy contract:
 * - The pseudonym is a real cryptographic SHA-256 (Web Crypto) digest of
 *   `salt:subjectId`, so the raw subject identifier cannot be recovered from
 *   the record.
 * - The consent record NEVER stores the raw subject id — only the pseudonym
 *   token and consent metadata.
 * - A non-empty per-deployment salt is REQUIRED; construction without one
 *   fails closed so a deployment can never silently fall back to a public
 *   default that weakens the pseudonym.
 */

export type ConsentStatus = 'unspecified' | 'granted' | 'revoked';
export type ConsentScope = 'telemetry' | 'biometric' | 'interaction_replay';

export interface ConsentRecord {
  pseudonymToken: string;
  status: ConsentStatus;
  timestamp: number;
  scopes: ConsentScope[];
}

const PSEUDONYM_PREFIX = 'subj_';

export class TelemetryConsentManager {
  private readonly _records = new Map<string, ConsentRecord>();
  private readonly _salt: string;

  constructor(salt: string) {
    if (typeof salt !== 'string' || salt.length === 0) {
      throw new Error(
        'TelemetryConsentManager requires a non-empty per-deployment salt (env/config-provided secret)'
      );
    }
    this._salt = salt;
  }

  /**
   * Derive a pseudonymous token from raw subject ID without storing PII.
   * SHA-256 of `salt:subjectId` via Web Crypto; full-length hex digest.
   */
  async generatePseudonymToken(rawSubjectId: string): Promise<string> {
    const input = `${this._salt}:${rawSubjectId}`;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    const bytes = new Uint8Array(digest);
    let hex = '';
    for (const b of bytes) hex += b.toString(16).padStart(2, '0');
    return `${PSEUDONYM_PREFIX}${hex}`;
  }

  async grantConsent(
    rawSubjectId: string,
    scopes: ConsentScope[] = ['telemetry']
  ): Promise<ConsentRecord> {
    const pseudonymToken = await this.generatePseudonymToken(rawSubjectId);
    const record: ConsentRecord = {
      pseudonymToken,
      status: 'granted',
      timestamp: Date.now(),
      scopes,
    };
    this._records.set(pseudonymToken, record);
    return record;
  }

  async revokeConsent(rawSubjectId: string): Promise<void> {
    const pseudonymToken = await this.generatePseudonymToken(rawSubjectId);
    const record = this._records.get(pseudonymToken);
    if (record) {
      record.status = 'revoked';
      record.scopes = [];
      record.timestamp = Date.now();
    }
  }

  /**
   * Check if telemetry recording is permitted for the given subject and scope.
   */
  async isPermitted(rawSubjectId: string, scope: ConsentScope = 'telemetry'): Promise<boolean> {
    const pseudonymToken = await this.generatePseudonymToken(rawSubjectId);
    const record = this._records.get(pseudonymToken);
    return record?.status === 'granted' && record.scopes.includes(scope);
  }

  /**
   * GDPR Right-to-Erasure: permanently erase subject record and all linked mapping.
   */
  async executeRightToErasure(rawSubjectId: string): Promise<boolean> {
    const pseudonymToken = await this.generatePseudonymToken(rawSubjectId);
    return this._records.delete(pseudonymToken);
  }

  get activeConsentCount(): number {
    let count = 0;
    for (const r of this._records.values()) {
      if (r.status === 'granted') count++;
    }
    return count;
  }
}
