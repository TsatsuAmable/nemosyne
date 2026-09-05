import type { ImmutableReferenceV1, Sha256DigestV1 } from '../governance/GovernedEventContracts.ts';
import { canonicalSha256Hex } from '../security/CryptoHash.ts';
import {
  LEARNING_SAFE_ID,
  LEARNING_STABLE_VERSION,
  cloneImmutableReferenceV1,
  deepFreezeLearning,
  exactObjectKeys,
  isImmutableReferenceV1,
  isLearningUtcTimestamp,
  isSha256DigestV1,
} from './LearningContractPrimitives.ts';

export const MODEL_DEPLOYMENT_MANIFEST_SCHEMA_VERSION = '1' as const;
export const MODEL_DEPLOYMENT_POLICY_VERSION = 'signed-staged-model-deployment-v1' as const;
export const MODEL_DEPLOYMENT_SIGNATURE_ALGORITHM = 'Ed25519' as const;

export type ModelDeploymentStage = 'SHADOW' | 'CANARY' | 'PRODUCTION' | 'ROLLBACK';

export interface ModelDeploymentManifestContentV1 {
  readonly schemaVersion: typeof MODEL_DEPLOYMENT_MANIFEST_SCHEMA_VERSION;
  readonly policyVersion: typeof MODEL_DEPLOYMENT_POLICY_VERSION;
  readonly manifestId: string;
  readonly manifestVersion: string;
  readonly createdAt: string;
  readonly stage: ModelDeploymentStage;
  readonly signingKeyId: string;
  readonly modelArtifact: ImmutableReferenceV1;
  readonly modelRegistryEntry: ImmutableReferenceV1;
  readonly runtimeRegistryEntry: ImmutableReferenceV1;
  readonly trainingReceipt: ImmutableReferenceV1;
  readonly evaluationReport: ImmutableReferenceV1;
  readonly operatorReview: ImmutableReferenceV1;
  readonly rolloutPercent: number;
  readonly previousDeployment: ImmutableReferenceV1 | null;
  readonly rollbackFromModel: ImmutableReferenceV1 | null;
}

export interface ModelDeploymentSignatureV1 {
  readonly algorithm: typeof MODEL_DEPLOYMENT_SIGNATURE_ALGORITHM;
  readonly value: string;
}

export interface SignedModelDeploymentManifestV1 extends ModelDeploymentManifestContentV1 {
  readonly manifestDigest: Sha256DigestV1;
  readonly signature: ModelDeploymentSignatureV1;
}

export type ModelDeploymentManifestIssueCode =
  | 'INVALID_MANIFEST_METADATA'
  | 'INVALID_REFERENCE'
  | 'INVALID_ROLLOUT'
  | 'INVALID_TRANSITION_BINDING'
  | 'MANIFEST_DIGEST_MISMATCH'
  | 'INVALID_SIGNATURE';

export interface ModelDeploymentManifestIssueV1 {
  readonly code: ModelDeploymentManifestIssueCode;
  readonly path: string;
  readonly message: string;
}

export class ModelDeploymentManifestError extends Error {
  readonly issues: readonly ModelDeploymentManifestIssueV1[];

