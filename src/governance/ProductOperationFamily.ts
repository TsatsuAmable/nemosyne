import { canonicalJsonStringify, sha256Hex } from '../security/CryptoHash.ts';
import {
  GOVERNED_DATA_CLASSES,
  GOVERNED_PURPOSES,
  type GovernedEventFamilyDefinitionV1Input,
  type ImmutableReferenceV1,
  type JsonValue,
} from './GovernedEventContracts.ts';
import { createGovernedEventRegistryV1 } from './GovernedEventRegistry.ts';

export const PRODUCT_OPERATION_FAMILY_ID = 'product.operation-applied.v1' as const;
export const PRODUCT_OPERATION_SOURCE_COMPONENT = 'product-operation-applied-projection' as const;

export const PRODUCT_OPERATION_VALUES = Object.freeze([
  'filter',
  'sort',
  'aggregate',
  'cluster',
  'hierarchical',
  'density',
  'anomaly',
  'timeSlice',
  'compare',
] as const);

export type ProductOperationValue = (typeof PRODUCT_OPERATION_VALUES)[number];

const PRODUCT_OPERATION_VALUE_SET = new Set<string>(PRODUCT_OPERATION_VALUES);

/**
 * Reviewed immutable policy artifacts for the first PT4 Product Mode family.
 *
 * The pinned digest is deliberately checked against the canonical artifact at
 * module initialization. Changing an artifact without changing its reviewed
 * version/digest therefore fails closed instead of silently changing consent
 * or retention meaning.
 */
export const PRODUCT_ANALYTICS_OPERATION_NOTICE_ARTIFACT = Object.freeze({
  schemaVersion: '1',
  id: 'product-analytics-operation-notice',
  version: '1.0.0',
  purpose: GOVERNED_PURPOSES.PRODUCT_ANALYTICS,
  familyId: PRODUCT_OPERATION_FAMILY_ID,
  dataClasses: Object.freeze([GOVERNED_DATA_CLASSES.PRODUCT_INTERACTION_METADATA]),
  defaultStatus: 'DENIED',
  summary:
    'Optional product analytics records only which governed operation was successfully applied. It excludes datasets, row counts, investigation content, discovery content, raw identity-provider identifiers and arbitrary operation metadata.',
} as const);

export const PRODUCT_ANALYTICS_OPERATION_RETENTION_ARTIFACT = Object.freeze({
  schemaVersion: '1',
  id: 'product-analytics-operation-retention',
  version: '1.0.0',
  purpose: GOVERNED_PURPOSES.PRODUCT_ANALYTICS,
  familyId: PRODUCT_OPERATION_FAMILY_ID,
  queryRetentionDays: 30,
  physicalDeletionDeadlineHours: 24,
  clock: 'SERVER_RECEIVED_AT',
} as const);

export const PRODUCT_ANALYTICS_DATA_SERVICE_AUTHORITY_ARTIFACT = Object.freeze({
  schemaVersion: '1',
  id: 'nemosyne-governed-data-service-authority',
  version: '1.0.0',
  purpose: GOVERNED_PURPOSES.PRODUCT_ANALYTICS,
  role: 'CONSENT_AND_EVENT_ADMISSION_AUTHORITY',
} as const);

const PINNED_NOTICE_SHA256 = '0630859502e6156857c00bda27d4dec43b705d02a6819362d0839e354fe656d6';
const PINNED_RETENTION_SHA256 = '1794d3be16d197dd88b0cdcf9aec811a295c8075709da0a4bc1509d46b3e837c';
const PINNED_AUTHORITY_SHA256 = 'e90ae9c1d5a5bcbaa07d734ee1042a43ad1fee213ddb07bfafc5b1706631f4d3';

function artifactDigest(artifact: JsonValue, expected: string, label: string): string {
  const actual = sha256Hex(canonicalJsonStringify(artifact));
  if (actual !== expected) {
    throw new Error(`${label} artifact digest mismatch: reviewed version must change before content changes`);
  }
  return actual;
}

function immutableReference(
  artifact: Readonly<{ schemaVersion: '1'; id: string; version: string }>,
  digestValue: string
): ImmutableReferenceV1 {
  return Object.freeze({
    schemaVersion: artifact.schemaVersion,
    id: artifact.id,
    version: artifact.version,
    digest: Object.freeze({ algorithm: 'SHA256' as const, value: digestValue }),
  });
}

