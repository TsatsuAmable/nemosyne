/**
 * Canonical Investigation Cryptographic Digest Engine.
 *
 * Investigation hashing delegates to the shared audited SHA-256 substrate so
 * provenance, study, model-registry, and investigation hashes cannot drift into
 * independent implementations.
 *
 * RF-046 distinguishes two contracts:
 * - schema v1: the historical lossy projection, retained only for replaying
 *   already-exported packages whose manifest has no digest-algorithm label;
 * - schema v2: a semantic Merkle-style projection. Meaning-bearing portable
 *   entities are individually hashed and composed into one deterministic root.
 *   Governed capture metadata is normalized out so clean-room replay can
 *   reproduce the same scientific commitment without reproducing wall-clock
 *   timing.
 */

import { canonicalJsonStringify, sha256Hex } from '../security/CryptoHash.ts';
import type { DiscoveryEpisode } from './DiscoveryEpisode.ts';

export { canonicalJsonStringify } from '../security/CryptoHash.ts';

export const LEGACY_INVESTIGATION_DIGEST_SCHEMA_VERSION = 1 as const;
export const INVESTIGATION_DIGEST_SCHEMA_VERSION = 2 as const;
export const INVESTIGATION_DIGEST_ALGORITHM = 'sha256-canonical-investigation-v2' as const;

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

/** Historical RF-048-era digest input. Do not use for new portable packages. */
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
    candidateId?: string;
    worldType?: string;
    layout?: string;
    geometry?: string;
    confidence?: number;
    utilityScore?: number;
    decisionStatus?: string;
    decisionMargin?: number | null;
    fitnessModelVersion?: string;
    /** Exact immutable learned model artifact used to produce the representation. */
    fitnessModelArtifactHash?: string | null;
    explanation?: string;
    preserves?: readonly string[];
    loses?: readonly string[];
    runnerUp?: {
      candidateId?: string;
      family?: string;
      layout?: string;
      score: number;
    } | null;
    rankedAlternatives?: Array<{
      candidateId?: string;
      family: string;
      layout: string;
      score: number;
      disqualified?: boolean;
    }>;
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
 * Raw portable semantic state from which a v2 digest root is built. Arrays may
 * contain full persisted entities: the root stores only their SHA-256 hashes.
 * Non-portable in-memory state is deliberately excluded until a later schema
 * version can persist and replay it authoritatively.
 */
export interface SemanticInvestigationState {
  datasetFingerprint: string;
  immutableDatasetFingerprint: string;
  kernelVersion: string;
  analyticalState: {
    datasetVersion: number;
    datasetFingerprint: string;
    rowCount?: number;
    columnCount?: number;
  };
  eventLedger: readonly unknown[];
  analysisResults: readonly unknown[];
  structures?: readonly unknown[];
  observations: readonly unknown[];
  findings: readonly unknown[];
  annotations: readonly unknown[];
  representationState?: unknown;
  discoveryEpisodes?: readonly unknown[];
  nilOutcomes?: readonly unknown[];
  researchContext?: unknown;
}

/** Compact, versioned root committed by the v2 digest. */
export interface CanonicalInvestigationInputV2 {
  schemaVersion: typeof INVESTIGATION_DIGEST_SCHEMA_VERSION;
  algorithm: typeof INVESTIGATION_DIGEST_ALGORITHM;
  datasetFingerprint: string;
  immutableDatasetFingerprint: string;
  kernelVersion: string;
  analyticalState: SemanticInvestigationState['analyticalState'];
  eventHashes: string[];
  resultHashes: string[];
  structureHashes: string[];
  observationHashes: string[];
  findingHashes: string[];
  annotationHashes: string[];
  representationStateHash?: string;
  discoveryEpisodeHashes: string[];
  nilOutcomeHashes: string[];
  researchContextHash?: string;
}

/**
 * Only these fields are normalized at the root of a persisted entity. They are
 * capture/allocation metadata regenerated during replay, not scientific facts.
 * Crucially, a nested command or parameter named `timestamp` remains committed.
 */
