import {
  FEATURE_DIM,
  GESTURE_CLASSES,
  type GestureClass,
} from '../../modules/gesture-intelligence/src/contracts.ts';
import {
  DERIVED_GESTURE_FEATURE_SCHEMA_REFERENCE,
  DERIVED_GESTURE_OBSERVATION_FAMILY_ID,
  GESTURE_LEARNING_GOVERNED_EVENT_REGISTRY_V1,
  GOVERNED_PURPOSES,
  decodeDerivedGestureLabelCodeV1,
  validateGovernedEventEnvelopeV1,
  type ImmutableReferenceV1,
  type JsonValue,
} from '../governance/index.ts';
import { canonicalSha256Hex } from '../security/CryptoHash.ts';
import {
  validateGestureTrainingSnapshotV1,
  type GestureTrainingSnapshotV1,
} from '../vr/input/GestureLearningContracts.ts';
import {
  type GestureTrainingSnapshotSourceV1,
} from './GestureTrainingSnapshotMaterializer.ts';
import { deepFreezeLearning, sameImmutableReferenceV1 } from './LearningContractPrimitives.ts';

export const GESTURE_TRAINING_FEATURE_DATASET_SCHEMA_VERSION = '1' as const;
export const GESTURE_TRAINING_FEATURE_DATASET_POLICY_VERSION = 'pt8-governed-feature-resolution-v1' as const;

export type GestureTrainingFeatureSplit = 'train' | 'validation' | 'test';

export interface GestureTrainingFeatureRowV1 {
  readonly recordId: string;
  readonly profilePseudonymId: string;
  readonly features: readonly number[];
  readonly label: GestureClass;
}

export interface GestureTrainingFeatureDatasetContentV1 {
  readonly schemaVersion: typeof GESTURE_TRAINING_FEATURE_DATASET_SCHEMA_VERSION;
  readonly policyVersion: typeof GESTURE_TRAINING_FEATURE_DATASET_POLICY_VERSION;
  readonly snapshot: ImmutableReferenceV1;
  readonly featureSchema: ImmutableReferenceV1;
  readonly splits: Readonly<Record<GestureTrainingFeatureSplit, readonly GestureTrainingFeatureRowV1[]>>;
}

export interface GestureTrainingFeatureDatasetV1 extends GestureTrainingFeatureDatasetContentV1 {
  readonly datasetDigest: Readonly<{ algorithm: 'SHA256'; value: string }>;
}

export type GestureTrainingFeatureDatasetIssueCode =
  | 'INVALID_SNAPSHOT'
  | 'INVALID_SOURCE_RECORD'
  | 'SOURCE_SNAPSHOT_MISMATCH'
  | 'INVALID_FEATURE_VECTOR'
  | 'INVALID_LABEL_BINDING'
  | 'DUPLICATE_RECORD';

export interface GestureTrainingFeatureDatasetIssueV1 {
  readonly code: GestureTrainingFeatureDatasetIssueCode;
  readonly path: string;
  readonly message: string;
}

export class GestureTrainingFeatureDatasetError extends Error {
  readonly issues: readonly GestureTrainingFeatureDatasetIssueV1[];

