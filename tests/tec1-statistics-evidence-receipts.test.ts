import { beforeAll, describe, expect, it } from 'vitest';
import { statisticsEvidenceReceiptAuthority } from '../src/atlas/MonetaEvidenceAuthority.ts';
import { parseEvidenceReceiptBundleV1 } from '../src/data/evidence/EvidenceReceipt.ts';
import {
  DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1,
  INFERENTIAL_CLAIM_REQUIREMENT_PROFILE_V1,
} from '../src/data/evidence/EvidenceRequirementProfile.ts';
import * as bridge from '../src/wasm/RuntimeBridge.ts';
import { encodeTypedColumnsPayload } from '../src/wasm/TypedColumnsCodec.ts';

const RECEIPT_COMPUTATION_INDEX = 12;
const call = (name: string, ...args: number[]) => Number(bridge.call(name, ...args)) >>> 0;

function fixture(): number {
  return bridge.loadDatasetJson({
    name: 'tec1-receipts',
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
}

describe('TEC1 statistics evidence receipt transport', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
  });

  it('transfers one Rust-issued receipt bundle with explicit absent axes', () => {
    const handle = fixture();
    try {
      const before = call('prepared_computation_count', RECEIPT_COMPUTATION_INDEX);
      const raw = bridge.statisticsEvidenceReceiptBundle(handle);
      expect(call('prepared_computation_count', RECEIPT_COMPUTATION_INDEX) - before).toBe(1);
      expect(call('prepared_result_count')).toBe(0);
      expect(call('prepared_result_bytes')).toBe(0);

      const bundle = parseEvidenceReceiptBundleV1(raw);
      expect(bundle.datasetFingerprint).toBe(bridge.datasetFingerprint(handle));
      expect(bundle.kernelVersion).toBe(bridge.kernelVersion());
      const descriptive = bundle.receipts.find((receipt) => receipt.claimId === 'descriptive:x');
      expect(descriptive?.measurementContext).toEqual({ status: 'NOT_ESTABLISHED' });
      expect(descriptive?.uncertainty).toBeNull();
      expect(descriptive?.stability).toBeNull();
      expect(descriptive?.sampleSupport.rowsUsed).toBe(2);
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('mints an immutable live resolver and preserves unresolved assumptions', () => {
    const handle = fixture();
    try {
      const authority = statisticsEvidenceReceiptAuthority(handle);
      expect(Object.isFrozen(authority)).toBe(true);
      expect(Object.isFrozen(authority.receiptIds)).toBe(true);
      const pearsonId = authority.receiptIds.find((id) => id.startsWith('pearson:x:y'));
      expect(pearsonId).toBeTruthy();
      const receipt = authority.resolve(pearsonId!);
      expect(receipt).not.toBeNull();
      expect(Object.isFrozen(receipt)).toBe(true);
      expect(Object.isFrozen(receipt?.assumptions)).toBe(true);
      expect(receipt?.assumptions.some((item) => item.status === 'notTestableFromData')).toBe(true);
      expect(receipt?.uncertainty).toBeNull();
      expect(receipt?.stability).toBeNull();
      expect(authority.resolve('missing-receipt')).toBeNull();
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('revokes resolution when the originating dataset handle is destroyed', () => {
    const handle = fixture();
    const authority = statisticsEvidenceReceiptAuthority(handle);
    const receiptId = authority.receiptIds[0];
    expect(authority.resolve(receiptId)).not.toBeNull();
    bridge.destroyDataset(handle);
    expect(() => authority.resolve(receiptId)).toThrow('stale');
  });

  it('returns typed governed refusals for unmet requirement profiles on live receipts', () => {
    const handle = fixture();
    try {
      const authority = statisticsEvidenceReceiptAuthority(handle);
      const pearsonId = authority.receiptIds.find((id) => id.startsWith('pearson:x:y'));
      const descriptiveId = authority.receiptIds.find((id) => id.startsWith('descriptive:x'));
      expect(pearsonId).toBeTruthy();
      expect(descriptiveId).toBeTruthy();

      // Unknown identity is a typed not-found refusal, not a silent null that
      // downstream code could mistake for an implicit pass.
      expect(
        authority.resolveAgainst(DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1, 'missing-receipt')
      ).toEqual({ status: 'RECEIPT_NOT_FOUND', receiptId: 'missing-receipt' });

      // The inferential profile refuses the live Pearson receipt on its
      // claim-intrinsic unresolved independence assumption: no guessed
      // analytical fact, no fallback interpretation.
      const unresolved = authority.resolveAgainst(
        INFERENTIAL_CLAIM_REQUIREMENT_PROFILE_V1,
        pearsonId!
      );
      expect(unresolved.status).toBe('UNRESOLVED_ASSUMPTION');
      if (unresolved.status === 'UNRESOLVED_ASSUMPTION') {
        expect(unresolved.receiptId).toBe(pearsonId);
        expect(unresolved.assumption).toBe(
          'observation independence for inferential interpretation'
        );
      }

      // The live descriptive receipt carries no violated or unresolved
      // assumptions, so the same inferential profile refuses it on the
      // first missing required axis instead: absence of established
      // measurement context is explicit absence, never a favourable value.
      const missingAxis = authority.resolveAgainst(
        INFERENTIAL_CLAIM_REQUIREMENT_PROFILE_V1,
        descriptiveId!
      );
      expect(missingAxis).toEqual({
        status: 'MISSING_REQUIRED_AXIS',
        receiptId: descriptiveId,
        axis: 'measurementContextEstablished',
      });

      // A profile whose requirements the live receipt does meet resolves to
      // the same immutable Rust-issued receipt object.
      const resolved = authority.resolveAgainst(
        DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1,
        pearsonId!
      );
      expect(resolved.status).toBe('RESOLVED');
      if (resolved.status === 'RESOLVED') {
        expect(resolved.receipt).toBe(authority.resolve(pearsonId!));
        expect(Object.isFrozen(resolved)).toBe(true);
      }

      // No current statistics receipt can satisfy the inferential profile:
      // the production family issues no measured uncertainty, so every
      // inferential requirement check must refuse rather than promote a
      // descriptive quantity into an inferential claim.
      for (const id of authority.receiptIds) {
        const outcome = authority.resolveAgainst(INFERENTIAL_CLAIM_REQUIREMENT_PROFILE_V1, id);
        expect(outcome.status).not.toBe('RESOLVED');
      }
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('rejects caller-forged requirement profiles at the live authority', () => {
    const handle = fixture();
    try {
      const authority = statisticsEvidenceReceiptAuthority(handle);
      const receiptId = authority.receiptIds[0];
      const forged = {
        profileId: 'caller-forged/v1',
        requiredAxes: [],
        assumptionRequirement: { refuseViolated: false, refuseUnresolved: false },
      };
      expect(() =>
        authority.resolveAgainst(
          forged as unknown as typeof DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1,
          receiptId
        )
      ).toThrow('authority-owned');
      // The refusal is fail-closed, not a downgrade: after the forged
      // profile is rejected the authority still resolves governed profiles.
      expect(
        authority.resolveAgainst(DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1, receiptId).status
      ).toBe('RESOLVED');
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('revokes requirement-profile resolution when the dataset handle is destroyed', () => {
    const handle = fixture();
    const authority = statisticsEvidenceReceiptAuthority(handle);
    const receiptId = authority.receiptIds[0];
    expect(
      authority.resolveAgainst(DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1, receiptId).status
    ).toBe('RESOLVED');
    bridge.destroyDataset(handle);
    expect(() =>
      authority.resolveAgainst(DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1, receiptId)
    ).toThrow('stale');
  });

  it('refuses invalid and columnar-only handles without computing evidence', () => {
    const columnar = bridge.loadTypedColumns(
      encodeTypedColumnsPayload({
        rowCount: 2,
        columns: [{ name: 'x', type: 'numeric', values: [1, 2] }],
      }),
      'columnar-only-receipts'
    );
    const before = call('prepared_computation_count', RECEIPT_COMPUTATION_INDEX);
    try {
      expect(bridge.statisticsEvidenceReceiptBundle(0)).toBeNull();
      expect(bridge.statisticsEvidenceReceiptBundle(columnar)).toBeNull();
      expect(call('prepared_computation_count', RECEIPT_COMPUTATION_INDEX)).toBe(before);
      expect(() => statisticsEvidenceReceiptAuthority(columnar)).toThrow();
    } finally {
      bridge.destroyDataset(columnar);
    }
  });
});
