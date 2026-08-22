/**
 * Canonical Investigation Cryptographic Digest Engine.
 *
 * Investigation hashing delegates to the shared audited SHA-256 substrate so
 * provenance, study, model-registry, and investigation hashes cannot drift into
 * independent implementations.
 */

import { canonicalJsonStringify, sha256Hex } from '../security/CryptoHash.ts';
import type { DiscoveryEpisode } from './DiscoveryEpisode.ts';

export { canonicalJsonStringify } from '../security/CryptoHash.ts';

/** Retained for API compatibility with earlier capability-based implementations. */
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
 * Compatibility async wrapper around the shared synchronous audited SHA-256.
 * Existing callers can continue awaiting this function without browser/Node
 * capability branching.
 */
export async function computeSha256Hex(data: string | Uint8Array): Promise<string> {
  return sha256Hex(data);
}

export async function computeInvestigationDigest(input: CanonicalInvestigationInput): Promise<string> {
  return sha256Hex(canonicalJsonStringify(input));
}
