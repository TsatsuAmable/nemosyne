import { sha256Hex } from '../../security/CryptoHash.ts';
import {
  DIRECT_DISTRIBUTION_CONSUMER_ID_V1,
  parseDirectDistributionBindingV1,
  verifyDirectDistributionBindingRequestV1,
  type DirectDistributionBindingV1,
} from './DirectDistributionBindingV1.ts';
import {
  DIRECT_EMPIRICAL_DISTRIBUTION_REQUIREMENT_PROFILE_V1,
} from '../../data/evidence/EvidenceRequirementProfile.ts';
import type { DistributionEmbodimentRequestV1 } from './SemanticEmbodimentPayload.ts';

export const DIRECT_DISTRIBUTION_REPLAY_SCHEMA_VERSION = '1' as const;
export const DIRECT_DISTRIBUTION_REPLAY_POLICY_ID =
  'direct-empirical-distribution-replay/v1' as const;

export interface DirectDistributionUseV1 {
  readonly consumerId: typeof DIRECT_DISTRIBUTION_CONSUMER_ID_V1;
  readonly receiptId: string;
  readonly requirementProfileId: typeof DIRECT_EMPIRICAL_DISTRIBUTION_REQUIREMENT_PROFILE_V1.profileId;
}

/**
 * Governed persisted direct-use carrier. The binding remains Rust-issued;
 * this record only preserves its exact source bytes, the exact request that
 * produced them, and a closed use declaration for replay admission.
 */
export interface DirectDistributionReplayCarrierV1 {
  readonly schemaVersion: typeof DIRECT_DISTRIBUTION_REPLAY_SCHEMA_VERSION;
  readonly policyId: typeof DIRECT_DISTRIBUTION_REPLAY_POLICY_ID;
  readonly binding: DirectDistributionBindingV1;
  readonly use: DirectDistributionUseV1;
  readonly request: DistributionEmbodimentRequestV1;
}

type WireBinding = Omit<DirectDistributionBindingV1, 'source'>;
type WireCarrier = {
  schemaVersion: typeof DIRECT_DISTRIBUTION_REPLAY_SCHEMA_VERSION;
  policyId: typeof DIRECT_DISTRIBUTION_REPLAY_POLICY_ID;
  binding: WireBinding;
  use: DirectDistributionUseV1;
  request: DistributionEmbodimentRequestV1;
};

