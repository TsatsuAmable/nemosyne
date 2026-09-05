import {
  FEATURE_DIM,
  FEATURE_WINDOW_FRAMES,
  GESTURE_CLASSES,
  TRAJECTORY_CAPACITY,
  type GestureClass,
} from '../../modules/gesture-intelligence/src/contracts.ts';
import { canonicalJsonStringify, sha256Hex } from '../security/CryptoHash.ts';
import {
  GOVERNED_DATA_CLASSES,
  GOVERNED_PURPOSES,
  type GovernedEventFamilyDefinitionV1Input,
  type ImmutableReferenceV1,
  type JsonValue,
} from './GovernedEventContracts.ts';
import { createGovernedEventRegistryV1 } from './GovernedEventRegistry.ts';

export const DERIVED_GESTURE_OBSERVATION_FAMILY_ID = 'gesture.derived-observation.v1' as const;
export const RAW_GESTURE_TRAJECTORY_FAMILY_ID = 'gesture.raw-trajectory-research.v1' as const;
export const DERIVED_GESTURE_SOURCE_COMPONENT = 'gesture-derived-learning-projection' as const;
export const RAW_GESTURE_SOURCE_COMPONENT = 'gesture-raw-trajectory-research-projection' as const;

const CONFIRM_PREFIX = 'CONFIRM:';
const CORRECT_PREFIX = 'CORRECT:';

export const DERIVED_GESTURE_LABEL_CODES = Object.freeze([
  ...GESTURE_CLASSES.map((gesture) => `${CONFIRM_PREFIX}${gesture}`),
  ...GESTURE_CLASSES.flatMap((predicted) =>
    GESTURE_CLASSES.filter((assigned) => assigned !== predicted).map(
      (assigned) => `${CORRECT_PREFIX}${predicted}->${assigned}`
    )
  ),
] as const);

export type DerivedGestureStrongLabelV1 = Readonly<{
  source: 'EXPLICIT_CONFIRMATION' | 'EXPLICIT_CORRECTION';
  predictedGesture: GestureClass;
  assignedGesture: GestureClass;
}>;

const gestureSet = new Set<string>(GESTURE_CLASSES);

export function decodeDerivedGestureLabelCodeV1(code: string): DerivedGestureStrongLabelV1 | null {
  if (code.startsWith(CONFIRM_PREFIX)) {
    const gesture = code.slice(CONFIRM_PREFIX.length);
    if (!gestureSet.has(gesture)) return null;
    return Object.freeze({
      source: 'EXPLICIT_CONFIRMATION',
      predictedGesture: gesture as GestureClass,
      assignedGesture: gesture as GestureClass,
    });
  }
  if (!code.startsWith(CORRECT_PREFIX)) return null;
  const [predicted, assigned, extra] = code.slice(CORRECT_PREFIX.length).split('->');
  if (extra !== undefined || !gestureSet.has(predicted) || !gestureSet.has(assigned) || predicted === assigned) {
    return null;
  }
  return Object.freeze({
    source: 'EXPLICIT_CORRECTION',
    predictedGesture: predicted as GestureClass,
    assignedGesture: assigned as GestureClass,
  });
}

/**
 * Reviewed immutable artifacts. Every digest is pinned below and verified at
 * module initialization. Changing their meaning therefore requires an explicit
 * version/digest review rather than silently changing consent or evidence semantics.
 */
export const DERIVED_GESTURE_FEATURE_SCHEMA_ARTIFACT = Object.freeze({
  schemaVersion: '1',
  id: 'gesture-derived-feature-schema',
  version: '1.0.0',
  featureDim: FEATURE_DIM,
  featureWindowFrames: FEATURE_WINDOW_FRAMES,
  valueMinimum: -1,
  valueMaximum: 1,
  source: '@nemosyne/gesture-intelligence extractFeatures',
} as const);

export const DERIVED_GESTURE_NOTICE_ARTIFACT = Object.freeze({
  schemaVersion: '1',
  id: 'gesture-derived-learning-notice',
  version: '1.0.0',
  purpose: GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING,
  familyId: DERIVED_GESTURE_OBSERVATION_FAMILY_ID,
  dataClasses: Object.freeze([GOVERNED_DATA_CLASSES.DERIVED_GESTURE_FEATURE]),
  defaultStatus: 'DENIED',
  summary:
    'Optional gesture learning records exactly 56 bounded on-device derived features plus an explicit confirmation or correction label and attributable gesture-treatment provenance. It excludes raw hand trajectories, product analytics identifiers, investigation content and automatic predictions as training truth.',
} as const);