  constructor(issues: readonly GestureTrainingFeatureDatasetIssueV1[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '));
    this.name = 'GestureTrainingFeatureDatasetError';
    this.issues = Object.freeze([...issues]);
  }
}

interface DerivedPayloadV1 {
  readonly featureSchemaId: string;
  readonly featureSchemaVersion: string;
  readonly featureSchemaDigest: string;
  readonly features: readonly number[];
  readonly labelCode: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePayload(value: JsonValue, path: string): DerivedPayloadV1 {
  if (!isRecord(value)) {
    throw new GestureTrainingFeatureDatasetError([{
      code: 'INVALID_SOURCE_RECORD', path, message: 'governed L2 payload must be an object',
    }]);
  }
  const payload = value as Record<string, unknown>;
  if (
    payload.featureSchemaId !== DERIVED_GESTURE_FEATURE_SCHEMA_REFERENCE.id ||
    payload.featureSchemaVersion !== DERIVED_GESTURE_FEATURE_SCHEMA_REFERENCE.version ||
    payload.featureSchemaDigest !== DERIVED_GESTURE_FEATURE_SCHEMA_REFERENCE.digest.value ||
    !Array.isArray(payload.features) ||
    typeof payload.labelCode !== 'string'
  ) {
    throw new GestureTrainingFeatureDatasetError([{
      code: 'INVALID_SOURCE_RECORD', path, message: 'payload is not the frozen PT6 derived-feature schema',
    }]);
  }
  return payload as unknown as DerivedPayloadV1;
}

function snapshotReference(snapshot: GestureTrainingSnapshotV1): ImmutableReferenceV1 {
  return deepFreezeLearning({
    schemaVersion: '1' as const,
    id: snapshot.snapshotId,
    version: snapshot.snapshotVersion,
    digest: { algorithm: 'SHA256' as const, value: snapshot.snapshotDigest.value },
  });
}

function validFeatures(features: readonly number[]): boolean {
  return features.length === FEATURE_DIM && features.every((value) => Number.isFinite(value) && value >= -1 && value <= 1);
}

export async function resolveGestureTrainingFeatureDatasetV1(
  source: GestureTrainingSnapshotSourceV1,
  snapshot: GestureTrainingSnapshotV1,
): Promise<GestureTrainingFeatureDatasetV1> {
  const snapshotIssues = validateGestureTrainingSnapshotV1(snapshot);
  if (snapshotIssues.length > 0) {
    throw new GestureTrainingFeatureDatasetError([{
      code: 'INVALID_SNAPSHOT', path: 'snapshot', message: snapshotIssues.map((issue) => issue.code).join(','),
    }]);
  }

  const expected = new Map<string, Readonly<{
    split: GestureTrainingFeatureSplit;
    profilePseudonymId: string;
    contentDigest: string;
    label: GestureClass;
    featureSchema: ImmutableReferenceV1;
  }>>();
  for (const split of ['train', 'validation', 'test'] as const) {
    for (const sample of snapshot.splits[split].samples) {
      expected.set(sample.recordId, Object.freeze({
        split,
        profilePseudonymId: sample.profilePseudonymId,
        contentDigest: sample.contentDigest.value,
        label: sample.label.assignedGesture,
        featureSchema: sample.featureSchema,
      }));
    }
  }

  const records = await source.readDerivedLearningRecords(Object.freeze({
    schemaVersion: '1' as const,
    asOf: snapshot.createdAt,
    maxRecords: Math.max(expected.size, 1),
  }));
  if (!Array.isArray(records) || records.length !== expected.size) {
    throw new GestureTrainingFeatureDatasetError([{
      code: 'SOURCE_SNAPSHOT_MISMATCH', path: 'source', message: `expected exactly ${expected.size} retained snapshot records, received ${Array.isArray(records) ? records.length : 'non-array'}`,
    }]);
  }

  const rows: Record<GestureTrainingFeatureSplit, GestureTrainingFeatureRowV1[]> = {
    train: [], validation: [], test: [],
  };
  const seen = new Set<string>();
  for (const [index, record] of records.entries()) {
    const path = `records[${index}]`;
    if (!record || typeof record.eventId !== 'string' || typeof record.envelopeJson !== 'string') {
      throw new GestureTrainingFeatureDatasetError([{
        code: 'INVALID_SOURCE_RECORD', path, message: 'record identity and governed envelope are required',
      }]);
    }
    if (seen.has(record.eventId)) {
      throw new GestureTrainingFeatureDatasetError([{
        code: 'DUPLICATE_RECORD', path: `${path}.eventId`, message: 'source may not repeat one snapshot record',
      }]);
    }
    seen.add(record.eventId);
    const binding = expected.get(record.eventId);
    if (!binding) {
      throw new GestureTrainingFeatureDatasetError([{
        code: 'SOURCE_SNAPSHOT_MISMATCH', path: `${path}.eventId`, message: 'source returned a record outside the immutable snapshot',
      }]);
    }

    const validated = validateGovernedEventEnvelopeV1(record.envelopeJson, GESTURE_LEARNING_GOVERNED_EVENT_REGISTRY_V1);
    if (!validated.ok) {
      throw new GestureTrainingFeatureDatasetError([{
        code: 'INVALID_SOURCE_RECORD', path: `${path}.envelopeJson`, message: validated.issues.map((issue) => issue.code).join(','),
      }]);
    }
    const envelope = validated.envelope;
    if (
      envelope.eventId !== record.eventId ||
      envelope.eventFamilyId !== DERIVED_GESTURE_OBSERVATION_FAMILY_ID ||
      envelope.purpose !== GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING ||
      envelope.identities.profilePseudonymId !== binding.profilePseudonymId ||
      envelope.contentDigest.value !== binding.contentDigest ||
      !sameImmutableReferenceV1(binding.featureSchema, DERIVED_GESTURE_FEATURE_SCHEMA_REFERENCE)
    ) {
      throw new GestureTrainingFeatureDatasetError([{
        code: 'SOURCE_SNAPSHOT_MISMATCH', path, message: 'governed source identity/profile/content/schema no longer matches the immutable PT6 snapshot reference',
      }]);
    }

    const payload = parsePayload(envelope.payload, `${path}.payload`);
    if (!validFeatures(payload.features)) {
      throw new GestureTrainingFeatureDatasetError([{
        code: 'INVALID_FEATURE_VECTOR', path: `${path}.payload.features`, message: `features must be exactly ${FEATURE_DIM} finite values in [-1,1]`,
      }]);
    }
    const decoded = decodeDerivedGestureLabelCodeV1(payload.labelCode);
    if (!decoded || decoded.assignedGesture !== binding.label || !GESTURE_CLASSES.includes(decoded.assignedGesture)) {
      throw new GestureTrainingFeatureDatasetError([{
        code: 'INVALID_LABEL_BINDING', path: `${path}.payload.labelCode`, message: 'governed source label no longer matches frozen snapshot label provenance',
      }]);
    }
    rows[binding.split].push(Object.freeze({
      recordId: record.eventId,
      profilePseudonymId: binding.profilePseudonymId,
      features: Object.freeze([...payload.features]),
      label: binding.label,
    }));
  }

  for (const split of ['train', 'validation', 'test'] as const) {
    rows[split].sort((left, right) => left.recordId.localeCompare(right.recordId));
    if (rows[split].length !== snapshot.splits[split].samples.length) {
      throw new GestureTrainingFeatureDatasetError([{
        code: 'SOURCE_SNAPSHOT_MISMATCH', path: `splits.${split}`, message: 'resolved split membership does not exactly reproduce the snapshot',
      }]);
    }
  }

  const content: GestureTrainingFeatureDatasetContentV1 = {
    schemaVersion: GESTURE_TRAINING_FEATURE_DATASET_SCHEMA_VERSION,
    policyVersion: GESTURE_TRAINING_FEATURE_DATASET_POLICY_VERSION,
    snapshot: snapshotReference(snapshot),
    featureSchema: DERIVED_GESTURE_FEATURE_SCHEMA_REFERENCE,
    splits: deepFreezeLearning(rows),
  };
  return deepFreezeLearning({
    ...content,
    datasetDigest: { algorithm: 'SHA256' as const, value: canonicalSha256Hex(content) },
  });
}
