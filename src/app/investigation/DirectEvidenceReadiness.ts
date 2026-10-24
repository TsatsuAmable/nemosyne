import type { GovernedEvidenceReceiptSnapshotV1 } from '../../atlas/MonetaEvidenceAuthority.ts';
import type { SemanticEmbodimentEnvelopeV1 } from '../../moneta/representation/SemanticEmbodimentPayload.ts';

/**
 * FM2 dependency probe. It does NOT grant evidence admission. Current V1
 * governed use policy only attests the descriptive-statistics consumer.
 * A semantic envelope and statistics receipt bundle sharing a dataset do NOT
 * prove that the receipts support the semantic method or its payload.
 */
export type DirectEvidenceReadinessV1 =
  | { readonly status: 'REFUSED'; readonly code: 'SOURCE_UNAVAILABLE' }
  | { readonly status: 'REFUSED'; readonly code: 'KERNEL_SOURCE_REFUSED' }
  | { readonly status: 'REFUSED'; readonly code: 'CAPTURE_UNAVAILABLE' }
  | { readonly status: 'REFUSED'; readonly code: 'IDENTITY_MISMATCH' }
  | { readonly status: 'REFUSED'; readonly code: 'DIRECT_CONSUMER_UNATTESTED' };

const refusal = (code: DirectEvidenceReadinessV1['code']): DirectEvidenceReadinessV1 =>
  ({ status: 'REFUSED', code });

/** The product may carry other envelope families; never cast them into this V1. */
export function isSemanticEnvelopeV1(value: unknown): value is SemanticEmbodimentEnvelopeV1 {
  if (!value || typeof value !== 'object') return false;
  const source = value as Partial<SemanticEmbodimentEnvelopeV1>;
  return source.schemaVersion === 1 && typeof source.datasetFingerprint === 'string' &&
    !!source.provenance && typeof source.provenance.kernelVersion === 'string' &&
    !!source.result && (source.result.status === 'READY' || source.result.status === 'REFUSED') &&
    (source.candidateId === 'DISTRIBUTION_FIELD' ||
      source.candidateId === 'DENSITY_FIELD' || source.candidateId === 'AGGREGATE_VOLUME');
}

export function diagnoseDirectEvidenceReadiness(input: {
  readonly source: SemanticEmbodimentEnvelopeV1 | null | undefined;
  readonly capture: GovernedEvidenceReceiptSnapshotV1 | null | undefined;
  readonly liveDatasetFingerprint: string | null;
  readonly liveKernelVersion: string | null;
}): DirectEvidenceReadinessV1 {
  const { source, capture, liveDatasetFingerprint, liveKernelVersion } = input;
  if (!source) return refusal('SOURCE_UNAVAILABLE');
  if (source.result.status !== 'READY') return refusal('KERNEL_SOURCE_REFUSED');
  if (!capture) return refusal('CAPTURE_UNAVAILABLE');
  if (
    !liveDatasetFingerprint ||
    !liveKernelVersion ||
    source.datasetFingerprint !== liveDatasetFingerprint ||
    source.provenance.kernelVersion !== liveKernelVersion ||
    capture.envelope.bundle.datasetFingerprint !== liveDatasetFingerprint ||
    capture.envelope.bundle.kernelVersion !== liveKernelVersion
  ) return refusal('IDENTITY_MISMATCH');

  // This build has no kernel-attested direct-representation consumer or
  // source-to-receipt claim binder. Even if one appears in later persisted
  // bytes, this *diagnostic* never promotes or compiles from it.
  return refusal('DIRECT_CONSUMER_UNATTESTED');
}

export function directEvidenceReadinessMessage(readiness: DirectEvidenceReadinessV1): string {
  switch (readiness.code) {
    case 'SOURCE_UNAVAILABLE':
      return 'Direct-loop unavailable: no Rust semantic embodiment source from this investigation.';
    case 'KERNEL_SOURCE_REFUSED':
      return 'Direct-loop refused: Rust semantic embodiment did not produce a ready analytical source.';
    case 'CAPTURE_UNAVAILABLE':
      return 'Direct-loop refused: no governed Rust evidence receipt capture is available.';
    case 'IDENTITY_MISMATCH':
      return 'Direct-loop refused: semantic source, governed receipts and live Rust dataset identity differ.';
    case 'DIRECT_CONSUMER_UNATTESTED':
      return 'Direct-loop refused: Rust receipts authorize descriptive statistics, not this semantic representation. Direct-consumer admission remains unimplemented.';
  }
}
