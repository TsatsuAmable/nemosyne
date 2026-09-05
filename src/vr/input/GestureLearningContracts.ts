import {
  GESTURE_CLASSES,
  type GestureClass,
} from '../../../modules/gesture-intelligence/src/contracts.ts';
import {
  GOVERNED_PURPOSES,
  type AuthorizationEvidenceV1,
  type ImmutableReferenceV1,
  type Sha256DigestV1,
} from '../../governance/GovernedEventContracts.ts';
import { canonicalSha256Hex, sha256Hex } from '../../security/CryptoHash.ts';

export const GESTURE_LEARNING_SCHEMA_VERSION = '1' as const;
export const GESTURE_LABEL_PROVENANCE_RULE_VERSION = '1.0.0' as const;
export const GESTURE_SNAPSHOT_SPLIT_POLICY_VERSION = 'profile-disjoint-v1' as const;

export const GESTURE_LEARNING_LEVELS = Object.freeze([
  'L0_NO_LEARNING_COLLECTION',
  'L1_PRODUCT_INTERACTION_TELEMETRY',
  'L2_DERIVED_GESTURE_LEARNING',
  'L3_RAW_TRAJECTORY_RESEARCH',
] as const);

export type GestureLearningLevel = (typeof GESTURE_LEARNING_LEVELS)[number];

export const GESTURE_LABEL_SOURCES = Object.freeze([
  'EXPLICIT_CONFIRMATION',
  'EXPLICIT_CORRECTION',
  'PROTOCOL_TARGET',
] as const);

export type GestureLabelSource = (typeof GESTURE_LABEL_SOURCES)[number];
export type GestureTrainingSplit = 'train' | 'validation' | 'test';

export interface GestureLearningConsentEvidenceV1 {
  readonly schemaVersion: typeof GESTURE_LEARNING_SCHEMA_VERSION;
  readonly purpose:
    | typeof GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING
    | typeof GOVERNED_PURPOSES.RAW_TRAJECTORY_RESEARCH;
  readonly receipt: AuthorizationEvidenceV1;
  readonly policy: ImmutableReferenceV1;
}

export interface GestureLabelProvenanceV1 {
  readonly schemaVersion: typeof GESTURE_LEARNING_SCHEMA_VERSION;
  readonly rulesVersion: typeof GESTURE_LABEL_PROVENANCE_RULE_VERSION;
  readonly source: GestureLabelSource;
  readonly predictedGesture: GestureClass | null;
  readonly assignedGesture: GestureClass;
  readonly evidenceId: string;
  readonly recordedAt: string;
}

/**
 * Reference to one already-admitted L2 derived-feature observation.
 *
 * Snapshots contain immutable references, not raw features or trajectories. The
 * purpose-scoped profile pseudonym is the only grouping key used to keep users
 * disjoint across train/validation/test. No account identity, device salt,
 * Product Analytics pseudonym, or raw-trajectory pseudonym belongs here.
 */
export interface GestureLearningSampleRefV1 {
  readonly schemaVersion: typeof GESTURE_LEARNING_SCHEMA_VERSION;
  readonly recordId: string;
  readonly purpose: typeof GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING;
  readonly profilePseudonymId: string;
  readonly featureSchema: ImmutableReferenceV1;
  readonly contentDigest: Sha256DigestV1;
  readonly consent: GestureLearningConsentEvidenceV1;
  readonly label: GestureLabelProvenanceV1;
}

export interface GestureTrainingSnapshotSplitV1 {
  readonly profilePseudonymIds: readonly string[];
  readonly samples: readonly GestureLearningSampleRefV1[];
}

export interface GestureTrainingSplitFractionsV1 {
  readonly train: number;
  readonly validation: number;
  readonly test: number;
}

