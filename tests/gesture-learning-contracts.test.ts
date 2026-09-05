import { describe, expect, it } from 'vitest';
import { GESTURE_CLASSES, type GestureClass } from '../modules/gesture-intelligence/src/contracts.ts';
import { GOVERNED_PURPOSES, type ImmutableReferenceV1 } from '../src/governance/GovernedEventContracts.ts';
import { canonicalSha256Hex, sha256Hex } from '../src/security/CryptoHash.ts';
import {
  GestureLearningContractError,
  buildGestureTrainingSnapshotV1,
  validateGestureLabelProvenanceV1,
  validateGestureLearningSampleRefV1,
  validateGestureTrainingSnapshotV1,
  type GestureLearningConsentEvidenceV1,
  type GestureLearningSampleRefV1,
  type GestureTrainingSnapshotV1,
} from '../src/vr/input/GestureLearningContracts.ts';

const CREATED_AT = '2026-09-05T03:20:00Z';
const SPLIT_SEED = 'pt6a-fixture-seed-1';

function digest(value: string) {
  return { algorithm: 'SHA256' as const, value: sha256Hex(value) };
}

function reference(id: string, version = '1.0.0'): ImmutableReferenceV1 {
  return {
    schemaVersion: '1',
    id,
    version,
    digest: digest(`${id}:${version}`),
  };
}

function consent(
  purpose: GestureLearningConsentEvidenceV1['purpose'] = GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING
): GestureLearningConsentEvidenceV1 {
  return {
    schemaVersion: '1',
    purpose,
    receipt: {
      id: `receipt-${purpose}`,
      revision: '1',
      digest: digest(`receipt:${purpose}`),
    },
    policy: reference(`policy-${purpose}`),
  };
}

const FEATURE_SCHEMA = reference('gesture-feature-schema-56d-v1');

function sample(
  profile: string,
  index: number,
  gesture: GestureClass = GESTURE_CLASSES[index % GESTURE_CLASSES.length],
  overrides: Partial<GestureLearningSampleRefV1> = {}
): GestureLearningSampleRefV1 {
  return {
    schemaVersion: '1',
    recordId: `record-${profile}-${index}`,
    purpose: GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING,
    profilePseudonymId: profile,
    featureSchema: FEATURE_SCHEMA,
    contentDigest: digest(`sample:${profile}:${index}`),
    consent: consent(),
    label: {
      schemaVersion: '1',
      rulesVersion: '1.0.0',
      source: 'PROTOCOL_TARGET',
      predictedGesture: null,
      assignedGesture: gesture,
      evidenceId: `protocol-${profile}-${index}`,
      recordedAt: CREATED_AT,
    },
    ...overrides,
  };
}

function fixtureSamples(): GestureLearningSampleRefV1[] {
  return Array.from({ length: 6 }, (_, profileIndex) => {
    const profile = `learn-profile-${profileIndex + 1}`;
    return [
      sample(profile, profileIndex * 2, GESTURE_CLASSES[profileIndex]),
      sample(profile, profileIndex * 2 + 1, GESTURE_CLASSES[(profileIndex + 1) % GESTURE_CLASSES.length]),
    ];
  }).flat();
}

function build(samples = fixtureSamples()) {
  return buildGestureTrainingSnapshotV1(samples, {
    snapshotId: 'gesture-snapshot-fixture',
    snapshotVersion: '1.0.0',
    createdAt: CREATED_AT,
    splitSeed: SPLIT_SEED,
    validationFraction: 0.2,
    testFraction: 0.2,
  });
}