export const DERIVED_GESTURE_RETENTION_ARTIFACT = Object.freeze({
  schemaVersion: '1',
  id: 'gesture-derived-learning-retention',
  version: '1.0.0',
  purpose: GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING,
  familyId: DERIVED_GESTURE_OBSERVATION_FAMILY_ID,
  maximumRetentionDays: 90,
  physicalDeletionDeadlineHours: 24,
  clock: 'SERVER_RECEIVED_AT',
} as const);

export const DERIVED_GESTURE_AUTHORITY_ARTIFACT = Object.freeze({
  schemaVersion: '1',
  id: 'nemosyne-derived-gesture-learning-authority',
  version: '1.0.0',
  purpose: GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING,
  role: 'CONSENT_AND_EVENT_ADMISSION_AUTHORITY',
} as const);

export const RAW_GESTURE_TRAJECTORY_SCHEMA_ARTIFACT = Object.freeze({
  schemaVersion: '1',
  id: 'gesture-raw-trajectory-schema',
  version: '1.0.0',
  coordinateFrame: 'APPLICATION_WORLD_METERS',
  timestampUnit: 'MILLISECONDS_FROM_CAPTURE_START',
  perHandCapacity: TRAJECTORY_CAPACITY,
  pointFields: Object.freeze(['x', 'y', 'z', 'pinched', 'dtMs']),
} as const);

export const RAW_GESTURE_NOTICE_ARTIFACT = Object.freeze({
  schemaVersion: '1',
  id: 'gesture-raw-trajectory-research-notice',
  version: '1.0.0',
  purpose: GOVERNED_PURPOSES.RAW_TRAJECTORY_RESEARCH,
  familyId: RAW_GESTURE_TRAJECTORY_FAMILY_ID,
  dataClasses: Object.freeze([GOVERNED_DATA_CLASSES.RAW_SPATIAL_TRAJECTORY]),
  defaultStatus: 'DENIED',
  summary:
    'Research-only capture of bounded dual-hand spatial trajectories in application world coordinates. Raw trajectories are highly sensitive, require separate explicit consent plus a frozen study protocol, and are never authorized by product analytics or derived-learning consent.',
} as const);

export const RAW_GESTURE_RETENTION_ARTIFACT = Object.freeze({
  schemaVersion: '1',
  id: 'gesture-raw-trajectory-research-retention',
  version: '1.0.0',
  purpose: GOVERNED_PURPOSES.RAW_TRAJECTORY_RESEARCH,
  familyId: RAW_GESTURE_TRAJECTORY_FAMILY_ID,
  maximumRetentionDays: 14,
  protocolMayRequireShorterRetention: true,
  physicalDeletionDeadlineHours: 24,
  clock: 'SERVER_RECEIVED_AT',
} as const);

export const RAW_GESTURE_CONSENT_AUTHORITY_ARTIFACT = Object.freeze({
  schemaVersion: '1',
  id: 'nemosyne-raw-trajectory-research-consent-authority',
  version: '1.0.0',
  purpose: GOVERNED_PURPOSES.RAW_TRAJECTORY_RESEARCH,
  role: 'CONSENT_AND_EVENT_ADMISSION_AUTHORITY',
} as const);

export const RAW_GESTURE_PROTOCOL_AUTHORITY_ARTIFACT = Object.freeze({
  schemaVersion: '1',
  id: 'nemosyne-gesture-research-protocol-authority',
  version: '1.0.0',
  purpose: GOVERNED_PURPOSES.RAW_TRAJECTORY_RESEARCH,
  role: 'FROZEN_STUDY_PROTOCOL_AUTHORITY',
} as const);

export const RAW_GESTURE_PROTOCOL_POLICY_ARTIFACT = Object.freeze({
  schemaVersion: '1',
  id: 'gesture-raw-trajectory-protocol-policy',
  version: '1.0.0',
  purpose: GOVERNED_PURPOSES.RAW_TRAJECTORY_RESEARCH,
  familyId: RAW_GESTURE_TRAJECTORY_FAMILY_ID,
  requireFrozenProtocolPerCapture: true,
  protocolMayShortenRetention: true,
} as const);

