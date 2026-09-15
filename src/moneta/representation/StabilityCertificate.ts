import type { ImmutableReferenceV1, Sha256DigestV1 } from '../../governance/GovernedEventContracts.ts';
import { canonicalSha256Hex } from '../../security/CryptoHash.ts';
import {
  ED25519_SIGNATURE_ALGORITHM,
  ED25519_SIGNATURE_HEX,
  TrustedEd25519KeyRegistryV1,
  signEd25519DigestHex,
} from '../../security/TrustedEd25519Keys.ts';
import {
  LEARNING_SAFE_ID,
  LEARNING_STABLE_VERSION,
  cloneImmutableReferenceV1,
  deepFreezeLearning,
  exactObjectKeys,
  immutableReferenceKeyV1,
  isImmutableReferenceV1,
  isLearningUtcTimestamp,
  isSha256DigestV1,
  sameImmutableReferenceV1,
} from '../../learning/LearningContractPrimitives.ts';
import {
  MONETA_REPRESENTATION_CANDIDATES,
  type SemanticRepresentationId,
} from './RepresentationCandidate.ts';
import {
  ALL_REPRESENTATION_FAMILIES,
  isCandidateAssignedToReasoningFamily,
  type RepresentationFamily,
} from './RepresentationFamily.ts';

export const STABILITY_CERTIFICATE_SCHEMA_VERSION = '1' as const;
export const STABILITY_CERTIFICATE_SIGNATURE_ALGORITHM = ED25519_SIGNATURE_ALGORITHM;
export const STABILITY_ADMISSION_CLAIM_SCHEMA_VERSION = '1' as const;

export interface EffectiveFeatureAuthorityReferenceV1 {
  readonly schemaVersion: '1';
  readonly authorityKind: 'RUST_WASM_EFFECTIVE_FEATURE_REFERENCE';
  readonly authorityVersion: string;
  readonly orderedFeatureIds: readonly string[];
  readonly effectiveFeatureCount: number;
  readonly artifact: ImmutableReferenceV1;
}

export interface PerturbationProtocolV1 {
  readonly protocolId: string;
  readonly protocolVersion: string;
  readonly configurationDigest: Sha256DigestV1;
  readonly runSetDigest: Sha256DigestV1;
  readonly runCount: number;
}

export interface StabilityEvidenceV1 {
  readonly metricId: string;
  readonly metricVersion: string;
  readonly evidenceArtifact: ImmutableReferenceV1;
  readonly evidenceRunCount: number;
  readonly observedValues: readonly number[];
  readonly refusal: null | Readonly<{
    code: 'INSUFFICIENT_EVIDENCE' | 'ANALYTICAL_REFUSAL';
    reason: string;
  }>;
}

export interface StabilityRuntimeIdentityV1 {
  readonly analyticalKernelVersion: string;
  readonly monetaVersion: string;
  readonly fitnessModelVersion: string;
  readonly fitnessModelArtifactDigest: Sha256DigestV1 | null;
}

export interface StabilityReplayBindingV1 {
  readonly scope: 'DATASET' | 'SESSION';
  readonly sessionId: string | null;
  readonly evidenceGeneratedAt: string;
  readonly compatibilityVersion: string;
}

export interface StabilityCertificateContentV1 {
  readonly schemaVersion: typeof STABILITY_CERTIFICATE_SCHEMA_VERSION;
  readonly certificateId: string;
  readonly issuedAt: string;
  readonly issuerKeyId: string;
  readonly datasetFingerprint: string;
  readonly candidateId: SemanticRepresentationId;
  readonly representationFamily: RepresentationFamily;
  readonly effectiveFeatureAuthority: EffectiveFeatureAuthorityReferenceV1;
  readonly perturbationProtocol: PerturbationProtocolV1;
  readonly stabilityEvidence: StabilityEvidenceV1;
  readonly governingPolicy: ImmutableReferenceV1;
  readonly runtimeIdentity: StabilityRuntimeIdentityV1;
  readonly replayBinding: StabilityReplayBindingV1;
}

export interface SignedStabilityCertificateV1 extends StabilityCertificateContentV1 {
  readonly certificateDigest: Sha256DigestV1;
  readonly signature: Readonly<{
    algorithm: typeof STABILITY_CERTIFICATE_SIGNATURE_ALGORITHM;
    value: string;
  }>;
}