export interface GestureTrainingSnapshotContentV1 {
  readonly schemaVersion: typeof GESTURE_LEARNING_SCHEMA_VERSION;
  readonly snapshotId: string;
  readonly snapshotVersion: string;
  readonly createdAt: string;
  readonly featureSchema: ImmutableReferenceV1;
  readonly labelRulesVersion: typeof GESTURE_LABEL_PROVENANCE_RULE_VERSION;
  readonly splitPolicyVersion: typeof GESTURE_SNAPSHOT_SPLIT_POLICY_VERSION;
  /** Secret-free stable seed identifier required to reproduce the profile split. */
  readonly splitSeedId: string;
  readonly splitFractions: GestureTrainingSplitFractionsV1;
  readonly splits: Readonly<{
    train: GestureTrainingSnapshotSplitV1;
    validation: GestureTrainingSnapshotSplitV1;
    test: GestureTrainingSnapshotSplitV1;
  }>;
}

export interface GestureTrainingSnapshotV1 extends GestureTrainingSnapshotContentV1 {
  readonly snapshotDigest: Sha256DigestV1;
}

export interface GestureTrainingSnapshotBuildOptionsV1 {
  readonly snapshotId: string;
  readonly snapshotVersion: string;
  readonly createdAt: string;
  /** Secret-free stable seed identifier, not a random-number seed or user ID. */
  readonly splitSeed: string;
  readonly validationFraction?: number;
  readonly testFraction?: number;
}

export type GestureLearningContractIssueCode =
  | 'INVALID_CONSENT_EVIDENCE'
  | 'INVALID_LABEL_PROVENANCE'
  | 'INVALID_SAMPLE_REFERENCE'
  | 'INVALID_SNAPSHOT_METADATA'
  | 'DUPLICATE_RECORD_ID'
  | 'MIXED_FEATURE_SCHEMA'
  | 'INSUFFICIENT_PROFILE_GROUPS'
  | 'EMPTY_PROFILE_GROUP'
  | 'INVALID_SPLIT_FRACTIONS'
  | 'PROFILE_SPLIT_OVERLAP'
  | 'SPLIT_POLICY_MISMATCH'
  | 'SNAPSHOT_DIGEST_MISMATCH';

export interface GestureLearningContractIssue {
  readonly code: GestureLearningContractIssueCode;
  readonly path: string;
  readonly message: string;
}

export class GestureLearningContractError extends Error {
  readonly issues: readonly GestureLearningContractIssue[];

  constructor(issues: readonly GestureLearningContractIssue[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '));
    this.name = 'GestureLearningContractError';
    this.issues = issues;
  }
}

const SHA256_HEX = /^[0-9a-f]{64}$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:+-]{0,159}$/;
const STABLE_VERSION = /^[0-9A-Za-z][0-9A-Za-z._+-]{0,63}$/;
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const GESTURE_CLASS_SET = new Set<string>(GESTURE_CLASSES);
const LABEL_SOURCE_SET = new Set<string>(GESTURE_LABEL_SOURCES);
const SPLIT_DOMAIN = 'nemosyne:gesture-profile-split:v1\n';
const FRACTION_EPSILON = 1e-12;

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

function isSha256Digest(value: unknown): value is Sha256DigestV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const digest = value as Readonly<Record<string, unknown>>;
  return digest.algorithm === 'SHA256' && typeof digest.value === 'string' && SHA256_HEX.test(digest.value);
}

function isImmutableReference(value: unknown): value is ImmutableReferenceV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const reference = value as Readonly<Record<string, unknown>>;
  return (
    reference.schemaVersion === '1' &&
    typeof reference.id === 'string' &&
    SAFE_ID.test(reference.id) &&
    typeof reference.version === 'string' &&
    STABLE_VERSION.test(reference.version) &&
    isSha256Digest(reference.digest)
  );
}

function isAuthorizationEvidence(value: unknown): value is AuthorizationEvidenceV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const evidence = value as Readonly<Record<string, unknown>>;
  return (
    typeof evidence.id === 'string' &&
    SAFE_ID.test(evidence.id) &&
    typeof evidence.revision === 'string' &&
    STABLE_VERSION.test(evidence.revision) &&
    isSha256Digest(evidence.digest)
  );
}

function validUtcTimestamp(value: unknown): value is string {
  return typeof value === 'string' && UTC_TIMESTAMP.test(value) && Number.isFinite(Date.parse(value));
}

function validSplitFractions(
  fractions: GestureTrainingSplitFractionsV1 | undefined
): fractions is GestureTrainingSplitFractionsV1 {
  if (!fractions) return false;
  const values = [fractions.train, fractions.validation, fractions.test];
  return (
    values.every((value) => Number.isFinite(value) && value > 0 && value < 1) &&
    Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) <= FRACTION_EPSILON
  );
}