function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`[DirectDistributionReplay] ${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function closedRecord(
  value: unknown,
  keys: readonly string[],
  label: string,
): Record<string, unknown> {
  const object = record(value, label);
  const actual = Object.keys(object);
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) {
    throw new Error(`[DirectDistributionReplay] ${label} has unsupported shape`);
  }
  return object;
}

function stringIdentity(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`[DirectDistributionReplay] ${label} must be a non-empty string`);
  }
  return value;
}

function parseRequest(value: unknown): DistributionEmbodimentRequestV1 {
  const object = record(value, 'request');
  const histogramBinCount = object.histogramBinCount;
  const ecdfKnotCount = object.ecdfKnotCount;
  const quantileProbabilities = object.quantileProbabilities;
  const allowed = [
    'schemaVersion', 'candidateId', 'measureField', 'histogramBinCount',
    'ecdfKnotCount', 'quantileProbabilities', 'decisionId',
    'decisionModelVersion', 'decisionModelArtifactHash',
  ];
  const actual = Object.keys(object);
  if (actual.some((key) => !allowed.includes(key))) {
    throw new Error('[DirectDistributionReplay] request has unsupported fields');
  }
  for (const field of ['decisionId', 'decisionModelVersion', 'decisionModelArtifactHash'] as const) {
    if (actual.includes(field) && typeof object[field] !== 'string') {
      throw new Error(`[DirectDistributionReplay] request.${field} must be a string when present`);
    }
  }
  if (
    object.schemaVersion !== 1 ||
    object.candidateId !== 'DISTRIBUTION_FIELD' ||
    typeof object.measureField !== 'string' ||
    object.measureField.length === 0 ||
    !Number.isSafeInteger(histogramBinCount) ||
    (histogramBinCount as number) <= 0 ||
    (histogramBinCount as number) > 256 ||
    !Number.isSafeInteger(ecdfKnotCount) ||
    (ecdfKnotCount as number) <= 0 ||
    (ecdfKnotCount as number) > 256 ||
    !Array.isArray(quantileProbabilities) ||
    quantileProbabilities.length === 0 ||
    quantileProbabilities.length > 32 ||
    quantileProbabilities.some(
      (probability) => typeof probability !== 'number' || !Number.isFinite(probability) || probability < 0 || probability > 1,
    )
  ) {
    throw new Error('[DirectDistributionReplay] request is not a bounded distribution request');
  }
  const boundedQuantileProbabilities = quantileProbabilities as number[];
  return Object.freeze({
    schemaVersion: 1,
    candidateId: 'DISTRIBUTION_FIELD',
    measureField: object.measureField,
    histogramBinCount: histogramBinCount as number,
    ecdfKnotCount: ecdfKnotCount as number,
    quantileProbabilities: [...boundedQuantileProbabilities],
    ...(actual.includes('decisionId') ? { decisionId: object.decisionId as string } : {}),
    ...(actual.includes('decisionModelVersion') ? { decisionModelVersion: object.decisionModelVersion as string } : {}),
    ...(actual.includes('decisionModelArtifactHash') ? { decisionModelArtifactHash: object.decisionModelArtifactHash as string } : {}),
  });
}

function wireBinding(binding: DirectDistributionBindingV1): WireBinding {
  return {
    schemaVersion: binding.schemaVersion,
    consumerId: binding.consumerId,
    requirementProfileId: binding.requirementProfileId,
    claimKind: binding.claimKind,
    datasetFingerprint: binding.datasetFingerprint,
    kernelVersion: binding.kernelVersion,
    sourceJson: binding.sourceJson,
    sourceDigest: binding.sourceDigest,
    receiptId: binding.receiptId,
  };
}

function parseUse(value: unknown, binding: DirectDistributionBindingV1): DirectDistributionUseV1 {
  const use = closedRecord(value, ['consumerId', 'receiptId', 'requirementProfileId'], 'use');
  if (
    use.consumerId !== binding.consumerId ||
    use.receiptId !== binding.receiptId ||
    use.requirementProfileId !== binding.requirementProfileId
  ) {
    throw new Error('[DirectDistributionReplay] use does not correspond to binding');
  }
  if (use.consumerId !== DIRECT_DISTRIBUTION_CONSUMER_ID_V1) {
    throw new Error('[DirectDistributionReplay] use consumer is not governed');
  }
  if (use.requirementProfileId !== DIRECT_EMPIRICAL_DISTRIBUTION_REQUIREMENT_PROFILE_V1.profileId) {
    throw new Error('[DirectDistributionReplay] use profile is not governed');
  }
  return Object.freeze({
    consumerId: use.consumerId as typeof DIRECT_DISTRIBUTION_CONSUMER_ID_V1,
    receiptId: stringIdentity(use.receiptId, 'use.receiptId'),
    requirementProfileId: use.requirementProfileId as typeof DIRECT_EMPIRICAL_DISTRIBUTION_REQUIREMENT_PROFILE_V1.profileId,
  });
}

function expectedIdentity(
  value: unknown,
  label: string,
): { datasetFingerprint: string; kernelVersion: string } {
  const object = record(value, label);
  return {
    datasetFingerprint: stringIdentity(object.datasetFingerprint, `${label}.datasetFingerprint`),
    kernelVersion: stringIdentity(object.kernelVersion, `${label}.kernelVersion`),
  };
}

export function createDirectDistributionReplayCarrierV1(
  binding: DirectDistributionBindingV1,
  request: DistributionEmbodimentRequestV1,
  live: { readonly datasetFingerprint: string; readonly kernelVersion: string | null },
): DirectDistributionReplayCarrierV1 {
  const kernelVersion = live.kernelVersion;
  if (!kernelVersion) throw new Error('[DirectDistributionReplay] live kernel identity unavailable');
  const validated = parseDirectDistributionBindingV1(wireBinding(binding), {
    datasetFingerprint: live.datasetFingerprint,
    kernelVersion,
  });
  const parsedRequest = parseRequest(request);
  verifyDirectDistributionBindingRequestV1(validated, parsedRequest);
  const use: DirectDistributionUseV1 = Object.freeze({
    consumerId: validated.consumerId,
    receiptId: validated.receiptId,
    requirementProfileId: validated.requirementProfileId,
  });
  return Object.freeze({
    schemaVersion: DIRECT_DISTRIBUTION_REPLAY_SCHEMA_VERSION,
    policyId: DIRECT_DISTRIBUTION_REPLAY_POLICY_ID,
    binding: validated,
    use,
    request: parsedRequest,
  });
}

export function parseDirectDistributionReplayCarrierV1(
  value: unknown,
  expected?: { readonly datasetFingerprint: string; readonly kernelVersion: string | null },
): DirectDistributionReplayCarrierV1 {
  const outer = closedRecord(value, ['schemaVersion', 'policyId', 'binding', 'use', 'request'], 'carrier');
  if (
    outer.schemaVersion !== DIRECT_DISTRIBUTION_REPLAY_SCHEMA_VERSION ||
    outer.policyId !== DIRECT_DISTRIBUTION_REPLAY_POLICY_ID
  ) {
    throw new Error('[DirectDistributionReplay] unsupported carrier policy');
  }
  const rawBinding = closedRecord(
    outer.binding,
    ['schemaVersion', 'consumerId', 'requirementProfileId', 'claimKind', 'datasetFingerprint', 'kernelVersion', 'sourceJson', 'sourceDigest', 'receiptId'],
    'binding',
  );
  const claimed = expectedIdentity(rawBinding, 'binding');
  const replayIdentity = expected
    ? {
        datasetFingerprint: stringIdentity(expected.datasetFingerprint, 'expected.datasetFingerprint'),
        kernelVersion: stringIdentity(expected.kernelVersion, 'expected.kernelVersion'),
      }
    : claimed;
  const binding = parseDirectDistributionBindingV1(rawBinding, replayIdentity);
  if (expected && (binding.datasetFingerprint !== replayIdentity.datasetFingerprint || binding.kernelVersion !== replayIdentity.kernelVersion)) {
    throw new Error('[DirectDistributionReplay] carrier identity does not match expected identity');
  }
  const use = parseUse(outer.use, binding);
  const request = parseRequest(outer.request);
  verifyDirectDistributionBindingRequestV1(binding, request);
  return Object.freeze({
    schemaVersion: DIRECT_DISTRIBUTION_REPLAY_SCHEMA_VERSION,
    policyId: DIRECT_DISTRIBUTION_REPLAY_POLICY_ID,
    binding,
    use,
    request,
  });
}

export function serializeDirectDistributionReplayCarrierV1(
  carrier: DirectDistributionReplayCarrierV1,
): Uint8Array {
  const parsed = parseDirectDistributionReplayCarrierV1({
    schemaVersion: carrier.schemaVersion,
    policyId: carrier.policyId,
    binding: wireBinding(carrier.binding),
    use: carrier.use,
    request: carrier.request,
  });
  return new TextEncoder().encode(JSON.stringify({
    schemaVersion: parsed.schemaVersion,
    policyId: parsed.policyId,
    binding: wireBinding(parsed.binding),
    use: parsed.use,
    request: parsed.request,
  } satisfies WireCarrier));
}

export function directDistributionBindingsEqualV1(
  expected: DirectDistributionBindingV1,
  actual: DirectDistributionBindingV1,
): boolean {
  return (
    expected.schemaVersion === actual.schemaVersion &&
    expected.consumerId === actual.consumerId &&
    expected.requirementProfileId === actual.requirementProfileId &&
    expected.claimKind === actual.claimKind &&
    expected.datasetFingerprint === actual.datasetFingerprint &&
    expected.kernelVersion === actual.kernelVersion &&
    expected.sourceJson === actual.sourceJson &&
    expected.sourceDigest === actual.sourceDigest &&
    expected.receiptId === actual.receiptId &&
    expected.sourceDigest === sha256Hex(expected.sourceJson)
  );
}
