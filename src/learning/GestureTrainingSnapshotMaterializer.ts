import {
  DERIVED_GESTURE_AUTHORITY_REFERENCE,
  DERIVED_GESTURE_FEATURE_SCHEMA_REFERENCE,
  DERIVED_GESTURE_NOTICE_REFERENCE,
  DERIVED_GESTURE_OBSERVATION_FAMILY_ID,
  GESTURE_LEARNING_GOVERNED_EVENT_REGISTRY_V1,
  GOVERNED_PURPOSES,
  decodeDerivedGestureLabelCodeV1,
  validateGovernedEventEnvelopeV1,
  type AuthorizationReferenceV1,
  type GovernedEventEnvelopeV1,
  type ImmutableReferenceV1,
  type JsonValue,
} from '../governance/index.ts';
import {
  GestureLearningContractError,
  buildGestureTrainingSnapshotV1,
  type GestureLearningSampleRefV1,
  type GestureTrainingSnapshotBuildOptionsV1,
  type GestureTrainingSnapshotV1,
} from '../vr/input/GestureLearningContracts.ts';

const MAX_TOTAL_RECORDS = 1_000_000;
const MAX_ENVELOPE_BYTES = 16 * 1024;
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

export interface GestureTrainingSourceReadRequestV1 {
  readonly schemaVersion: '1';
  /** Inclusive server-received cutoff. Prevents later arrivals changing the materialized population. */
  readonly asOf: string;
  readonly maxRecords: number;
}

/**
 * Trusted internal projection from the governed durable store.
 *
 * It deliberately omits principal/deletion handles. The purpose-scoped profile
 * pseudonym remains inside the already-admitted envelope and is the only user
 * grouping authority visible to the learning plane.
 */
export interface GestureTrainingSourceRecordV1 {
  readonly eventId: string;
  readonly serverReceivedAt: string;
  readonly envelopeJson: string;
}

export interface GestureTrainingSnapshotSourceV1 {
  readDerivedLearningRecords(
    request: GestureTrainingSourceReadRequestV1,
  ): Promise<readonly GestureTrainingSourceRecordV1[]>;
}

export type GestureTrainingMaterializationIssueCode =
  | 'INVALID_SOURCE_RECORD'
  | 'WRONG_PURPOSE'
  | 'MISSING_PROFILE_PSEUDONYM'
  | 'INVALID_CONSENT_PROVENANCE'
  | 'INVALID_LABEL_PROVENANCE'
  | 'RESOURCE_LIMIT_EXCEEDED'
  | 'SNAPSHOT_CONTRACT_REFUSED';

export interface GestureTrainingMaterializationIssueV1 {
  readonly code: GestureTrainingMaterializationIssueCode;
  readonly path: string;
  readonly message: string;
}

export class GestureTrainingMaterializationError extends Error {
  readonly issues: readonly GestureTrainingMaterializationIssueV1[];

