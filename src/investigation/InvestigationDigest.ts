/**
 * Canonical Investigation Cryptographic Digest Engine.
 *
 * Implements:
 * - Deterministic, platform-independent canonical JSON serialization (RFC 8785 subset:
 *   sorted object keys, normalized numbers, deterministic array sequencing).
 * - Cryptographic SHA-256 hash calculation over the complete semantic investigation state.
 * - Independence from volatile timestamps, Three.js object UUIDs, or runtime memory handles.
 */

import type { DiscoveryEpisode } from './DiscoveryEpisode.ts';

export class CapabilityError extends Error {
  readonly code: string;

  constructor(message: string, code = 'CAPABILITY_UNAVAILABLE') {
    super(message);
    this.name = 'CapabilityError';
    this.code = code;
    Object.setPrototypeOf(this, CapabilityError.prototype);
  }
}

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
  discoveryEpisodes?: readonly DiscoveryEpisode[];
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
 * Array elements that are undefined are converted to null (RFC 8259/8785 compliance).
 */
export function canonicalJsonStringify(value: unknown, seen = new WeakSet<object>()): string {
  if (value === undefined) {
    return 'null';
  }

  if (value === null) {
    return 'null';
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError(`Cannot canonically serialize non-finite number: ${value}`);
    }
    // Normalize -0 to 0
    if (Object.is(value, -0)) {
      return '0';
    }
    return JSON.stringify(value);
  }

  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (typeof value === 'bigint' || typeof value === 'symbol' || typeof value === 'function') {
    throw new TypeError(`Cannot canonically serialize value of type ${typeof value}`);
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      throw new TypeError('Cannot canonically serialize cyclical object structure');
    }
    seen.add(value);

    try {
      if (Array.isArray(value)) {
        const elements = value.map((item) => (item === undefined ? 'null' : canonicalJsonStringify(item, seen)));
        return `[${elements.join(',')}]`;
      }

      const record = value as Record<string, unknown>;
      const sortedKeys = Object.keys(record).sort();
      const pairs: string[] = [];

      for (const key of sortedKeys) {
        const val = record[key];
        if (val !== undefined && typeof val !== 'function' && typeof val !== 'symbol') {
          pairs.push(`${JSON.stringify(key)}:${canonicalJsonStringify(val, seen)}`);
        }
      }

      return `{${pairs.join(',')}}`;
    } finally {
      seen.delete(value);
    }
  }

  return JSON.stringify(value);
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

  throw new CapabilityError('SHA-256 cryptographic digest engine is unavailable in this runtime environment');
}

/**
 * Computes the canonical investigation digest from a structured input payload.
 */
export async function computeInvestigationDigest(input: CanonicalInvestigationInput): Promise<string> {
  const canonicalJson = canonicalJsonStringify(input);
  return computeSha256Hex(canonicalJson);
}