const ROOT_CAPTURE_METADATA_KEYS = new Set([
  'timestamp',
  'generatedAt',
  'recordedAt',
  'createdAt',
  'savedAt',
  'sessionId',
  'eventId',
  'decisionTimestamp',
]);

/** Known provenance clock fields are also regenerated by authoritative replay. */
const PROVENANCE_CAPTURE_METADATA_KEYS = new Set(['timestamp', 'generatedAt']);

/** Entity payloads embedded inside ResearchEvents duplicate their persisted entities. */
const EMBEDDED_ENTITY_KEYS = new Set(['observationEntity', 'findingEntity', 'annotationEntity']);

function normalizeSemanticValue(
  value: unknown,
  depth: number,
  parentKey: string | null,
): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeSemanticValue(entry, depth + 1, parentKey));
  }

  const record = value as Record<string, unknown>;
  const normalized: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    const isRootCaptureMetadata = depth === 0 && ROOT_CAPTURE_METADATA_KEYS.has(key);
    const isProvenanceCaptureMetadata =
      parentKey === 'provenance' && PROVENANCE_CAPTURE_METADATA_KEYS.has(key);
    const isEmbeddedEntityCaptureMetadata =
      parentKey !== null && EMBEDDED_ENTITY_KEYS.has(parentKey) && key === 'timestamp';
    if (isRootCaptureMetadata || isProvenanceCaptureMetadata || isEmbeddedEntityCaptureMetadata) {
      continue;
    }
    const child = record[key];
    if (child === undefined) continue;
    normalized[key] = normalizeSemanticValue(child, depth + 1, key);
  }
  return normalized;
}

/**
 * Normalize only governed replay-volatile metadata. This is intentionally
 * context-aware rather than a global key-name filter: operation parameters and
 * other nested semantic objects keep every field, including a field literally
 * named `timestamp`.
 */
export function semanticDigestValue(value: unknown): unknown {
  return normalizeSemanticValue(value, 0, null);
}

export function semanticEntityHash(value: unknown): string {
  return sha256Hex(canonicalJsonStringify(semanticDigestValue(value)));
}

function hashList(values: readonly unknown[] | undefined): string[] {
  return (values ?? []).map((value) => semanticEntityHash(value));
}

/** Build the documented v2 semantic root from full persisted investigation state. */
export function buildCanonicalInvestigationInputV2(
  state: SemanticInvestigationState,
): CanonicalInvestigationInputV2 {
  return {
    schemaVersion: INVESTIGATION_DIGEST_SCHEMA_VERSION,
    algorithm: INVESTIGATION_DIGEST_ALGORITHM,
    datasetFingerprint: state.datasetFingerprint,
    immutableDatasetFingerprint: state.immutableDatasetFingerprint,
    kernelVersion: state.kernelVersion,
    analyticalState: semanticDigestValue(state.analyticalState) as CanonicalInvestigationInputV2['analyticalState'],
    eventHashes: hashList(state.eventLedger),
    resultHashes: hashList(state.analysisResults),
    structureHashes: hashList(state.structures),
    observationHashes: hashList(state.observations),
    findingHashes: hashList(state.findings),
    annotationHashes: hashList(state.annotations),
    representationStateHash:
      state.representationState === undefined ? undefined : semanticEntityHash(state.representationState),
    discoveryEpisodeHashes: hashList(state.discoveryEpisodes),
    nilOutcomeHashes: hashList(state.nilOutcomes),
    researchContextHash:
      state.researchContext === undefined ? undefined : semanticEntityHash(state.researchContext),
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

export async function computeInvestigationDigest(
  input: CanonicalInvestigationInput | CanonicalInvestigationInputV2,
): Promise<string> {
  return sha256Hex(canonicalJsonStringify(input));
}

export async function computeSemanticInvestigationDigest(
  state: SemanticInvestigationState,
): Promise<string> {
  return computeInvestigationDigest(buildCanonicalInvestigationInputV2(state));
}