function sameReference(a: ImmutableReferenceV1, b: ImmutableReferenceV1): boolean {
  return (
    a.schemaVersion === b.schemaVersion &&
    a.id === b.id &&
    a.version === b.version &&
    a.digest.algorithm === b.digest.algorithm &&
    a.digest.value === b.digest.value
  );
}

function cloneReference(reference: ImmutableReferenceV1): ImmutableReferenceV1 {
  return {
    schemaVersion: reference.schemaVersion,
    id: reference.id,
    version: reference.version,
    digest: { algorithm: 'SHA256', value: reference.digest.value },
  };
}

function cloneConsent(consent: GestureLearningConsentEvidenceV1): GestureLearningConsentEvidenceV1 {
  return {
    schemaVersion: '1',
    purpose: consent.purpose,
    receipt: {
      id: consent.receipt.id,
      revision: consent.receipt.revision,
      digest: { algorithm: 'SHA256', value: consent.receipt.digest.value },
    },
    policy: cloneReference(consent.policy),
  };
}

function cloneLabel(label: GestureLabelProvenanceV1): GestureLabelProvenanceV1 {
  return {
    schemaVersion: '1',
    rulesVersion: GESTURE_LABEL_PROVENANCE_RULE_VERSION,
    source: label.source,
    predictedGesture: label.predictedGesture,
    assignedGesture: label.assignedGesture,
    evidenceId: label.evidenceId,
    recordedAt: label.recordedAt,
  };
}

function cloneSample(sample: GestureLearningSampleRefV1): GestureLearningSampleRefV1 {
  return {
    schemaVersion: '1',
    recordId: sample.recordId,
    purpose: GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING,
    profilePseudonymId: sample.profilePseudonymId,
    featureSchema: cloneReference(sample.featureSchema),
    contentDigest: { algorithm: 'SHA256', value: sample.contentDigest.value },
    consent: cloneConsent(sample.consent),
    label: cloneLabel(sample.label),
  };
}

export function validateGestureLearningConsentEvidenceV1(
  consent: GestureLearningConsentEvidenceV1,
  expectedPurpose: GestureLearningConsentEvidenceV1['purpose']
): readonly GestureLearningContractIssue[] {
  const issues: GestureLearningContractIssue[] = [];
  if (!consent || consent.schemaVersion !== '1' || consent.purpose !== expectedPurpose) {
    issues.push({
      code: 'INVALID_CONSENT_EVIDENCE',
      path: 'consent.purpose',
      message: `must be explicit ${expectedPurpose} consent evidence`,
    });
  }
  if (!isAuthorizationEvidence(consent?.receipt)) {
    issues.push({
      code: 'INVALID_CONSENT_EVIDENCE',
      path: 'consent.receipt',
      message: 'must be a versioned immutable authorization receipt',
    });
  }
  if (!isImmutableReference(consent?.policy)) {
    issues.push({
      code: 'INVALID_CONSENT_EVIDENCE',
      path: 'consent.policy',
      message: 'must reference the reviewed purpose policy',
    });
  }
  return issues;
}

