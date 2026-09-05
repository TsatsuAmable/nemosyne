import {
  DERIVED_GESTURE_AUTHORITY_REFERENCE,
  DERIVED_GESTURE_FEATURE_SCHEMA_REFERENCE,
  DERIVED_GESTURE_NOTICE_REFERENCE,
  DERIVED_GESTURE_OBSERVATION_FAMILY_ID,
  GESTURE_LEARNING_GOVERNED_EVENT_REGISTRY_V1,
  GOVERNED_PURPOSES,
  canonicalGovernedJsonV1,
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

const EXPORT_SCHEMA_VERSION = '1' as const;
const MAX_EXPORT_BODIES = 10_000;
const MAX_TOTAL_RECORDS = 1_000_000;
const MAX_EXPORT_BODY_BYTES = 64 * 1024 * 1024;
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

export type GestureTrainingMaterializationIssueCode =
  | 'INVALID_EXPORT_BODY'
  | 'INVALID_EXPORT_MANIFEST'
  | 'WRONG_PURPOSE'
  | 'RECORD_COUNT_MISMATCH'
  | 'INVALID_GOVERNED_RECORD'
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

interface GestureLearningExportManifestV1 {
  readonly kind: 'MANIFEST';
  readonly schemaVersion: typeof EXPORT_SCHEMA_VERSION;
  readonly purpose: typeof GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING;
  readonly recordCount: number;
  readonly from: string;
  readonly to: string;
}

interface GestureLearningExportRecordV1 {
  readonly kind: 'RECORD';
  readonly serverReceivedAt: string;
  readonly envelope: GovernedEventEnvelopeV1;
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

function parseJsonLine(line: string, path: string): unknown {
  try {
    return JSON.parse(line) as unknown;
  } catch {
    throw new GestureTrainingMaterializationError([{
      code: 'INVALID_EXPORT_BODY',
      path,
      message: 'must contain valid JSON on every NDJSON line',
    }]);
  }
}

function parseManifest(value: unknown, path: string): GestureLearningExportManifestV1 {
  if (!isRecord(value) || !exactKeys(value, ['kind', 'schemaVersion', 'purpose', 'recordCount', 'from', 'to'])) {
    throw new GestureTrainingMaterializationError([{
      code: 'INVALID_EXPORT_MANIFEST',
      path,
      message: 'manifest must contain exactly kind, schemaVersion, purpose, recordCount, from and to',
    }]);
  }
  if (value.kind !== 'MANIFEST' || value.schemaVersion !== EXPORT_SCHEMA_VERSION) {
    throw new GestureTrainingMaterializationError([{
      code: 'INVALID_EXPORT_MANIFEST',
      path,
      message: 'manifest kind/schemaVersion is unsupported',
    }]);
  }
  if (value.purpose !== GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING) {
    throw new GestureTrainingMaterializationError([{
      code: 'WRONG_PURPOSE',
      path: `${path}.purpose`,
      message: 'PT6D training snapshots accept only derived-gesture-learning exports; raw trajectories are never silently promoted into training snapshots',
    }]);
  }
  if (!Number.isSafeInteger(value.recordCount) || (value.recordCount as number) < 0 || !validUtcTimestamp(value.from) || !validUtcTimestamp(value.to)) {
    throw new GestureTrainingMaterializationError([{
      code: 'INVALID_EXPORT_MANIFEST',
      path,
      message: 'recordCount and export time bounds are invalid',
    }]);
  }
  if (Date.parse(value.from) > Date.parse(value.to)) {
    throw new GestureTrainingMaterializationError([{
      code: 'INVALID_EXPORT_MANIFEST',
      path,
      message: 'manifest from must not exceed to',
    }]);
  }
  return value as unknown as GestureLearningExportManifestV1;
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
      code: 'INVALID_GOVERNED_RECORD',
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
      code: 'INVALID_GOVERNED_RECORD',
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

function materializeRecord(value: unknown, path: string): GestureLearningSampleRefV1 {
  if (!isRecord(value) || !exactKeys(value, ['kind', 'serverReceivedAt', 'envelope']) || value.kind !== 'RECORD' || !validUtcTimestamp(value.serverReceivedAt)) {
    throw new GestureTrainingMaterializationError([{
      code: 'INVALID_GOVERNED_RECORD',
      path,
      message: 'export record must contain exactly kind, serverReceivedAt and envelope',
    }]);
  }
  if (!isRecord(value.envelope)) {
    throw new GestureTrainingMaterializationError([{
      code: 'INVALID_GOVERNED_RECORD',
      path: `${path}.envelope`,
      message: 'envelope must be a governed-event object',
    }]);
  }

  let wire: string;
  try {
    wire = canonicalGovernedJsonV1(value.envelope as unknown as JsonValue);
  } catch {
    throw new GestureTrainingMaterializationError([{
      code: 'INVALID_GOVERNED_RECORD',
      path: `${path}.envelope`,
      message: 'envelope cannot be canonically represented as governed JSON',
    }]);
  }
  const structural = validateGovernedEventEnvelopeV1(wire, GESTURE_LEARNING_GOVERNED_EVENT_REGISTRY_V1);
  if (!structural.ok) {
    throw new GestureTrainingMaterializationError([{
      code: 'INVALID_GOVERNED_RECORD',
      path: `${path}.envelope`,
      message: `governed envelope failed structural/digest validation: ${structural.issues.map((issue) => issue.code).join(',')}`,
    }]);
  }
  const envelope = structural.envelope;
  if (
    envelope.eventFamilyId !== DERIVED_GESTURE_OBSERVATION_FAMILY_ID ||
    envelope.purpose !== GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING
  ) {
    throw new GestureTrainingMaterializationError([{
      code: 'WRONG_PURPOSE',
      path: `${path}.envelope.eventFamilyId`,
      message: 'only admitted L2 derived gesture observations are eligible for this snapshot contract',
    }]);
  }
  const profilePseudonymId = envelope.identities.profilePseudonymId;
  if (!profilePseudonymId) {
    throw new GestureTrainingMaterializationError([{
      code: 'MISSING_PROFILE_PSEUDONYM',
      path: `${path}.envelope.identities.profilePseudonymId`,
      message: 'purpose-scoped profile identity is required for user-disjoint splitting',
    }]);
  }

  const payload = parseDerivedPayload(envelope.payload, `${path}.envelope.payload`);
  const decoded = decodeDerivedGestureLabelCodeV1(payload.labelCode);
  if (!decoded) {
    throw new GestureTrainingMaterializationError([{
      code: 'INVALID_LABEL_PROVENANCE',
      path: `${path}.envelope.payload.labelCode`,
      message: 'only frozen explicit confirmation/correction labels may become L2 training truth',
    }]);
  }
  const consent = findConsentAuthorization(envelope, `${path}.envelope`);

  return Object.freeze({
    schemaVersion: '1',
    recordId: envelope.eventId,
    purpose: GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING,
    profilePseudonymId,
    featureSchema: DERIVED_GESTURE_FEATURE_SCHEMA_REFERENCE,
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

function samplesFromExport(body: string, exportIndex: number): readonly GestureLearningSampleRefV1[] {
  const path = `exports[${exportIndex}]`;
  const bytes = new TextEncoder().encode(body).byteLength;
  if (bytes > MAX_EXPORT_BODY_BYTES) {
    throw new GestureTrainingMaterializationError([{
      code: 'RESOURCE_LIMIT_EXCEEDED',
      path,
      message: `one governed export exceeds the ${MAX_EXPORT_BODY_BYTES}-byte materialization bound`,
    }]);
  }
  const normalized = body.endsWith('\n') ? body.slice(0, -1) : body;
  if (!normalized || normalized.includes('\n\n')) {
    throw new GestureTrainingMaterializationError([{
      code: 'INVALID_EXPORT_BODY',
      path,
      message: 'governed export must be non-empty NDJSON without blank records',
    }]);
  }
  const lines = normalized.split('\n');
  const manifest = parseManifest(parseJsonLine(lines[0], `${path}.manifest`), `${path}.manifest`);
  const records = lines.slice(1);
  if (records.length !== manifest.recordCount) {
    throw new GestureTrainingMaterializationError([{
      code: 'RECORD_COUNT_MISMATCH',
      path,
      message: `manifest declares ${manifest.recordCount} records but export contains ${records.length}`,
    }]);
  }
  return Object.freeze(records.map((line, index) =>
    materializeRecord(parseJsonLine(line, `${path}.records[${index}]`), `${path}.records[${index}]`)
  ));
}

/**
 * PT6D repository-runnable materializer.
 *
 * Input must be purpose-scoped governed exports produced from the durable PT6C
 * store. The output intentionally contains immutable references rather than
 * copied feature vectors, keeping later erasure/reachability on the governed
 * source records. Raw L3 trajectories are categorically refused here.
 */
export function materializeGestureTrainingSnapshotV1(
  governedDerivedExports: readonly string[],
  options: GestureTrainingSnapshotBuildOptionsV1,
): GestureTrainingSnapshotV1 {
  if (governedDerivedExports.length === 0 || governedDerivedExports.length > MAX_EXPORT_BODIES) {
    throw new GestureTrainingMaterializationError([{
      code: 'RESOURCE_LIMIT_EXCEEDED',
      path: 'exports',
      message: `materialization requires 1..${MAX_EXPORT_BODIES} bounded governed exports`,
    }]);
  }

  const samples: GestureLearningSampleRefV1[] = [];
  for (let index = 0; index < governedDerivedExports.length; index += 1) {
    const next = samplesFromExport(governedDerivedExports[index], index);
    if (samples.length + next.length > MAX_TOTAL_RECORDS) {
      throw new GestureTrainingMaterializationError([{
        code: 'RESOURCE_LIMIT_EXCEEDED',
        path: 'exports',
        message: `materialization exceeds the ${MAX_TOTAL_RECORDS}-record bound`,
      }]);
    }
    samples.push(...next);
  }

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