describe('PT6A gesture-learning evidence contracts', () => {
  it('does not allow model output to manufacture confirmation or correction labels', () => {
    const badConfirmation = validateGestureLabelProvenanceV1({
      schemaVersion: '1',
      rulesVersion: '1.0.0',
      source: 'EXPLICIT_CONFIRMATION',
      predictedGesture: 'pinchTogether',
      assignedGesture: 'pinchApart',
      evidenceId: 'confirmation-1',
      recordedAt: CREATED_AT,
    });
    const badCorrection = validateGestureLabelProvenanceV1({
      schemaVersion: '1',
      rulesVersion: '1.0.0',
      source: 'EXPLICIT_CORRECTION',
      predictedGesture: 'scoopUp',
      assignedGesture: 'scoopUp',
      evidenceId: 'correction-1',
      recordedAt: CREATED_AT,
    });

    expect(badConfirmation.some((issue) => issue.code === 'INVALID_LABEL_PROVENANCE')).toBe(true);
    expect(badCorrection.some((issue) => issue.code === 'INVALID_LABEL_PROVENANCE')).toBe(true);
  });

  it('rejects raw-trajectory consent as authority for a derived-learning training record', () => {
    const candidate = sample('learn-profile-1', 1, 'idle', {
      consent: consent(GOVERNED_PURPOSES.RAW_TRAJECTORY_RESEARCH),
    });
    const issues = validateGestureLearningSampleRefV1(candidate);

    expect(issues.some((issue) => issue.code === 'INVALID_CONSENT_EVIDENCE')).toBe(true);
  });

  it('builds immutable deterministic snapshots with profile-disjoint splits', () => {
    const samples = fixtureSamples();
    const forward = build(samples);
    const reversed = build([...samples].reverse());

    expect(forward.snapshotDigest).toEqual(reversed.snapshotDigest);
    expect(forward.splits).toEqual(reversed.splits);
    expect(forward.splitSeedId).toBe(SPLIT_SEED);
    expect(forward.splitFractions).toEqual({ train: 0.6, validation: 0.2, test: 0.2 });
    expect(Object.isFrozen(forward)).toBe(true);

    const owner = new Map<string, string>();
    for (const splitName of ['train', 'validation', 'test'] as const) {
      for (const profile of forward.splits[splitName].profilePseudonymIds) {
        expect(owner.has(profile)).toBe(false);
        owner.set(profile, splitName);
      }
      for (const row of forward.splits[splitName].samples) {
        expect(owner.get(row.profilePseudonymId)).toBe(splitName);
      }
    }
    expect(owner.size).toBe(6);
    expect(validateGestureTrainingSnapshotV1(forward)).toEqual([]);
  });

  it('keeps every record for one profile in exactly one split', () => {
    const snapshot = build();
    for (const profileIndex of [1, 2, 3, 4, 5, 6]) {
      const profile = `learn-profile-${profileIndex}`;
      const containing = (['train', 'validation', 'test'] as const).filter((splitName) =>
        snapshot.splits[splitName].samples.some((row) => row.profilePseudonymId === profile)
      );
      expect(containing).toHaveLength(1);
      expect(
        snapshot.splits[containing[0]].samples.filter((row) => row.profilePseudonymId === profile)
      ).toHaveLength(2);
    }
  });

  it('rejects duplicate record identity, mixed feature schemas, and insufficient user groups', () => {
    const duplicate = fixtureSamples();
    duplicate[1] = { ...duplicate[1], recordId: duplicate[0].recordId };
    expect(() => build(duplicate)).toThrow(GestureLearningContractError);

    const mixedSchema = fixtureSamples();
    mixedSchema[0] = {
      ...mixedSchema[0],
      featureSchema: reference('gesture-feature-schema-other'),
    };
    expect(() => build(mixedSchema)).toThrow(GestureLearningContractError);

    const twoProfiles = fixtureSamples().filter((row) =>
      row.profilePseudonymId === 'learn-profile-1' || row.profilePseudonymId === 'learn-profile-2'
    );
    expect(() => build(twoProfiles)).toThrow(GestureLearningContractError);
  });

  it('detects a re-digested snapshot whose memberships violate the declared split policy', () => {
    const original = build();
    const forged = JSON.parse(JSON.stringify(original)) as GestureTrainingSnapshotV1;

    const trainProfile = forged.splits.train.profilePseudonymIds[0];
    const validationProfile = forged.splits.validation.profilePseudonymIds[0];
    const trainRows = forged.splits.train.samples.filter((row) => row.profilePseudonymId === trainProfile);
    const validationRows = forged.splits.validation.samples.filter(
      (row) => row.profilePseudonymId === validationProfile
    );

    forged.splits.train.profilePseudonymIds = forged.splits.train.profilePseudonymIds.map((profile) =>
      profile === trainProfile ? validationProfile : profile
    );
    forged.splits.validation.profilePseudonymIds = forged.splits.validation.profilePseudonymIds.map(
      (profile) => (profile === validationProfile ? trainProfile : profile)
    );
    forged.splits.train.samples = [
      ...forged.splits.train.samples.filter((row) => row.profilePseudonymId !== trainProfile),
      ...validationRows,
    ];
    forged.splits.validation.samples = [
      ...forged.splits.validation.samples.filter((row) => row.profilePseudonymId !== validationProfile),
      ...trainRows,
    ];

    const { snapshotDigest: _oldDigest, ...content } = forged;
    forged.snapshotDigest = {
      algorithm: 'SHA256',
      value: canonicalSha256Hex(content),
    };

    const issues = validateGestureTrainingSnapshotV1(forged);
    expect(issues.some((issue) => issue.code === 'SNAPSHOT_DIGEST_MISMATCH')).toBe(false);
    expect(issues.some((issue) => issue.code === 'SPLIT_POLICY_MISMATCH')).toBe(true);
  });
});
