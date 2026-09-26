import { beforeAll, describe, expect, it } from 'vitest';
import {
  DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1,
  INFERENTIAL_CLAIM_REQUIREMENT_PROFILE_V1,
  evidenceRequirementProfileByIdV1,
} from '../src/data/evidence/EvidenceRequirementProfile.ts';
import { parseEvidenceReceiptBundleV1 } from '../src/data/evidence/EvidenceReceipt.ts';
import { governedReplayEvidenceReceiptAuthority } from '../src/data/evidence/ReplayEvidenceAuthority.ts';
import * as bridge from '../src/wasm/RuntimeBridge.ts';

/**
 * TEC1 governed replay resolution (RFC 0007 "Persistence and replay";
 * ADR-0007 consequence 9).
 *
 * Historical evidence must resolve under the contract that governed it when
 * it was issued: the persisted bundle's dataset/kernel identity must match
 * the replay context, and resolution must be bound to an explicit
 * requirement-profile identity the closed registry still mints. Every
 * failure fails closed with a typed refusal — never a heuristic fallback
 * and never today's default policy silently re-judging historical receipts.
 *
 * The hand-built fixtures mirror the Rust statistics producer's value
 * semantics per the #818 mock-seam discipline (closed schema shapes the
 * producer can emit), and the real-WASM cases pin the same contract
 * against genuine Rust-issued receipts.
 */

const GOVERNING_DATASET_FINGERPRINT = 'historical-dataset-fingerprint';
const GOVERNING_KERNEL_VERSION = 'historical-kernel-9.9.9';
const DESCRIPTIVE_ID = DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1.profileId;
const INFERENTIAL_ID = INFERENTIAL_CLAIM_REQUIREMENT_PROFILE_V1.profileId;
const UNRESOLVED_INDEPENDENCE = 'observation independence for inferential interpretation';

function pearsonReceipt(): Record<string, unknown> {
  return {
    receiptId: 'pearson:x:y',
    claimId: 'pearson:x:y',
    estimand: 'Pearson linear association between x and y',
    measurementContext: { status: 'NOT_ESTABLISHED' },
    geometry: null,
    assumptions: [
      { assumption: UNRESOLVED_INDEPENDENCE, status: 'notTestableFromData', detail: 'fixture: not testable from data' },
      { assumption: 'Pearson r describes linear association only', status: 'satisfied', detail: 'fixture: satisfied' },
    ],
    sampleSupport: {
      totalRows: 3,
      rowsUsed: 2,
      rowsExcluded: 1,
      columns: ['x', 'y'],
      policy: 'pairwiseComplete',
      exclusionReasons: [{ reason: 'missing or non-finite numeric value', rowCount: 1 }],
    },
    uncertainty: null,
    stability: null,
    sensitivity: [],
    limitations: ['association only; no population uncertainty has been estimated'],
    methodProvenance: {
      method: 'pearson/linear',
      methodVersion: 'statistics-v1',
      kernelVersion: GOVERNING_KERNEL_VERSION,
      datasetFingerprint: GOVERNING_DATASET_FINGERPRINT,
      parameters: [],
    },
  };
}

function bundle(receipts: unknown[], overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: '1',
    datasetFingerprint: GOVERNING_DATASET_FINGERPRINT,
    kernelVersion: GOVERNING_KERNEL_VERSION,
    receipts,
    ...overrides,
  };
}

const MATCHING_CONTEXT = {
  datasetFingerprint: GOVERNING_DATASET_FINGERPRINT,
  kernelVersion: GOVERNING_KERNEL_VERSION,
};

function mint(payload: unknown = bundle([pearsonReceipt()])) {
  return governedReplayEvidenceReceiptAuthority(payload, MATCHING_CONTEXT);
}

