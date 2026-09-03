import { describe, expect, it } from 'vitest';
import {
  GOVERNED_DATA_CLASSES,
  GOVERNED_PURPOSES,
  PRODUCT_ANALYTICS_DATA_SERVICE_AUTHORITY_REFERENCE,
  PRODUCT_ANALYTICS_OPERATION_NOTICE_REFERENCE,
  PRODUCT_ANALYTICS_OPERATION_RETENTION_REFERENCE,
  PRODUCT_GOVERNED_EVENT_REGISTRY_V1,
  PRODUCT_OPERATION_FAMILY_DEFINITION_V1,
  PRODUCT_OPERATION_FAMILY_ID,
  PRODUCT_OPERATION_SOURCE_COMPONENT,
  PRODUCT_OPERATION_VALUES,
  projectProductOperationAppliedV1,
} from '../src/governance/index.ts';

describe('PT4B product.operation-applied.v1 family', () => {
  it('registers exactly the first RFC 0004 Product Mode family', () => {
    expect(PRODUCT_GOVERNED_EVENT_REGISTRY_V1.list()).toHaveLength(1);
    const family = PRODUCT_GOVERNED_EVENT_REGISTRY_V1.get(PRODUCT_OPERATION_FAMILY_ID);
    expect(family).toBeDefined();
    expect(family).toMatchObject({
      familyId: PRODUCT_OPERATION_FAMILY_ID,
      payloadSchemaVersion: '1',
      purpose: GOVERNED_PURPOSES.PRODUCT_ANALYTICS,
      dataClasses: [GOVERNED_DATA_CLASSES.PRODUCT_INTERACTION_METADATA],
      datasetRequirement: 'FORBIDDEN',
      allowedModes: ['PRODUCT'],
      allowedSourceComponents: [PRODUCT_OPERATION_SOURCE_COMPONENT],
      maxPayloadBytes: 256,
      exportVisibility: 'GOVERNED_EXPORT',
      revocationBehavior: 'DISCARD_QUEUED',
      erasureReachability: 'REGISTERED_STORE',
    });
  });

  it('requires only the RFC runtime and identity coordinates', () => {
    expect(PRODUCT_OPERATION_FAMILY_DEFINITION_V1.identityRequirements).toEqual({
      profilePseudonymId: 'REQUIRED',
      productSessionId: 'REQUIRED',
      investigationId: 'FORBIDDEN',
      discoveryEpisodeId: 'FORBIDDEN',
    });
    expect(PRODUCT_OPERATION_FAMILY_DEFINITION_V1.runtimeRequirements).toEqual({
      applicationBuild: 'REQUIRED',
      deploymentConfiguration: 'REQUIRED',
      wasmKernel: 'FORBIDDEN',
      representationTreatment: 'FORBIDDEN',
      monetaEngine: 'FORBIDDEN',
      fitnessModel: 'FORBIDDEN',
      nil: 'FORBIDDEN',
      perceptionGestureTreatment: 'FORBIDDEN',
      uiTreatment: 'REQUIRED',
      platformRuntime: 'REQUIRED',
    });
  });

  it('pins consent, retention and authority references to reviewed immutable digests', () => {
    expect(PRODUCT_ANALYTICS_OPERATION_NOTICE_REFERENCE).toEqual({
      schemaVersion: '1',
      id: 'product-analytics-operation-notice',
      version: '1.0.0',
      digest: {
        algorithm: 'SHA256',
        value: '0630859502e6156857c00bda27d4dec43b705d02a6819362d0839e354fe656d6',
      },
    });
    expect(PRODUCT_ANALYTICS_OPERATION_RETENTION_REFERENCE.digest.value).toBe(
      '1794d3be16d197dd88b0cdcf9aec811a295c8075709da0a4bc1509d46b3e837c'
    );
    expect(PRODUCT_ANALYTICS_DATA_SERVICE_AUTHORITY_REFERENCE.digest.value).toBe(
      'e90ae9c1d5a5bcbaa07d734ee1042a43ad1fee213ddb07bfafc5b1706631f4d3'
    );
  });

  it('projects only the closed successful-operation value', () => {
    for (const operation of PRODUCT_OPERATION_VALUES) {
      const source = {
        operation,
        rowCount: 999_999,
        datasetBefore: { secret: 'before' },
        datasetAfter: { secret: 'after' },
        arbitrary: 'must-not-cross',
      };
      const projected = projectProductOperationAppliedV1(source);
      expect(projected).toEqual({ operation });
      expect(Object.keys(projected ?? {})).toEqual(['operation']);
      expect(Object.isFrozen(projected)).toBe(true);
    }
  });

  it('fails closed for unknown, malformed or missing operation values', () => {
    expect(projectProductOperationAppliedV1(null)).toBeNull();
    expect(projectProductOperationAppliedV1([])).toBeNull();
    expect(projectProductOperationAppliedV1({})).toBeNull();
    expect(projectProductOperationAppliedV1({ operation: 1 })).toBeNull();
    expect(projectProductOperationAppliedV1({ operation: 'export' })).toBeNull();
    expect(projectProductOperationAppliedV1({ operation: 'FILTER' })).toBeNull();
  });

  it('uses one consent basis and the reviewed operation notice', () => {
    expect(PRODUCT_OPERATION_FAMILY_DEFINITION_V1.authorizationRequirements).toEqual([
      {
        basis: 'CONSENT_RECEIPT',
        authority: PRODUCT_ANALYTICS_DATA_SERVICE_AUTHORITY_REFERENCE,
        policy: PRODUCT_ANALYTICS_OPERATION_NOTICE_REFERENCE,
      },
    ]);
    expect(PRODUCT_OPERATION_FAMILY_DEFINITION_V1.retentionPolicy).toEqual({
      schemaVersion: '1',
      policy: PRODUCT_ANALYTICS_OPERATION_RETENTION_REFERENCE,
    });
  });
});
