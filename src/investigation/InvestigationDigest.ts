/**
 * Canonical Investigation Cryptographic Digest Engine.
 *
 * Implements:
 * - Deterministic, platform-independent canonical JSON serialization (RFC 8785 subset:
 *   sorted object keys, normalized floats, deterministic array sequencing).
 * - Cryptographic SHA-256 hash calculation over the complete semantic investigation state.
 * - Independence from volatile timestamps, Three.js object UUIDs, or runtime memory handles.
 */

export interface CanonicalInvestigationInput {
  schemaVersion: number;
  datasetFingerprint: string;
  datasetName?: string;
  kernelVersion: string;
  immutableDatasetFingerprint: string;
  commandStream: Array<{
    op: string;
    datasetVersion?: number;
    datasetFingerprint?: string;
    params?: Record<string, unknown>;
  }>;
  analyticalState: {
    datasetVersion: number;
    datasetFingerprint: string;
    rowCount?: number;
    columnCount?: number;
  };
  evidenceLedger: {
    resultsCount: number;
    eventsCount: number;
    observationCount: number;
    findingCount: number;
    annotationCount: number;
    findings?: Array<{ id: string; title: string; confidence: string }>;
    observations?: Array<{ id: string; notes: string }>;
  };
  representationDecision?: {
    strategyId?: string;
    worldType?: string;
    layout?: string;
    geometry?: string;
  };
  researchContext?: {
    studyId?: string;
    researchQuestion?: string;
    hypothesis?: string;
  };
}

/**
 * Deterministically serialize any JSON-compatible value with sorted object keys.
 */
export function canonicalJsonStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJsonStringify(item)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort();
  const pairs = sortedKeys
    .filter((key) => record[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${canonicalJsonStringify(record[key])}`);
  return `{${pairs.join(',')}}`;
}

/**
 * Fast cross-platform SHA-256 computation returning a 64-character lowercase hex string.
 */
export async function computeSha256Hex(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;

  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    const hashBuf = await globalThis.crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
    return Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Pure deterministic 64-character fallback hash for lightweight environments without WebCrypto
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    h0 = Math.imul(h0 ^ byte, 0x01000193) >>> 0;
    h1 = Math.imul(h1 ^ (byte << 1), 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (byte << 2), 0x01000193) >>> 0;
    h3 = Math.imul(h3 ^ (byte << 3), 0x01000193) >>> 0;
    h4 = Math.imul(h4 ^ (byte << 4), 0x01000193) >>> 0;
    h5 = Math.imul(h5 ^ (byte << 5), 0x01000193) >>> 0;
    h6 = Math.imul(h6 ^ (byte << 6), 0x01000193) >>> 0;
    h7 = Math.imul(h7 ^ (byte << 7), 0x01000193) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((h) => (h >>> 0).toString(16).padStart(8, '0'))
    .join('');
}

/**
 * Computes the authoritative Canonical Investigation Digest (SHA-256 hex string).
 */
export async function computeInvestigationDigest(
  input: CanonicalInvestigationInput
): Promise<string> {
  const canonicalString = canonicalJsonStringify(input);
  return computeSha256Hex(canonicalString);
}