export interface StabilityAnalyticalAuthorityContextV1 {
  /**
   * This tranche deliberately defines only a reference contract. It is not a
   * Rust/WASM validation receipt and can never make a certificate promotable.
   */
  readonly status: 'REFERENCE_ONLY';
  readonly effectiveFeatureAuthority: EffectiveFeatureAuthorityReferenceV1;
  readonly perturbationProtocol: PerturbationProtocolV1;
  readonly stabilityMetricId: string;
  readonly stabilityMetricVersion: string;
  readonly perturbationEvidenceArtifact: ImmutableReferenceV1;
  readonly perturbationEvidenceRunCount: number;
}

export interface StabilityVerificationContextV1 {
  readonly datasetFingerprint: string;
  readonly candidateId: SemanticRepresentationId;
  readonly representationFamily: RepresentationFamily;
  readonly analyticalAuthority: StabilityAnalyticalAuthorityContextV1;
  readonly governingPolicy: ImmutableReferenceV1;
  readonly runtimeIdentity: StabilityRuntimeIdentityV1;
  readonly replayBinding: StabilityReplayBindingV1;
}

export type StabilityCertificateIssueCode =
  | 'INVALID_CERTIFICATE_STRUCTURE'
  | 'CERTIFICATE_DIGEST_MISMATCH'
  | 'INVALID_SIGNATURE'
  | 'UNTRUSTED_ISSUER_KEY'
  | 'RETIRED_ISSUER_KEY'
  | 'CROSS_DATASET_REPLAY'
  | 'CROSS_CANDIDATE_REPLAY'
  | 'EFFECTIVE_FEATURE_CONTEXT_MISMATCH'
  | 'PERTURBATION_PROTOCOL_MISMATCH'
  | 'PERTURBATION_EVIDENCE_MISMATCH'
  | 'PERTURBATION_RUN_COUNT_MISMATCH'
  | 'POLICY_CONTEXT_MISMATCH'
  | 'RUNTIME_CONTEXT_MISMATCH'
  | 'REPLAY_CONTEXT_MISMATCH'
  | 'GOVERNING_POLICY_UNAVAILABLE'
  | 'EFFECTIVE_FEATURE_AUTHORITY_REFERENCE_ONLY'
  | 'NO_PROMOTABLE_GOVERNING_CRITERION';

export interface StabilityCertificateIssueV1 {
  readonly code: StabilityCertificateIssueCode;
  readonly path: string;
  readonly message: string;
}

export class StabilityCertificateError extends Error {
  readonly issues: readonly StabilityCertificateIssueV1[];

  constructor(issues: readonly StabilityCertificateIssueV1[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '));
    this.name = 'StabilityCertificateError';
    this.issues = Object.freeze([...issues]);
  }
}

export interface StabilityPolicyAuthorityV1 {
  readonly policy: ImmutableReferenceV1;
  readonly disposition: 'VERIFIED_NON_PROMOTABLE';
}

/**
 * Authority-owned policy identities. No threshold or promotion callback is
 * accepted: RFC 0006 has no scientifically promotable policy in this tranche.
 */
export class StabilityPolicyRegistryV1 {
  private readonly policies = new Map<string, StabilityPolicyAuthorityV1>();

  constructor(entries: readonly StabilityPolicyAuthorityV1[]) {
    for (const entry of entries) {
      if (
        !exactObjectKeys(entry, ['policy', 'disposition']) ||
        !isImmutableReferenceV1(entry.policy) ||
        entry.disposition !== 'VERIFIED_NON_PROMOTABLE'
      ) {
        throw new TypeError('Stability policy registry accepts only closed, immutable non-promotable policy authorities');
      }
      const key = immutableReferenceKeyV1(entry.policy);
      if (this.policies.has(key)) throw new TypeError(`Duplicate stability policy authority: ${key}`);
      this.policies.set(key, deepFreezeLearning({
        policy: cloneImmutableReferenceV1(entry.policy),
        disposition: entry.disposition,
      }));
    }
  }

