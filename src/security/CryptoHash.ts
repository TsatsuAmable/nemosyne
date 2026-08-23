import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

/** Deterministic JSON serialization with recursively sorted object keys. */
export function canonicalJsonStringify(value: unknown, seen = new WeakSet<object>()): string {
  if (value === undefined || value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 'null';
    return Object.is(value, -0) ? '0' : JSON.stringify(value);
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'bigint' || typeof value === 'symbol' || typeof value === 'function') {
    throw new TypeError(`Cannot canonically serialize value of type ${typeof value}`);
  }
  if (typeof value === 'object') {
    if (seen.has(value)) throw new TypeError('Cannot canonically serialize cyclical object structure');
    seen.add(value);
    try {
      if (Array.isArray(value)) {
        return `[${value.map((entry) => canonicalJsonStringify(entry, seen)).join(',')}]`;
      }
      const record = value as Record<string, unknown>;
      const pairs = Object.keys(record)
        .sort()
        .filter((key) => record[key] !== undefined && typeof record[key] !== 'function' && typeof record[key] !== 'symbol')
        .map((key) => `${JSON.stringify(key)}:${canonicalJsonStringify(record[key], seen)}`);
      return `{${pairs.join(',')}}`;
    } finally {
      seen.delete(value);
    }
  }
  return JSON.stringify(value);
}

/** Audited synchronous SHA-256 for browser and Node runtimes. */
export function sha256Hex(data: string | Uint8Array): string {
  const bytes = typeof data === 'string' ? utf8ToBytes(data) : data;
  return bytesToHex(sha256(bytes));
}

/** Content-address a JSON-compatible value with canonical SHA-256. */
export function canonicalSha256Hex(value: unknown): string {
  return sha256Hex(canonicalJsonStringify(value));
}

/**
 * Deterministic pseudo-random unit value derived from SHA-256.
 * Uses 48 digest bits so conversion remains exact in IEEE-754 Number.
 */
export function sha256UnitInterval(key: string): number {
  const digest = sha256(utf8ToBytes(key));
  let value = 0;
  for (let i = 0; i < 6; i += 1) value = value * 256 + digest[i];
  return value / 0x1_0000_0000_0000;
}

/** Stable non-negative 31-bit identifier derived from SHA-256. */
export function sha256Uint31(key: string): number {
  const digest = sha256(utf8ToBytes(key));
  const value = (((digest[0] << 24) | (digest[1] << 16) | (digest[2] << 8) | digest[3]) >>> 0) & 0x7fffffff;
  return value;
}