  constructor(issues: readonly ModelDeploymentManifestIssueV1[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '));
    this.name = 'ModelDeploymentManifestError';
    this.issues = Object.freeze([...issues]);
  }
}

const SIGNATURE_HEX = /^[0-9a-f]{128}$/;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function cloneNullableReference(reference: ImmutableReferenceV1 | null): ImmutableReferenceV1 | null {
  return reference ? cloneImmutableReferenceV1(reference) : null;
}

function validateContent(content: ModelDeploymentManifestContentV1): ModelDeploymentManifestIssueV1[] {
  const issues: ModelDeploymentManifestIssueV1[] = [];
  if (
    !content ||
    content.schemaVersion !== MODEL_DEPLOYMENT_MANIFEST_SCHEMA_VERSION ||
    content.policyVersion !== MODEL_DEPLOYMENT_POLICY_VERSION ||
    !LEARNING_SAFE_ID.test(content.manifestId ?? '') ||
    !LEARNING_STABLE_VERSION.test(content.manifestVersion ?? '') ||
    !isLearningUtcTimestamp(content.createdAt) ||
    !LEARNING_SAFE_ID.test(content.signingKeyId ?? '') ||
    !['SHADOW', 'CANARY', 'PRODUCTION', 'ROLLBACK'].includes(content.stage)
  ) {
    issues.push({ code: 'INVALID_MANIFEST_METADATA', path: 'manifest', message: 'deployment manifest identity, policy, stage, timestamp, or signing-key identity is invalid' });
  }
  for (const [path, reference] of [
    ['modelArtifact', content?.modelArtifact],
    ['modelRegistryEntry', content?.modelRegistryEntry],
    ['runtimeRegistryEntry', content?.runtimeRegistryEntry],
    ['trainingReceipt', content?.trainingReceipt],
    ['evaluationReport', content?.evaluationReport],
    ['operatorReview', content?.operatorReview],
  ] as const) {
    if (!isImmutableReferenceV1(reference)) {
      issues.push({ code: 'INVALID_REFERENCE', path, message: 'must be an immutable versioned artifact reference' });
    }
  }
  if (content?.previousDeployment !== null && !isImmutableReferenceV1(content?.previousDeployment)) {
    issues.push({ code: 'INVALID_REFERENCE', path: 'previousDeployment', message: 'must be null or an immutable prior deployment reference' });
  }
  if (content?.rollbackFromModel !== null && !isImmutableReferenceV1(content?.rollbackFromModel)) {
    issues.push({ code: 'INVALID_REFERENCE', path: 'rollbackFromModel', message: 'must be null or an immutable model reference' });
  }
  if (!Number.isFinite(content?.rolloutPercent) || content.rolloutPercent < 0 || content.rolloutPercent > 100) {
    issues.push({ code: 'INVALID_ROLLOUT', path: 'rolloutPercent', message: 'rollout percent must be finite within [0,100]' });
  } else if (content.stage === 'SHADOW' && content.rolloutPercent !== 0) {
    issues.push({ code: 'INVALID_ROLLOUT', path: 'rolloutPercent', message: 'shadow evaluation may not serve user traffic' });
  } else if (content.stage === 'CANARY' && !(content.rolloutPercent > 0 && content.rolloutPercent < 100)) {
    issues.push({ code: 'INVALID_ROLLOUT', path: 'rolloutPercent', message: 'canary rollout must be greater than 0 and less than 100 percent' });
  } else if ((content.stage === 'PRODUCTION' || content.stage === 'ROLLBACK') && content.rolloutPercent !== 100) {
    issues.push({ code: 'INVALID_ROLLOUT', path: 'rolloutPercent', message: 'production and rollback manifests must describe the full active deployment' });
  }
  if (content?.stage === 'SHADOW') {
    if (content.previousDeployment !== null || content.rollbackFromModel !== null) {
      issues.push({ code: 'INVALID_TRANSITION_BINDING', path: 'manifest', message: 'initial shadow deployment may not claim prior deployment or rollback state' });
    }
  } else if (content?.stage === 'CANARY' || content?.stage === 'PRODUCTION') {
    if (!isImmutableReferenceV1(content.previousDeployment) || content.rollbackFromModel !== null) {
      issues.push({ code: 'INVALID_TRANSITION_BINDING', path: 'manifest', message: 'canary/production must chain the exact prior deployment and may not claim rollback state' });
    }
  } else if (content?.stage === 'ROLLBACK') {
    if (!isImmutableReferenceV1(content.previousDeployment) || !isImmutableReferenceV1(content.rollbackFromModel)) {
      issues.push({ code: 'INVALID_TRANSITION_BINDING', path: 'manifest', message: 'rollback must bind both the deployment being replaced and the failed production model' });
    }
  }
  return issues;
}

export function buildModelDeploymentManifestContentV1(
  input: ModelDeploymentManifestContentV1,
): ModelDeploymentManifestContentV1 {
  const content: ModelDeploymentManifestContentV1 = {
    schemaVersion: MODEL_DEPLOYMENT_MANIFEST_SCHEMA_VERSION,
    policyVersion: MODEL_DEPLOYMENT_POLICY_VERSION,
    manifestId: input.manifestId,
    manifestVersion: input.manifestVersion,
    createdAt: input.createdAt,
    stage: input.stage,
    signingKeyId: input.signingKeyId,
    modelArtifact: cloneImmutableReferenceV1(input.modelArtifact),
    modelRegistryEntry: cloneImmutableReferenceV1(input.modelRegistryEntry),
    runtimeRegistryEntry: cloneImmutableReferenceV1(input.runtimeRegistryEntry),
    trainingReceipt: cloneImmutableReferenceV1(input.trainingReceipt),
    evaluationReport: cloneImmutableReferenceV1(input.evaluationReport),
    operatorReview: cloneImmutableReferenceV1(input.operatorReview),
    rolloutPercent: input.rolloutPercent,
    previousDeployment: cloneNullableReference(input.previousDeployment),
    rollbackFromModel: cloneNullableReference(input.rollbackFromModel),
  };
  const issues = validateContent(content);
  if (issues.length > 0) throw new ModelDeploymentManifestError(issues);
  return deepFreezeLearning(content);
}

export async function signModelDeploymentManifestV1(
  input: ModelDeploymentManifestContentV1,
  privateKey: CryptoKey,
): Promise<SignedModelDeploymentManifestV1> {
  const content = buildModelDeploymentManifestContentV1(input);
  const manifestDigest = { algorithm: 'SHA256' as const, value: canonicalSha256Hex(content) };
  let signatureBytes: ArrayBuffer;
  try {
    signatureBytes = await globalThis.crypto.subtle.sign(
      MODEL_DEPLOYMENT_SIGNATURE_ALGORITHM,
      privateKey,
      new TextEncoder().encode(manifestDigest.value),
    );
  } catch (error) {
    throw new ModelDeploymentManifestError([{
      code: 'INVALID_SIGNATURE',
      path: 'signature',
      message: `Ed25519 signing failed: ${String(error)}`,
    }]);
  }
  return deepFreezeLearning({
    ...content,
    manifestDigest,
    signature: {
      algorithm: MODEL_DEPLOYMENT_SIGNATURE_ALGORITHM,
      value: bytesToHex(new Uint8Array(signatureBytes)),
    },
  });
}

export function validateSignedModelDeploymentManifestStructureV1(
  manifest: SignedModelDeploymentManifestV1,
): readonly ModelDeploymentManifestIssueV1[] {
  const issues: ModelDeploymentManifestIssueV1[] = [];
  const expectedKeys = [
    'schemaVersion', 'policyVersion', 'manifestId', 'manifestVersion', 'createdAt', 'stage', 'signingKeyId',
    'modelArtifact', 'modelRegistryEntry', 'runtimeRegistryEntry', 'trainingReceipt', 'evaluationReport',
    'operatorReview', 'rolloutPercent', 'previousDeployment', 'rollbackFromModel', 'manifestDigest', 'signature',
  ];
  if (!exactObjectKeys(manifest, expectedKeys)) {
    issues.push({ code: 'INVALID_MANIFEST_METADATA', path: 'manifest', message: 'signed deployment manifest must use the exact closed PT7 schema' });
  }
  const { manifestDigest: _digest, signature: _signature, ...content } = manifest ?? {} as SignedModelDeploymentManifestV1;
  issues.push(...validateContent(content as ModelDeploymentManifestContentV1));
  if (!isSha256DigestV1(manifest?.manifestDigest) || canonicalSha256Hex(content) !== manifest.manifestDigest.value) {
    issues.push({ code: 'MANIFEST_DIGEST_MISMATCH', path: 'manifestDigest', message: 'deployment content does not match its immutable SHA-256 digest' });
  }
  if (
    !manifest?.signature ||
    !exactObjectKeys(manifest.signature, ['algorithm', 'value']) ||
    manifest.signature.algorithm !== MODEL_DEPLOYMENT_SIGNATURE_ALGORITHM ||
    !SIGNATURE_HEX.test(manifest.signature.value)
  ) {
    issues.push({ code: 'INVALID_SIGNATURE', path: 'signature', message: 'deployment signature must be a 64-byte Ed25519 signature encoded as lower-case hex' });
  }
  return issues;
}

export async function verifySignedModelDeploymentManifestV1(
  manifest: SignedModelDeploymentManifestV1,
  publicKey: CryptoKey,
): Promise<readonly ModelDeploymentManifestIssueV1[]> {
  const issues = [...validateSignedModelDeploymentManifestStructureV1(manifest)];
  if (issues.length > 0) return issues;
  let valid = false;
  try {
    valid = await globalThis.crypto.subtle.verify(
      MODEL_DEPLOYMENT_SIGNATURE_ALGORITHM,
      publicKey,
      hexToBytes(manifest.signature.value),
      new TextEncoder().encode(manifest.manifestDigest.value),
    );
  } catch {
    valid = false;
  }
  if (!valid) {
    issues.push({ code: 'INVALID_SIGNATURE', path: 'signature', message: 'Ed25519 signature does not verify for the exact deployment manifest digest' });
  }
  return issues;
}

export function deploymentManifestReferenceV1(manifest: SignedModelDeploymentManifestV1): ImmutableReferenceV1 {
  const issues = validateSignedModelDeploymentManifestStructureV1(manifest);
  if (issues.length > 0) throw new ModelDeploymentManifestError(issues);
  return deepFreezeLearning({
    schemaVersion: '1' as const,
    id: `deployment:${manifest.manifestId}`,
    version: manifest.manifestVersion,
    digest: { algorithm: 'SHA256' as const, value: manifest.manifestDigest.value },
  });
}