export function validateGestureLabelProvenanceV1(
  label: GestureLabelProvenanceV1
): readonly GestureLearningContractIssue[] {
  const issues: GestureLearningContractIssue[] = [];
  if (
    !label ||
    label.schemaVersion !== '1' ||
    label.rulesVersion !== GESTURE_LABEL_PROVENANCE_RULE_VERSION ||
    !LABEL_SOURCE_SET.has(label.source)
  ) {
    return [{
      code: 'INVALID_LABEL_PROVENANCE',
      path: 'label',
      message: 'must use the frozen PT6 label-provenance contract',
    }];
  }
  if (!GESTURE_CLASS_SET.has(label.assignedGesture)) {
    issues.push({ code: 'INVALID_LABEL_PROVENANCE', path: 'label.assignedGesture', message: 'must be a declared gesture class' });
  }
  if (label.predictedGesture !== null && !GESTURE_CLASS_SET.has(label.predictedGesture)) {
    issues.push({ code: 'INVALID_LABEL_PROVENANCE', path: 'label.predictedGesture', message: 'must be null or a declared gesture class' });
  }
  if (!SAFE_ID.test(label.evidenceId)) {
    issues.push({ code: 'INVALID_LABEL_PROVENANCE', path: 'label.evidenceId', message: 'must be a bounded stable evidence identifier' });
  }
  if (!validUtcTimestamp(label.recordedAt)) {
    issues.push({ code: 'INVALID_LABEL_PROVENANCE', path: 'label.recordedAt', message: 'must be a canonical UTC timestamp' });
  }
  if (
    label.source === 'EXPLICIT_CONFIRMATION' &&
    (label.predictedGesture === null || label.predictedGesture !== label.assignedGesture)
  ) {
    issues.push({ code: 'INVALID_LABEL_PROVENANCE', path: 'label', message: 'explicit confirmation requires predictedGesture == assignedGesture' });
  }
  if (
    label.source === 'EXPLICIT_CORRECTION' &&
    (label.predictedGesture === null || label.predictedGesture === label.assignedGesture)
  ) {
    issues.push({ code: 'INVALID_LABEL_PROVENANCE', path: 'label', message: 'explicit correction requires a different predicted and assigned gesture' });
  }
  if (label.source === 'PROTOCOL_TARGET' && label.predictedGesture !== null) {
    issues.push({ code: 'INVALID_LABEL_PROVENANCE', path: 'label.predictedGesture', message: 'protocol target labels are independent of model predictions' });
  }
  return issues;
}

export function validateGestureLearningSampleRefV1(
  sample: GestureLearningSampleRefV1
): readonly GestureLearningContractIssue[] {
  const issues: GestureLearningContractIssue[] = [];
  if (!sample || sample.schemaVersion !== '1' || sample.purpose !== GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING) {
    issues.push({
      code: 'INVALID_SAMPLE_REFERENCE',
      path: 'sample.purpose',
      message: 'training snapshots accept only admitted L2 derived-gesture-learning records',
    });
  }
  if (!SAFE_ID.test(sample?.recordId ?? '')) {
    issues.push({ code: 'INVALID_SAMPLE_REFERENCE', path: 'sample.recordId', message: 'must be a bounded stable record identifier' });
  }
  if (!SAFE_ID.test(sample?.profilePseudonymId ?? '')) {
    issues.push({ code: 'INVALID_SAMPLE_REFERENCE', path: 'sample.profilePseudonymId', message: 'must be a purpose-scoped derived-learning pseudonym' });
  }
  if (!isImmutableReference(sample?.featureSchema)) {
    issues.push({ code: 'INVALID_SAMPLE_REFERENCE', path: 'sample.featureSchema', message: 'must be an immutable feature-schema reference' });
  }
  if (!isSha256Digest(sample?.contentDigest)) {
    issues.push({ code: 'INVALID_SAMPLE_REFERENCE', path: 'sample.contentDigest', message: 'must be an exact SHA-256 content digest' });
  }
  issues.push(...validateGestureLearningConsentEvidenceV1(sample?.consent, GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING));
  issues.push(...validateGestureLabelProvenanceV1(sample?.label));
  return issues;
}

function profileOrderKey(profilePseudonymId: string, splitSeed: string): string {
  return sha256Hex(`${SPLIT_DOMAIN}${splitSeed}\n${profilePseudonymId}`);
}

function normalizedSplitCounts(
  profileCount: number,
  validationFraction: number,
  testFraction: number
): Readonly<{ train: number; validation: number; test: number }> {
  let validation = Math.max(1, Math.floor(profileCount * validationFraction));
  let test = Math.max(1, Math.floor(profileCount * testFraction));
  while (validation + test >= profileCount) {
    if (validation >= test && validation > 1) validation -= 1;
    else if (test > 1) test -= 1;
    else break;
  }
  return { train: profileCount - validation - test, validation, test };
}

function orderedProfilesForPolicy(profileIds: readonly string[], splitSeed: string): string[] {
  return [...profileIds].sort((a, b) => {
    const byHash = profileOrderKey(a, splitSeed).localeCompare(profileOrderKey(b, splitSeed));
    return byHash !== 0 ? byHash : a.localeCompare(b);
  });
}

