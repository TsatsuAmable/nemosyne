import { sha256Hex } from '../../security/CryptoHash.ts';
import type { SemanticEmbodimentEnvelopeV1 } from './SemanticEmbodimentPayload.ts';
import {
  DIRECT_EMPIRICAL_DISTRIBUTION_REQUIREMENT_PROFILE_V1,
} from '../../data/evidence/EvidenceRequirementProfile.ts';
import type { DistributionEmbodimentRequestV1 } from './SemanticEmbodimentPayload.ts';

export const DIRECT_DISTRIBUTION_CONSUMER_ID_V1 =
  'nemosyne:consumer/direct-distribution/v1' as const;

/**
 * Rust single-pass evidence binding, NOT a general V3 statistics receipt or
 * an authorized persisted replay use. Parsing serialized JSON cannot grant a
 * live kernel capability. Only the runtime bridge may assert its provenance.
 */
export interface DirectDistributionBindingV1 {
  readonly schemaVersion: '1';
  readonly consumerId: typeof DIRECT_DISTRIBUTION_CONSUMER_ID_V1;
  readonly requirementProfileId: typeof DIRECT_EMPIRICAL_DISTRIBUTION_REQUIREMENT_PROFILE_V1.profileId;
  readonly claimKind: 'DESCRIPTIVE_EMPIRICAL_DISTRIBUTION';
  readonly datasetFingerprint: string;
  readonly kernelVersion: string;
  readonly sourceDigest: string;
  /** Exact Rust source JSON bytes hashed into the digest. */
  readonly sourceJson: string;
  readonly receiptId: string;
  readonly source: SemanticEmbodimentEnvelopeV1;
}

