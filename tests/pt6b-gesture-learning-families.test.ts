import { describe, expect, it } from 'vitest';
import { FEATURE_DIM, GESTURE_CLASSES, TRAJECTORY_CAPACITY } from '../modules/gesture-intelligence/src/contracts.ts';
import { validatePayloadAgainstSchema } from '../src/governance/ClosedPayloadValidation.ts';
import { validateAuthorization } from '../src/governance/GovernedEventContextValidation.ts';
import {
  DERIVED_GESTURE_AUTHORITY_REFERENCE,
  DERIVED_GESTURE_FEATURE_SCHEMA_ARTIFACT,
  DERIVED_GESTURE_FEATURE_SCHEMA_REFERENCE,
  DERIVED_GESTURE_LABEL_CODES,
  DERIVED_GESTURE_NOTICE_REFERENCE,
  DERIVED_GESTURE_OBSERVATION_FAMILY_DEFINITION_V1,
  DERIVED_GESTURE_OBSERVATION_FAMILY_ID,
  GESTURE_LEARNING_GOVERNED_EVENT_REGISTRY_V1,
  RAW_GESTURE_CONSENT_AUTHORITY_REFERENCE,
  RAW_GESTURE_NOTICE_REFERENCE,
  RAW_GESTURE_PROTOCOL_AUTHORITY_REFERENCE,
  RAW_GESTURE_PROTOCOL_POLICY_REFERENCE,
  RAW_GESTURE_TRAJECTORY_FAMILY_DEFINITION_V1,
  RAW_GESTURE_TRAJECTORY_FAMILY_ID,
  RAW_GESTURE_TRAJECTORY_SCHEMA_ARTIFACT,
  RAW_GESTURE_TRAJECTORY_SCHEMA_REFERENCE,
  decodeDerivedGestureLabelCodeV1,
} from '../src/governance/GestureLearningFamilies.ts';
import {
  PRODUCT_ANALYTICS_DATA_SERVICE_AUTHORITY_REFERENCE,
  PRODUCT_ANALYTICS_OPERATION_NOTICE_REFERENCE,
  PRODUCT_GOVERNED_EVENT_REGISTRY_V1,
} from '../src/governance/ProductOperationFamily.ts';
import { canonicalJsonStringify, sha256Hex } from '../src/security/CryptoHash.ts';
import type { AuthorizationReferenceV1, JsonValue } from '../src/governance/GovernedEventContracts.ts';

function evidence(id: string) {
  return { id, revision: '1', digest: { algorithm: 'SHA256' as const, value: sha256Hex(id) } };
}

function auth(
  basis: AuthorizationReferenceV1['basis'],
  purpose: AuthorizationReferenceV1['purpose'],
  authority: AuthorizationReferenceV1['authority'],
  policy: AuthorizationReferenceV1['policy']
): AuthorizationReferenceV1 {
  return { schemaVersion: '1', basis, purpose, authority, evidence: evidence(`${basis}-${purpose}`), policy };
}

function payloadIssues(value: JsonValue, family = DERIVED_GESTURE_OBSERVATION_FAMILY_DEFINITION_V1) {
  const issues: { code: string; path: string; message: string }[] = [];
  validatePayloadAgainstSchema(value, family.payloadSchema, 'payload', issues);
  return issues;
}

function validDerivedPayload(): JsonValue {
  return {
    featureSchemaId: DERIVED_GESTURE_FEATURE_SCHEMA_REFERENCE.id,
    featureSchemaVersion: DERIVED_GESTURE_FEATURE_SCHEMA_REFERENCE.version,
    featureSchemaDigest: DERIVED_GESTURE_FEATURE_SCHEMA_REFERENCE.digest.value,
    features: Array.from({ length: FEATURE_DIM }, () => 0.25),
    labelCode: 'CONFIRM:pinchTogether',
    evidenceId: 'feedback-fixture-1',
    recordedAt: '2026-09-05T03:45:00.000Z',
  };
}

function rawPoint(dtMs: number) {
  return { x: 0.1, y: 1.2, z: -0.3, pinched: false, dtMs };
}

function validRawPayload(): JsonValue {
  return {
    trajectorySchemaId: RAW_GESTURE_TRAJECTORY_SCHEMA_REFERENCE.id,
    trajectorySchemaVersion: RAW_GESTURE_TRAJECTORY_SCHEMA_REFERENCE.version,
    trajectorySchemaDigest: RAW_GESTURE_TRAJECTORY_SCHEMA_REFERENCE.digest.value,
    coordinateFrame: RAW_GESTURE_TRAJECTORY_SCHEMA_ARTIFACT.coordinateFrame,
    left: [rawPoint(0), rawPoint(16)],
    right: [rawPoint(0), rawPoint(16)],
    protocolTargetGesture: 'pinchApart',
  };
}