  constructor(issues: readonly GestureTrainingMaterializationIssueV1[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '));
    this.name = 'GestureTrainingMaterializationError';
    this.issues = Object.freeze([...issues]);
  }
}

interface DerivedGesturePayloadV1 {
  readonly featureSchemaId: string;
  readonly featureSchemaVersion: string;
  readonly featureSchemaDigest: string;
  readonly features: readonly number[];
  readonly labelCode: string;
  readonly evidenceId: string;
  readonly recordedAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((entry, index) => entry === expected[index]);
}

function validUtcTimestamp(value: unknown): value is string {
  return typeof value === 'string' && UTC_TIMESTAMP.test(value) && Number.isFinite(Date.parse(value));
}

function sameReference(left: ImmutableReferenceV1, right: ImmutableReferenceV1): boolean {
  return left.schemaVersion === right.schemaVersion &&
    left.id === right.id &&
    left.version === right.version &&
    left.digest.algorithm === right.digest.algorithm &&
    left.digest.value === right.digest.value;
}

function parseDerivedPayload(value: JsonValue, path: string): DerivedGesturePayloadV1 {
  if (!isRecord(value) || !exactKeys(value, [
    'featureSchemaId',
    'featureSchemaVersion',
    'featureSchemaDigest',
    'features',
    'labelCode',
    'evidenceId',
    'recordedAt',
  ])) {
    throw new GestureTrainingMaterializationError([{
      code: 'INVALID_SOURCE_RECORD',
      path,
      message: 'derived gesture payload is not the closed PT6B schema',
    }]);
  }
  if (
    value.featureSchemaId !== DERIVED_GESTURE_FEATURE_SCHEMA_REFERENCE.id ||
    value.featureSchemaVersion !== DERIVED_GESTURE_FEATURE_SCHEMA_REFERENCE.version ||
    value.featureSchemaDigest !== DERIVED_GESTURE_FEATURE_SCHEMA_REFERENCE.digest.value ||
    !Array.isArray(value.features) ||
    typeof value.labelCode !== 'string' ||
    typeof value.evidenceId !== 'string' ||
    !validUtcTimestamp(value.recordedAt)
  ) {
    throw new GestureTrainingMaterializationError([{
      code: 'INVALID_SOURCE_RECORD',
      path,
      message: 'derived gesture payload does not preserve the reviewed feature schema and bounded label evidence',
    }]);
  }
  return value as unknown as DerivedGesturePayloadV1;
}

function findConsentAuthorization(envelope: GovernedEventEnvelopeV1, path: string): AuthorizationReferenceV1 {
  const matches = envelope.authorization.filter((entry) => entry.basis === 'CONSENT_RECEIPT');
  if (matches.length !== 1) {
    throw new GestureTrainingMaterializationError([{
      code: 'INVALID_CONSENT_PROVENANCE',
      path: `${path}.authorization`,
      message: 'derived training evidence must carry exactly one explicit consent receipt',
    }]);
  }
  const authorization = matches[0];
  if (
    authorization.purpose !== GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING ||
    !sameReference(authorization.authority, DERIVED_GESTURE_AUTHORITY_REFERENCE) ||
    !sameReference(authorization.policy, DERIVED_GESTURE_NOTICE_REFERENCE)
  ) {
    throw new GestureTrainingMaterializationError([{
      code: 'INVALID_CONSENT_PROVENANCE',
      path: `${path}.authorization`,
      message: 'consent authority/policy does not match the reviewed derived-learning purpose',
    }]);
  }
  return authorization;
}

function materializeRecord(
  record: GestureTrainingSourceRecordV1,
  index: number,
  asOf: string,
): GestureLearningSampleRefV1 {
  const path = `records[${index}]`;
  if (
    !record || typeof record.eventId !== 'string' || !record.eventId ||
    !validUtcTimestamp(record.serverReceivedAt) || typeof record.envelopeJson !== 'string' || !record.envelopeJson
  ) {
    throw new GestureTrainingMaterializationError([{
      code: 'INVALID_SOURCE_RECORD',
      path,
      message: 'source record identity, server timestamp and envelope are required',
    }]);
  }
  if (Date.parse(record.serverReceivedAt) > Date.parse(asOf)) {
    throw new GestureTrainingMaterializationError([{
      code: 'INVALID_SOURCE_RECORD',
      path: `${path}.serverReceivedAt`,
      message: 'source returned a record newer than the immutable materialization cutoff',
    }]);
  }
  if (new TextEncoder().encode(record.envelopeJson).byteLength > MAX_ENVELOPE_BYTES) {
    throw new GestureTrainingMaterializationError([{
      code: 'RESOURCE_LIMIT_EXCEEDED',
      path: `${path}.envelopeJson`,
      message: `derived governed envelope exceeds the ${MAX_ENVELOPE_BYTES}-byte materialization bound`,
    }]);
  }

  const structural = validateGovernedEventEnvelopeV1(record.envelopeJson, GESTURE_LEARNING_GOVERNED_EVENT_REGISTRY_V1);
  if (!structural.ok) {
    throw new GestureTrainingMaterializationError([{
      code: 'INVALID_SOURCE_RECORD',
      path: `${path}.envelopeJson`,
      message: `governed envelope failed structural/digest validation: ${structural.issues.map((issue) => issue.code).join(',')}`,
    }]);
  }
  const envelope = structural.envelope;
  if (envelope.eventId !== record.eventId) {
    throw new GestureTrainingMaterializationError([{
      code: 'INVALID_SOURCE_RECORD',
      path: `${path}.eventId`,
      message: 'durable row identity does not match its governed envelope',
    }]);
  }
  if (
    envelope.eventFamilyId !== DERIVED_GESTURE_OBSERVATION_FAMILY_ID ||
    envelope.purpose !== GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING
  ) {
    throw new GestureTrainingMaterializationError([{
      code: 'WRONG_PURPOSE',
      path: `${path}.envelopeJson`,
      message: 'only admitted L2 derived gesture observations are eligible; L3 raw trajectories remain a separately governed research family',
    }]);
  }
  const profilePseudonymId = envelope.identities.profilePseudonymId;
  if (!profilePseudonymId) {
    throw new GestureTrainingMaterializationError([{
      code: 'MISSING_PROFILE_PSEUDONYM',
      path: `${path}.envelopeJson.identities.profilePseudonymId`,
      message: 'purpose-scoped profile identity is required for user-disjoint splitting',
    }]);
  }

  const payload = parseDerivedPayload(envelope.payload, `${path}.envelopeJson.payload`);
  const decoded = decodeDerivedGestureLabelCodeV1(payload.labelCode);
  if (!decoded) {
    throw new GestureTrainingMaterializationError([{
      code: 'INVALID_LABEL_PROVENANCE',
      path: `${path}.envelopeJson.payload.labelCode`,
      message: 'only frozen explicit confirmation/correction labels may become L2 training truth',
    }]);
  }
  const consent = findConsentAuthorization(envelope, `${path}.envelopeJson`);

  return Object.freeze({
    schemaVersion: '1',
    recordId: envelope.eventId,
    purpose: GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING,
    profilePseudonymId,
    featureSchema: DERIVED_GESTURE_FEATURE_SCHEMA_REFERENCE,
    // The PT6A sample-reference contract stores the exact SHA-256 value of the
    // admitted governed-event content digest while remaining agnostic to the
    // event-domain label. The source envelope is revalidated above before use.
    contentDigest: Object.freeze({ algorithm: 'SHA256' as const, value: envelope.contentDigest.value }),
    consent: Object.freeze({
      schemaVersion: '1',
      purpose: GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING,
      receipt: consent.evidence,
      policy: consent.policy,
    }),
    label: Object.freeze({
      schemaVersion: '1',
      rulesVersion: '1.0.0',
      source: decoded.source,
      predictedGesture: decoded.predictedGesture,
      assignedGesture: decoded.assignedGesture,
      evidenceId: payload.evidenceId,
      recordedAt: payload.recordedAt,
    }),
  });
}

/**
 * Materialize an immutable, user-disjoint L2 training snapshot from the trusted
 * governed durable-store projection. The snapshot contains references rather
 * than copied feature vectors, preserving source erasure reachability.
 */
export async function materializeGestureTrainingSnapshotV1(
  source: GestureTrainingSnapshotSourceV1,
  options: GestureTrainingSnapshotBuildOptionsV1,
): Promise<GestureTrainingSnapshotV1> {
  if (!validUtcTimestamp(options.createdAt)) {
    throw new GestureTrainingMaterializationError([{
      code: 'SNAPSHOT_CONTRACT_REFUSED',
      path: 'options.createdAt',
      message: 'materialization cutoff must be a canonical UTC timestamp',
    }]);
  }

  const records = await source.readDerivedLearningRecords(Object.freeze({
    schemaVersion: '1',
    asOf: options.createdAt,
    maxRecords: MAX_TOTAL_RECORDS,
  }));
  if (!Array.isArray(records) || records.length === 0 || records.length > MAX_TOTAL_RECORDS) {
    throw new GestureTrainingMaterializationError([{
      code: 'RESOURCE_LIMIT_EXCEEDED',
      path: 'records',
      message: `materialization requires 1..${MAX_TOTAL_RECORDS} retained governed L2 records`,
    }]);
  }

  const samples = records.map((record, index) => materializeRecord(record, index, options.createdAt));
  try {
    return buildGestureTrainingSnapshotV1(samples, options);
  } catch (error) {
    if (error instanceof GestureLearningContractError) {
      throw new GestureTrainingMaterializationError(error.issues.map((issue) => ({
        code: 'SNAPSHOT_CONTRACT_REFUSED' as const,
        path: issue.path,
        message: `${issue.code}: ${issue.message}`,
      })));
    }
    throw error;
  }
}
