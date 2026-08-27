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
 * Streaming canonical SHA-256 for large dataset fingerprints.
 * Computes the canonical SHA-256 by writing the canonical JSON to a stream
 * and hashing the complete stream without materializing the full string.
 * Produces the EXACT same hash as canonicalSha256Hex.
 */
export async function canonicalSha256HexStreaming(
  writePrefix: (writer: { write(chunk: string): void; end(): void }) => void,
  writeRows: (writer: { write(chunk: string): void; end(): void }, startIndex: number, endIndex: number) => Promise<void>,
  writeSuffix: (writer: { write(chunk: string): void; end(): void }) => void,
  rowCount: number,
  chunkSize = 10000
): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle || !crypto.subtle.digest) {
    throw new Error('Web Crypto API not available for streaming hash');
  }

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  const writable = {
    write(chunk: string) {
      const bytes = encoder.encode(chunk);
      chunks.push(bytes);
      totalLength += bytes.length;
    },
    end() {}
  };

  // Write prefix
  writePrefix(writable);

  // Write rows in chunks
  for (let start = 0; start < rowCount; start += chunkSize) {
    const end = Math.min(start + chunkSize, rowCount);
    await writeRows(writable, start, end);
  }

  // Write suffix
  writeSuffix(writable);

  // Concatenate all chunks and hash
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
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
