import { createHmac } from 'node:crypto';

import type { AuthenticatedPrincipalV1, VersionedSecretKeyV1 } from './ProductAnalyticsConsentAuthority.ts';

const DELETION_HANDLE_DOMAIN = Buffer.from('nemosyne:deletion-handle:v1\n', 'utf8');

function lengthFrame(values: readonly string[]): Buffer {
  const chunks: Buffer[] = [];
  for (const value of values) {
    const bytes = Buffer.from(value, 'utf8');
    const length = Buffer.allocUnsafe(4);
    length.writeUInt32BE(bytes.byteLength, 0);
    chunks.push(length, bytes);
  }
  return Buffer.concat(chunks);
}

/**
 * Domain-separated protected principal handle shared by every PT4 persistence
 * adapter. Callers remain responsible for their domain-specific validation and
 * error mapping before invoking this primitive.
 */
export function deriveDeletionHandleV1(
  principal: AuthenticatedPrincipalV1,
  secret: VersionedSecretKeyV1,
): string {
  if (!principal.issuer || !principal.subject) throw new TypeError('principal issuer/subject are required');
  if (!/^[A-Za-z0-9._-]{1,32}$/.test(secret.version) || secret.key.byteLength < 32) {
    throw new TypeError('deletion handle key requires a bounded version and at least 256 bits');
  }
  const digest = createHmac('sha256', secret.key)
    .update(DELETION_HANDLE_DOMAIN)
    .update(lengthFrame([principal.issuer, principal.subject]))
    .digest('hex');
  return `dhv1_${secret.version}_${digest}`;
}