describe('PT6B governed gesture-learning event families', () => {
  it('keeps the learning registry explicit and separate from Product Analytics', () => {
    expect(GESTURE_LEARNING_GOVERNED_EVENT_REGISTRY_V1.list().map((family) => family.familyId)).toEqual([
      DERIVED_GESTURE_OBSERVATION_FAMILY_ID,
      RAW_GESTURE_TRAJECTORY_FAMILY_ID,
    ]);
    expect(PRODUCT_GOVERNED_EVENT_REGISTRY_V1.list().map((family) => family.familyId)).toEqual([
      'product.operation-applied.v1',
    ]);
  });

  it('pins L2 to Product Mode, derived features, purpose-scoped identity and gesture provenance', () => {
    const family = DERIVED_GESTURE_OBSERVATION_FAMILY_DEFINITION_V1;
    expect(family.purpose).toBe('derived-gesture-learning');
    expect(family.dataClasses).toEqual(['DERIVED_GESTURE_FEATURE']);
    expect(family.allowedModes).toEqual(['PRODUCT']);
    expect(family.identityRequirements).toEqual({
      profilePseudonymId: 'REQUIRED', productSessionId: 'FORBIDDEN', investigationId: 'FORBIDDEN', discoveryEpisodeId: 'FORBIDDEN',
    });
    expect(family.runtimeRequirements.perceptionGestureTreatment).toBe('REQUIRED');
    expect(family.authorizationRequirements).toEqual([{
      basis: 'CONSENT_RECEIPT', authority: DERIVED_GESTURE_AUTHORITY_REFERENCE, policy: DERIVED_GESTURE_NOTICE_REFERENCE,
    }]);
    expect(family.revocationBehavior).toBe('DISCARD_QUEUED');
  });

  it('encodes only internally consistent strong Product-Mode labels', () => {
    expect(DERIVED_GESTURE_LABEL_CODES).toHaveLength(36);
    for (const code of DERIVED_GESTURE_LABEL_CODES) expect(decodeDerivedGestureLabelCodeV1(code)).not.toBeNull();
    expect(decodeDerivedGestureLabelCodeV1('CONFIRM:not-a-gesture')).toBeNull();
    expect(decodeDerivedGestureLabelCodeV1('CORRECT:idle->idle')).toBeNull();
    expect(DERIVED_GESTURE_LABEL_CODES.some((code) => code.includes('PROTOCOL_TARGET'))).toBe(false);
  });

  it('accepts exact-width bounded L2 features and rejects raw fields, wrong width, range and protocol labels', () => {
    expect(payloadIssues(validDerivedPayload())).toEqual([]);

    const rawLeak = { ...(validDerivedPayload() as Record<string, JsonValue>), left: [rawPoint(0)] };
    expect(payloadIssues(rawLeak).some((issue) => issue.code === 'PAYLOAD_UNKNOWN_PROPERTY')).toBe(true);

    const shortFeatures = { ...(validDerivedPayload() as Record<string, JsonValue>), features: [0] };
    expect(payloadIssues(shortFeatures).some((issue) => issue.code === 'PAYLOAD_ARRAY_BOUNDS')).toBe(true);

    const outOfRange = { ...(validDerivedPayload() as Record<string, JsonValue>), features: Array.from({ length: FEATURE_DIM }, (_, i) => i === 3 ? 1.01 : 0) };
    expect(payloadIssues(outOfRange).some((issue) => issue.code === 'PAYLOAD_NUMBER_BOUNDS')).toBe(true);

    const protocolLabel = { ...(validDerivedPayload() as Record<string, JsonValue>), labelCode: 'PROTOCOL_TARGET:pinchTogether' };
    expect(payloadIssues(protocolLabel).some((issue) => issue.code === 'PAYLOAD_ENUM_MISMATCH')).toBe(true);
  });

  it('pins the reviewed feature schema to the production extractor constants', () => {
    expect(DERIVED_GESTURE_FEATURE_SCHEMA_ARTIFACT.featureDim).toBe(FEATURE_DIM);
    expect(DERIVED_GESTURE_FEATURE_SCHEMA_ARTIFACT.valueMinimum).toBe(-1);
    expect(DERIVED_GESTURE_FEATURE_SCHEMA_ARTIFACT.valueMaximum).toBe(1);
    expect(sha256Hex(canonicalJsonStringify(DERIVED_GESTURE_FEATURE_SCHEMA_ARTIFACT))).toBe(
      DERIVED_GESTURE_FEATURE_SCHEMA_REFERENCE.digest.value
    );
  });

  it('makes L3 Research-only and requires both raw consent and frozen protocol authority', () => {
    const family = RAW_GESTURE_TRAJECTORY_FAMILY_DEFINITION_V1;
    expect(family.purpose).toBe('raw-trajectory-research');
    expect(family.dataClasses).toEqual(['RAW_SPATIAL_TRAJECTORY']);
    expect(family.allowedModes).toEqual(['RESEARCH']);
    expect(family.authorizationRequirements).toEqual([
      { basis: 'CONSENT_RECEIPT', authority: RAW_GESTURE_CONSENT_AUTHORITY_REFERENCE, policy: RAW_GESTURE_NOTICE_REFERENCE },
      { basis: 'FROZEN_STUDY_PROTOCOL', authority: RAW_GESTURE_PROTOCOL_AUTHORITY_REFERENCE, policy: RAW_GESTURE_PROTOCOL_POLICY_REFERENCE },
    ]);
    expect(family.revocationBehavior).toBe('POLICY_GOVERNED');
    expect(family.runtimeRequirements.perceptionGestureTreatment).toBe('REQUIRED');
  });

  it('rejects Product Analytics authority and missing protocol as L2/L3 authorization', () => {
    const l2Issues: { code: string; path: string; message: string }[] = [];
    const registeredL2 = GESTURE_LEARNING_GOVERNED_EVENT_REGISTRY_V1.get(DERIVED_GESTURE_OBSERVATION_FAMILY_ID)!;
    validateAuthorization([
      auth('CONSENT_RECEIPT', 'derived-gesture-learning', PRODUCT_ANALYTICS_DATA_SERVICE_AUTHORITY_REFERENCE, PRODUCT_ANALYTICS_OPERATION_NOTICE_REFERENCE),
    ] as unknown as JsonValue, registeredL2, l2Issues);
    expect(l2Issues.some((issue) => issue.code === 'AUTHORIZATION_AUTHORITY_MISMATCH')).toBe(true);
    expect(l2Issues.some((issue) => issue.code === 'AUTHORIZATION_POLICY_MISMATCH')).toBe(true);

    const l3Issues: { code: string; path: string; message: string }[] = [];
    const registeredL3 = GESTURE_LEARNING_GOVERNED_EVENT_REGISTRY_V1.get(RAW_GESTURE_TRAJECTORY_FAMILY_ID)!;
    validateAuthorization([
      auth('CONSENT_RECEIPT', 'raw-trajectory-research', RAW_GESTURE_CONSENT_AUTHORITY_REFERENCE, RAW_GESTURE_NOTICE_REFERENCE),
    ] as unknown as JsonValue, registeredL3, l3Issues);
    expect(l3Issues.some((issue) => issue.code === 'AUTHORIZATION_COMBINATION_MISMATCH')).toBe(true);
    expect(l3Issues.some((issue) => issue.code === 'MISSING_AUTHORIZATION_BASIS')).toBe(true);
  });

  it('bounds L3 raw payloads and rejects unknown fields and oversized trajectories', () => {
    expect(payloadIssues(validRawPayload(), RAW_GESTURE_TRAJECTORY_FAMILY_DEFINITION_V1)).toEqual([]);

    const oversized = {
      ...(validRawPayload() as Record<string, JsonValue>),
      left: Array.from({ length: TRAJECTORY_CAPACITY + 1 }, (_, i) => rawPoint(i)),
    };
    expect(payloadIssues(oversized, RAW_GESTURE_TRAJECTORY_FAMILY_DEFINITION_V1).some((issue) => issue.code === 'PAYLOAD_ARRAY_BOUNDS')).toBe(true);

    const unknown = { ...(validRawPayload() as Record<string, JsonValue>), accountId: 'forbidden-cross-purpose-id' };
    expect(payloadIssues(unknown, RAW_GESTURE_TRAJECTORY_FAMILY_DEFINITION_V1).some((issue) => issue.code === 'PAYLOAD_UNKNOWN_PROPERTY')).toBe(true);
  });

  it('pins the raw schema to bounded production gesture constants without claiming the legacy uploader is live', () => {
    expect(RAW_GESTURE_TRAJECTORY_SCHEMA_ARTIFACT.perHandCapacity).toBe(TRAJECTORY_CAPACITY);
    expect(RAW_GESTURE_TRAJECTORY_SCHEMA_ARTIFACT.pointFields).toEqual(['x', 'y', 'z', 'pinched', 'dtMs']);
    expect(sha256Hex(canonicalJsonStringify(RAW_GESTURE_TRAJECTORY_SCHEMA_ARTIFACT))).toBe(
      RAW_GESTURE_TRAJECTORY_SCHEMA_REFERENCE.digest.value
    );
    expect(GESTURE_CLASSES).toContain('pinchTogether');
  });
});
