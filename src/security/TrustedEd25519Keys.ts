export const ED25519_SIGNATURE_ALGORITHM = 'Ed25519' as const;
export const ED25519_SIGNATURE_HEX = /^[0-9a-f]{128}$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;
const TRUSTED_KEY_ID = /^[A-Za-z0-9][A-Za-z0-9._:+-]{0,159}$/;

export type TrustedEd25519KeyStatus = 'ACTIVE' | 'RETIRED';

export interface TrustedEd25519KeyV1 {
  readonly keyId: string;
  readonly status: TrustedEd25519KeyStatus;
  readonly publicKey: CryptoKey;
}

export type TrustedEd25519VerificationStatus =
  | 'VERIFIED'
  | 'INVALID_SIGNATURE'
  | 'UNKNOWN_KEY'
  | 'RETIRED_KEY';

function assertDigest(value: string): void {
  if (!SHA256_HEX.test(value)) throw new TypeError('Ed25519 signed digest must be lower-case SHA-256 hex');
}

function assertPublicKey(key: CryptoKey): void {
  if (
    !key ||
    key.type !== 'public' ||
    key.algorithm.name !== ED25519_SIGNATURE_ALGORITHM ||
    !key.usages.includes('verify')
  ) {
    throw new TypeError('Trusted Ed25519 key must be a public verification key');
  }
}

function signatureHexToArrayBuffer(value: string): ArrayBuffer {
  const buffer = new ArrayBuffer(value.length / 2);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return buffer;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

export async function signEd25519DigestHex(privateKey: CryptoKey, digestHex: string): Promise<string> {
  assertDigest(digestHex);
  const signature = await globalThis.crypto.subtle.sign(
    ED25519_SIGNATURE_ALGORITHM,
    privateKey,
    new TextEncoder().encode(digestHex),
  );
  return bytesToHex(new Uint8Array(signature));
}

export async function verifyEd25519DigestHex(
  publicKey: CryptoKey,
  digestHex: string,
  signatureHex: string,
): Promise<boolean> {
  if (!SHA256_HEX.test(digestHex) || !ED25519_SIGNATURE_HEX.test(signatureHex)) return false;
  try {
    return await globalThis.crypto.subtle.verify(
      ED25519_SIGNATURE_ALGORITHM,
      publicKey,
      signatureHexToArrayBuffer(signatureHex),
      new TextEncoder().encode(digestHex),
    );
  } catch {
    return false;
  }
}

/**
 * Canonical in-memory Ed25519 trust authority shared by signed deployment and
 * scientific-certificate verification. Callers can request verification but
 * cannot obtain or replace a key through the verification path.
 */
export class TrustedEd25519KeyRegistryV1 {
  private readonly keys = new Map<string, TrustedEd25519KeyV1>();

  constructor(entries: readonly TrustedEd25519KeyV1[]) {
    for (const entry of entries) {
      if (!TRUSTED_KEY_ID.test(entry.keyId) || !['ACTIVE', 'RETIRED'].includes(entry.status)) {
        throw new TypeError('Trusted Ed25519 key identity or lifecycle status is invalid');
      }
      assertPublicKey(entry.publicKey);
      if (this.keys.has(entry.keyId)) throw new TypeError(`Duplicate trusted Ed25519 key id: ${entry.keyId}`);
      this.keys.set(entry.keyId, { ...entry });
    }
  }

  status(keyId: string): TrustedEd25519KeyStatus | null {
    return this.keys.get(keyId)?.status ?? null;
  }

  async verify(keyId: string, digestHex: string, signatureHex: string): Promise<TrustedEd25519VerificationStatus> {
    const entry = this.keys.get(keyId);
    if (!entry) return 'UNKNOWN_KEY';
    if (entry.status !== 'ACTIVE') return 'RETIRED_KEY';
    return await verifyEd25519DigestHex(entry.publicKey, digestHex, signatureHex)
      ? 'VERIFIED'
      : 'INVALID_SIGNATURE';
  }
}