const PINNED = Object.freeze({
  derivedFeatureSchema: 'eb15557ab5ff289d6386de40c0b244dd66d80183e0533827cc9380b0b5a5febb',
  derivedNotice: 'a63dd5c11d5e15bd9aef2cb534f42c88f127707106222fbccf6f5d1b765bb0b1',
  derivedRetention: 'dfe20dad358f16eebcb91c3e8d6fa58b5de0f2d87f667a9c4bd2ab9a183ea90e',
  derivedAuthority: '845448b8b2141172ace85e6b6aeae69d8717f7a5a3ecd4419868f77740ea01dc',
  rawTrajectorySchema: 'edeb4f525bf2dce3c535f30cd455f279b0fbee06346d7237cc353a60bcc6c1dd',
  rawNotice: '614c8508def5610dfa7ff78cf10d53004d5b4c71a43702df7222e9e6f45edcb8',
  rawRetention: 'bdbb6b7d156dd962a16482ad3d88f866fe73f2705dda10b3cb1b107db6ed4520',
  rawConsentAuthority: '0c38c98f7221a4456daae5b60849bffab408c194f05b20831c35cd118fcbc3f5',
  rawProtocolAuthority: 'e58dc6b319ed07ca05cacf17748bec7d3deeaa8a165aadc4fd8c4e55803c0119',
  rawProtocolPolicy: '9890fb2694f876e3bcafd977f64710f88e37ddcad9709afdc39368c34a2a7e36',
});

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

export const DERIVED_GESTURE_FEATURE_SCHEMA_REFERENCE = immutableReference(
  DERIVED_GESTURE_FEATURE_SCHEMA_ARTIFACT,
  artifactDigest(
    DERIVED_GESTURE_FEATURE_SCHEMA_ARTIFACT as unknown as JsonValue,
    PINNED.derivedFeatureSchema,
    'derived gesture feature schema'
  )
);
export const DERIVED_GESTURE_NOTICE_REFERENCE = immutableReference(
  DERIVED_GESTURE_NOTICE_ARTIFACT,
  artifactDigest(DERIVED_GESTURE_NOTICE_ARTIFACT as unknown as JsonValue, PINNED.derivedNotice, 'derived gesture notice')
);
export const DERIVED_GESTURE_RETENTION_REFERENCE = immutableReference(
  DERIVED_GESTURE_RETENTION_ARTIFACT,
  artifactDigest(DERIVED_GESTURE_RETENTION_ARTIFACT as unknown as JsonValue, PINNED.derivedRetention, 'derived gesture retention')
);
export const DERIVED_GESTURE_AUTHORITY_REFERENCE = immutableReference(
  DERIVED_GESTURE_AUTHORITY_ARTIFACT,
  artifactDigest(DERIVED_GESTURE_AUTHORITY_ARTIFACT as unknown as JsonValue, PINNED.derivedAuthority, 'derived gesture authority')
);
export const RAW_GESTURE_TRAJECTORY_SCHEMA_REFERENCE = immutableReference(
  RAW_GESTURE_TRAJECTORY_SCHEMA_ARTIFACT,
  artifactDigest(RAW_GESTURE_TRAJECTORY_SCHEMA_ARTIFACT as unknown as JsonValue, PINNED.rawTrajectorySchema, 'raw gesture trajectory schema')
);
export const RAW_GESTURE_NOTICE_REFERENCE = immutableReference(
  RAW_GESTURE_NOTICE_ARTIFACT,
  artifactDigest(RAW_GESTURE_NOTICE_ARTIFACT as unknown as JsonValue, PINNED.rawNotice, 'raw gesture notice')
);
export const RAW_GESTURE_RETENTION_REFERENCE = immutableReference(
  RAW_GESTURE_RETENTION_ARTIFACT,
  artifactDigest(RAW_GESTURE_RETENTION_ARTIFACT as unknown as JsonValue, PINNED.rawRetention, 'raw gesture retention')
);
export const RAW_GESTURE_CONSENT_AUTHORITY_REFERENCE = immutableReference(
  RAW_GESTURE_CONSENT_AUTHORITY_ARTIFACT,
  artifactDigest(RAW_GESTURE_CONSENT_AUTHORITY_ARTIFACT as unknown as JsonValue, PINNED.rawConsentAuthority, 'raw gesture consent authority')
);
export const RAW_GESTURE_PROTOCOL_AUTHORITY_REFERENCE = immutableReference(
  RAW_GESTURE_PROTOCOL_AUTHORITY_ARTIFACT,
  artifactDigest(RAW_GESTURE_PROTOCOL_AUTHORITY_ARTIFACT as unknown as JsonValue, PINNED.rawProtocolAuthority, 'raw gesture protocol authority')
);
export const RAW_GESTURE_PROTOCOL_POLICY_REFERENCE = immutableReference(
  RAW_GESTURE_PROTOCOL_POLICY_ARTIFACT,
  artifactDigest(RAW_GESTURE_PROTOCOL_POLICY_ARTIFACT as unknown as JsonValue, PINNED.rawProtocolPolicy, 'raw gesture protocol policy')
);