function expectedProfileOwners(
  profileIds: readonly string[],
  splitSeed: string,
  fractions: GestureTrainingSplitFractionsV1
): ReadonlyMap<string, GestureTrainingSplit> {
  const orderedProfiles = orderedProfilesForPolicy(profileIds, splitSeed);
  const counts = normalizedSplitCounts(orderedProfiles.length, fractions.validation, fractions.test);
  const owners = new Map<string, GestureTrainingSplit>();
  orderedProfiles.slice(0, counts.train).forEach((profileId) => owners.set(profileId, 'train'));
  orderedProfiles.slice(counts.train, counts.train + counts.validation).forEach((profileId) => owners.set(profileId, 'validation'));
  orderedProfiles.slice(counts.train + counts.validation).forEach((profileId) => owners.set(profileId, 'test'));
  return owners;
}

function buildSplit(
  profileIds: readonly string[],
  samplesByProfile: ReadonlyMap<string, readonly GestureLearningSampleRefV1[]>
): GestureTrainingSnapshotSplitV1 {
  return {
    profilePseudonymIds: [...profileIds].sort(),
    samples: profileIds
      .flatMap((profileId) => samplesByProfile.get(profileId) ?? [])
      .map(cloneSample)
      .sort((a, b) => a.recordId.localeCompare(b.recordId)),
  };
}

export function buildGestureTrainingSnapshotV1(
  samples: readonly GestureLearningSampleRefV1[],
  options: GestureTrainingSnapshotBuildOptionsV1
): GestureTrainingSnapshotV1 {
  const issues: GestureLearningContractIssue[] = [];
  const validationFraction = options.validationFraction ?? 0.15;
  const testFraction = options.testFraction ?? 0.15;
  const splitFractions: GestureTrainingSplitFractionsV1 = {
    train: 1 - validationFraction - testFraction,
    validation: validationFraction,
    test: testFraction,
  };

  if (!validSplitFractions(splitFractions)) {
    issues.push({ code: 'INVALID_SPLIT_FRACTIONS', path: 'options', message: 'validation/test fractions must be positive and leave a positive train fraction' });
  }
  if (
    !SAFE_ID.test(options.snapshotId) ||
    !STABLE_VERSION.test(options.snapshotVersion) ||
    !validUtcTimestamp(options.createdAt) ||
    !SAFE_ID.test(options.splitSeed)
  ) {
    issues.push({ code: 'INVALID_SNAPSHOT_METADATA', path: 'options', message: 'snapshot identity, version, timestamp and splitSeed must be stable bounded values' });
  }

  const seenRecordIds = new Set<string>();
  let featureSchema: ImmutableReferenceV1 | null = null;
  const samplesByProfile = new Map<string, GestureLearningSampleRefV1[]>();

  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    const sampleIssues = validateGestureLearningSampleRefV1(sample);
    for (const issue of sampleIssues) issues.push({ ...issue, path: `samples[${index}].${issue.path}` });
    if (sampleIssues.length > 0) continue;

    if (seenRecordIds.has(sample.recordId)) {
      issues.push({ code: 'DUPLICATE_RECORD_ID', path: `samples[${index}].recordId`, message: `duplicate recordId ${sample.recordId}` });
    }
    seenRecordIds.add(sample.recordId);

    if (featureSchema === null) featureSchema = sample.featureSchema;
    else if (!sameReference(featureSchema, sample.featureSchema)) {
      issues.push({ code: 'MIXED_FEATURE_SCHEMA', path: `samples[${index}].featureSchema`, message: 'one training snapshot cannot mix feature-schema identities' });
    }

    const grouped = samplesByProfile.get(sample.profilePseudonymId) ?? [];
    grouped.push(sample);
    samplesByProfile.set(sample.profilePseudonymId, grouped);
  }

  if (samplesByProfile.size < 3) {
    issues.push({ code: 'INSUFFICIENT_PROFILE_GROUPS', path: 'samples', message: 'at least three distinct purpose-scoped profiles are required for train/validation/test' });
  }
  if (issues.length > 0 || featureSchema === null) throw new GestureLearningContractError(issues);

  const orderedProfiles = orderedProfilesForPolicy([...samplesByProfile.keys()], options.splitSeed);
  const counts = normalizedSplitCounts(orderedProfiles.length, validationFraction, testFraction);
  if (counts.train < 1 || counts.validation < 1 || counts.test < 1) {
    throw new GestureLearningContractError([{
      code: 'INSUFFICIENT_PROFILE_GROUPS',
      path: 'samples',
      message: 'split policy must produce non-empty train, validation and test profile groups',
    }]);
  }

  const trainProfiles = orderedProfiles.slice(0, counts.train);
  const validationProfiles = orderedProfiles.slice(counts.train, counts.train + counts.validation);
  const testProfiles = orderedProfiles.slice(counts.train + counts.validation);
  const content: GestureTrainingSnapshotContentV1 = {
    schemaVersion: '1',
    snapshotId: options.snapshotId,
    snapshotVersion: options.snapshotVersion,
    createdAt: options.createdAt,
    featureSchema: cloneReference(featureSchema),
    labelRulesVersion: GESTURE_LABEL_PROVENANCE_RULE_VERSION,
    splitPolicyVersion: GESTURE_SNAPSHOT_SPLIT_POLICY_VERSION,
    splitSeedId: options.splitSeed,
    splitFractions,
    splits: {
      train: buildSplit(trainProfiles, samplesByProfile),
      validation: buildSplit(validationProfiles, samplesByProfile),
      test: buildSplit(testProfiles, samplesByProfile),
    },
  };

  return deepFreeze({
    ...content,
    snapshotDigest: { algorithm: 'SHA256' as const, value: canonicalSha256Hex(content) },
  });
}

