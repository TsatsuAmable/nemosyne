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
    representationFamily?: string;
    worldType?: string;
    layout?: string;
    geometry?: string;
    confidence?: number;
    utilityScore?: number;
    evidence?: Array<{ fact: string; weight: number; supports: boolean; source: string }>;
    rejectedAlternatives?: Array<{ family: string; score: number; reason: string; hardPassed: boolean }>;
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
 * Strictly authentic SHA-256 computation returning a 64-character lowercase hex string.
 * Fails closed with CapabilityError if no genuine cryptographic SHA-256 provider is available.
 */
export async function computeSha256Hex(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;

  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    const hashBuf = await globalThis.crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
    return Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Fallback for Node.js test environment if WebCrypto subtle is absent
  try {
    const nodeCrypto = await import('node:crypto');
    if (nodeCrypto?.createHash) {
      return nodeCrypto.createHash('sha256').update(bytes).digest('hex');
    }
  } catch {
    // node:crypto not available in browser runtime
  }

  throw new Error('CapabilityError: SHA-256 cryptographic digest engine is unavailable in this runtime environment');
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