describe('TEC1 governed replay resolution', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
  });

  it('binds identity lookup to the closed profile registry', () => {
    // The persisted-identity fixtures below cannot silently drift from the
    // minted registry: the strings must be exactly the minted identities.
    expect(evidenceRequirementProfileByIdV1(DESCRIPTIVE_ID)).toBe(
      DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1
    );
    expect(evidenceRequirementProfileByIdV1(INFERENTIAL_ID)).toBe(
      INFERENTIAL_CLAIM_REQUIREMENT_PROFILE_V1
    );
    expect(evidenceRequirementProfileByIdV1('descriptive-summary/v0')).toBeNull();
    expect(evidenceRequirementProfileByIdV1('DESCRIPTIVE-SUMMARY/V1')).toBeNull();
    expect(evidenceRequirementProfileByIdV1('')).toBeNull();
    expect(evidenceRequirementProfileByIdV1(null as unknown as string)).toBeNull();
  });

  it('resolves a historical receipt under its governing identity and never upgrades values', () => {
    const authority = mint();
    expect(Object.isFrozen(authority)).toBe(true);
    expect(Object.isFrozen(authority.receiptIds)).toBe(true);
    expect(authority.receiptIds).toEqual(['pearson:x:y']);
    expect(authority.governingDatasetFingerprint).toBe(GOVERNING_DATASET_FINGERPRINT);
    expect(authority.governingKernelVersion).toBe(GOVERNING_KERNEL_VERSION);
    expect(authority.replayDatasetFingerprint).toBe(GOVERNING_DATASET_FINGERPRINT);
    expect(authority.replayKernelVersion).toBe(GOVERNING_KERNEL_VERSION);

    const outcome = authority.resolveAgainst(DESCRIPTIVE_ID, 'pearson:x:y');
    expect(outcome).toEqual({
      status: 'RESOLVED',
      receipt: parseEvidenceReceiptBundleV1(bundle([pearsonReceipt()])).receipts[0],
    });
    expect(Object.isFrozen(outcome)).toBe(true);
    if (outcome.status === 'RESOLVED') {
      expect(outcome.receipt.uncertainty).toBeNull();
      expect(outcome.receipt.stability).toBeNull();
      expect(Object.isFrozen(outcome.receipt)).toBe(true);
    }
  });

  it('fails closed on replay-context identity mismatch instead of substituting a newer claim', () => {
    // Version-skewed replay context: the same persisted bundle, replayed
    // under a different kernel, must refuse — the historical receipts were
    // issued under the governing kernel and cannot be re-judged under
    // today's.
    const kernelSkew = governedReplayEvidenceReceiptAuthority(bundle([pearsonReceipt()]), {
      datasetFingerprint: GOVERNING_DATASET_FINGERPRINT,
      kernelVersion: 'todays-kernel-42.0.0',
    });
    const kernelRefusal = kernelSkew.resolveAgainst(DESCRIPTIVE_ID, 'pearson:x:y');
    expect(kernelRefusal).toEqual({
      status: 'KERNEL_MISMATCH',
      receiptId: 'pearson:x:y',
      expectedKernelVersion: GOVERNING_KERNEL_VERSION,
      observedKernelVersion: 'todays-kernel-42.0.0',
    });
    expect(Object.isFrozen(kernelRefusal)).toBe(true);

    // Dataset skew: a valid historical receipt reused against another
    // dataset refuses the same way.
    const datasetSkew = governedReplayEvidenceReceiptAuthority(bundle([pearsonReceipt()]), {
      datasetFingerprint: 'another-dataset-fingerprint',
      kernelVersion: GOVERNING_KERNEL_VERSION,
    });
    const datasetRefusal = datasetSkew.resolveAgainst(DESCRIPTIVE_ID, 'pearson:x:y');
    expect(datasetRefusal).toEqual({
      status: 'DATASET_MISMATCH',
      receiptId: 'pearson:x:y',
      expectedDatasetFingerprint: GOVERNING_DATASET_FINGERPRINT,
      observedDatasetFingerprint: 'another-dataset-fingerprint',
    });
    expect(Object.isFrozen(datasetRefusal)).toBe(true);

    // The refusal is identity-driven, not content-driven: the identical
    // call under the correct context resolves.
    expect(mint().resolveAgainst(DESCRIPTIVE_ID, 'pearson:x:y').status).toBe('RESOLVED');

    // Deterministic order: with both identities disagreeing, the dataset
    // refusal is reported first.
    const bothSkew = governedReplayEvidenceReceiptAuthority(bundle([pearsonReceipt()]), {
      datasetFingerprint: 'another-dataset-fingerprint',
      kernelVersion: 'todays-kernel-42.0.0',
    });
    expect(bothSkew.resolveAgainst(DESCRIPTIVE_ID, 'pearson:x:y').status).toBe('DATASET_MISMATCH');
  });

  it('refuses unresolvable governing profile identities and never falls back to a current default', () => {
    const authority = mint();
    // A retired identity, a case-tampered identity, a caller-invented
    // identity, and a forged profile object passed where an identity string
    // belongs: all must fail closed with the typed refusal. Substituting
    // any current default profile would silently re-judge the historical
    // receipt under today's policy.
    for (const badIdentity of [
      'descriptive-summary/v0',
      'DESCRIPTIVE-SUMMARY/V1',
      'caller-forged/v1',
      DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1 as unknown as string,
    ]) {
      const refusal = authority.resolveAgainst(badIdentity, 'pearson:x:y');
      expect(refusal.status).toBe('UNKNOWN_REQUIREMENT_PROFILE');
      if (refusal.status === 'UNKNOWN_REQUIREMENT_PROFILE') {
        expect(refusal.receiptId).toBe('pearson:x:y');
        expect(typeof refusal.profileId).toBe('string');
        expect(refusal.profileId.length).toBeGreaterThan(0);
      }
      expect(Object.isFrozen(refusal)).toBe(true);
      // No fallback: the same receipt under the resolvable historical
      // identity still resolves, so the refusal came from identity
      // resolution, not from the receipt.
      expect(authority.resolveAgainst(DESCRIPTIVE_ID, 'pearson:x:y').status).toBe('RESOLVED');
    }
  });

  it('resolves according to the requested governing identity, not the current default', () => {
    // Current-default-drift falsifier. The historical pearson receipt
    // carries an unresolved inferential assumption. Under its historical
    // descriptive governance it resolves; under today's stricter
    // inferential policy it refuses. If the resolver silently substituted
    // a current default for the requested identity, one of these two
    // assertions would fail in opposite directions.
    const authority = mint();
    expect(authority.resolveAgainst(DESCRIPTIVE_ID, 'pearson:x:y').status).toBe('RESOLVED');
    const refusal = authority.resolveAgainst(INFERENTIAL_ID, 'pearson:x:y');
    expect(refusal).toEqual({
      status: 'UNRESOLVED_ASSUMPTION',
      receiptId: 'pearson:x:y',
      assumption: UNRESOLVED_INDEPENDENCE,
    });
  });

  it('never upgrades missing historical fields into satisfied requirements', () => {
    // A historical receipt without established measurement context cannot
    // satisfy the inferential profile: absence stays absence under replay.
    const authority = mint();
    const refusal = authority.resolveAgainst(INFERENTIAL_ID, 'pearson:x:y');
    // The pearson fixture refuses on its assumption first (deterministic
    // claim-intrinsic order); use a descriptive receipt with satisfied
    // assumptions to reach the axis check.
    const descriptive = pearsonReceipt();
    descriptive.receiptId = 'descriptive:x';
    descriptive.claimId = 'descriptive:x';
    descriptive.estimand = 'descriptive finite-value summary for column x';
    descriptive.assumptions = [];
    descriptive.sampleSupport = {
      totalRows: 3,
      rowsUsed: 2,
      rowsExcluded: 1,
      columns: ['x'],
      policy: 'completeCase',
      exclusionReasons: [{ reason: 'missing or non-finite numeric value', rowCount: 1 }],
    };
    const withDescriptive = governedReplayEvidenceReceiptAuthority(
      bundle([pearsonReceipt(), descriptive]),
      MATCHING_CONTEXT
    );
    const axisRefusal = withDescriptive.resolveAgainst(INFERENTIAL_ID, 'descriptive:x');
    expect(axisRefusal).toEqual({
      status: 'MISSING_REQUIRED_AXIS',
      receiptId: 'descriptive:x',
      axis: 'measurementContextEstablished',
    });
    expect(refusal.status).toBe('UNRESOLVED_ASSUMPTION');

    // Unknown receipt ids stay typed not-found under replay governance.
    expect(authority.resolveAgainst(DESCRIPTIVE_ID, 'missing-receipt')).toEqual({
      status: 'RECEIPT_NOT_FOUND',
      receiptId: 'missing-receipt',
    });
  });

  it('cannot mint from malformed, version-skewed, duplicate or tampered persisted evidence', () => {
    // Structural integrity is a mint precondition: none of these can
    // produce a resolver capability.
    const tamperedProvenance = pearsonReceipt();
    (tamperedProvenance.methodProvenance as Record<string, unknown>).kernelVersion =
      'some-other-kernel';
    const missingAxis = pearsonReceipt();
    delete (missingAxis as Record<string, unknown>).stability;
    for (const payload of [
      null,
      'not-an-object',
      bundle([pearsonReceipt()], { schemaVersion: '2' }),
      bundle([pearsonReceipt()], { schemaVersion: 1 }),
      bundle([pearsonReceipt()], { extraField: true }),
      bundle([pearsonReceipt()], { datasetFingerprint: '' }),
      bundle([pearsonReceipt(), pearsonReceipt()]),
      bundle([tamperedProvenance]),
      bundle([missingAxis]),
    ]) {
      expect(() => governedReplayEvidenceReceiptAuthority(payload, MATCHING_CONTEXT)).toThrow();
    }
  });

  it('cannot mint under an unidentifiable replay context', () => {
    for (const context of [
      null,
      'not-an-object',
      {},
      { datasetFingerprint: GOVERNING_DATASET_FINGERPRINT },
      { datasetFingerprint: '', kernelVersion: GOVERNING_KERNEL_VERSION },
      { datasetFingerprint: GOVERNING_DATASET_FINGERPRINT, kernelVersion: 9 },
      {
        datasetFingerprint: GOVERNING_DATASET_FINGERPRINT,
        kernelVersion: GOVERNING_KERNEL_VERSION,
        extra: true,
      },
    ]) {
      expect(() =>
        governedReplayEvidenceReceiptAuthority(bundle([pearsonReceipt()]), context as never)
      ).toThrow();
    }
  });

  it('pins the contract against real Rust-issued production receipts', () => {
    const handle = bridge.loadDatasetJson({
      name: 'tec1-governed-replay',
      columns: [
        { name: 'x', type: 'NUMERIC' },
        { name: 'y', type: 'NUMERIC' },
      ],
      rows: [
        { x: 1, y: 2 },
        { x: 2, y: 4 },
        { x: null, y: 6 },
      ],
    });
    try {
      const raw = bridge.statisticsEvidenceReceiptBundle(handle);
      const fingerprint = bridge.datasetFingerprint(handle);
      const kernelVersion = bridge.kernelVersion();
      expect(fingerprint).toBeTruthy();
      expect(kernelVersion).toBeTruthy();

      // A serialized production bundle is evidence data; minting the
      // replay capability requires the explicit governed replay context.
      const authority = governedReplayEvidenceReceiptAuthority(raw, {
        datasetFingerprint: fingerprint!,
        kernelVersion: kernelVersion!,
      });
      const pearsonId = authority.receiptIds.find((id) => id.startsWith('pearson:x:y'));
      expect(pearsonId).toBeTruthy();

      // Real Rust-issued receipts resolve under their governing identity...
      const resolved = authority.resolveAgainst(DESCRIPTIVE_ID, pearsonId!);
      expect(resolved.status).toBe('RESOLVED');

      // ...and refuse under identity skew, exactly like the fixtures.
      const skewed = governedReplayEvidenceReceiptAuthority(raw, {
        datasetFingerprint: fingerprint!,
        kernelVersion: 'replay-under-a-different-kernel',
      });
      const kernelRefusal = skewed.resolveAgainst(DESCRIPTIVE_ID, pearsonId!);
      expect(kernelRefusal).toEqual({
        status: 'KERNEL_MISMATCH',
        receiptId: pearsonId,
        expectedKernelVersion: kernelVersion,
        observedKernelVersion: 'replay-under-a-different-kernel',
      });

      const otherDataset = governedReplayEvidenceReceiptAuthority(raw, {
        datasetFingerprint: 'a-different-dataset-fingerprint',
        kernelVersion: kernelVersion!,
      });
      expect(otherDataset.resolveAgainst(DESCRIPTIVE_ID, pearsonId!).status).toBe(
        'DATASET_MISMATCH'
      );
      // The same bundle + context resolves, so the refusal is driven by
      // the replay-context identity, not by the receipt content.
      expect(authority.resolveAgainst(DESCRIPTIVE_ID, pearsonId!).status).toBe('RESOLVED');
    } finally {
      bridge.destroyDataset(handle);
    }
  });
});