function requestRecord(request: DistributionEmbodimentRequestV1): Record<string, unknown> {
  return {
    schemaVersion: request.schemaVersion,
    candidateId: request.candidateId,
    measureField: request.measureField,
    histogramBinCount: request.histogramBinCount,
    ecdfKnotCount: request.ecdfKnotCount,
    quantileProbabilities: [...request.quantileProbabilities],
    ...(request.decisionId === undefined ? {} : { decisionId: request.decisionId }),
    ...(request.decisionModelVersion === undefined
      ? {}
      : { decisionModelVersion: request.decisionModelVersion }),
    ...(request.decisionModelArtifactHash === undefined
      ? {}
      : { decisionModelArtifactHash: request.decisionModelArtifactHash }),
  };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * Verify that the kernel source was minted for this exact distribution
 * request. Source integrity alone is insufficient when two requests can
 * produce identical empirical geometry (for example, bounded counts on a
 * constant-valued column).
 */
export function verifyDirectDistributionBindingRequestV1(
  binding: DirectDistributionBindingV1,
  request: DistributionEmbodimentRequestV1,
): DirectDistributionBindingV1 {
  const parameters = binding.source.analyticalMethod?.parameters;
  if (parameters === null || typeof parameters !== 'object' || Array.isArray(parameters)) {
    throw new Error('[DirectDistributionBinding] Source request binding missing');
  }
  const sourceRequest = (parameters as Record<string, unknown>).request;
  if (sourceRequest === null || typeof sourceRequest !== 'object' || Array.isArray(sourceRequest)) {
    throw new Error('[DirectDistributionBinding] Source request binding missing');
  }
  if (stableJson(sourceRequest) !== stableJson(requestRecord(request))) {
    throw new Error('[DirectDistributionBinding] Source request does not match requested distribution');
  }
  return binding;
}

export function parseDirectDistributionBindingV1(
  raw: unknown,
  live: { readonly datasetFingerprint: string; readonly kernelVersion: string },
): DirectDistributionBindingV1 {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('[DirectDistributionBinding] Rust response missing');
  }
  const object = raw as Record<string, unknown>;
  const required = [
    'schemaVersion', 'consumerId', 'requirementProfileId', 'claimKind',
    'datasetFingerprint', 'kernelVersion', 'sourceJson', 'sourceDigest', 'receiptId',
  ];
  if (Object.keys(object).length !== required.length || required.some((key) => !(key in object))) {
    throw new Error('[DirectDistributionBinding] Unsupported Rust binding shape');
  }
  if (
    object.schemaVersion !== '1' ||
    object.consumerId !== DIRECT_DISTRIBUTION_CONSUMER_ID_V1 ||
    object.requirementProfileId !== DIRECT_EMPIRICAL_DISTRIBUTION_REQUIREMENT_PROFILE_V1.profileId ||
    object.claimKind !== 'DESCRIPTIVE_EMPIRICAL_DISTRIBUTION'
  ) {
    throw new Error('[DirectDistributionBinding] Consumer/profile/claim authority mismatch');
  }
  if (!live.datasetFingerprint || !live.kernelVersion ||
      object.datasetFingerprint !== live.datasetFingerprint ||
      object.kernelVersion !== live.kernelVersion) {
    throw new Error('[DirectDistributionBinding] Live analytical identity mismatch');
  }
  if (typeof object.sourceJson !== 'string' ||
      typeof object.sourceDigest !== 'string' ||
      object.sourceDigest !== sha256Hex(object.sourceJson) ||
      object.receiptId !== `direct-distribution:${object.sourceDigest}`) {
    throw new Error('[DirectDistributionBinding] Source content binding mismatch');
  }

  const source = JSON.parse(object.sourceJson) as SemanticEmbodimentEnvelopeV1;
  if (
    source.schemaVersion !== 1 || source.candidateId !== 'DISTRIBUTION_FIELD' ||
    source.representationFamily !== 'DISTRIBUTION' ||
    source.analyticalMethod?.name !== 'univariate-empirical-distribution' ||
    source.datasetFingerprint !== live.datasetFingerprint ||
    source.provenance?.kernelVersion !== live.kernelVersion ||
    source.result?.status !== 'READY' ||
    source.result.payload.kind !== 'EMPIRICAL_DISTRIBUTION' ||
    !Number.isSafeInteger(source.approximation?.representedRowCount) ||
    source.approximation.representedRowCount <= 0
  ) {
    throw new Error('[DirectDistributionBinding] Source not a ready Rust distribution');
  }

  return Object.freeze({
    schemaVersion: '1',
    consumerId: DIRECT_DISTRIBUTION_CONSUMER_ID_V1,
    requirementProfileId: DIRECT_EMPIRICAL_DISTRIBUTION_REQUIREMENT_PROFILE_V1.profileId,
    claimKind: 'DESCRIPTIVE_EMPIRICAL_DISTRIBUTION',
    datasetFingerprint: live.datasetFingerprint,
    kernelVersion: live.kernelVersion,
    sourceDigest: object.sourceDigest,
    sourceJson: object.sourceJson,
    receiptId: object.receiptId as string,
    source,
  });
}

/** Validate worker transport without silently trusting TypeScript casting.
 * Integrity hashes do not prove origin: only the Worker-owned Rust producer
 * can issue this record; transport may only verify and refuse it.
 */
export function verifyTransportedDirectDistributionBindingV1(
  raw: unknown,
  live: { readonly datasetFingerprint: string; readonly kernelVersion: string },
  request?: DistributionEmbodimentRequestV1,
): DirectDistributionBindingV1 {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('[DirectDistributionBinding] Transported binding missing');
  }
  const value = raw as Record<string, unknown>;
  if (Object.keys(value).length !== 10 || !('source' in value)) {
    throw new Error('[DirectDistributionBinding] Transported binding shape invalid');
  }
  const validated = parseDirectDistributionBindingV1({
    schemaVersion: value.schemaVersion,
    consumerId: value.consumerId,
    requirementProfileId: value.requirementProfileId,
    claimKind: value.claimKind,
    datasetFingerprint: value.datasetFingerprint,
    kernelVersion: value.kernelVersion,
    sourceJson: value.sourceJson,
    sourceDigest: value.sourceDigest,
    receiptId: value.receiptId,
  }, live);
  if (JSON.stringify(validated.source) !== JSON.stringify(value.source)) {
    throw new Error('[DirectDistributionBinding] Transported source differs from kernel bytes');
  }
  return request === undefined
    ? validated
    : verifyDirectDistributionBindingRequestV1(validated, request);
}