export const PRODUCT_ANALYTICS_OPERATION_NOTICE_REFERENCE = immutableReference(
  PRODUCT_ANALYTICS_OPERATION_NOTICE_ARTIFACT,
  artifactDigest(
    PRODUCT_ANALYTICS_OPERATION_NOTICE_ARTIFACT as unknown as JsonValue,
    PINNED_NOTICE_SHA256,
    'product analytics operation notice'
  )
);

export const PRODUCT_ANALYTICS_OPERATION_RETENTION_REFERENCE = immutableReference(
  PRODUCT_ANALYTICS_OPERATION_RETENTION_ARTIFACT,
  artifactDigest(
    PRODUCT_ANALYTICS_OPERATION_RETENTION_ARTIFACT as unknown as JsonValue,
    PINNED_RETENTION_SHA256,
    'product analytics operation retention'
  )
);

export const PRODUCT_ANALYTICS_DATA_SERVICE_AUTHORITY_REFERENCE = immutableReference(
  PRODUCT_ANALYTICS_DATA_SERVICE_AUTHORITY_ARTIFACT,
  artifactDigest(
    PRODUCT_ANALYTICS_DATA_SERVICE_AUTHORITY_ARTIFACT as unknown as JsonValue,
    PINNED_AUTHORITY_SHA256,
    'governed data service authority'
  )
);

export const PRODUCT_OPERATION_FAMILY_DEFINITION_V1: GovernedEventFamilyDefinitionV1Input =
  Object.freeze({
    familyId: PRODUCT_OPERATION_FAMILY_ID,
    payloadSchemaVersion: '1',
    purpose: GOVERNED_PURPOSES.PRODUCT_ANALYTICS,
    dataClasses: Object.freeze([GOVERNED_DATA_CLASSES.PRODUCT_INTERACTION_METADATA]),
    identityRequirements: Object.freeze({
      profilePseudonymId: 'REQUIRED',
      productSessionId: 'REQUIRED',
      investigationId: 'FORBIDDEN',
      discoveryEpisodeId: 'FORBIDDEN',
    }),
    datasetRequirement: 'FORBIDDEN',
    runtimeRequirements: Object.freeze({
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
    }),
    requiredSeedNames: Object.freeze([]),
    allowedModes: Object.freeze(['PRODUCT']),
    allowedSourceComponents: Object.freeze([PRODUCT_OPERATION_SOURCE_COMPONENT]),
    payloadSchema: Object.freeze({
      type: 'object',
      properties: Object.freeze({
        operation: Object.freeze({
          type: 'string',
          minLength: 1,
          maxLength: 32,
          allowedValues: PRODUCT_OPERATION_VALUES,
        }),
      }),
      required: Object.freeze(['operation']),
    }),
    maxPayloadBytes: 256,
    retentionPolicy: Object.freeze({
      schemaVersion: '1',
      policy: PRODUCT_ANALYTICS_OPERATION_RETENTION_REFERENCE,
    }),
    authorizationRequirements: Object.freeze([
      Object.freeze({
        basis: 'CONSENT_RECEIPT',
        authority: PRODUCT_ANALYTICS_DATA_SERVICE_AUTHORITY_REFERENCE,
        policy: PRODUCT_ANALYTICS_OPERATION_NOTICE_REFERENCE,
      }),
    ]),
    exportVisibility: 'GOVERNED_EXPORT',
    revocationBehavior: 'DISCARD_QUEUED',
    erasureReachability: 'REGISTERED_STORE',
  });

/** The explicit first-family registry. It is not the default for unrelated producers. */
export const PRODUCT_GOVERNED_EVENT_REGISTRY_V1 = createGovernedEventRegistryV1([
  PRODUCT_OPERATION_FAMILY_DEFINITION_V1,
]);

/**
 * Project a successful production OPERATION_APPLIED payload into the closed
 * governed payload. No other source field is copied across the boundary.
 */
export function projectProductOperationAppliedV1(source: unknown): Readonly<{
  operation: ProductOperationValue;
}> | null {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
  const operation = (source as Readonly<Record<string, unknown>>).operation;
  if (typeof operation !== 'string' || !PRODUCT_OPERATION_VALUE_SET.has(operation)) return null;
  return Object.freeze({ operation: operation as ProductOperationValue });
}