const derivedGestureFamily: GovernedEventFamilyDefinitionV1Input = {
  familyId: DERIVED_GESTURE_OBSERVATION_FAMILY_ID,
  payloadSchemaVersion: '1',
  purpose: GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING,
  dataClasses: [GOVERNED_DATA_CLASSES.DERIVED_GESTURE_FEATURE],
  identityRequirements: {
    profilePseudonymId: 'REQUIRED',
    productSessionId: 'FORBIDDEN',
    investigationId: 'FORBIDDEN',
    discoveryEpisodeId: 'FORBIDDEN',
  },
  datasetRequirement: 'FORBIDDEN',
  runtimeRequirements: {
    applicationBuild: 'REQUIRED',
    deploymentConfiguration: 'REQUIRED',
    wasmKernel: 'FORBIDDEN',
    representationTreatment: 'FORBIDDEN',
    monetaEngine: 'FORBIDDEN',
    fitnessModel: 'FORBIDDEN',
    nil: 'FORBIDDEN',
    perceptionGestureTreatment: 'REQUIRED',
    uiTreatment: 'FORBIDDEN',
    platformRuntime: 'REQUIRED',
  },
  requiredSeedNames: [],
  allowedModes: ['PRODUCT'],
  allowedSourceComponents: [DERIVED_GESTURE_SOURCE_COMPONENT],
  payloadSchema: {
    type: 'object',
    properties: {
      featureSchemaId: { type: 'string', minLength: 1, maxLength: 64, allowedValues: [DERIVED_GESTURE_FEATURE_SCHEMA_REFERENCE.id] },
      featureSchemaVersion: { type: 'string', minLength: 1, maxLength: 64, allowedValues: [DERIVED_GESTURE_FEATURE_SCHEMA_REFERENCE.version] },
      featureSchemaDigest: { type: 'string', minLength: 64, maxLength: 64, format: 'SHA256_HEX', allowedValues: [DERIVED_GESTURE_FEATURE_SCHEMA_REFERENCE.digest.value] },
      features: { type: 'array', minItems: FEATURE_DIM, maxItems: FEATURE_DIM, items: { type: 'number', minimum: -1, maximum: 1 } },
      labelCode: { type: 'string', minLength: 1, maxLength: 64, allowedValues: DERIVED_GESTURE_LABEL_CODES },
      evidenceId: { type: 'string', minLength: 1, maxLength: 160 },
      recordedAt: { type: 'string', minLength: 24, maxLength: 24, format: 'UTC_TIMESTAMP' },
    },
    required: ['featureSchemaId', 'featureSchemaVersion', 'featureSchemaDigest', 'features', 'labelCode', 'evidenceId', 'recordedAt'],
  },
  maxPayloadBytes: 8_192,
  retentionPolicy: { schemaVersion: '1', policy: DERIVED_GESTURE_RETENTION_REFERENCE },
  authorizationRequirements: [{
    basis: 'CONSENT_RECEIPT',
    authority: DERIVED_GESTURE_AUTHORITY_REFERENCE,
    policy: DERIVED_GESTURE_NOTICE_REFERENCE,
  }],
  exportVisibility: 'GOVERNED_EXPORT',
  revocationBehavior: 'DISCARD_QUEUED',
  erasureReachability: 'REGISTERED_STORE',
};

const rawPointSchema = {
  type: 'object' as const,
  properties: {
    x: { type: 'number' as const, minimum: -1_000, maximum: 1_000 },
    y: { type: 'number' as const, minimum: -1_000, maximum: 1_000 },
    z: { type: 'number' as const, minimum: -1_000, maximum: 1_000 },
    pinched: { type: 'boolean' as const },
    dtMs: { type: 'number' as const, minimum: 0, maximum: 60_000 },
  },
  required: ['x', 'y', 'z', 'pinched', 'dtMs'],
};