export function validateGestureTrainingSnapshotV1(
  snapshot: GestureTrainingSnapshotV1
): readonly GestureLearningContractIssue[] {
  const issues: GestureLearningContractIssue[] = [];
  const splitNames = ['train', 'validation', 'test'] as const;
  const profileOwner = new Map<string, GestureTrainingSplit>();
  const recordIds = new Set<string>();
  const allProfileIds = new Set<string>();
  let featureSchema: ImmutableReferenceV1 | null = null;

  if (
    snapshot?.schemaVersion !== GESTURE_LEARNING_SCHEMA_VERSION ||
    !SAFE_ID.test(snapshot?.snapshotId ?? '') ||
    !STABLE_VERSION.test(snapshot?.snapshotVersion ?? '') ||
    !validUtcTimestamp(snapshot?.createdAt) ||
    snapshot?.labelRulesVersion !== GESTURE_LABEL_PROVENANCE_RULE_VERSION ||
    snapshot?.splitPolicyVersion !== GESTURE_SNAPSHOT_SPLIT_POLICY_VERSION ||
    !SAFE_ID.test(snapshot?.splitSeedId ?? '')
  ) {
    issues.push({ code: 'INVALID_SNAPSHOT_METADATA', path: 'snapshot', message: 'snapshot metadata must use the frozen PT6A schema, label rules and split policy' });
  }
  if (!validSplitFractions(snapshot?.splitFractions)) {
    issues.push({ code: 'INVALID_SPLIT_FRACTIONS', path: 'splitFractions', message: 'train/validation/test fractions must be finite, positive and sum to 1' });
  }

  for (const splitName of splitNames) {
    const split = snapshot?.splits?.[splitName];
    if (!split || split.profilePseudonymIds.length === 0 || split.samples.length === 0) {
      issues.push({ code: 'INSUFFICIENT_PROFILE_GROUPS', path: `splits.${splitName}`, message: 'each split must contain at least one profile and sample' });
      continue;
    }

    const declaredProfiles = new Set(split.profilePseudonymIds);
    const sampleCountByProfile = new Map<string, number>();
    if (declaredProfiles.size !== split.profilePseudonymIds.length) {
      issues.push({ code: 'PROFILE_SPLIT_OVERLAP', path: `splits.${splitName}.profilePseudonymIds`, message: 'split profile list contains duplicates' });
    }

    for (const profileId of declaredProfiles) {
      if (!SAFE_ID.test(profileId)) {
        issues.push({ code: 'INVALID_SAMPLE_REFERENCE', path: `splits.${splitName}.profilePseudonymIds`, message: `${profileId} is not a bounded purpose-scoped profile identifier` });
      }
      const prior = profileOwner.get(profileId);
      if (prior && prior !== splitName) {
        issues.push({ code: 'PROFILE_SPLIT_OVERLAP', path: `splits.${splitName}.profilePseudonymIds`, message: `${profileId} is already assigned to ${prior}` });
      }
      profileOwner.set(profileId, splitName);
      allProfileIds.add(profileId);
      sampleCountByProfile.set(profileId, 0);
    }

    for (let index = 0; index < split.samples.length; index += 1) {
      const sample = split.samples[index];
      for (const issue of validateGestureLearningSampleRefV1(sample)) {
        issues.push({ ...issue, path: `splits.${splitName}.samples[${index}].${issue.path}` });
      }
      if (!declaredProfiles.has(sample.profilePseudonymId)) {
        issues.push({ code: 'PROFILE_SPLIT_OVERLAP', path: `splits.${splitName}.samples[${index}].profilePseudonymId`, message: 'sample profile must be declared in its split' });
      } else {
        sampleCountByProfile.set(sample.profilePseudonymId, (sampleCountByProfile.get(sample.profilePseudonymId) ?? 0) + 1);
      }
      if (recordIds.has(sample.recordId)) {
        issues.push({ code: 'DUPLICATE_RECORD_ID', path: `splits.${splitName}.samples[${index}].recordId`, message: `duplicate recordId ${sample.recordId}` });
      }
      recordIds.add(sample.recordId);
      if (isImmutableReference(sample.featureSchema)) {
        if (featureSchema === null) featureSchema = sample.featureSchema;
        else if (!sameReference(featureSchema, sample.featureSchema)) {
          issues.push({ code: 'MIXED_FEATURE_SCHEMA', path: `splits.${splitName}.samples[${index}].featureSchema`, message: 'sample feature schema differs from snapshot schema' });
        }
      }
    }

    for (const [profileId, count] of sampleCountByProfile) {
      if (count === 0) {
        issues.push({
          code: 'EMPTY_PROFILE_GROUP',
          path: `splits.${splitName}.profilePseudonymIds`,
          message: `${profileId} has no sample in its declared split and cannot influence split policy`,
        });
      }
    }
  }

  if (allProfileIds.size < 3) {
    issues.push({ code: 'INSUFFICIENT_PROFILE_GROUPS', path: 'splits', message: 'snapshot must contain at least three distinct profile groups' });
  }

  if (!isImmutableReference(snapshot?.featureSchema) || (featureSchema && !sameReference(snapshot.featureSchema, featureSchema))) {
    issues.push({ code: 'MIXED_FEATURE_SCHEMA', path: 'featureSchema', message: 'snapshot feature schema must match every sample' });
  }

  if (validSplitFractions(snapshot?.splitFractions) && SAFE_ID.test(snapshot?.splitSeedId ?? '') && allProfileIds.size >= 3) {
    const expectedOwners = expectedProfileOwners([...allProfileIds], snapshot.splitSeedId, snapshot.splitFractions);
    for (const profileId of allProfileIds) {
      if (expectedOwners.get(profileId) !== profileOwner.get(profileId)) {
        issues.push({ code: 'SPLIT_POLICY_MISMATCH', path: 'splits', message: `${profileId} is not assigned according to ${GESTURE_SNAPSHOT_SPLIT_POLICY_VERSION}` });
      }
    }
  }

  if (!isSha256Digest(snapshot?.snapshotDigest)) {
    issues.push({ code: 'SNAPSHOT_DIGEST_MISMATCH', path: 'snapshotDigest', message: 'snapshot digest must be SHA-256' });
  } else {
    const { snapshotDigest: _snapshotDigest, ...content } = snapshot;
    if (canonicalSha256Hex(content) !== snapshot.snapshotDigest.value) {
      issues.push({ code: 'SNAPSHOT_DIGEST_MISMATCH', path: 'snapshotDigest.value', message: 'snapshot content does not match its immutable digest' });
    }
  }

  return issues;
}