  resolve(reference: ImmutableReferenceV1): StabilityPolicyAuthorityV1 | null {
    const entry = this.policies.get(immutableReferenceKeyV1(reference));
    return entry ? structuredClone(entry) : null;
  }
}

export interface VerifiedStabilityAdmissionClaimV1 {
  readonly schemaVersion: typeof STABILITY_ADMISSION_CLAIM_SCHEMA_VERSION;
  readonly certificateDigest: Sha256DigestV1;
  readonly issuerKeyId: string;
  readonly datasetFingerprint: string;
  readonly candidateId: SemanticRepresentationId;
  readonly representationFamily: RepresentationFamily;
  readonly governingPolicy: ImmutableReferenceV1;
  readonly runtimeIdentity: StabilityRuntimeIdentityV1;
  readonly replayBinding: StabilityReplayBindingV1;
  readonly promotionDisposition: 'VERIFIED_NON_PROMOTABLE';
}

export interface StabilityVerificationResultV1 {
  readonly disposition: 'INVALID' | 'VERIFIED_NON_PROMOTABLE';
  readonly claim: VerifiedStabilityAdmissionClaimV1 | null;
  readonly issues: readonly StabilityCertificateIssueV1[];
}

const DATASET_FINGERPRINT = /^[0-9a-f]{64}$/;
const verifiedClaims = new WeakSet<object>();

function isSafeVersion(value: unknown): value is string {
  return typeof value === 'string' && LEARNING_STABLE_VERSION.test(value);
}

function sameCanonical(left: unknown, right: unknown): boolean {
  return canonicalSha256Hex(left) === canonicalSha256Hex(right);
}

function cloneDigest(value: Sha256DigestV1): Sha256DigestV1 {
  return { algorithm: 'SHA256', value: value.value };
}

function cloneEffectiveFeatureAuthority(value: EffectiveFeatureAuthorityReferenceV1): EffectiveFeatureAuthorityReferenceV1 {
  return {
    schemaVersion: '1',
    authorityKind: 'RUST_WASM_EFFECTIVE_FEATURE_REFERENCE',
    authorityVersion: value.authorityVersion,
    orderedFeatureIds: [...value.orderedFeatureIds],
    effectiveFeatureCount: value.effectiveFeatureCount,
    artifact: cloneImmutableReferenceV1(value.artifact),
  };
}

function cloneRuntimeIdentity(value: StabilityRuntimeIdentityV1): StabilityRuntimeIdentityV1 {
  return {
    analyticalKernelVersion: value.analyticalKernelVersion,
    monetaVersion: value.monetaVersion,
    fitnessModelVersion: value.fitnessModelVersion,
    fitnessModelArtifactDigest: value.fitnessModelArtifactDigest
      ? cloneDigest(value.fitnessModelArtifactDigest)
      : null,
  };
}

function cloneReplayBinding(value: StabilityReplayBindingV1): StabilityReplayBindingV1 {
  return { ...value };
}

function validateEffectiveFeatureAuthority(value: EffectiveFeatureAuthorityReferenceV1): boolean {
  return exactObjectKeys(value, [
    'schemaVersion', 'authorityKind', 'authorityVersion', 'orderedFeatureIds',
    'effectiveFeatureCount', 'artifact',
  ]) &&
    value.schemaVersion === '1' &&
    value.authorityKind === 'RUST_WASM_EFFECTIVE_FEATURE_REFERENCE' &&
    isSafeVersion(value.authorityVersion) &&
    Array.isArray(value.orderedFeatureIds) &&
    value.orderedFeatureIds.length > 0 &&
    value.orderedFeatureIds.length <= 100_000 &&
    value.orderedFeatureIds.every((id) => typeof id === 'string' && LEARNING_SAFE_ID.test(id)) &&
    new Set(value.orderedFeatureIds).size === value.orderedFeatureIds.length &&
    Number.isSafeInteger(value.effectiveFeatureCount) &&
    value.effectiveFeatureCount === value.orderedFeatureIds.length &&
    isImmutableReferenceV1(value.artifact);
}

function validateRuntimeIdentity(value: StabilityRuntimeIdentityV1): boolean {
  return exactObjectKeys(value, [
    'analyticalKernelVersion', 'monetaVersion', 'fitnessModelVersion', 'fitnessModelArtifactDigest',
  ]) &&
    isSafeVersion(value.analyticalKernelVersion) &&
    isSafeVersion(value.monetaVersion) &&
    isSafeVersion(value.fitnessModelVersion) &&
    (value.fitnessModelArtifactDigest === null || isSha256DigestV1(value.fitnessModelArtifactDigest));
}

function validateReplayBinding(value: StabilityReplayBindingV1): boolean {
  return exactObjectKeys(value, [
    'scope', 'sessionId', 'evidenceGeneratedAt', 'compatibilityVersion',
  ]) &&
    (value.scope === 'DATASET' || value.scope === 'SESSION') &&
    isLearningUtcTimestamp(value.evidenceGeneratedAt) &&
    isSafeVersion(value.compatibilityVersion) &&
    ((value.scope === 'DATASET' && value.sessionId === null) ||
      (value.scope === 'SESSION' && typeof value.sessionId === 'string' && LEARNING_SAFE_ID.test(value.sessionId)));
}

function validatePerturbationProtocol(value: PerturbationProtocolV1): boolean {
  return exactObjectKeys(value, ['protocolId', 'protocolVersion', 'configurationDigest', 'runSetDigest', 'runCount']) &&
    LEARNING_SAFE_ID.test(value?.protocolId ?? '') && isSafeVersion(value?.protocolVersion) &&
    isSha256DigestV1(value?.configurationDigest) && isSha256DigestV1(value?.runSetDigest) &&
    Number.isSafeInteger(value?.runCount) && value.runCount >= 1 && value.runCount <= 1_000_000;
}

function validateVerificationContext(value: StabilityVerificationContextV1): boolean {
  if (!exactObjectKeys(value, [
    'datasetFingerprint', 'candidateId', 'representationFamily', 'analyticalAuthority',
    'governingPolicy', 'runtimeIdentity', 'replayBinding',
  ])) return false;
  const authority = value.analyticalAuthority;
  return DATASET_FINGERPRINT.test(value.datasetFingerprint ?? '') &&
    Object.hasOwn(MONETA_REPRESENTATION_CANDIDATES, value.candidateId) &&
    ALL_REPRESENTATION_FAMILIES.includes(value.representationFamily) &&
    exactObjectKeys(authority, [
      'status', 'effectiveFeatureAuthority', 'perturbationProtocol', 'stabilityMetricId',
      'stabilityMetricVersion', 'perturbationEvidenceArtifact', 'perturbationEvidenceRunCount',
    ]) &&
    authority.status === 'REFERENCE_ONLY' &&
    validateEffectiveFeatureAuthority(authority.effectiveFeatureAuthority) &&
    validatePerturbationProtocol(authority.perturbationProtocol) &&
    LEARNING_SAFE_ID.test(authority.stabilityMetricId ?? '') &&
    isSafeVersion(authority.stabilityMetricVersion) &&
    isImmutableReferenceV1(authority.perturbationEvidenceArtifact) &&
    Number.isSafeInteger(authority.perturbationEvidenceRunCount) &&
    authority.perturbationEvidenceRunCount >= 1 &&
    authority.perturbationEvidenceRunCount <= 1_000_000 &&
    isImmutableReferenceV1(value.governingPolicy) &&
    validateRuntimeIdentity(value.runtimeIdentity) &&
    validateReplayBinding(value.replayBinding);
}

function validateContent(value: StabilityCertificateContentV1): StabilityCertificateIssueV1[] {
  const issues: StabilityCertificateIssueV1[] = [];
  if (!exactObjectKeys(value, [
    'schemaVersion', 'certificateId', 'issuedAt', 'issuerKeyId', 'datasetFingerprint',
    'candidateId', 'representationFamily', 'effectiveFeatureAuthority', 'perturbationProtocol',
    'stabilityEvidence', 'governingPolicy', 'runtimeIdentity', 'replayBinding',
  ])) {
    issues.push({ code: 'INVALID_CERTIFICATE_STRUCTURE', path: 'certificate', message: 'certificate content must use the exact closed V1 schema' });
    return issues;
  }
  if (
    value.schemaVersion !== STABILITY_CERTIFICATE_SCHEMA_VERSION ||
    !LEARNING_SAFE_ID.test(value.certificateId ?? '') ||
    !isLearningUtcTimestamp(value.issuedAt) ||
    !LEARNING_SAFE_ID.test(value.issuerKeyId ?? '') ||
    !DATASET_FINGERPRINT.test(value.datasetFingerprint ?? '') ||
    !Object.hasOwn(MONETA_REPRESENTATION_CANDIDATES, value.candidateId) ||
    !ALL_REPRESENTATION_FAMILIES.includes(value.representationFamily) ||
    !isCandidateAssignedToReasoningFamily(value.candidateId, value.representationFamily)
  ) {
    issues.push({ code: 'INVALID_CERTIFICATE_STRUCTURE', path: 'certificate', message: 'certificate identity, dataset, candidate, family, or timestamp is invalid' });
  }
  if (!validateEffectiveFeatureAuthority(value.effectiveFeatureAuthority)) {
    issues.push({ code: 'INVALID_CERTIFICATE_STRUCTURE', path: 'effectiveFeatureAuthority', message: 'effective-feature authority must be a closed Rust/WASM reference with an exact ordered count' });
  }
  const protocol = value.perturbationProtocol;
  if (!validatePerturbationProtocol(protocol)) {
    issues.push({ code: 'INVALID_CERTIFICATE_STRUCTURE', path: 'perturbationProtocol', message: 'perturbation protocol identity, digests, or run count is invalid' });
  }
  const evidence = value.stabilityEvidence;
  const validRefusal = evidence?.refusal === null || (
    exactObjectKeys(evidence?.refusal, ['code', 'reason']) &&
    ['INSUFFICIENT_EVIDENCE', 'ANALYTICAL_REFUSAL'].includes(evidence.refusal.code) &&
    typeof evidence.refusal.reason === 'string' && evidence.refusal.reason.length > 0 && evidence.refusal.reason.length <= 500
  );
  if (!exactObjectKeys(evidence, ['metricId', 'metricVersion', 'evidenceArtifact', 'evidenceRunCount', 'observedValues', 'refusal']) ||
    !LEARNING_SAFE_ID.test(evidence?.metricId ?? '') || !isSafeVersion(evidence?.metricVersion) ||
    !isImmutableReferenceV1(evidence?.evidenceArtifact) ||
    !Number.isSafeInteger(evidence?.evidenceRunCount) || evidence.evidenceRunCount < 1 || evidence.evidenceRunCount > 1_000_000 ||
    evidence.evidenceRunCount !== protocol?.runCount || !Array.isArray(evidence.observedValues) ||
    evidence.observedValues.length > 64 || evidence.observedValues.some((number) => !Number.isFinite(number)) || !validRefusal ||
    (evidence.refusal === null && evidence.observedValues.length === 0) ||
    (evidence.refusal !== null && evidence.observedValues.length !== 0)) {
    issues.push({ code: 'INVALID_CERTIFICATE_STRUCTURE', path: 'stabilityEvidence', message: 'stability evidence must bind finite observations or an explicit refusal and reconcile its run count' });
  }
  if (!isImmutableReferenceV1(value.governingPolicy)) {
    issues.push({ code: 'INVALID_CERTIFICATE_STRUCTURE', path: 'governingPolicy', message: 'governing policy must be an immutable reference' });
  }
  if (!validateRuntimeIdentity(value.runtimeIdentity)) {
    issues.push({ code: 'INVALID_CERTIFICATE_STRUCTURE', path: 'runtimeIdentity', message: 'runtime identity must use the exact closed V1 schema' });
  }
  if (!validateReplayBinding(value.replayBinding)) {
    issues.push({ code: 'INVALID_CERTIFICATE_STRUCTURE', path: 'replayBinding', message: 'replay binding must use the exact closed V1 schema and coherent scope' });
  }
  return issues;
}

export function buildStabilityCertificateContentV1(input: StabilityCertificateContentV1): StabilityCertificateContentV1 {
  const issues = validateContent(input);
  if (issues.length > 0) throw new StabilityCertificateError(issues);
  return deepFreezeLearning({
    schemaVersion: STABILITY_CERTIFICATE_SCHEMA_VERSION,
    certificateId: input.certificateId,
    issuedAt: input.issuedAt,
    issuerKeyId: input.issuerKeyId,
    datasetFingerprint: input.datasetFingerprint,
    candidateId: input.candidateId,
    representationFamily: input.representationFamily,
    effectiveFeatureAuthority: cloneEffectiveFeatureAuthority(input.effectiveFeatureAuthority),
    perturbationProtocol: {
      protocolId: input.perturbationProtocol.protocolId,
      protocolVersion: input.perturbationProtocol.protocolVersion,
      configurationDigest: cloneDigest(input.perturbationProtocol.configurationDigest),
      runSetDigest: cloneDigest(input.perturbationProtocol.runSetDigest),
      runCount: input.perturbationProtocol.runCount,
    },
    stabilityEvidence: {
      metricId: input.stabilityEvidence.metricId,
      metricVersion: input.stabilityEvidence.metricVersion,
      evidenceArtifact: cloneImmutableReferenceV1(input.stabilityEvidence.evidenceArtifact),
      evidenceRunCount: input.stabilityEvidence.evidenceRunCount,
      observedValues: [...input.stabilityEvidence.observedValues],
      refusal: input.stabilityEvidence.refusal ? { ...input.stabilityEvidence.refusal } : null,
    },
    governingPolicy: cloneImmutableReferenceV1(input.governingPolicy),
    runtimeIdentity: cloneRuntimeIdentity(input.runtimeIdentity),
    replayBinding: cloneReplayBinding(input.replayBinding),
  });
}

export async function signStabilityCertificateV1(
  input: StabilityCertificateContentV1,
  privateKey: CryptoKey,
): Promise<SignedStabilityCertificateV1> {
  const certificate = buildStabilityCertificateContentV1(input);
  const certificateDigest = { algorithm: 'SHA256' as const, value: canonicalSha256Hex(certificate) };
  let signatureValue: string;
  try {
    signatureValue = await signEd25519DigestHex(privateKey, certificateDigest.value);
  } catch (error) {
    throw new StabilityCertificateError([{
      code: 'INVALID_SIGNATURE', path: 'signature', message: `Ed25519 signing failed: ${String(error)}`,
    }]);
  }
  return deepFreezeLearning({
    ...certificate,
    certificateDigest,
    signature: { algorithm: STABILITY_CERTIFICATE_SIGNATURE_ALGORITHM, value: signatureValue },
  });
}

export function validateSignedStabilityCertificateStructureV1(
  certificate: SignedStabilityCertificateV1,
): readonly StabilityCertificateIssueV1[] {
  const issues: StabilityCertificateIssueV1[] = [];
  if (!exactObjectKeys(certificate, [
    'schemaVersion', 'certificateId', 'issuedAt', 'issuerKeyId', 'datasetFingerprint',
    'candidateId', 'representationFamily', 'effectiveFeatureAuthority', 'perturbationProtocol',
    'stabilityEvidence', 'governingPolicy', 'runtimeIdentity', 'replayBinding',
    'certificateDigest', 'signature',
  ])) {
    return [{ code: 'INVALID_CERTIFICATE_STRUCTURE', path: 'certificate', message: 'signed certificate must use the exact closed V1 schema' }];
  }
  const { certificateDigest: _digest, signature: _signature, ...content } = certificate;
  issues.push(...validateContent(content));
  if (!isSha256DigestV1(certificate.certificateDigest) ||
    canonicalSha256Hex(content) !== certificate.certificateDigest.value) {
    issues.push({ code: 'CERTIFICATE_DIGEST_MISMATCH', path: 'certificateDigest', message: 'certificate content does not match its canonical SHA-256 digest' });
  }
  if (!exactObjectKeys(certificate.signature, ['algorithm', 'value']) ||
    certificate.signature.algorithm !== STABILITY_CERTIFICATE_SIGNATURE_ALGORITHM ||
    !ED25519_SIGNATURE_HEX.test(certificate.signature.value)) {
    issues.push({ code: 'INVALID_SIGNATURE', path: 'signature', message: 'certificate signature must be 64-byte lower-case Ed25519 hex' });
  }
  return issues;
}

function validateContext(
  certificate: SignedStabilityCertificateV1,
  context: StabilityVerificationContextV1,
): StabilityCertificateIssueV1[] {
  const issues: StabilityCertificateIssueV1[] = [];
  if (certificate.datasetFingerprint !== context.datasetFingerprint) {
    issues.push({ code: 'CROSS_DATASET_REPLAY', path: 'datasetFingerprint', message: 'certificate does not bind the current dataset' });
  }
  if (certificate.candidateId !== context.candidateId || certificate.representationFamily !== context.representationFamily) {
    issues.push({ code: 'CROSS_CANDIDATE_REPLAY', path: 'candidate', message: 'certificate does not bind the current candidate and family' });
  }
  if (context.analyticalAuthority?.status !== 'REFERENCE_ONLY' ||
    !sameCanonical(certificate.effectiveFeatureAuthority, context.analyticalAuthority.effectiveFeatureAuthority)) {
    issues.push({ code: 'EFFECTIVE_FEATURE_CONTEXT_MISMATCH', path: 'effectiveFeatureAuthority', message: 'effective-feature reference does not match the current analytical authority context' });
  }
  if (!sameCanonical(certificate.perturbationProtocol, context.analyticalAuthority.perturbationProtocol)) {
    issues.push({ code: 'PERTURBATION_PROTOCOL_MISMATCH', path: 'perturbationProtocol', message: 'perturbation protocol identity, configuration, or run set was substituted' });
  }
  if (certificate.stabilityEvidence.metricId !== context.analyticalAuthority.stabilityMetricId ||
    certificate.stabilityEvidence.metricVersion !== context.analyticalAuthority.stabilityMetricVersion) {
    issues.push({ code: 'PERTURBATION_EVIDENCE_MISMATCH', path: 'stabilityEvidence.metricId', message: 'stability metric identity or version was substituted' });
  }
  if (!sameImmutableReferenceV1(certificate.stabilityEvidence.evidenceArtifact, context.analyticalAuthority.perturbationEvidenceArtifact)) {
    issues.push({ code: 'PERTURBATION_EVIDENCE_MISMATCH', path: 'stabilityEvidence.evidenceArtifact', message: 'perturbation evidence artifact was substituted' });
  }
  if (certificate.perturbationProtocol.runCount !== context.analyticalAuthority.perturbationEvidenceRunCount ||
    certificate.stabilityEvidence.evidenceRunCount !== context.analyticalAuthority.perturbationEvidenceRunCount) {
    issues.push({ code: 'PERTURBATION_RUN_COUNT_MISMATCH', path: 'perturbationProtocol.runCount', message: 'certificate run count does not reconcile with the referenced evidence' });
  }
  if (!sameImmutableReferenceV1(certificate.governingPolicy, context.governingPolicy)) {
    issues.push({ code: 'POLICY_CONTEXT_MISMATCH', path: 'governingPolicy', message: 'policy id, version, or artifact digest does not match current governance' });
  }
  if (!sameCanonical(certificate.runtimeIdentity, context.runtimeIdentity)) {
    issues.push({ code: 'RUNTIME_CONTEXT_MISMATCH', path: 'runtimeIdentity', message: 'kernel, Moneta, or model identity does not match the current runtime' });
  }
  if (!sameCanonical(certificate.replayBinding, context.replayBinding)) {
    issues.push({ code: 'REPLAY_CONTEXT_MISMATCH', path: 'replayBinding', message: 'certificate replay scope does not match the current session/dataset context' });
  }
  return issues;
}

export class TrustedStabilityCertificateVerifierV1 {
  constructor(
    private readonly trustedKeys: TrustedEd25519KeyRegistryV1,
    private readonly policies: StabilityPolicyRegistryV1,
  ) {}