const rawGestureFamily: GovernedEventFamilyDefinitionV1Input = {
  familyId: RAW_GESTURE_TRAJECTORY_FAMILY_ID,
  payloadSchemaVersion: '1',
  purpose: GOVERNED_PURPOSES.RAW_TRAJECTORY_RESEARCH,
  dataClasses: [GOVERNED_DATA_CLASSES.RAW_SPATIAL_TRAJECTORY],
  identityRequirements: {
    profilePseudonymId: 'REQUIRED',
    productSessionId: 'FORBIDDEN',
    investigationId: 'FORBIDDEN',
    discoveryEpisodeId: 'FORBIDDEN',
  },
  datasetRequirement: 'FORBIDDEN',
  runtimeRequirements: {
    applicationBuild: 'REQUIRED',
    deploymentConfiguration: 'REQUIRED',
    wasmKernel: 'FORBIDDEN',
    representationTreatment: 'FORBIDDEN',
    monetaEngine: 'FORBIDDEN',
    fitnessModel: 'FORBIDDEN',
    nil: 'FORBIDDEN',
    perceptionGestureTreatment: 'REQUIRED',
    uiTreatment: 'FORBIDDEN',
    platformRuntime: 'REQUIRED',
  },
  requiredSeedNames: [],
  allowedModes: ['RESEARCH'],
  allowedSourceComponents: [RAW_GESTURE_SOURCE_COMPONENT],
  payloadSchema: {
    type: 'object',
    properties: {
      trajectorySchemaId: { type: 'string', minLength: 1, maxLength: 64, allowedValues: [RAW_GESTURE_TRAJECTORY_SCHEMA_REFERENCE.id] },
      trajectorySchemaVersion: { type: 'string', minLength: 1, maxLength: 64, allowedValues: [RAW_GESTURE_TRAJECTORY_SCHEMA_REFERENCE.version] },
      trajectorySchemaDigest: { type: 'string', minLength: 64, maxLength: 64, format: 'SHA256_HEX', allowedValues: [RAW_GESTURE_TRAJECTORY_SCHEMA_REFERENCE.digest.value] },
      coordinateFrame: { type: 'string', minLength: 1, maxLength: 64, allowedValues: [RAW_GESTURE_TRAJECTORY_SCHEMA_ARTIFACT.coordinateFrame] },
      left: { type: 'array', minItems: 1, maxItems: TRAJECTORY_CAPACITY, items: rawPointSchema },
      right: { type: 'array', minItems: 1, maxItems: TRAJECTORY_CAPACITY, items: rawPointSchema },
      protocolTargetGesture: { type: 'string', minLength: 1, maxLength: 32, allowedValues: GESTURE_CLASSES },
    },
    required: ['trajectorySchemaId', 'trajectorySchemaVersion', 'trajectorySchemaDigest', 'coordinateFrame', 'left', 'right'],
  },
  maxPayloadBytes: 65_536,
  retentionPolicy: { schemaVersion: '1', policy: RAW_GESTURE_RETENTION_REFERENCE },
  authorizationRequirements: [
    {
      basis: 'CONSENT_RECEIPT',
      authority: RAW_GESTURE_CONSENT_AUTHORITY_REFERENCE,
      policy: RAW_GESTURE_NOTICE_REFERENCE,
    },
    {
      basis: 'FROZEN_STUDY_PROTOCOL',
      authority: RAW_GESTURE_PROTOCOL_AUTHORITY_REFERENCE,
      policy: RAW_GESTURE_PROTOCOL_POLICY_REFERENCE,
    },
  ],
  exportVisibility: 'GOVERNED_EXPORT',
  revocationBehavior: 'POLICY_GOVERNED',
  erasureReachability: 'REGISTERED_STORE',
};

export const DERIVED_GESTURE_OBSERVATION_FAMILY_DEFINITION_V1 = Object.freeze(derivedGestureFamily);
export const RAW_GESTURE_TRAJECTORY_FAMILY_DEFINITION_V1 = Object.freeze(rawGestureFamily);

/** Explicit PT6 learning registry. It is not merged into Product Analytics by default. */
export const GESTURE_LEARNING_GOVERNED_EVENT_REGISTRY_V1 = createGovernedEventRegistryV1([
  DERIVED_GESTURE_OBSERVATION_FAMILY_DEFINITION_V1,
  RAW_GESTURE_TRAJECTORY_FAMILY_DEFINITION_V1,
]);
