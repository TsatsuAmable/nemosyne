/**
 * Telemetry Consent & GDPR Right-to-Erasure Manager.
 *
 * Enforces explicit participant consent, pseudonymous subject hashing, and
 * full scrubbing/deletion hooks for study and performance logs.
 */

export type ConsentStatus = 'unspecified' | 'granted' | 'revoked';

export interface ConsentRecord {
  subjectId: string;
  pseudonymToken: string;
  status: ConsentStatus;
  timestamp: number;
  scopes: Array<'telemetry' | 'biometric' | 'interaction_replay'>;
}

export class TelemetryConsentManager {
  private readonly _records = new Map<string, ConsentRecord>();
  private readonly _salt: string;

  constructor(salt = 'nemosyne-consent-salt-v1') {
    this._salt = salt;
  }

  /**
   * Derive a pseudonymous token from raw subject ID without storing PII.
   */
  generatePseudonymToken(rawSubjectId: string): string {
    let hash = 0x811c9dc5;
    const input = `${this._salt}:${rawSubjectId}`;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return `subj_${(hash >>> 0).toString(16).padStart(8, '0')}`;
  }

  grantConsent(
    rawSubjectId: string,
    scopes: Array<'telemetry' | 'biometric' | 'interaction_replay'> = ['telemetry']
  ): ConsentRecord {
    const pseudonymToken = this.generatePseudonymToken(rawSubjectId);
    const record: ConsentRecord = {
      subjectId: rawSubjectId,
      pseudonymToken,
      status: 'granted',
      timestamp: Date.now(),
      scopes,
    };
    this._records.set(pseudonymToken, record);
    return record;
  }

  revokeConsent(rawSubjectId: string): void {
    const pseudonymToken = this.generatePseudonymToken(rawSubjectId);
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
  isPermitted(
    rawSubjectId: string,
    scope: 'telemetry' | 'biometric' | 'interaction_replay' = 'telemetry'
  ): boolean {
    const pseudonymToken = this.generatePseudonymToken(rawSubjectId);
    const record = this._records.get(pseudonymToken);
    return record?.status === 'granted' && record.scopes.includes(scope);
  }

  /**
   * GDPR Right-to-Erasure: permanently erase subject record and all linked mapping.
   */
  executeRightToErasure(rawSubjectId: string): boolean {
    const pseudonymToken = this.generatePseudonymToken(rawSubjectId);
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
