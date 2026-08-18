/**
 * Connector API Authentication & Authorization Engine.
 *
 * Implements bearer token validation, permission scope gating,
 * and rate-limiting for external data-source connectors.
 */

export type ConnectorPermissionScope = 'READ_DATASET' | 'WRITE_DATASET' | 'STREAM_TELEMETRY' | 'ADMIN';

export interface ConnectorCredential {
  connectorId: string;
  token: string;
  scopes: ConnectorPermissionScope[];
  rateLimitMaxRps: number;
  expiresAt: number;
}

export class ConnectorAuthManager {
  private _credentials = new Map<string, ConnectorCredential>();
  private _requestCounts = new Map<string, { count: number; windowStart: number }>();

  registerCredential(credential: ConnectorCredential): void {
    this._credentials.set(credential.token, credential);
  }

  revokeCredential(token: string): boolean {
    return this._credentials.delete(token);
  }

  validateAccess(token: string, requiredScope: ConnectorPermissionScope, now = Date.now()): { allowed: boolean; reason?: string } {
    const cred = this._credentials.get(token);
    if (!cred) {
      return { allowed: false, reason: 'Invalid authentication token' };
    }

    if (now > cred.expiresAt) {
      return { allowed: false, reason: 'Token has expired' };
    }

    if (!cred.scopes.includes(requiredScope) && !cred.scopes.includes('ADMIN')) {
      return { allowed: false, reason: `Missing required scope: ${requiredScope}` };
    }

    // Rate-limiting check (1-second sliding window)
    let rateData = this._requestCounts.get(cred.connectorId);
    if (!rateData || now - rateData.windowStart > 1000) {
      rateData = { count: 1, windowStart: now };
    } else {
      rateData.count++;
      if (rateData.count > cred.rateLimitMaxRps) {
        return { allowed: false, reason: 'Rate limit exceeded' };
      }
    }
    this._requestCounts.set(cred.connectorId, rateData);

    return { allowed: true };
  }
}