  async verify(
    certificate: SignedStabilityCertificateV1,
    context: StabilityVerificationContextV1,
  ): Promise<StabilityVerificationResultV1> {
    const structureIssues = [...validateSignedStabilityCertificateStructureV1(certificate)];
    if (structureIssues.length > 0) return deepFreezeLearning({ disposition: 'INVALID', claim: null, issues: structureIssues });
    if (!validateVerificationContext(context)) {
      return deepFreezeLearning({
        disposition: 'INVALID',
        claim: null,
        issues: [{ code: 'INVALID_CERTIFICATE_STRUCTURE', path: 'verificationContext', message: 'verification context must use the exact closed V1 authority schema' }],
      });
    }

    const signatureStatus = await this.trustedKeys.verify(
      certificate.issuerKeyId,
      certificate.certificateDigest.value,
      certificate.signature.value,
    );
    if (signatureStatus !== 'VERIFIED') {
      const code: StabilityCertificateIssueCode = signatureStatus === 'UNKNOWN_KEY'
        ? 'UNTRUSTED_ISSUER_KEY'
        : signatureStatus === 'RETIRED_KEY'
          ? 'RETIRED_ISSUER_KEY'
          : 'INVALID_SIGNATURE';
      return deepFreezeLearning({
        disposition: 'INVALID',
        claim: null,
        issues: [{ code, path: 'issuerKeyId', message: 'certificate issuer is not an active trusted Ed25519 authority for this exact signature' }],
      });
    }

    const contextIssues = validateContext(certificate, context);
    if (contextIssues.length > 0) return deepFreezeLearning({ disposition: 'INVALID', claim: null, issues: contextIssues });

    const issues: StabilityCertificateIssueV1[] = [{
      code: 'EFFECTIVE_FEATURE_AUTHORITY_REFERENCE_ONLY',
      path: 'effectiveFeatureAuthority',
      message: 'current Rust/WASM boundary supplies only a closed reference contract, not a promotable authority receipt',
    }];
    const policy = this.policies.resolve(certificate.governingPolicy);
    issues.push(policy ? {
      code: 'NO_PROMOTABLE_GOVERNING_CRITERION',
      path: 'governingPolicy',
      message: 'referenced governing policy is verified but intentionally non-promotable',
    } : {
      code: 'GOVERNING_POLICY_UNAVAILABLE',
      path: 'governingPolicy',
      message: 'referenced governing policy is unavailable and no fallback policy is permitted',
    });

    const claim: VerifiedStabilityAdmissionClaimV1 = deepFreezeLearning({
      schemaVersion: STABILITY_ADMISSION_CLAIM_SCHEMA_VERSION,
      certificateDigest: cloneDigest(certificate.certificateDigest),
      issuerKeyId: certificate.issuerKeyId,
      datasetFingerprint: certificate.datasetFingerprint,
      candidateId: certificate.candidateId,
      representationFamily: certificate.representationFamily,
      governingPolicy: cloneImmutableReferenceV1(certificate.governingPolicy),
      runtimeIdentity: cloneRuntimeIdentity(certificate.runtimeIdentity),
      replayBinding: cloneReplayBinding(certificate.replayBinding),
      promotionDisposition: 'VERIFIED_NON_PROMOTABLE',
    });
    verifiedClaims.add(claim);
    return deepFreezeLearning({ disposition: 'VERIFIED_NON_PROMOTABLE', claim, issues });
  }
}

export interface StabilityAdmissionContextV1 {
  readonly datasetFingerprint: string;
  readonly candidateId: SemanticRepresentationId;
  readonly representationFamily: RepresentationFamily;
  readonly runtimeIdentity: StabilityRuntimeIdentityV1;
}

/** Runtime-local capability check: serialized or caller-constructed lookalikes are never authoritative. */
export function isVerifiedStabilityAdmissionClaimV1(
  claim: VerifiedStabilityAdmissionClaimV1 | undefined,
  context: StabilityAdmissionContextV1,
): claim is VerifiedStabilityAdmissionClaimV1 {
  return Boolean(
    claim &&
    verifiedClaims.has(claim) &&
    claim.schemaVersion === STABILITY_ADMISSION_CLAIM_SCHEMA_VERSION &&
    claim.datasetFingerprint === context.datasetFingerprint &&
    claim.candidateId === context.candidateId &&
    claim.representationFamily === context.representationFamily &&
    sameCanonical(claim.runtimeIdentity, context.runtimeIdentity),
  );
}

/** No claim minted by the accepted minimal tranche is scientifically promotable. */
export function isStabilityAdmissionPromotableV1(
  claim: VerifiedStabilityAdmissionClaimV1 | undefined,
  context: StabilityAdmissionContextV1,
): boolean {
  return isVerifiedStabilityAdmissionClaimV1(claim, context) && false;
}
